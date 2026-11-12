/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  SchoolRecord,
  SchoolInspection,
  RealAcStatus,
  RoofType,
  VentilationType,
  WaterAccessType,
  InspectionRevisionRecord,
  WeatherObservationStation,
} from '../types';
import {
  Building2,
  ShieldAlert,
  CheckCircle2,
  AlertTriangle,
  Thermometer,
  UserCheck,
  Save,
  FileEdit,
  HelpCircle,
  History,
  LogIn,
  Lock,
  FileText,
  Wind,
} from 'lucide-react';
import { calculateDecoupledRiskEvaluation } from '../utils/thermalMath';
import { schoolAirEstimate } from '../utils/airQualityMath';
import { DataProvenanceBadge } from './DataProvenanceBadge';
import {
  formatIntegerPtBr,
  formatNumberPtBr,
  formatPercentIntPtBr,
  formatTempPtBr,
} from '../utils/formatPtBr';
import { getInmetStateLabel } from '../utils/inmetUtils';
import {
  fetchSchoolTechnicalRevisions,
  saveInspectionDraft,
  fetchInspectionDraft,
  deleteInspectionDraft,
} from '../firebase';
import { User } from 'firebase/auth';

interface SchoolDetailProps {
  school: SchoolRecord;
  nearestStation?: WeatherObservationStation;
  onUpdateInspection: (
    schoolId: string,
    inspection: SchoolInspection,
    personal: { fullName: string; email: string },
    previousVersion?: number
  ) => Promise<void>;
  maxForecastHeatIndex: number;
  onNavigateToBulletins: () => void;
  onNavigateToMonitoring?: () => void;
  currentUser: User | null;
  onLogin: () => void;
}

