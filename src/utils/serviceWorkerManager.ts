/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Gerenciador de Service Worker e Notificações Push de Estresse Térmico
 * Conforme o protocolo do Decreto Municipal 54.740/2024 e diretrizes da Secretaria de Educação.
 */

import { SchoolRecord } from '../types';
import { formatTempPtBr } from './formatPtBr';

export interface NotificationSettings {
  enabled: boolean;
  thresholdC: number; // Padrão da Secretaria: 44.0 ºC (Faixa de Perigo / NC4-NC5)
  monitoredSchoolId: string | null; // Se null, segue a escola ativa selecionada
  notifyAfternoonShift: boolean; // Turno tarde (12h-17h, maior estresse térmico)
  notifyMorningShift: boolean; // Turno manhã (07h-12h)
  soundEnabled: boolean;
  lastAlertTimestamp: number;
}

export interface AlertHistoryItem {
  id: string;
  timestamp: string;
  schoolId: string;
  schoolName: string;
  heatIndexC: number;
  peakHour: string;
  rioLevel: string;
  status: 'enviado' | 'bloqueado' | 'teste';
}

const STORAGE_KEY_SETTINGS = 'termometro_notification_settings_v1';
const STORAGE_KEY_HISTORY = 'termometro_notification_history_v1';

// Limite Oficial de Perigo da Secretaria Municipal de Educação / SMS-Rio
export const SECRETARIA_PERIGO_THRESHOLD = 44.0; // 44 ºC (NC4 / NC5 - Perigo)
export const SECRETARIA_ALERTA_THRESHOLD = 40.0; // 40 ºC (NC3 - Alerta)

export const DEFAULT_SETTINGS: NotificationSettings = {
  enabled: false,
  thresholdC: SECRETARIA_PERIGO_THRESHOLD,
  monitoredSchoolId: null,
  notifyAfternoonShift: true,
  notifyMorningShift: true,
  soundEnabled: true,
  lastAlertTimestamp: 0,
};

let activeRegistration: ServiceWorkerRegistration | null = null;

/**
 * Registra o Service Worker (/sw.js)
 */
export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    console.warn('[SW Manager] Service Worker não suportado neste navegador.');
    return null;
  }

  try {
    const registration = await navigator.serviceWorker.register('/sw.js', {
      scope: '/',
    });

    activeRegistration = registration;

    // Aguarda ativação completa
    await navigator.serviceWorker.ready;
    console.log('[SW Manager] Service Worker ativo e registrado com sucesso:', registration.scope);
    return registration;
  } catch (error) {
    console.warn('[SW Manager] Falha ao registrar Service Worker:', error);
    return null;
  }
}

/**
 * Obtém a registration ativa do Service Worker
 */
export async function getServiceWorkerRegistration(): Promise<ServiceWorkerRegistration | null> {
  if (activeRegistration) return activeRegistration;
  if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
    try {
      activeRegistration = await navigator.serviceWorker.ready;
      return activeRegistration;
    } catch {
      return null;
    }
  }
  return null;
}

/**
 * Verifica o status de suporte do navegador para notificações
 */
export function getNotificationSupport(): {
  supported: boolean;
  permission: NotificationPermission | 'unsupported';
} {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return { supported: false, permission: 'unsupported' };
  }
  return { supported: true, permission: Notification.permission };
}

/**
 * Solicita autorização ao usuário para exibir notificações push
 */
export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'denied';
  }

  try {
    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      await registerServiceWorker();
    }
    return permission;
  } catch (err) {
    console.warn('[SW Manager] Erro ao solicitar permissão de notificação:', err);
    return 'denied';
  }
}

/**
 * Carrega as preferências salvas no localStorage
 */
export function loadNotificationSettings(): NotificationSettings {
  if (typeof window === 'undefined') return DEFAULT_SETTINGS;
  try {
    const stored = localStorage.getItem(STORAGE_KEY_SETTINGS);
    if (!stored) return DEFAULT_SETTINGS;
    return { ...DEFAULT_SETTINGS, ...JSON.parse(stored) };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

/**
 * Salva as preferências de notificação
 */
export function saveNotificationSettings(settings: NotificationSettings): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY_SETTINGS, JSON.stringify(settings));
  } catch (e) {
    console.warn('[SW Manager] Falha ao salvar configurações:', e);
  }
}

