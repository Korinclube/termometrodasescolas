/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { initializeApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  User,
} from 'firebase/auth';
import {
  getFirestore,
  doc,
  collection,
  onSnapshot,
  getDocs,
  getDoc,
  deleteDoc,
  setDoc,
  writeBatch,
  getDocFromServer,
} from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';
import {
  SchoolInspection,
  InspectionRevisionRecord,
  InspectionDraft,
  InspectorProfile,
} from './types';
import { LEGACY_SCHOOL_ID_MAP } from './data/legacySchoolIds';

// Inicialização única do Firebase App
const app = initializeApp(firebaseConfig);

// Instâncias oficiais com ID de banco de dados dedicado
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

export type SyncStatus = 'connecting' | 'synced' | 'offline' | 'permission_denied';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid || null,
      email: auth.currentUser?.email || null,
      emailVerified: auth.currentUser?.emailVerified || null,
      isAnonymous: auth.currentUser?.isAnonymous || false,
      tenantId: auth.currentUser?.tenantId || null,
      providerInfo: auth.currentUser?.providerData?.map((p) => ({
        providerId: p.providerId,
        email: p.email,
      })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error context: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

/**
 * Validação da conexão com o Firestore na inicialização (conforme skill Firebase)
 */
export async function testConnection(): Promise<boolean> {
  try {
    // Tenta consultar a raiz do Firestore no servidor para validar regras e status
    await getDocFromServer(doc(db, 'inspections', 'test_conn'));
    return true;
  } catch (error: any) {
    if (error?.message?.includes('the client is offline')) {
      console.warn('Firestore offline ou em reconexão:', error);
    }
    return false;
  }
}

// Autenticação com Google para editores autorizados
export async function loginWithGoogle(): Promise<User> {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    return result.user;
  } catch (err) {
    console.error('Erro no login com Google:', err);
    throw err;
  }
}

export async function logoutUser(): Promise<void> {
  await signOut(auth);
}

export function subscribeToAuthState(callback: (user: User | null) => void): () => void {
  return onAuthStateChanged(auth, callback);
}

/**
 * Escuta em tempo real todas as vistorias públicas aprovadas salvas no Firestore.
 * Sem expor dados pessoais do inspetor (PII).
 */
export function subscribeToAllInspections(
  onData: (inspectionsMap: Record<string, SchoolInspection>) => void,
  onStatusChange?: (status: SyncStatus) => void,
  onError?: (err: Error) => void
): () => void {
  const collectionPath = 'inspections';

  if (onStatusChange) onStatusChange('connecting');

  const unsubscribe = onSnapshot(
    collection(db, collectionPath),
    (snapshot) => {
      const directMap: Record<string, SchoolInspection> = {};
      const legacyCandidateMap: Record<string, SchoolInspection> = {};

      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        const docId = docSnap.id;
        const targetSchoolId = data?.schoolId || docId;

        if (targetSchoolId) {
          const inspectionObj: SchoolInspection = {
            inspectedAt: data.inspectedAt || '',
            // O nome pessoal não é público no documento raiz por privacidade LGPD; exibimos o papel institucional
            inspectorName: data.inspectorRole ? `Inspetor credenciado (${data.inspectorRole})` : 'Equipe Técnica',
            inspectorRole: data.inspectorRole || 'professor',
            realAcStatus: data.realAcStatus || 'desconhecido',
            acNotes: data.acNotes || '',
            roofType: data.roofType || 'outro_desconhecido',
            ventilationType: data.ventilationType || 'desconhecido',
            waterAccess: data.waterAccess || 'desconhecido',
            electricalOverloadReported: Boolean(data.electricalOverloadReported),
            cableTheftReported: Boolean(data.cableTheftReported),
            acType: data.acType,
            windowsOperable: data.windowsOperable,
            windowsClosedWhenAcOn: data.windowsClosedWhenAcOn,
            pmocStatus: data.pmocStatus,
            lastFilterCleaning: data.lastFilterCleaning,
            moldOrDampSigns: data.moldOrDampSigns !== undefined ? Boolean(data.moldOrDampSigns) : undefined,
            nearbyPollutionSource: data.nearbyPollutionSource,
            roomDimensions: data.roomDimensions,
            notes: data.notes || '',
            version: data.version || 1,
            status: data.status || 'published',
            source: data.source || 'vistoria_in_loco',
            approvedAt: data.approvedAt || data.updatedAt || '',
            currentRevisionId: data.currentRevisionId || '',
          };

          directMap[targetSchoolId] = inspectionObj;

          if (LEGACY_SCHOOL_ID_MAP[targetSchoolId]) {
            const mappedNewId = LEGACY_SCHOOL_ID_MAP[targetSchoolId];
            legacyCandidateMap[mappedNewId] = {
              ...inspectionObj,
              legacySchoolId: targetSchoolId,
            };
          }
        }
      });

      // Prioridade: se houver documento com ID novo, ele prevalece sobre o legado mapeado
      const finalMap: Record<string, SchoolInspection> = {
        ...legacyCandidateMap,
        ...directMap,
      };

      if (onStatusChange) onStatusChange('synced');
      onData(finalMap);
    },
    (error: any) => {
      console.warn('Erro na subscrição onSnapshot do Firestore:', error);
      const isPermissionDenied =
        error?.code === 'permission-denied' ||
        (error?.message && error.message.includes('insufficient permissions'));

      if (onStatusChange) {
        onStatusChange(isPermissionDenied ? 'permission_denied' : 'offline');
      }
      if (onError) onError(error);
    }
  );

  return unsubscribe;
}