export const SchoolDetail: React.FC<SchoolDetailProps> = ({
  school,
  nearestStation,
  onUpdateInspection,
  maxForecastHeatIndex,
  onNavigateToBulletins,
  onNavigateToMonitoring,
  currentUser,
  onLogin,
}) => {
  const [isEditingInspection, setIsEditingInspection] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [revisions, setRevisions] = useState<InspectionRevisionRecord[]>([]);
  const [isLoadingRevisions, setIsLoadingRevisions] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isSavingDraft, setIsSavingDraft] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // Estado do formulário de inspeção
  const [realAcStatus, setRealAcStatus] = useState<RealAcStatus>(
    school.inspection?.realAcStatus || 'desconhecido'
  );
  const [acNotes, setAcNotes] = useState(school.inspection?.acNotes || '');
  const [roofType, setRoofType] = useState<RoofType>(
    school.inspection?.roofType || 'outro_desconhecido'
  );
  const [ventilationType, setVentilationType] = useState<VentilationType>(
    school.inspection?.ventilationType || 'desconhecido'
  );
  const [waterAccess, setWaterAccess] = useState<WaterAccessType>(
    school.inspection?.waterAccess || 'desconhecido'
  );
  const [electricalOverload, setElectricalOverload] = useState(
    school.inspection?.electricalOverloadReported || false
  );
  const [cableTheft, setCableTheft] = useState(
    school.inspection?.cableTheftReported || false
  );

  // Novos campos opcionais "Ar da sala" (Parte 6)
  const [acType, setAcType] = useState<NonNullable<SchoolInspection['acType']>>(
    school.inspection?.acType || 'desconhecido'
  );
  const [windowsOperable, setWindowsOperable] = useState<NonNullable<SchoolInspection['windowsOperable']>>(
    school.inspection?.windowsOperable || 'desconhecido'
  );
  const [windowsClosedWhenAcOn, setWindowsClosedWhenAcOn] = useState<NonNullable<SchoolInspection['windowsClosedWhenAcOn']>>(
    school.inspection?.windowsClosedWhenAcOn || 'desconhecido'
  );
  const [pmocStatus, setPmocStatus] = useState<NonNullable<SchoolInspection['pmocStatus']>>(
    school.inspection?.pmocStatus || 'desconhecido'
  );
  const [lastFilterCleaning, setLastFilterCleaning] = useState<string>(
    school.inspection?.lastFilterCleaning || ''
  );
  const [moldOrDampSigns, setMoldOrDampSigns] = useState<boolean>(
    school.inspection?.moldOrDampSigns || false
  );
  const [nearbyPollutionSource, setNearbyPollutionSource] = useState<NonNullable<SchoolInspection['nearbyPollutionSource']>>(
    school.inspection?.nearbyPollutionSource || 'desconhecido'
  );
  const [roomLengthM, setRoomLengthM] = useState<string>(
    school.inspection?.roomDimensions?.lengthM ? String(school.inspection.roomDimensions.lengthM) : ''
  );
  const [roomWidthM, setRoomWidthM] = useState<string>(
    school.inspection?.roomDimensions?.widthM ? String(school.inspection.roomDimensions.widthM) : ''
  );
  const [roomHeightM, setRoomHeightM] = useState<string>(
    school.inspection?.roomDimensions?.heightM ? String(school.inspection.roomDimensions.heightM) : ''
  );

  const [inspectorName, setInspectorName] = useState(currentUser?.displayName || '');
  const [inspectorEmail, setInspectorEmail] = useState(currentUser?.email || '');
  const [inspectorRole, setInspectorRole] = useState(
    school.inspection?.inspectorRole || 'professor'
  );
  const [notes, setNotes] = useState(school.inspection?.notes || '');

  // Sincroniza estado ao trocar de escola ou atualizar vistoria
  useEffect(() => {
    setRealAcStatus(school.inspection?.realAcStatus || 'desconhecido');
    setAcNotes(school.inspection?.acNotes || '');
    setRoofType(school.inspection?.roofType || 'outro_desconhecido');
    setVentilationType(school.inspection?.ventilationType || 'desconhecido');
    setWaterAccess(school.inspection?.waterAccess || 'desconhecido');
    setElectricalOverload(school.inspection?.electricalOverloadReported || false);
    setCableTheft(school.inspection?.cableTheftReported || false);
    setAcType(school.inspection?.acType || 'desconhecido');
    setWindowsOperable(school.inspection?.windowsOperable || 'desconhecido');
    setWindowsClosedWhenAcOn(school.inspection?.windowsClosedWhenAcOn || 'desconhecido');
    setPmocStatus(school.inspection?.pmocStatus || 'desconhecido');
    setLastFilterCleaning(school.inspection?.lastFilterCleaning || '');
    setMoldOrDampSigns(school.inspection?.moldOrDampSigns || false);
    setNearbyPollutionSource(school.inspection?.nearbyPollutionSource || 'desconhecido');
    setRoomLengthM(school.inspection?.roomDimensions?.lengthM ? String(school.inspection.roomDimensions.lengthM) : '');
    setRoomWidthM(school.inspection?.roomDimensions?.widthM ? String(school.inspection.roomDimensions.widthM) : '');
    setRoomHeightM(school.inspection?.roomDimensions?.heightM ? String(school.inspection.roomDimensions.heightM) : '');
    setInspectorRole(school.inspection?.inspectorRole || 'professor');
    setNotes(school.inspection?.notes || '');
  }, [school.id, school.inspection]);

  // Preenche dados do usuário autenticado e recupera rascunho
  useEffect(() => {
    if (currentUser) {
      if (!inspectorName && currentUser.displayName) setInspectorName(currentUser.displayName);
      if (!inspectorEmail && currentUser.email) setInspectorEmail(currentUser.email);

      fetchInspectionDraft(school.id).then((draft) => {
        if (draft && draft.inspectionData) {
          const d = draft.inspectionData;
          if (d.realAcStatus) setRealAcStatus(d.realAcStatus);
          if (d.roofType) setRoofType(d.roofType);
          if (d.ventilationType) setVentilationType(d.ventilationType);
          if (d.waterAccess) setWaterAccess(d.waterAccess);
          if (d.acNotes !== undefined) setAcNotes(d.acNotes);
          if (d.notes !== undefined) setNotes(d.notes);
          if (d.electricalOverloadReported !== undefined) setElectricalOverload(d.electricalOverloadReported);
          if (d.cableTheftReported !== undefined) setCableTheft(d.cableTheftReported);
          if (d.acType) setAcType(d.acType);
          if (d.windowsOperable) setWindowsOperable(d.windowsOperable);
          if (d.windowsClosedWhenAcOn) setWindowsClosedWhenAcOn(d.windowsClosedWhenAcOn);
          if (d.pmocStatus) setPmocStatus(d.pmocStatus);
          if (d.lastFilterCleaning !== undefined) setLastFilterCleaning(d.lastFilterCleaning);
          if (d.moldOrDampSigns !== undefined) setMoldOrDampSigns(d.moldOrDampSigns);
          if (d.nearbyPollutionSource) setNearbyPollutionSource(d.nearbyPollutionSource);
          if (d.roomDimensions) {
            setRoomLengthM(String(d.roomDimensions.lengthM));
            setRoomWidthM(String(d.roomDimensions.widthM));
            setRoomHeightM(String(d.roomDimensions.heightM));
          }
          setStatusMessage('Rascunho recuperado da sua última sessão.');
        }
      });
    }
  }, [currentUser, school.id]);

  // Carrega histórico técnico de revisões ao alternar
  useEffect(() => {
    if (showHistory) {
      setIsLoadingRevisions(true);
      fetchSchoolTechnicalRevisions(school.id).then((data) => {
        setRevisions(data);
        setIsLoadingRevisions(false);
      });
    }
  }, [showHistory, school.id]);

  const buildAirFields = (): { error?: string; fields: Partial<SchoolInspection> } => {
    const fields: Partial<SchoolInspection> = {
      acType,
      windowsOperable,
      windowsClosedWhenAcOn,
      pmocStatus,
      moldOrDampSigns,
      nearbyPollutionSource,
    };

    const trimmedCleaning = lastFilterCleaning.trim();
    if (trimmedCleaning) {
      if (!/^[0-9]{4}-[0-9]{2}$/.test(trimmedCleaning)) {
        return { error: 'A data da última limpeza de filtros deve estar no formato AAAA-MM (ex.: 2026-08).', fields };
      }
      fields.lastFilterCleaning = trimmedCleaning;
    }

    const hasAnyDim = roomLengthM.trim() !== '' || roomWidthM.trim() !== '' || roomHeightM.trim() !== '';
    if (hasAnyDim) {
      const l = parseFloat(roomLengthM.replace(',', '.'));
      const w = parseFloat(roomWidthM.replace(',', '.'));
      const h = parseFloat(roomHeightM.replace(',', '.'));
      if (
        Number.isNaN(l) || Number.isNaN(w) || Number.isNaN(h) ||
        l < 1 || l > 30 || w < 1 || w > 30 || h < 2 || h > 8
      ) {
        return {
          error: 'Dimensões da sala inválidas: comprimento e largura entre 1 e 30 m; pé-direito entre 2 e 8 m.',
          fields,
        };
      }
      fields.roomDimensions = { lengthM: l, widthM: w, heightM: h };
    }

    return { fields };
  };

  // Salva rascunho antes da aprovação final
  const handleSaveDraft = async () => {
    if (!currentUser) {
      setStatusMessage('Você precisa entrar com sua conta Google para salvar um rascunho.');
      onLogin();
      return;
    }

    const { error, fields } = buildAirFields();
    if (error) {
      setStatusMessage(error);
      return;
    }

    setIsSavingDraft(true);
    setStatusMessage(null);

    const draftData: Partial<SchoolInspection> = {
      inspectedAt: new Date().toISOString().split('T')[0],
      inspectorRole,
      realAcStatus,
      acNotes: acNotes.trim(),
      roofType,
      ventilationType,
      waterAccess,
      electricalOverloadReported: electricalOverload,
      cableTheftReported: cableTheft,
      notes: notes.trim(),
      ...fields,
    };

    try {
      await saveInspectionDraft(school.id, draftData);
      setStatusMessage('Rascunho salvo com sucesso em /inspectionDrafts!');
      setTimeout(() => setStatusMessage(null), 5000);
    } catch (err: any) {
      setStatusMessage(`Erro ao salvar rascunho: ${err.message}`);
    } finally {
      setIsSavingDraft(false);
    }
  };

  // Publicação final da vistoria com revisão atômica no Firestore
  const handlePublishInspection = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!currentUser) {
      setStatusMessage('Você precisa entrar com sua conta Google para publicar uma vistoria.');
      onLogin();
      return;
    }

    const { error, fields } = buildAirFields();
    if (error) {
      setStatusMessage(error);
      return;
    }

    setIsSaving(true);
    setStatusMessage(null);

    const technicalData: SchoolInspection = {
      inspectedAt: new Date().toISOString().split('T')[0],
      inspectorName: `Inspetor credenciado (${inspectorRole})`,
      inspectorRole,
      realAcStatus,
      acNotes: acNotes.trim(),
      roofType,
      ventilationType,
      waterAccess,
      electricalOverloadReported: electricalOverload,
      cableTheftReported: cableTheft,
      notes: notes.trim(),
      ...fields,
      version: (school.inspection?.version || 0) + 1,
      status: 'published',
      source: 'vistoria_in_loco',
    };

    const personalData = {
      fullName: inspectorName.trim() || currentUser.displayName || 'Inspetor',
      email: inspectorEmail.trim() || currentUser.email || '',
    };

    try {
      await onUpdateInspection(
        school.id,
        technicalData,
        personalData,
        school.inspection?.version || 0
      );
      await deleteInspectionDraft(school.id);
      setStatusMessage('Vistoria homologada e publicada com sucesso em /inspections!');
      setIsEditingInspection(false);
      setTimeout(() => setStatusMessage(null), 6000);
    } catch (err: any) {
      setStatusMessage(`Erro ao publicar no Firestore: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const airEstimate = schoolAirEstimate(school, school.inspection);

  const formatPmocLabel = (status?: string) => {
    if (status === 'visto_documento') return 'documento visto na vistoria';
    if (status === 'informado_sem_documento') return 'informado sem documento';
    if (status === 'nao_tem') return 'não tem';
    return 'não verificado';
  };

  // Avaliação desacoplada: Exposição (clima) vs. Vulnerabilidade (infraestrutura)
  const decoupledEval = calculateDecoupledRiskEvaluation(
    school,
    maxForecastHeatIndex,
    school.inspection
  );

  // Status da Vistoria
  const isAudited = Boolean(school.inspection);
  let inspectionStatusLabel = 'Não Vistoriada (Apenas Censo)';
  let inspectionStatusBadge = 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300';

  if (isAudited && school.inspection) {
    const inspectTime = new Date(school.inspection.inspectedAt).getTime();
    const diffDays = Math.max(0, (new Date().getTime() - inspectTime) / (1000 * 3600 * 24));
    if (diffDays > 120) {
      inspectionStatusLabel = `Vistoria Desatualizada (${school.inspection.inspectedAt})`;
      inspectionStatusBadge = 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/30';
    } else {
      inspectionStatusLabel = `Vistoria de Campo (Exemplo) v${school.inspection.version || 1} (${school.inspection.inspectedAt})`;
      inspectionStatusBadge = 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30';
    }
  }

  return (
    <div className="space-y-6">
      {/* 0. Barra de Procedência de Dados da Ficha Escolar */}
      <DataProvenanceBadge
        provenance={{
          source: 'Censo Escolar 2025 (Inep), declarado pela escola',
          timestamp: `Ano-base ${school.dataReferenceYear} (Cadastro Oficial)`,
          location: `${school.name} · ${school.borough} (${school.region})`,
          nature: 'observacao',
          natureDescription: 'Registro oficial declarado pela própria escola ao Inep. Salas climatizadas no Censo não garantem aparelhos funcionando.',
        }}
        variant="bar"
      />

      {/* Mensagem de Feedback */}
      {statusMessage && (
        <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-800 dark:text-emerald-300 p-3 rounded-xl text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{statusMessage}</span>
        </div>
      )}

      {/* 1. Cabeçalho Principal da Escola */}
      <div className="bg-white dark:bg-slate-900 rounded-xl p-6 border border-slate-200 dark:border-slate-800 shadow-xs">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-bold px-2 py-0.5 rounded-sm bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                {school.network === 'municipal' ? 'SME-Rio (Municipal)' : 'SEEDUC-RJ (Estadual)'}
              </span>
              <span className={`text-xs font-bold px-2 py-0.5 rounded-sm ${inspectionStatusBadge}`}>
                {inspectionStatusLabel}
              </span>
              {school.isSentinel && (
                <span className="text-xs font-bold px-2 py-0.5 rounded-sm bg-purple-500/10 text-purple-700 dark:text-purple-300 border border-purple-500/30">
                  Escola-Sentinela
                </span>
              )}
              {school.isDemo && (
                <span className="text-xs font-bold px-2 py-0.5 rounded-sm bg-amber-500/20 text-amber-800 dark:text-amber-300 border border-amber-500/40">
                  Exemplo Fictício
                </span>
              )}
              <span className="text-xs font-mono text-slate-500">INEP: {school.inepCode}</span>
            </div>

            <h2 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight pt-1">
              {school.name}
            </h2>
            <p className="text-xs text-slate-600 dark:text-slate-400">
              {school.address} · {school.borough} ({school.region})
            </p>
            {school.officialName && school.officialName !== school.name && (
              <p className="text-[11px] text-slate-400 font-mono">
                Nome oficial Censo: {school.officialName}
              </p>
            )}
            {nearestStation && (
              <div className="flex flex-wrap items-center gap-2 pt-1 text-xs text-[var(--text-secondary)]">
                <span>
                  Estação INMET mais próxima:{' '}
                  <strong className="font-semibold text-[var(--text-primary)]">
                    {nearestStation.name}
                  </strong>
                  {Number.isFinite(nearestStation.distanceKm)
                    ? ` (${formatNumberPtBr(nearestStation.distanceKm!)} km)`
                    : ''}
                </span>
                <span className="inline-flex items-center px-2 py-0.5 rounded-[var(--radius-control)] border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] text-[11px] font-semibold text-[var(--text-secondary)]">
                  {getInmetStateLabel(nearestStation)}
                </span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onNavigateToBulletins}
              className="px-4 py-2 bg-slate-900 text-white dark:bg-amber-500 dark:text-slate-950 font-bold rounded-lg text-xs hover:bg-slate-800 transition-colors cursor-pointer"
            >
              Gerar Boletim & Parecer IA
            </button>
          </div>
        </div>

        {/* Resumo Rápido de Cadastrais e Turnos */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-6 border-t border-slate-100 dark:border-slate-800 text-xs">
          <div>
            <span className="text-slate-500 block">Matrículas Ativas:</span>
            <strong className="font-mono text-slate-900 dark:text-white text-base">
              {formatIntegerPtBr(school.totalStudents)} alunos
            </strong>
            {school.nightEnrollment > 0 && (
              <span className="block text-[11px] text-amber-600 dark:text-amber-400">
                Tem turma noturna ({formatIntegerPtBr(school.nightEnrollment)} matrículas)
              </span>
            )}
          </div>

          <div>
            <span className="text-slate-500 block">Turnos Escolares:</span>
            <strong className="font-mono text-slate-900 dark:text-white">
              {school.shiftsInformed && school.shifts && school.shifts.length > 0
                ? school.shifts.join(', ')
                : 'Turnos não informados no Censo (a confirmar com a escola)'}
            </strong>
          </div>

          <div>
            <span className="text-slate-500 block">Salas Climatizadas (Censo):</span>
            <strong className="font-mono text-slate-900 dark:text-white text-base">
              {school.declaredClimatizedRooms} / {school.totalRooms}
            </strong>
          </div>

          <div>
            <span className="text-slate-500 block">Prioridade Preventiva Integrada:</span>
            <strong
              className={`font-mono text-base uppercase font-bold ${
                decoupledEval.combinedPriority === 'muito_alta'
                  ? 'text-rose-600 dark:text-rose-400'
                  : decoupledEval.combinedPriority === 'alta'
                  ? 'text-orange-600 dark:text-orange-400'
                  : decoupledEval.combinedPriority === 'moderada'
                  ? 'text-amber-600 dark:text-amber-400'
                  : 'text-emerald-600 dark:text-emerald-400'
              }`}
            >
              {decoupledEval.combinedPriority.replace('_', ' ')}
            </strong>
          </div>
        </div>

        {/* Histórico de Climatização e Matrículas por Etapa */}
        {(school.climatizationHistory?.length > 0 || school.enrollmentByStage) && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4 pt-4 border-t border-slate-100 dark:border-slate-800/80 text-xs text-slate-600 dark:text-slate-400">
            {school.climatizationHistory && school.climatizationHistory.length > 0 && (
              <div>
                <span className="text-slate-500 block font-medium mb-1">Evolução de Salas Climatizadas (Censo Inep):</span>
                <span className="font-mono text-slate-900 dark:text-slate-200">
                  {school.climatizationHistory
                    .map((h) => `${h.year}: ${h.climatizedRooms} de ${h.roomsInUse}`)
                    .join(' · ')}
                </span>
              </div>
            )}

            {school.enrollmentByStage && (
              <div>
                <span className="text-slate-500 block font-medium mb-1">Matrículas por Etapa:</span>
                <span className="font-mono text-slate-900 dark:text-slate-200">
                  {[
                    school.enrollmentByStage.infantil > 0 ? `Infantil: ${formatIntegerPtBr(school.enrollmentByStage.infantil)}` : null,
                    school.enrollmentByStage.fundamental_1 > 0 ? `Fund. 1: ${formatIntegerPtBr(school.enrollmentByStage.fundamental_1)}` : null,
                    school.enrollmentByStage.fundamental_2 > 0 ? `Fund. 2: ${formatIntegerPtBr(school.enrollmentByStage.fundamental_2)}` : null,
                    school.enrollmentByStage.medio > 0 ? `Médio: ${formatIntegerPtBr(school.enrollmentByStage.medio)}` : null,
                    school.enrollmentByStage.eja > 0 ? `EJA: ${formatIntegerPtBr(school.enrollmentByStage.eja)}` : null,
                  ]
                    .filter(Boolean)
                    .join(' · ') || 'Sem detalhamento por etapa'}
                </span>
              </div>
            )}

            {/* Bloco: Ilha de calor de superfície */}
            <div className="md:col-span-2 pt-3 border-t border-slate-100 dark:border-slate-800 space-y-2">
              <span className="text-slate-500 block font-medium">Ilha de calor de superfície:</span>
              {school.heatIslandFactorLST === null ? (
                <div className="text-slate-400 italic text-xs">
                  Pendente: cálculo por satélite ainda não importado
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-xs text-slate-700 dark:text-slate-300">
                    <div>
                      Anomalia metropolitana:{' '}
                      <strong className={school.heatIslandFactorLST >= 0 ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'}>
                        {formatTempPtBr(school.heatIslandFactorLST, { signed: true })}
                      </strong>
                    </div>
                    {school.heatIsland?.lstC !== undefined && school.heatIsland.lstC !== null && (
                      <div>
                        Temperatura mediana de superfície:{' '}
                        <strong>{formatTempPtBr(school.heatIsland.lstC)}</strong>
                      </div>
                    )}
                    {school.greenCoveragePercent !== null && (
                      <div>
                        Árvores no raio de 200 m:{' '}
                        <strong>{formatPercentIntPtBr(school.greenCoveragePercent)}</strong>
                      </div>
                    )}
                  </div>

                  <DataProvenanceBadge
                    provenance={{
                      source: 'Landsat 8/9 (USGS) e ESA WorldCover, via Google Earth Engine',
                      timestamp: school.heatIsland?.period || 'Verões de 2021/22 a 2025/26',
                      location: `${school.name} (Raio 200m)`,
                      nature: 'observacao',
                      natureDescription:
                        'Temperatura de superfície medida por satélite por volta das 10h. Compara lugares; não é a temperatura do ar dentro da sala.',
                    }}
                    variant="inline"
                  />

                  {school.heatIsland?.quality === 'poucas_observacoes' && (
                    <p className="text-amber-600 dark:text-amber-400 font-semibold text-[10px]">
                      Poucas imagens sem nuvem: valor frágil
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Bloco Parte 3: Ar dentro da sala (estimativa, sem sensor) */}
            <div className="md:col-span-2 pt-3 border-t border-slate-100 dark:border-slate-800 space-y-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-slate-700 dark:text-slate-200 font-bold flex items-center gap-1.5">
                  <Wind className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" />
                  Ar dentro da sala (estimativa, sem sensor)
                </span>
                <DataProvenanceBadge
                  provenance={{
                    source: 'Censo Escolar 2024, turmas · ABNT NBR 17037',
                    timestamp:
                      airEstimate.status === 'disponivel' && airEstimate.roomVolumeM3 !== undefined
                        ? `Sala de ${formatNumberPtBr(airEstimate.roomVolumeM3, {
                            decimals: Number.isInteger(airEstimate.roomVolumeM3) ? 0 : 1,
                          })} m³`
                        : 'Aguardando turmas',
                    location: `${school.name} (Estimativa de Modelo)`,
                    nature: 'estimativa',
                    natureDescription: 'Calculado por modelo a partir de dados públicos. Não é medição.',
                  }}
                  variant="inline"
                />
              </div>

              {airEstimate.status === 'pendente' ? (
                <div className="text-slate-400 italic text-xs">
                  Estimativa pendente: turmas desta escola não carregadas
                </div>
              ) : (
                <div className="space-y-2 text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                  <p>
                    Turma média no turno da <strong>{airEstimate.shiftLabel}</strong>:{' '}
                    <strong className="font-mono">{airEstimate.students} alunos</strong> (maior turma:{' '}
                    <strong className="font-mono">{airEstimate.maxClassSize}</strong>). Fonte: Censo Escolar 2024, turmas.
                  </p>

                  {school.declaredClimatizedRooms > 0 ? (
                    <>
                      <p>
                        {school.inspection?.acType === 'central_com_renovacao' ? (
                          <span>
                            Sistema com renovação de ar declarado na vistoria. Só um sensor mostra se a vazão basta.
                          </span>
                        ) : (
                          <span>
                            Com porta e janelas fechadas e ar-condicionado split, o CO2 passa da referência em cerca de{' '}
                            <strong className="font-mono text-rose-600 dark:text-rose-400">
                              {airEstimate.firstMinuteAboveReferenceClosed} minutos
                            </strong>{' '}
                            de aula.
                          </span>
                        )}
                      </p>
                      <p>
                        Para ficar dentro da referência, a sala precisaria receber cerca de{' '}
                        <strong className="font-mono">{formatIntegerPtBr(airEstimate.requiredOutdoorAirM3h ?? 0)} m³/h</strong> de ar de fora (
                        <strong className="font-mono">
                          {formatNumberPtBr(airEstimate.requiredAch ?? 0, { decimals: 2 })}
                        </strong>{' '}
                        trocas de ar por hora numa sala de{' '}
                        <strong className="font-mono">
                          {formatNumberPtBr(airEstimate.roomVolumeM3 ?? 150, {
                            decimals: Number.isInteger(airEstimate.roomVolumeM3 ?? 150) ? 0 : 1,
                          })}{' '}
                          m³
                        </strong>
                        ). O split comum não traz ar de fora; só esfria o ar da sala.
                      </p>
                      <p>
                        Sala climatizada de uso coletivo: a Lei 13.589/2018 exige PMOC. PMOC desta escola:{' '}
                        <strong>{formatPmocLabel(school.inspection?.pmocStatus)}</strong>.
                      </p>
                      {school.inspection?.windowsOperable === 'nenhuma' && (
                        <p className="font-semibold text-amber-700 dark:text-amber-400">
                          Janelas não abrem (vistoria).
                        </p>
                      )}
                    </>
                  ) : school.inspection?.windowsOperable === 'nenhuma' ? (
                    <p className="font-semibold text-amber-700 dark:text-amber-400">
                      Janelas não abrem (vistoria).
                    </p>
                  ) : (
                    <p>
                      Com janelas abertas (3 trocas por hora, valor provisório), o pico estimado é de{' '}
                      <strong className="font-mono">
                        {formatIntegerPtBr(airEstimate.peakPpmOpenWindows ?? 0)} ppm
                      </strong>
                      . Janela aberta também traz o ar da rua:{' '}
                      {onNavigateToMonitoring ? (
                        <button
                          type="button"
                          onClick={onNavigateToMonitoring}
                          className="text-cyan-700 dark:text-cyan-400 underline hover:opacity-80 cursor-pointer"
                        >
                          veja a previsão de partículas no monitoramento
                        </button>
                      ) : (
                        <span>veja a previsão de partículas no monitoramento</span>
                      )}
                      .
                    </p>
                  )}

                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Referência: ABNT NBR 17037, CO2 até 700 ppm acima do ar externo (1.120 ppm com o ar externo a 420 ppm). A norma vale para ambiente climatizado; em sala sem ar-condicionado, o Termômetro usa o mesmo valor como régua.
                  </p>

                  <details className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 rounded-lg p-2.5 text-[11px] text-slate-600 dark:text-slate-400">
                    <summary className="cursor-pointer font-semibold text-slate-700 dark:text-slate-200">
                      Como esta estimativa é feita
                    </summary>
                    <ul className="mt-2 space-y-1 list-disc pl-4">
                      <li>
                        Sala de referência de 150 m³ (50 m² e 3 m de pé-direito) até a vistoria medir as dimensões reais da sala.
                      </li>
                      <li>
                        Taxas provisórias de renovação: 0,5 troca de ar por hora com tudo fechado e 3 trocas de ar por hora com janelas abertas.
                      </li>
                      <li>
                        Geração de CO2 por estudante conforme idade e etapa (Carrasco, Molina e Jones, AIVC), com professor incluído (0,0049 L/s).
                      </li>
                      <li>
                        Ar externo de referência a 420 ppm ao longo de 4 aulas de 50 minutos e recreio de 20 minutos com a sala vazia.
                      </li>
                    </ul>
                    <p className="mt-2 font-medium text-slate-700 dark:text-slate-300">
                      A ordem de grandeza bate com medições em salas brasileiras com split, mas só o sensor do piloto confirma o número desta escola.
                    </p>
                  </details>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* 2. BLOCO DESACOPLADO: EXPOSIÇÃO METEOROLÓGICA (IE_met) vs. VULNERABILIDADE DA INFRAESTRUTURA (IV_infra) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Bloco 1: Índice de Exposição Meteorológica */}
        <div className="bg-white dark:bg-slate-900 rounded-xl p-5 border border-slate-200 dark:border-slate-800 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
              <Thermometer className="w-4 h-4 text-amber-500" />
              Índice de Exposição Meteorológica (IE_met)
            </span>
            <span className="text-xs font-mono font-bold text-amber-600 dark:text-amber-400">
              {decoupledEval.exposure.score}/100
            </span>
          </div>

          <div className="flex items-baseline justify-between pt-1">
            <span className="text-xl font-bold text-slate-900 dark:text-white">
              {decoupledEval.exposure.label}
            </span>
            <span className="text-xs font-mono text-slate-500">
              Pico 72h: {formatTempPtBr(maxForecastHeatIndex)}
            </span>
          </div>

          <div className="space-y-1.5 pt-2 border-t border-slate-100 dark:border-slate-800 text-xs">
            <span className="text-slate-500 block font-medium">Fatores Territoriais de Exposição:</span>
            <ul className="space-y-1 text-slate-700 dark:text-slate-300">
              {decoupledEval.exposure.factors.map((f, i) => (
                <li key={i} className="flex items-start gap-1.5">
                  <span className="text-amber-500">•</span>
                  <span>{f}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Bloco 2: Índice de Vulnerabilidade da Infraestrutura */}
        <div className="bg-white dark:bg-slate-900 rounded-xl p-5 border border-slate-200 dark:border-slate-800 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
              <Building2 className="w-4 h-4 text-rose-500" />
              Índice de Vulnerabilidade de Infraestrutura (IV_infra)
            </span>
            <span className="text-xs font-mono font-bold text-rose-600 dark:text-rose-400">
              {decoupledEval.infrastructure.score}/100
            </span>
          </div>

          <div className="flex items-baseline justify-between pt-1">
            <span className="text-xl font-bold text-slate-900 dark:text-white">
              {decoupledEval.infrastructure.label}
            </span>
            <span className="text-xs font-mono text-slate-500">
              Confiança: {formatPercentIntPtBr(decoupledEval.infrastructure.confidenceMultiplier * 100)}
            </span>
          </div>

          {decoupledEval.infrastructure.gapDescription && (
            <div className="p-2.5 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-[11px] text-rose-800 dark:text-rose-200">
              {decoupledEval.infrastructure.gapDescription}
            </div>
          )}

          <div className="space-y-1.5 pt-2 border-t border-slate-100 dark:border-slate-800 text-xs">
            <span className="text-slate-500 block font-medium">Condições Físicas Verificadas:</span>
            <ul className="space-y-1 text-slate-700 dark:text-slate-300">
              {decoupledEval.infrastructure.factors.map((f, i) => (
                <li key={i} className="flex items-start gap-1.5">
                  <span className="text-rose-500">•</span>
                  <span>{f}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {/* 3. CAMADA CADASTRAL (INEP) vs. VISTORIA DE CAMPO AUDITADA */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Bloco A: Cadastro Censo Escolar (INEP / SME) */}
        <div className="bg-white dark:bg-slate-900 rounded-xl p-5 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Building2 className="w-4 h-4 text-slate-500" />
              Camada Cadastral (Censo Escolar {school.dataReferenceYear})
            </h3>
            <span className="text-[11px] font-mono text-slate-400">Fonte Oficial INEP</span>
          </div>

          <div className="space-y-3 text-xs text-slate-700 dark:text-slate-300">
            <div className="flex justify-between py-1.5 border-b border-slate-100 dark:border-slate-800">
              <span className="text-slate-500">Salas de Aula Utilizadas:</span>
              <strong className="font-mono">{school.totalRooms} salas</strong>
            </div>
            <div className="flex justify-between py-1.5 border-b border-slate-100 dark:border-slate-800">
              <span className="text-slate-500">Salas Declaradas Climatizadas:</span>
              <strong className="font-mono">{school.declaredClimatizedRooms} salas</strong>
            </div>
            <div className="flex justify-between py-1.5 border-b border-slate-100 dark:border-slate-800">
              <span className="text-slate-500">Proporção Declarada:</span>
              <strong className="font-mono">
                {formatPercentIntPtBr(
                  school.totalRooms > 0
                    ? (school.declaredClimatizedRooms / school.totalRooms) * 100
                    : 0
                )}
              </strong>
            </div>
            <div className="flex justify-between py-1.5 border-b border-slate-100 dark:border-slate-800">
              <span className="text-slate-500">Anomalia Territorial LST:</span>
              {school.heatIslandFactorLST === null ? (
                <span className="text-slate-400 font-mono text-[11px] italic">
                  Pendente: cálculo por satélite ainda não importado
                </span>
              ) : (
                <strong className="font-mono text-rose-600 dark:text-rose-400">
                  {formatTempPtBr(school.heatIslandFactorLST, { signed: true })}
                </strong>
              )}
            </div>
            <div className="flex justify-between py-1.5 border-b border-slate-100 dark:border-slate-800">
              <span className="text-slate-500">Cobertura Verde no Entorno:</span>
              {school.greenCoveragePercent === null ? (
                <span className="text-slate-400 font-mono text-[11px] italic">
                  Pendente: cálculo por satélite ainda não importado
                </span>
              ) : (
                <strong className="font-mono">{formatPercentIntPtBr(school.greenCoveragePercent)}</strong>
              )}
            </div>

            {school.heatIsland && (
              <div className="space-y-1 pt-2 border-t border-slate-100 dark:border-slate-800 text-[11px]">
                <DataProvenanceBadge
                  provenance={{
                    source: 'Landsat 8/9 (USGS) e ESA WorldCover, via Google Earth Engine',
                    timestamp: school.heatIsland.period || 'Verões 2021/22 a 2025/26',
                    location: `${school.name} (Raio 200m)`,
                    nature: 'observacao',
                    natureDescription:
                      'Temperatura de superfície medida por satélite por volta das 10h. Compara lugares; não é a temperatura do ar dentro da sala.',
                  }}
                  variant="inline"
                />
                {school.heatIsland.quality === 'poucas_observacoes' && (
                  <p className="text-amber-600 dark:text-amber-400 font-semibold text-[10px]">
                    Poucas imagens sem nuvem: valor frágil
                  </p>
                )}
              </div>
            )}
          </div>

          <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3 text-amber-900 dark:text-amber-300 text-[11px] leading-relaxed">
            <strong>Ressalva Epistemológica:</strong> Equipamentos inoperantes, capacidade da subestação elétrica, tipo de telhado e ventilação cruzada <em>não constam do Censo e não podem ser presumidos</em>. Devem ser apurados via vistoria física.
          </div>
        </div>

        {/* Bloco B: Vistoria Local Verificada & Histórico */}
        <div className="bg-white dark:bg-slate-900 rounded-xl p-5 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <UserCheck className="w-4 h-4 text-emerald-500" />
              Vistoria de Campo (Sincronizada no Firestore)
            </h3>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowHistory(!showHistory)}
                className="text-xs text-slate-500 hover:text-slate-900 dark:hover:text-white flex items-center gap-1 cursor-pointer"
                title="Ver histórico de revisões aprovadas"
              >
                <History className="w-3.5 h-3.5" />
                <span>{showHistory ? 'Ocultar Histórico' : 'Histórico'}</span>
              </button>
              <button
                onClick={() => setIsEditingInspection(!isEditingInspection)}
                className="text-xs text-amber-600 dark:text-amber-400 font-semibold flex items-center gap-1 hover:underline cursor-pointer"
              >
                <FileEdit className="w-3.5 h-3.5" />
                {isEditingInspection ? 'Cancelar' : school.inspection ? 'Nova Revisão' : 'Registrar Vistoria'}
              </button>
            </div>
          </div>

          <div className="pt-1">
            <DataProvenanceBadge
              provenance={{
                source: school.inspection
                  ? `Vistoria Homologada v${school.inspection.version || 1} (${school.inspection.inspectorRole})`
                  : 'Aguardando Vistoria Presencial',
                timestamp: school.inspection ? school.inspection.inspectedAt : 'Sem data',
                location: `${school.name} (In Loco)`,
                nature: 'observacao',
                natureDescription: 'Auditoria técnica presencial de infraestrutura elétrica, ventilação e telhado.',
              }}
              variant="compact"
            />
          </div>

          {!currentUser && isEditingInspection && (
            <div className="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg flex items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-2 text-amber-900 dark:text-amber-200">
                <Lock className="w-4 h-4 text-amber-600 shrink-0" />
                <span>Para salvar no Firestore, entre com sua conta Google credenciada.</span>
              </div>
              <button
                type="button"
                onClick={onLogin}
                className="px-2.5 py-1 bg-amber-500 text-slate-950 font-bold rounded text-xs flex items-center gap-1 cursor-pointer"
              >
                <LogIn className="w-3.5 h-3.5" />
                Entrar
              </button>
            </div>
          )}

          {isEditingInspection ? (
            <form onSubmit={handlePublishInspection} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-medium mb-1">
                  Condição Real dos Aparelhos de Ar-Condicionado:
                </label>
                <select
                  value={realAcStatus}
                  onChange={(e) => setRealAcStatus(e.target.value as RealAcStatus)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg p-2 text-slate-900 dark:text-slate-100"
                >
                  <option value="desconhecido">Não Verificado / Desconhecido</option>
                  <option value="operante">Operante em todas as salas declaradas</option>
                  <option value="parcial_inoperante">Parcialmente inoperante (aparelhos queimados/sem manutenção)</option>
                  <option value="inoperante_eletrica">Inoperante por sobrecarga elétrica ou furto de cabos</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-medium mb-1">
                  Observações Técnicas sobre Climatização / Energia:
                </label>
                <input
                  type="text"
                  placeholder="Ex: Disjuntor desarma às 13h; aguardando subestação..."
                  value={acNotes}
                  onChange={(e) => setAcNotes(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg p-2 text-slate-900 dark:text-slate-100"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-medium mb-1">
                    Tipo de Cobertura:
                  </label>
                  <select
                    value={roofType}
                    onChange={(e) => setRoofType(e.target.value as RoofType)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg p-2 text-slate-900 dark:text-slate-100"
                  >
                    <option value="outro_desconhecido">Desconhecido</option>
                    <option value="fibrocimento">Fibrocimento sem forro isolante</option>
                    <option value="laje_concreto">Laje de concreto maciça exposta</option>
                    <option value="telha_metalica">Telha metálica simples</option>
                    <option value="termoacustica">Telha termoacústica ou com manta</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-medium mb-1">
                    Ventilação Natural:
                  </label>
                  <select
                    value={ventilationType}
                    onChange={(e) => setVentilationType(e.target.value as VentilationType)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg p-2 text-slate-900 dark:text-slate-100"
                  >
                    <option value="desconhecido">Desconhecido</option>
                    <option value="cruzada_adequada">Cruzada adequada (ar circula)</option>
                    <option value="unilateral_parcial">Unilateral parcial</option>
                    <option value="bloqueada_ou_fechada">Bloqueada / Janelas fechadas</option>
                  </select>
                </div>
              </div>

              <div className="flex gap-4 pt-1">
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={electricalOverload}
                    onChange={(e) => setElectricalOverload(e.target.checked)}
                    className="rounded text-amber-500"
                  />
                  <span>Sobrecarga elétrica frequente</span>
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={cableTheft}
                    onChange={(e) => setCableTheft(e.target.checked)}
                    className="rounded text-rose-500"
                  />
                  <span>Histórico de furto de cabos</span>
                </label>
              </div>

              {/* Seção Ar da sala (Parte 6) */}
              <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-lg border border-slate-200 dark:border-slate-700 space-y-3">
                <span className="text-[11px] font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                  <Wind className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" />
                  Ar da sala (Campos Opcionais de Ventilação e PMOC)
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div>
                    <label className="block text-slate-600 dark:text-slate-400 font-medium mb-1">
                      Tipo de Climatização:
                    </label>
                    <select
                      value={acType}
                      onChange={(e) => setAcType(e.target.value as any)}
                      className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-md p-1.5 text-slate-900 dark:text-slate-100"
                    >
                      <option value="desconhecido">Desconhecido</option>
                      <option value="split">Ar-condicionado split (sem ar de fora)</option>
                      <option value="janela">Ar-condicionado de janela</option>
                      <option value="central_com_renovacao">Central com renovação de ar</option>
                      <option value="ventilador">Apenas ventilador</option>
                      <option value="nenhum">Nenhum equipamento</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-slate-600 dark:text-slate-400 font-medium mb-1">
                      Abertura das Janelas:
                    </label>
                    <select
                      value={windowsOperable}
                      onChange={(e) => setWindowsOperable(e.target.value as any)}
                      className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-md p-1.5 text-slate-900 dark:text-slate-100"
                    >
                      <option value="desconhecido">Desconhecido</option>
                      <option value="todas_abrem">Todas abrem</option>
                      <option value="algumas">Algumas abrem</option>
                      <option value="nenhuma">Nenhuma abre</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-slate-600 dark:text-slate-400 font-medium mb-1">
                      Janelas com Ar Ligado:
                    </label>
                    <select
                      value={windowsClosedWhenAcOn}
                      onChange={(e) => setWindowsClosedWhenAcOn(e.target.value as any)}
                      className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-md p-1.5 text-slate-900 dark:text-slate-100"
                    >
                      <option value="desconhecido">Desconhecido</option>
                      <option value="sempre">Sempre fechadas</option>
                      <option value="as_vezes">Às vezes fechadas</option>
                      <option value="nunca">Nunca fechadas</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-slate-600 dark:text-slate-400 font-medium mb-1">
                      PMOC (Lei 13.589/2018):
                    </label>
                    <select
                      value={pmocStatus}
                      onChange={(e) => setPmocStatus(e.target.value as any)}
                      className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-md p-1.5 text-slate-900 dark:text-slate-100"
                    >
                      <option value="desconhecido">Desconhecido / Não verificado</option>
                      <option value="visto_documento">Documento visto na vistoria</option>
                      <option value="informado_sem_documento">Informado sem documento</option>
                      <option value="nao_tem">Não tem PMOC</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-slate-600 dark:text-slate-400 font-medium mb-1">
                      Última Limpeza de Filtros (AAAA-MM):
                    </label>
                    <input
                      type="text"
                      placeholder="Ex: 2026-08"
                      value={lastFilterCleaning}
                      onChange={(e) => setLastFilterCleaning(e.target.value)}
                      className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-md p-1.5 text-slate-900 dark:text-slate-100 font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-600 dark:text-slate-400 font-medium mb-1">
                      Fonte de Poluição Próxima:
                    </label>
                    <select
                      value={nearbyPollutionSource}
                      onChange={(e) => setNearbyPollutionSource(e.target.value as any)}
                      className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-md p-1.5 text-slate-900 dark:text-slate-100"
                    >
                      <option value="desconhecido">Desconhecido</option>
                      <option value="nenhuma">Nenhuma observada</option>
                      <option value="via_movimentada">Via movimentada</option>
                      <option value="obra">Obra próxima</option>
                      <option value="queima_de_lixo">Queima de lixo</option>
                      <option value="industria">Indústria</option>
                    </select>
                  </div>
                </div>

                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={moldOrDampSigns}
                    onChange={(e) => setMoldOrDampSigns(e.target.checked)}
                    className="rounded text-amber-500"
                  />
                  <span>Sinais de mofo ou infiltração na sala</span>
                </label>

                <div>
                  <span className="block text-slate-600 dark:text-slate-400 font-medium mb-1">
                    Dimensões da Sala Vistoriada em metros (opcional):
                  </span>
                  <div className="grid grid-cols-3 gap-2">
                    <input
                      type="number"
                      step="0.1"
                      min="1"
                      max="30"
                      placeholder="Comp. (m)"
                      value={roomLengthM}
                      onChange={(e) => setRoomLengthM(e.target.value)}
                      className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-md p-1.5 text-slate-900 dark:text-slate-100 font-mono"
                    />
                    <input
                      type="number"
                      step="0.1"
                      min="1"
                      max="30"
                      placeholder="Larg. (m)"
                      value={roomWidthM}
                      onChange={(e) => setRoomWidthM(e.target.value)}
                      className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-md p-1.5 text-slate-900 dark:text-slate-100 font-mono"
                    />
                    <input
                      type="number"
                      step="0.1"
                      min="2"
                      max="8"
                      placeholder="Pé-dir. (m)"
                      value={roomHeightM}
                      onChange={(e) => setRoomHeightM(e.target.value)}
                      className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-md p-1.5 text-slate-900 dark:text-slate-100 font-mono"
                    />
                  </div>
                </div>
              </div>

              {/* Informações Pessoais do Inspetor (Isoladas por LGPD) */}
              <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-lg border border-slate-200 dark:border-slate-700 space-y-2">
                <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                  <Lock className="w-3.5 h-3.5 text-amber-500" />
                  Identificação do Inspetor (Restrita a /private/{'{revisionId}'}):
                </span>
                <p className="text-[10px] text-slate-500">
                  Nome e e-mail não são divulgados no retrato técnico público, em conformidade com a LGPD.
                </p>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-slate-600 dark:text-slate-400 font-medium mb-1">Nome Completo:</label>
                    <input
                      type="text"
                      placeholder="Nome do responsável"
                      value={inspectorName}
                      onChange={(e) => setInspectorName(e.target.value)}
                      className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-md p-1.5 text-slate-900 dark:text-slate-100"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-600 dark:text-slate-400 font-medium mb-1">Vínculo Funcional:</label>
                    <select
                      value={inspectorRole}
                      onChange={(e) => setInspectorRole(e.target.value as any)}
                      className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-md p-1.5 text-slate-900 dark:text-slate-100"
                    >
                      <option value="direcao">Direção / Coordenação</option>
                      <option value="professor">Professor(a)</option>
                      <option value="gremio">Grêmio Estudantil</option>
                      <option value="comunidade">Comissão de Pais</option>
                      <option value="tecnico_externo">Técnico Externo / MPRJ</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Botões Duplos: Salvar Rascunho vs. Publicar Homologação */}
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={handleSaveDraft}
                  disabled={isSavingDraft || isSaving}
                  className="flex-1 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold rounded-lg flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>{isSavingDraft ? 'Salvando...' : 'Salvar Rascunho'}</span>
                </button>

                <button
                  type="submit"
                  disabled={isSaving || isSavingDraft}
                  className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg flex items-center justify-center gap-1.5 cursor-pointer transition-colors shadow-xs"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{isSaving ? 'Publicando...' : 'Publicar Vistoria (Atômico)'}</span>
                </button>
              </div>
            </form>
          ) : showHistory ? (
            /* Histórico Técnico Versionado */
            <div className="space-y-3 text-xs">
              <span className="font-bold text-slate-800 dark:text-slate-200 block">
                Histórico de Revisões Técnicas Anteriores:
              </span>

              {isLoadingRevisions ? (
                <div className="text-center py-4 text-slate-400 font-mono">Carregando histórico do Firestore...</div>
              ) : revisions.length === 0 ? (
                <p className="text-slate-500 italic py-2">
                  Nenhuma revisão anterior registrada para esta escola.
                </p>
              ) : (
                <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                  {revisions.map((rev, idx) => (
                    <div
                      key={rev.revisionId || idx}
                      className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 text-[11px] space-y-1"
                    >
                      <div className="flex items-center justify-between font-mono">
                        <span className="font-bold text-amber-600 dark:text-amber-400">{rev.revisionId}</span>
                        <span className="text-slate-400">{new Date(rev.createdAt || rev.inspectedAt).toLocaleDateString('pt-BR')}</span>
                      </div>
                      <div className="text-slate-700 dark:text-slate-300">
                        Vínculo: <strong className="capitalize">{rev.inspectorRole}</strong> · Ar: <strong className="capitalize">{rev.realAcStatus?.replace('_', ' ')}</strong>
                      </div>
                      {rev.acNotes && <p className="text-slate-500 italic">"{rev.acNotes}"</p>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : school.inspection ? (
            <div className="space-y-3 text-xs text-slate-700 dark:text-slate-300">
              {school.inspection.legacySchoolId && (
                <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/25 text-amber-900 dark:text-amber-200 text-[11px]">
                  Vistoria registrada antes da correção do cadastro (ID antigo: {school.inspection.legacySchoolId})
                </div>
              )}
              <div className="flex justify-between py-1.5 border-b border-slate-100 dark:border-slate-800">
                <span className="text-slate-500">Status Operacional do Ar:</span>
                <strong className="font-mono capitalize text-slate-900 dark:text-white">
                  {school.inspection.realAcStatus.replace('_', ' ')}
                </strong>
              </div>
              {school.inspection.acNotes && (
                <p className="text-[11px] text-slate-600 dark:text-slate-400 italic bg-slate-50 dark:bg-slate-800/40 p-2 rounded">
                  "{school.inspection.acNotes}"
                </p>
              )}
              <div className="flex justify-between py-1.5 border-b border-slate-100 dark:border-slate-800">
                <span className="text-slate-500">Material de Cobertura:</span>
                <strong className="font-mono capitalize">
                  {school.inspection.roofType.replace('_', ' ')}
                </strong>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-100 dark:border-slate-800">
                <span className="text-slate-500">Ventilação Natural:</span>
                <strong className="font-mono capitalize">
                  {school.inspection.ventilationType.replace('_', ' ')}
                </strong>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-100 dark:border-slate-800">
                <span className="text-slate-500">Sobrecarga Elétrica Confirmada:</span>
                <strong className={`font-mono ${school.inspection.electricalOverloadReported ? 'text-rose-600' : 'text-slate-500'}`}>
                  {school.inspection.electricalOverloadReported ? 'SIM' : 'NÃO'}
                </strong>
              </div>
              {school.inspection.acType && (
                <div className="flex justify-between py-1.5 border-b border-slate-100 dark:border-slate-800">
                  <span className="text-slate-500">Tipo de Climatização (Ar da sala):</span>
                  <strong className="font-mono capitalize">{school.inspection.acType.replace(/_/g, ' ')}</strong>
                </div>
              )}
              {school.inspection.windowsOperable && (
                <div className="flex justify-between py-1.5 border-b border-slate-100 dark:border-slate-800">
                  <span className="text-slate-500">Janelas operáveis:</span>
                  <strong className="font-mono capitalize">{school.inspection.windowsOperable.replace(/_/g, ' ')}</strong>
                </div>
              )}
              {school.inspection.pmocStatus && (
                <div className="flex justify-between py-1.5 border-b border-slate-100 dark:border-slate-800">
                  <span className="text-slate-500">PMOC:</span>
                  <strong className="font-mono">{formatPmocLabel(school.inspection.pmocStatus)}</strong>
                </div>
              )}
              {school.inspection.lastFilterCleaning && (
                <div className="flex justify-between py-1.5 border-b border-slate-100 dark:border-slate-800">
                  <span className="text-slate-500">Última limpeza de filtros:</span>
                  <strong className="font-mono">{school.inspection.lastFilterCleaning}</strong>
                </div>
              )}
              {school.inspection.roomDimensions && (
                <div className="flex justify-between py-1.5 border-b border-slate-100 dark:border-slate-800">
                  <span className="text-slate-500">Sala vistoriada:</span>
                  <strong className="font-mono">
                    {formatNumberPtBr(school.inspection.roomDimensions.lengthM, {
                      decimals: Number.isInteger(school.inspection.roomDimensions.lengthM) ? 0 : 1,
                    })}{' '}
                    x{' '}
                    {formatNumberPtBr(school.inspection.roomDimensions.widthM, {
                      decimals: Number.isInteger(school.inspection.roomDimensions.widthM) ? 0 : 1,
                    })}{' '}
                    x{' '}
                    {formatNumberPtBr(school.inspection.roomDimensions.heightM, {
                      decimals: Number.isInteger(school.inspection.roomDimensions.heightM) ? 0 : 1,
                    })}{' '}
                    m
                  </strong>
                </div>
              )}
              <div className="pt-2 text-[11px] text-slate-400 flex items-center justify-between">
                <span>Inspecionado em {school.inspection.inspectedAt} por {school.inspection.inspectorRole} credenciado.</span>
                <span className="text-emerald-600 dark:text-emerald-400 font-mono">Dados Públicos Isolados</span>
              </div>
            </div>
          ) : (
            <div className="text-center py-6 space-y-3">
              <HelpCircle className="w-8 h-8 text-slate-400 mx-auto opacity-60" />
              <p className="text-xs text-slate-500">
                Nenhuma vistoria física registrada para esta escola.
              </p>
              <button
                onClick={() => setIsEditingInspection(true)}
                className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 rounded-lg text-xs font-semibold hover:bg-slate-200 cursor-pointer"
              >
                Preencher Formulário de Vistoria
              </button>
            </div>
          )}
        </div>
      </div>

      {/* 4. Medições de Sensores em Escolas-Sentinela (Exemplos Simulados) */}
      {school.isSentinel && (
        <div className="bg-white dark:bg-slate-900 rounded-xl p-5 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Thermometer className="w-4 h-4 text-purple-500" />
                Exemplo de Leitura de Sensores Sentinela (Simulação)
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Leituras sintéticas de exemplo para demonstração de interface. Não constituem medições laboratoriais aferidas. Cozinhas são analisadas separadamente devido a caldeirões e fogões.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {(school.sentinelSensors || []).map((sensor) => (
              <div
                key={sensor.sensorId}
                className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 space-y-2 text-xs"
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-900 dark:text-white capitalize">
                    {sensor.environment === 'sala_aula'
                      ? 'Sala de Aula'
                      : sensor.environment === 'patio_sombreado'
                      ? 'Pátio Sombreado'
                      : 'Cozinha Escolar'}
                  </span>
                  <span className="font-mono text-[10px] text-purple-600 dark:text-purple-400 font-bold">
                    {sensor.sensorId}
                  </span>
                </div>

                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <span className="text-2xl font-bold font-mono text-slate-900 dark:text-white">
                    {formatTempPtBr(sensor.temperatureC)}
                  </span>
                  <span className="text-slate-500 font-mono">
                    Umidade: {formatPercentIntPtBr(sensor.relativeHumidity)}
                  </span>
                  {sensor.co2Ppm !== undefined && (
                    <span className="text-cyan-700 dark:text-cyan-400 font-mono font-bold">
                      CO2: {formatIntegerPtBr(sensor.co2Ppm)} ppm
                    </span>
                  )}
                </div>

                {sensor.co2Ppm !== undefined && (
                  <DataProvenanceBadge
                    provenance={{
                      source: 'Exemplo simulado para demonstração (Escola Demonstração)',
                      timestamp: sensor.recordedAt,
                      location: sensor.environment === 'sala_aula' ? 'Sala de aula (demo)' : 'Pátio externo (demo)',
                      nature: 'demonstracao',
                      natureDescription: 'Leitura fictícia de exemplo. Nenhuma escola real possui leitura de CO2.',
                    }}
                    variant="inline"
                  />
                )}

                {sensor.notes && (
                  <p className="text-[11px] text-slate-600 dark:text-slate-400 italic">
                    {sensor.notes}
                  </p>
                )}

                <div className="pt-2 border-t border-slate-200 dark:border-slate-700/60 text-[10px] text-slate-400 font-mono">
                  Dispositivo: {sensor.deviceModel}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 5. Ações Preventivas Recomendadas para a Gestão Escolar (SMS-Rio) */}
      <div className="bg-white dark:bg-slate-900 rounded-xl p-5 border border-slate-200 dark:border-slate-800 shadow-xs space-y-3">
        <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 text-amber-500" />
          Diretrizes Preventivas e Operacionais Recomendadas
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
          <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-lg border border-slate-200 dark:border-slate-800 space-y-1">
            <strong className="text-slate-900 dark:text-white block font-semibold">1. Hidratação Ativa Programada</strong>
            <p className="text-slate-600 dark:text-slate-400">
              Garantir pausas curtas a cada 30 a 45 minutos para ingestão de água fresca. Incentivar alunos a trazer garrafas individuais e monitorar coloração da urina conforme guia da SMS-Rio.
            </p>
          </div>

          <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-lg border border-slate-200 dark:border-slate-800 space-y-1">
            <strong className="text-slate-900 dark:text-white block font-semibold">2. Remanejamento e Ventilação</strong>
            <p className="text-slate-600 dark:text-slate-400">
              Nos dias de Alerta/Perigo no turno da tarde, transferir turmas de salas sob telhado de fibrocimento ou expostas ao sol poente para pátios sombreados, bibliotecas ou salas térreas.
            </p>
          </div>

          <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-lg border border-slate-200 dark:border-slate-800 space-y-1">
            <strong className="text-slate-900 dark:text-white block font-semibold">3. Cuidados Especiais com a Cozinha</strong>
            <p className="text-slate-600 dark:text-slate-400">
              Ajustar horários de cocção em caldeirões industriais para as primeiras horas da manhã. Garantir pausas de resfriamento para merendeiras a cada 45 minutos.
            </p>
          </div>

          <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-lg border border-slate-200 dark:border-slate-800 space-y-1">
            <strong className="text-slate-900 dark:text-white block font-semibold">4. Reconhecimento Precoce de Mal-Estar</strong>
            <p className="text-slate-600 dark:text-slate-400">
              Sinais de alerta: dor de cabeça, sonolência anormal, náusea e tontura. Retirar imediatamente a criança da exposição ao calor, repousar em local arejado e contatar a Unidade Básica de Saúde / 192 se persistir.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