/**
 * Carrega o histórico de alertas emitidos
 */
export function loadAlertHistory(): AlertHistoryItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const stored = localStorage.getItem(STORAGE_KEY_HISTORY);
    if (!stored) return [];
    return JSON.parse(stored);
  } catch {
    return [];
  }
}

/**
 * Adiciona um alerta ao histórico
 */
export function appendAlertHistory(item: Omit<AlertHistoryItem, 'id' | 'timestamp'>): void {
  if (typeof window === 'undefined') return;
  try {
    const history = loadAlertHistory();
    const newItem: AlertHistoryItem = {
      ...item,
      id: `alert-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' }),
    };
    const updated = [newItem, ...history].slice(0, 20); // Mantém até 20 itens
    localStorage.setItem(STORAGE_KEY_HISTORY, JSON.stringify(updated));
  } catch (e) {
    console.warn('[SW Manager] Falha ao salvar histórico:', e);
  }
}

/**
 * Dispara uma notificação pelo Service Worker (ou fallback nativo)
 */
export async function showThermalNotification(params: {
  title: string;
  body: string;
  schoolId: string;
  schoolName: string;
  heatIndex: number;
  rioLevel?: string;
  peakHour?: string;
  isTest?: boolean;
}): Promise<boolean> {
  const { supported, permission } = getNotificationSupport();
  if (!supported || permission !== 'granted') {
    console.warn('[SW Manager] Notificações não autorizadas ou não suportadas.');
    return false;
  }

  const registration = await getServiceWorkerRegistration();

  // Opção preferencial: Disparo via Service Worker showNotification
  if (registration && 'showNotification' in registration) {
    try {
      const options: NotificationOptions & { renotify?: boolean } = {
        body: params.body,
        icon: '/icon.svg',
        badge: '/icon.svg',
        tag: `thermal-alert-${params.schoolId || 'general'}`,
        renotify: true,
        requireInteraction: true,
        data: {
          url: `/?schoolId=${params.schoolId}&tab=school`,
          schoolId: params.schoolId,
          schoolName: params.schoolName,
          heatIndex: params.heatIndex,
          peakHour: params.peakHour,
          timestamp: Date.now(),
        },
      } as any;
      await (registration as any).showNotification(params.title, options);

      appendAlertHistory({
        schoolId: params.schoolId,
        schoolName: params.schoolName,
        heatIndexC: params.heatIndex,
        peakHour: params.peakHour || '--:--',
        rioLevel: params.rioLevel || 'Nível de Perigo',
        status: params.isTest ? 'teste' : 'enviado',
      });

      return true;
    } catch (err) {
      console.warn('[SW Manager] Erro ao disparar via registration.showNotification:', err);
    }
  }

  // Fallback 1: via postMessage para o Service Worker ativo
  if (navigator.serviceWorker && navigator.serviceWorker.controller) {
    navigator.serviceWorker.controller.postMessage({
      type: 'TRIGGER_THERMAL_ALERT',
      ...params,
    });
    return true;
  }

  // Fallback 2: via construtor padrão new Notification()
  try {
    new Notification(params.title, {
      body: params.body,
      icon: '/icon.svg',
      badge: '/icon.svg',
      tag: `thermal-alert-${params.schoolId}`,
    });

    appendAlertHistory({
      schoolId: params.schoolId,
      schoolName: params.schoolName,
      heatIndexC: params.heatIndex,
      peakHour: params.peakHour || '--:--',
      rioLevel: params.rioLevel || 'Nível de Perigo',
      status: params.isTest ? 'teste' : 'enviado',
    });

    return true;
  } catch (err) {
    console.warn('[SW Manager] Fallback direto de Notification falhou:', err);
    return false;
  }
}

/**
 * Avalia as condições meteorológicas da escola e dispara o alerta push se o limite for ultrapassado
 */
export async function evaluateAndTriggerThermalAlert(params: {
  school: SchoolRecord;
  maxForecastHeatIndex: number;
  peakHour?: string;
  rioLevel?: string;
  currentSettings?: NotificationSettings;
}): Promise<{ triggered: boolean; reason: string }> {
  const settings = params.currentSettings || loadNotificationSettings();

  if (!settings.enabled) {
    return { triggered: false, reason: 'Notificações desativadas nas preferências do usuário.' };
  }

  const { supported, permission } = getNotificationSupport();
  if (!supported || permission !== 'granted') {
    return { triggered: false, reason: 'Permissão de notificação do navegador não concedida.' };
  }

  // Se o usuário fixou uma escola monitorada e não é a escola atual
  if (settings.monitoredSchoolId && settings.monitoredSchoolId !== params.school.id) {
    return { triggered: false, reason: 'Escola atual não é a unidade monitorada para alertas.' };
  }

  const threshold = settings.thresholdC || SECRETARIA_PERIGO_THRESHOLD;
  const currentHI = params.maxForecastHeatIndex;

  // Verifica se ultrapassou o limite definido pela secretaria
  if (currentHI < threshold) {
    return {
      triggered: false,
      reason: `Índice de calor (${formatTempPtBr(currentHI)}) abaixo do limiar de perigo (${formatTempPtBr(threshold)}).`,
    };
  }

  // Cooldown de 30 minutos para evitar múltiplos alertas em sequência para a mesma condição
  const now = Date.now();
  const COOLDOWN_MS = 30 * 60 * 1000;
  if (now - settings.lastAlertTimestamp < COOLDOWN_MS) {
    return {
      triggered: false,
      reason: `Alerta recente já emitido nos últimos 30 minutos (cooldown ativo).`,
    };
  }

  // Disparo do Alerta Oficial
  const peakTimeStr = params.peakHour ? ` às ${params.peakHour}` : '';
  const levelStr = params.rioLevel ? ` [${params.rioLevel}]` : ' [Nível 4/5 - Perigo]';

  const title = `🚨 ALERTA TÉRMICO DA SECRETARIA - ${params.school.name}`;
  const body = `Previsão de estresse térmico crítico: Índice de Calor de ${formatTempPtBr(currentHI)}${peakTimeStr}${levelStr}. Limite de perigo da Secretaria ultrapassado! Recomenda-se acionar hidratação imediata e recolhimento de pátio exposto.`;

  const success = await showThermalNotification({
    title,
    body,
    schoolId: params.school.id,
    schoolName: params.school.name,
    heatIndex: currentHI,
    rioLevel: params.rioLevel || 'Nível de Perigo',
    peakHour: params.peakHour,
    isTest: false,
  });

  if (success) {
    settings.lastAlertTimestamp = now;
    saveNotificationSettings(settings);
    return { triggered: true, reason: 'Alerta emitido com sucesso ao usuário via Service Worker.' };
  }

  return { triggered: false, reason: 'Falha na emissão da notificação.' };
}

/**
 * Dispara notificação de teste sob demanda do usuário
 */
export async function sendTestThermalNotification(
  schoolName: string = 'E.M. Alfredo de Paula Freitas',
  threshold: number = SECRETARIA_PERIGO_THRESHOLD
): Promise<boolean> {
  const simulatedHI = Math.max(threshold + 1.2, 44.6);
  return showThermalNotification({
    title: `🔔 TESTE DO SERVICE WORKER - ${schoolName}`,
    body: `Simulação de notificação: Índice de Calor previsto de ${formatTempPtBr(simulatedHI)} ultrapassa o limite de perigo da Secretaria (${formatTempPtBr(threshold)}). O canal push está ativo e operacional no seu dispositivo!`,
    schoolId: 'test-school',
    schoolName,
    heatIndex: simulatedHI,
    rioLevel: 'NC4 / NC5 - Perigo',
    peakHour: '14:00',
    isTest: true,
  });
}