/**
 * Salva a vistoria com versionamento atômico e separação estrita de PII:
 * 1. Documento público de síntese: /inspections/{schoolId}
 * 2. Revisão técnica imutável pública: /inspections/{schoolId}/revisions/{revisionId}
 * 3. Dados pessoais restritos (PII): /inspections/{schoolId}/private/{revisionId}
 */
export async function saveInspectionWithRevision(
  schoolId: string,
  inspection: SchoolInspection,
  inspectorPersonal: {
    fullName: string;
    email: string;
  },
  previousVersion: number = 0
): Promise<string> {
  const user = auth.currentUser;
  if (!user) {
    throw new Error('Apenas usuários autenticados com Google podem registrar vistorias.');
  }

  const revisionId = `rev_${Date.now()}`;
  const nowIso = new Date().toISOString();
  const nextVersion = previousVersion + 1;

  const batch = writeBatch(db);

  // 1. Dados públicos de infraestrutura física
  const publicDocRef = doc(db, 'inspections', schoolId);
  const publicPayload: Record<string, any> = {
    schoolId,
    status: 'published',
    version: nextVersion,
    source: 'vistoria_in_loco',
    inspectedAt: inspection.inspectedAt,
    approvedAt: nowIso,
    inspectorRole: inspection.inspectorRole,
    realAcStatus: inspection.realAcStatus,
    roofType: inspection.roofType,
    ventilationType: inspection.ventilationType,
    waterAccess: inspection.waterAccess,
    acNotes: inspection.acNotes || '',
    electricalOverloadReported: Boolean(inspection.electricalOverloadReported),
    cableTheftReported: Boolean(inspection.cableTheftReported),
    notes: inspection.notes || '',
    currentRevisionId: revisionId,
    updatedAt: nowIso,
  };

  if (inspection.acType) publicPayload.acType = inspection.acType;
  if (inspection.windowsOperable) publicPayload.windowsOperable = inspection.windowsOperable;
  if (inspection.windowsClosedWhenAcOn) publicPayload.windowsClosedWhenAcOn = inspection.windowsClosedWhenAcOn;
  if (inspection.pmocStatus) publicPayload.pmocStatus = inspection.pmocStatus;
  if (inspection.lastFilterCleaning) publicPayload.lastFilterCleaning = inspection.lastFilterCleaning;
  if (inspection.moldOrDampSigns !== undefined) publicPayload.moldOrDampSigns = Boolean(inspection.moldOrDampSigns);
  if (inspection.nearbyPollutionSource) publicPayload.nearbyPollutionSource = inspection.nearbyPollutionSource;
  if (inspection.roomDimensions) publicPayload.roomDimensions = inspection.roomDimensions;

  batch.set(publicDocRef, publicPayload, { merge: true });

  // 2. Histórico técnico público imutável (revisão)
  const revisionDocRef = doc(db, 'inspections', schoolId, 'revisions', revisionId);
  const revisionPayload: Record<string, any> = {
    revisionId,
    schoolId,
    inspectedAt: inspection.inspectedAt,
    inspectorRole: inspection.inspectorRole,
    realAcStatus: inspection.realAcStatus,
    roofType: inspection.roofType,
    ventilationType: inspection.ventilationType,
    waterAccess: inspection.waterAccess,
    acNotes: inspection.acNotes || '',
    notes: inspection.notes || '',
    createdAt: nowIso,
  };

  if (inspection.acType) revisionPayload.acType = inspection.acType;
  if (inspection.windowsOperable) revisionPayload.windowsOperable = inspection.windowsOperable;
  if (inspection.windowsClosedWhenAcOn) revisionPayload.windowsClosedWhenAcOn = inspection.windowsClosedWhenAcOn;
  if (inspection.pmocStatus) revisionPayload.pmocStatus = inspection.pmocStatus;
  if (inspection.lastFilterCleaning) revisionPayload.lastFilterCleaning = inspection.lastFilterCleaning;
  if (inspection.moldOrDampSigns !== undefined) revisionPayload.moldOrDampSigns = Boolean(inspection.moldOrDampSigns);
  if (inspection.nearbyPollutionSource) revisionPayload.nearbyPollutionSource = inspection.nearbyPollutionSource;
  if (inspection.roomDimensions) revisionPayload.roomDimensions = inspection.roomDimensions;

  batch.set(revisionDocRef, revisionPayload);

  // 3. Subcoleção privada restrita com dados pessoais do inspetor (PII)
  const privateDocRef = doc(db, 'inspections', schoolId, 'private', revisionId);
  const privatePayload = {
    revisionId,
    authorUid: user.uid,
    inspectorName: inspectorPersonal.fullName || user.displayName || 'Inspetor',
    inspectorEmail: inspectorPersonal.email || user.email || '',
    inspectorRole: inspection.inspectorRole,
    submittedAt: nowIso,
  };
  batch.set(privateDocRef, privatePayload);

  try {
    await batch.commit();
    return revisionId;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `inspections/${schoolId}`);
  }
}

