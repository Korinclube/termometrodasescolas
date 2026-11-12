/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Modal de Configuração de Notificações Push do Service Worker
 * Alertas de Estresse Térmico Crítico da Secretaria Municipal de Educação
 */

import React, { useState, useEffect } from 'react';
import {
  Bell,
  BellRing,
  BellOff,
  ShieldAlert,
  CheckCircle2,
  AlertTriangle,
  Send,
  History,
  X,
  Settings2,
  Clock,
  Building2,
  Sliders,
  ExternalLink,
} from 'lucide-react';
import { SchoolRecord } from '../types';
import {
  NotificationSettings,
  AlertHistoryItem,
  SECRETARIA_PERIGO_THRESHOLD,
  SECRETARIA_ALERTA_THRESHOLD,
  getNotificationSupport,
  requestNotificationPermission,
  loadNotificationSettings,
  saveNotificationSettings,
  loadAlertHistory,
  sendTestThermalNotification,
} from '../utils/serviceWorkerManager';
import { formatTempPtBr } from '../utils/formatPtBr';

interface NotificationSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  schools: SchoolRecord[];
  activeSchool: SchoolRecord;
  onSelectSchool?: (schoolId: string) => void;
}

export const NotificationSettingsModal: React.FC<NotificationSettingsModalProps> = ({
  isOpen,
  onClose,
  schools,
  activeSchool,
}) => {
  const [settings, setSettings] = useState<NotificationSettings>(loadNotificationSettings);
  const [history, setHistory] = useState<AlertHistoryItem[]>(loadAlertHistory);
  const [permission, setPermission] = useState<NotificationPermission | 'unsupported'>('default');
  const [isSupported, setIsSupported] = useState(true);
  const [isTesting, setIsTesting] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState<{ type: 'success' | 'warning' | 'error'; text: string } | null>(null);

  useEffect(() => {
    const support = getNotificationSupport();
    setIsSupported(support.supported);
    setPermission(support.permission);
    setSettings(loadNotificationSettings());
    setHistory(loadAlertHistory());
  }, [isOpen]);

  if (!isOpen) return null;

  const handleRequestPermission = async () => {
    const perm = await requestNotificationPermission();
    setPermission(perm);
    if (perm === 'granted') {
      const updated = { ...settings, enabled: true };
      setSettings(updated);
      saveNotificationSettings(updated);
      setFeedbackMessage({
        type: 'success',
        text: 'Notificações autorizadas e Service Worker sincronizado com sucesso!',
      });
    } else if (perm === 'denied') {
      setFeedbackMessage({
        type: 'warning',
        text: 'Permissão bloqueada no navegador. Para reativar, clique no ícone de configurações ao lado da barra de endereço.',
      });
    }
  };

  const handleToggleEnable = (enabled: boolean) => {
    if (enabled && permission !== 'granted') {
      handleRequestPermission();
      return;
    }
    const updated = { ...settings, enabled };
    setSettings(updated);
    saveNotificationSettings(updated);
    setFeedbackMessage({
      type: 'success',
      text: enabled ? 'Alertas push do Service Worker ativados.' : 'Alertas push pausados.',
    });
    setTimeout(() => setFeedbackMessage(null), 4000);
  };

  const handleUpdateThreshold = (thresholdC: number) => {
    const updated = { ...settings, thresholdC };
    setSettings(updated);
    saveNotificationSettings(updated);
  };

  const handleUpdateSchool = (schoolId: string | null) => {
    const updated = { ...settings, monitoredSchoolId: schoolId };
    setSettings(updated);
    saveNotificationSettings(updated);
  };

  const handleSendTestNotification = async () => {
    setIsTesting(true);
    setFeedbackMessage(null);
    try {
      const targetSchool = schools.find((s) => s.id === settings.monitoredSchoolId) || activeSchool;
      const success = await sendTestThermalNotification(targetSchool.name, settings.thresholdC);
      if (success) {
        setHistory(loadAlertHistory());
        setFeedbackMessage({
          type: 'success',
          text: `Notificação push emitida pelo Service Worker para ${targetSchool.name}! Verifique a barra de notificações do seu sistema.`,
        });
      } else {
        setFeedbackMessage({
          type: 'error',
          text: 'Falha ao emitir notificação. Verifique se as permissões de notificação do sistema operacional estão habilitadas.',
        });
      }
    } catch (err: any) {
      setFeedbackMessage({
        type: 'error',
        text: `Erro ao testar: ${err.message || 'Falha inesperada'}`,
      });
    } finally {
      setIsTesting(false);
    }
  };

  const monitoredSchool = schools.find((s) => s.id === settings.monitoredSchoolId) || activeSchool;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--backdrop-modal)] backdrop-blur-[4px] p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-label="Configurações de alertas push"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl shadow-[var(--shadow-modal)] max-w-2xl w-full max-h-[90vh] flex flex-col text-slate-900 dark:text-slate-100 animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        
        {/* Cabeçalho do Modal */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-amber-500/10 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center border border-amber-500/25">
              <BellRing className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white tracking-tight">
                  Alertas Push do Service Worker
                </h3>
                <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-sm bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                  PWA / Web Push
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Notificação proativa no dispositivo ao ultrapassar limites de estresse térmico da Secretaria
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Feedback dinâmico */}
        {feedbackMessage && (
          <div
            className={`mx-4 sm:mx-5 mt-4 p-3 rounded-lg text-xs flex items-center gap-2 border ${
              feedbackMessage.type === 'success'
                ? 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                : feedbackMessage.type === 'warning'
                ? 'bg-amber-50 dark:bg-amber-950/30 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-800'
                : 'bg-rose-50 dark:bg-rose-950/30 text-rose-800 dark:text-rose-300 border-rose-200 dark:border-rose-800'
            }`}
          >
            {feedbackMessage.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
            ) : (
              <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600 dark:text-amber-400" />
            )}
            <span>{feedbackMessage.text}</span>
          </div>
        )}

        {/* Conteúdo rolável */}
        <div className="p-4 sm:p-5 space-y-5 overflow-y-auto flex-1">
          
          {/* 1. Status de Permissão do Navegador & Interruptor Principal */}
          <div className="p-4 rounded-lg bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="font-bold text-slate-900 dark:text-white">
                  Canal de Notificações do Dispositivo:
                </span>
                {permission === 'granted' ? (
                  <span className="flex items-center gap-1 font-mono font-semibold text-emerald-600 dark:text-emerald-400 text-[11px]">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    Autorizado no Navegador
                  </span>
                ) : permission === 'denied' ? (
                  <span className="flex items-center gap-1 font-mono font-semibold text-rose-600 dark:text-rose-400 text-[11px]">
                    <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                    Bloqueado no Navegador
                  </span>
                ) : (
                  <span className="flex items-center gap-1 font-mono font-semibold text-amber-600 dark:text-amber-400 text-[11px]">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                    Pendente de Autorização
                  </span>
                )}
              </div>
              <p className="text-slate-500 dark:text-slate-400 text-[11px]">
                O Service Worker monitora os boletins das 72 horas e emite alertas na central de notificações do seu sistema operacional.
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {permission !== 'granted' ? (
                <button
                  onClick={handleRequestPermission}
                  className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-md text-xs flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
                >
                  <Bell className="w-3.5 h-3.5" />
                  <span>Autorizar Alertas</span>
                </button>
              ) : (
                <label className="flex items-center gap-2 cursor-pointer font-medium text-xs">
                  <input
                    type="checkbox"
                    checked={settings.enabled}
                    onChange={(e) => handleToggleEnable(e.target.checked)}
                    className="w-4 h-4 accent-amber-500 rounded cursor-pointer"
                  />
                  <span>{settings.enabled ? 'Alertas Ativos' : 'Alertas Desativados'}</span>
                </label>
              )}
            </div>
          </div>

          {/* 2. Seleção do Limiar de Perigo da Secretaria */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-1.5">
                <ShieldAlert className="w-4 h-4 text-rose-500" />
                Limite de Disparo da Secretaria de Educação:
              </label>
              <span className="text-xs font-mono font-bold text-rose-600 dark:text-rose-400 tabular-nums">
                Gatilho: IC ≥ {formatTempPtBr(settings.thresholdC)}
              </span>
            </div>

            <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
              Defina quando o sistema deve emitir notificação de emergência para a equipe escolar e comunidade:
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs pt-1">
              {/* Opção 1: Limite Oficial de Perigo (44 °C) */}
              <button
                type="button"
                onClick={() => handleUpdateThreshold(SECRETARIA_PERIGO_THRESHOLD)}
                className={`p-3 rounded-lg border text-left transition-colors cursor-pointer ${
                  settings.thresholdC === SECRETARIA_PERIGO_THRESHOLD
                    ? 'border-rose-500/60 bg-rose-500/[0.08] dark:bg-rose-500/[0.12] ring-1 ring-rose-500/30'
                    : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-bold text-rose-700 dark:text-rose-400 flex items-center gap-1">
                    <span>🚨</span>
                    <span>Limite Oficial da Secretaria</span>
                  </span>
                  <span className="font-mono text-xs font-extrabold text-rose-600 dark:text-rose-400">
                    {formatTempPtBr(SECRETARIA_PERIGO_THRESHOLD)}
                  </span>
                </div>
                <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-snug">
                  Níveis <strong>NC4 e NC5 (Perigo Extremo)</strong> do Decreto 54.740/2024. Recomendado para acionamento imediato de hidratação contínua e recolhimento de recreios ao ar livre.
                </p>
              </button>

              {/* Opção 2: Alerta Preventivo (40 °C) */}
              <button
                type="button"
                onClick={() => handleUpdateThreshold(SECRETARIA_ALERTA_THRESHOLD)}
                className={`p-3 rounded-lg border text-left transition-colors cursor-pointer ${
                  settings.thresholdC === SECRETARIA_ALERTA_THRESHOLD
                    ? 'border-amber-500/60 bg-amber-500/[0.08] dark:bg-amber-500/[0.12] ring-1 ring-amber-500/30'
                    : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-bold text-amber-700 dark:text-amber-400 flex items-center gap-1">
                    <span>⚠️</span>
                    <span>Alerta Preventivo Prévio</span>
                  </span>
                  <span className="font-mono text-xs font-extrabold text-amber-600 dark:text-amber-400">
                    {formatTempPtBr(SECRETARIA_ALERTA_THRESHOLD)}
                  </span>
                </div>
                <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-snug">
                  Nível <strong>NC3 (Calor Alto)</strong>. Dispara aviso prévio antes do pico da tarde para garantir verificação de bebedouros e ventilação das salas.
                </p>
              </button>
            </div>
          </div>

          {/* 3. Escola Monitorada */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-1.5">
              <Building2 className="w-4 h-4 text-slate-500" />
              Escola Monitorada para Alertas:
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              <button
                type="button"
                onClick={() => handleUpdateSchool(null)}
                className={`p-2.5 rounded-lg border text-left transition-colors cursor-pointer ${
                  settings.monitoredSchoolId === null
                    ? 'border-amber-500/60 bg-amber-500/[0.06] font-bold text-slate-900 dark:text-white'
                    : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400'
                }`}
              >
                <span>🔄 Seguir Escola Selecionada no App</span>
                <span className="block text-[11px] font-normal text-slate-500 mt-0.5">
                  Atualmente: {activeSchool.name}
                </span>
              </button>

              <div className="relative">
                <select
                  aria-label="Fixar Escola Específica"
                  value={settings.monitoredSchoolId || ''}
                  onChange={(e) => handleUpdateSchool(e.target.value || null)}
                  className="w-full h-full p-2.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs text-slate-800 dark:text-slate-200 cursor-pointer"
                >
                  <option value="">Fixar em uma Escola Específica...</option>
                  {schools.map((sc) => (
                    <option key={sc.id} value={sc.id}>
                      {sc.name} ({sc.borough})
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* 4. Turnos de Monitoramento */}
          <div className="p-3.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 space-y-2 text-xs">
            <span className="font-bold text-slate-900 dark:text-white block">
              Janelas de Vigilância Escolar:
            </span>
            <div className="flex flex-wrap items-center gap-4 text-slate-700 dark:text-slate-300">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.notifyAfternoonShift}
                  onChange={(e) => {
                    const updated = { ...settings, notifyAfternoonShift: e.target.checked };
                    setSettings(updated);
                    saveNotificationSettings(updated);
                  }}
                  className="rounded text-amber-500 cursor-pointer"
                />
                <span>Turno Tarde (12h às 17h - Pico Solar poente)</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.notifyMorningShift}
                  onChange={(e) => {
                    const updated = { ...settings, notifyMorningShift: e.target.checked };
                    setSettings(updated);
                    saveNotificationSettings(updated);
                  }}
                  className="rounded text-amber-500 cursor-pointer"
                />
                <span>Turno Manhã (07h às 12h)</span>
              </label>
            </div>
          </div>

          {/* 5. Ação de Teste do Service Worker */}
          <div className="p-4 rounded-lg bg-amber-500/[0.04] dark:bg-amber-500/[0.08] border border-amber-500/25 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            <div>
              <strong className="block text-slate-900 dark:text-white font-semibold">
                Homologação do Canal Push no Dispositivo
              </strong>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                Emite uma notificação simulada de perigo térmico via Service Worker para validar som, vibração e banner do sistema.
              </p>
            </div>

            <button
              onClick={handleSendTestNotification}
              disabled={isTesting || permission !== 'granted'}
              className={`px-3.5 py-2 rounded-md font-bold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer shrink-0 ${
                permission === 'granted'
                  ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-950 hover:bg-slate-800'
                  : 'bg-slate-200 dark:bg-slate-800 text-slate-400 cursor-not-allowed'
              }`}
            >
              <Send className="w-3.5 h-3.5" />
              <span>{isTesting ? 'Emitindo...' : 'Testar Notificação Agora'}</span>
            </button>
          </div>

          {/* 6. Histórico de Notificações Registradas */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5 uppercase tracking-wider text-[11px]">
                <History className="w-3.5 h-3.5 text-slate-400" />
                Histórico de Alertas Disparados ({history.length}):
              </span>
              {history.length > 0 && (
                <button
                  onClick={() => {
                    localStorage.removeItem('termometro_notification_history_v1');
                    setHistory([]);
                  }}
                  className="text-[11px] text-slate-400 hover:text-rose-500 transition-colors"
                >
                  Limpar Histórico
                </button>
              )}
            </div>

            {history.length === 0 ? (
              <p className="text-[11px] text-slate-400 italic py-2">
                Nenhum alerta disparado nesta sessão ainda.
              </p>
            ) : (
              <div className="max-h-36 overflow-y-auto space-y-1.5 divide-y divide-slate-100 dark:divide-slate-800 text-xs font-mono">
                {history.map((item) => (
                  <div key={item.id} className="pt-1.5 flex items-center justify-between text-[11px]">
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${item.status === 'teste' ? 'bg-sky-500' : 'bg-rose-500'}`} />
                      <span className="font-semibold text-slate-800 dark:text-slate-200">{item.schoolName}</span>
                      <span className="text-slate-400">({item.peakHour})</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-bold text-rose-600 dark:text-rose-400 tabular-nums">
                        IC {formatTempPtBr(item.heatIndexC)}
                      </span>
                      <span className="text-slate-400 text-[10px]">{item.timestamp}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Rodapé do Modal */}
        <div className="p-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/60 dark:bg-slate-950/60 rounded-b-xl text-xs">
          <span className="text-[11px] text-slate-400 font-mono">
            Service Worker: /sw.js · Escopo: /
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-md font-semibold bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-950 hover:bg-slate-800 transition-colors cursor-pointer"
          >
            Concluir & Fechar
          </button>
        </div>
      </div>
    </div>
  );
};