/**
 * Consulta o histórico público de revisões técnicas de uma escola
 */
export async function fetchSchoolTechnicalRevisions(
  schoolId: string
): Promise<InspectionRevisionRecord[]> {
  try {
    let revsSnapshot = await getDocs(collection(db, 'inspections', schoolId, 'revisions'));
    let list: InspectionRevisionRecord[] = [];
    revsSnapshot.forEach((d) => list.push(d.data() as InspectionRevisionRecord));

    // Se estiver vazio e for um ID novo, verifica se há revisões registradas no ID legado correspondente
    if (list.length === 0) {
      const legacyEntry = Object.entries(LEGACY_SCHOOL_ID_MAP).find(([, newId]) => newId === schoolId);
      if (legacyEntry) {
        const legacyId = legacyEntry[0];
        const legacyRevsSnapshot = await getDocs(collection(db, 'inspections', legacyId, 'revisions'));
        legacyRevsSnapshot.forEach((d) => list.push(d.data() as InspectionRevisionRecord));
      }
    }

    return list.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
  } catch (err) {
    console.warn(`Não foi possível carregar revisões de ${schoolId}:`, err);
    return [];
  }
}

/**
 * Salva rascunho de vistoria em elaboração (/inspectionDrafts/{draftId})
 */
export async function saveInspectionDraft(
  schoolId: string,
  inspectionData: Partial<SchoolInspection>
): Promise<string> {
  const user = auth.currentUser;
  if (!user) {
    throw new Error('Apenas usuários autenticados podem salvar rascunhos.');
  }

  const draftId = `draft_${schoolId}_${user.uid}`;
  const nowIso = new Date().toISOString();

  const draftPayload: InspectionDraft = {
    draftId,
    schoolId,
    authorUid: user.uid,
    authorEmail: user.email || '',
    status: 'draft',
    inspectionData,
    updatedAt: nowIso,
  };

  try {
    await setDoc(doc(db, 'inspectionDrafts', draftId), draftPayload);
    return draftId;
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `inspectionDrafts/${draftId}`);
  }
}

/**
 * Busca rascunho existente para a escola pelo usuário atual
 */
export async function fetchInspectionDraft(schoolId: string): Promise<InspectionDraft | null> {
  const user = auth.currentUser;
  if (!user) return null;

  const draftId = `draft_${schoolId}_${user.uid}`;
  try {
    const snap = await getDoc(doc(db, 'inspectionDrafts', draftId));
    if (snap.exists()) {
      return snap.data() as InspectionDraft;
    }

    // Se não encontrou pelo ID atual, verifica rascunho no ID legado correspondente
    const legacyEntry = Object.entries(LEGACY_SCHOOL_ID_MAP).find(([, newId]) => newId === schoolId);
    if (legacyEntry) {
      const legacyDraftId = `draft_${legacyEntry[0]}_${user.uid}`;
      const legacySnap = await getDoc(doc(db, 'inspectionDrafts', legacyDraftId));
      if (legacySnap.exists()) {
        return legacySnap.data() as InspectionDraft;
      }
    }

    return null;
  } catch (err) {
    console.warn('Erro ao buscar rascunho:', err);
    return null;
  }
}

/**
 * Exclui rascunho após publicação
 */
export async function deleteInspectionDraft(schoolId: string): Promise<void> {
  const user = auth.currentUser;
  if (!user) return;

  const draftId = `draft_${schoolId}_${user.uid}`;
  try {
    await deleteDoc(doc(db, 'inspectionDrafts', draftId));
  } catch (err) {
    console.warn('Erro ao excluir rascunho:', err);
  }
}

/**
 * Consulta perfil do inspetor em /inspectors/{uid}
 */
export async function fetchInspectorProfile(uid: string): Promise<InspectorProfile | null> {
  try {
    const snap = await getDoc(doc(db, 'inspectors', uid));
    if (snap.exists()) {
      return snap.data() as InspectorProfile;
    }
    return null;
  } catch (err) {
    console.warn('Erro ao consultar perfil de inspetor:', err);
    return null;
  }
}
