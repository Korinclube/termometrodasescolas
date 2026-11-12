/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { SchoolRecord, DayForecastSummary, GeminiStructuredEvaluation } from '../types';
import { Share2, CheckCheck, Copy, Shield, FileCheck, Cpu, AlertCircle, Sparkles, Wind } from 'lucide-react';
import { calculateDecoupledRiskEvaluation } from '../utils/thermalMath';
import { schoolAirEstimate, bestVentilationHours } from '../utils/airQualityMath';
import { DataProvenanceBadge } from './DataProvenanceBadge';
import {
  formatIntegerPtBr,
  formatPercentIntPtBr,
  formatTempPtBr,
} from '../utils/formatPtBr';

interface BulletinsAndReportsProps {
  schools: SchoolRecord[];
  activeSchool: SchoolRecord;
  daysSummary: DayForecastSummary[];
  airQualityStatus?: 'loading' | 'disponivel' | 'indisponivel';
  onSelectSchool: (id: string) => void;
}

const DAYTIME_HOURS = ['07:00', '08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00'];

export const BulletinsAndReports: React.FC<BulletinsAndReportsProps> = ({
  schools,
  activeSchool,
  daysSummary,
  airQualityStatus = 'loading',
  onSelectSchool,
}) => {
  const [activeTab, setActiveTab] = useState<'whatsapp' | 'mprj' | 'gemini'>('whatsapp');

  // Estado de governança: aprovação humana prévia do boletim
  const [isApproved, setIsApproved] = useState(false);
  const [approverName, setApproverName] = useState('Coordenação Pedagógica / Direção');
  const [copiedMessage, setCopiedMessage] = useState(false);

  // Estado da chamada do Gemini
  const [isLoadingGemini, setIsLoadingGemini] = useState(false);
  const [geminiResult, setGeminiResult] = useState<GeminiStructuredEvaluation | null>(null);
  const [geminiError, setGeminiError] = useState<string | null>(null);

  const activeDay = daysSummary[0];
  const maxHI = activeDay?.shifts.tarde.maxHeatIndexC ?? 39;
  const hoursCritical = activeDay?.shifts.tarde.hours40Plus ?? 2;

  const airEstimate = schoolAirEstimate(activeSchool, activeSchool.inspection);
  const hourly = activeDay?.hourly || [];
  const bestVent = bestVentilationHours(hourly, DAYTIME_HOURS);
  const bestHoursLabel =
    bestVent.hours.length >= 2
      ? `${bestVent.hours[0]} e ${bestVent.hours[1]}`
      : bestVent.hours[0] || 'nos intervalos';

  const daytimeHourly = hourly.filter((pt) => DAYTIME_HOURS.some((h) => pt.time.includes(h)));
  const validDaytimePm =
    airQualityStatus === 'disponivel'
      ? daytimeHourly
          .map((pt) => pt.pm2_5)
          .filter((v): v is number => v !== null && v !== undefined)
      : [];

  const loadedHours =
    airQualityStatus === 'disponivel'
      ? daytimeHourly
          .filter((pt) => pt.pm2_5 !== null && pt.pm2_5 !== undefined && pt.pm2_5 > 25)
          .map((pt) => (pt.time.includes('T') ? pt.time.split('T')[1].slice(0, 5) : pt.time.slice(0, 5)))
      : [];

  const loadedRangeText =
    loadedHours.length >= 2
      ? `${loadedHours[0]} e ${loadedHours[loadedHours.length - 1]}`
      : loadedHours.length === 1
      ? loadedHours[0]
      : '';

  const climatizedAirActionText =
    activeSchool.declaredClimatizedRooms > 0
      ? `Abrir porta e janelas por 5 minutos na troca de aula e durante todo o recreio, de preferência às ${bestHoursLabel}. Ajuda a baixar o CO2; não substitui renovação de ar.`
      : '';

  const loadedOutdoorAirText =
    loadedHours.length > 0
      ? `Ar lá fora carregado de partículas entre ${loadedRangeText}: evite abrir janelas para a rua nesse período.`
      : '';

  const whatsappAirLine =
    activeSchool.declaredClimatizedRooms > 0
      ? `• *Ventilação na sala:* Abrir porta e janelas por 5 min na troca de aula e no recreio, de preferência às ${bestHoursLabel} (baixa o CO2; não substitui renovação de ar).`
      : '';

  const whatsappLoadedAirLine =
    loadedHours.length > 0
      ? `• *Ar lá fora carregado:* Partículas altas entre ${loadedRangeText}; evite abrir janelas para a rua nesse período.`
      : '';

  // Montagem do texto do boletim para WhatsApp
  const whatsappText = `📢 *TERMÔMETRO DAS ESCOLAS RJ: BOLETIM PREVENTIVO DE CALOR*
📍 *Unidade:* ${activeSchool.name} (${activeSchool.borough})
📅 *Período:* Próximas 72 Horas | Data: ${activeDay ? activeDay.date : 'Hoje'}

⚠️ *PREVISÃO EXTERNA PARA O TURNO DA TARDE (12h às 17h):*
• Pico do Índice de Calor: *${formatTempPtBr(maxHI)}* (Faixa de ${maxHI >= 40 ? 'ALERTA' : 'ATENÇÃO'})
• Duração de estresse térmico: aproximadamente *${hoursCritical} horas* no período vespertino.
${activeSchool.inspection?.electricalOverloadReported ? '• ⚠️ Atenção redobrada: Limitação elétrica confirmada em vistoria física nesta unidade.\n' : ''}${whatsappAirLine ? `${whatsappAirLine}\n` : ''}${whatsappLoadedAirLine ? `${whatsappLoadedAirLine}\n` : ''}
💧 *RECOMENDAÇÕES PARA A COMUNIDADE ESCOLAR:*
1. *Água e Hidratação:* Beber água fresca a cada 30-40 minutos, mesmo sem sede. Tragam suas garrafas de casa!
2. *Roupas e Conforto:* Uniforme leve, tecidos de algodão e cores claras.
3. *Atividades:* Priorizar pátios sombreados e evitar atividades físicas expostas ao sol direto entre 10h e 16h.
4. *Sinais de Alarme:* Tontura, dor de cabeça forte ou náusea devem ser comunicados imediatamente aos professores e à direção.

_Aviso Institucional: Este boletim é um informativo preventivo comunitário gerado pela plataforma Termômetro das Escolas RJ e aprovado pela gestão local. Não substitui orientações médicas nem determinações do Centro de Operações e Resiliência (COR)._`;

  const handleCopyWhatsApp = () => {
    navigator.clipboard.writeText(whatsappText);
    setCopiedMessage(true);
    setTimeout(() => setCopiedMessage(false), 2500);
  };

  const handleTriggerGeminiAnalysis = async () => {
    setIsLoadingGemini(true);
    setGeminiError(null);
    try {
      const outdoorAirSummary =
        airQualityStatus === 'disponivel' && validDaytimePm.length > 0
          ? {
              status: 'disponivel',
              maxPm25: Math.max(...validDaytimePm),
              loadedHours,
              bestVentilationHours: bestVent.hours,
            }
          : {
              status: 'indisponivel',
              bestVentilationHours: bestVent.hours,
              notice: 'Previsão do ar externo indisponível agora',
            };

      const response = await fetch('/api/gemini/interpret', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          school: activeSchool,
          hourlySummary: activeDay?.shifts.tarde,
          airEstimate,
          outdoorAirSummary,
          userContext: 'Geração de síntese analítica preventiva para a direção escolar e MPRJ.',
        }),
      });

      if (!response.ok) {
        throw new Error(`Erro na API (${response.status})`);
      }

      const data = await response.json();
      setGeminiResult(data.evaluation);
    } catch (err: any) {
      setGeminiError(err.message || 'Falha ao conectar com o serviço de inteligência.');
    } finally {
      setIsLoadingGemini(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* 0. Barra de Proveniência dos Dados do Boletim */}
      <DataProvenanceBadge
        provenance={{
          source:
            activeTab === 'gemini'
              ? 'Google Gemini 2.5 Flash (Interpretação Analítica Automatizada)'
              : 'Previsão Numérica (Open-Meteo) & Censo INEP / Vistoria Física',
          timestamp:
            activeTab === 'gemini'
              ? 'Inferência em tempo real sob demanda'
              : `Previsão D+0 (${activeDay ? activeDay.date : 'Hoje'}) · Turnos Manhã e Tarde`,
          location: `${activeSchool.name} · ${activeSchool.borough} (${activeSchool.region})`,
          nature: activeTab === 'gemini' ? 'demonstracao' : 'previsao',
          natureDescription:
            activeTab === 'gemini'
              ? 'Síntese textual assistida por IA. Requer validação e chancela humana prévia pela direção antes de qualquer encaminhamento.'
              : 'Informativo preventivo gerado a partir do cruzamento de modelos meteorológicos e cadastro escolar.',
        }}
        variant="bar"
      />

      {/* Seletor de Escola para o Boletim */}
      <div className="bg-white dark:bg-slate-900 rounded-xl p-4 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-slate-700 dark:text-slate-300">Escola em Foco:</span>
          <select
            aria-label="Selecionar Escola para o Relatório"
            value={activeSchool.id}
            onChange={(e) => onSelectSchool(e.target.value)}
            className="bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-1.5 font-bold text-slate-900 dark:text-white cursor-pointer"
          >
            {schools.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} ({s.borough})
              </option>
            ))}
          </select>
        </div>

        {/* Sub-Navegação de Relatórios */}
        <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-lg">
          <button
            onClick={() => setActiveTab('whatsapp')}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors cursor-pointer ${
              activeTab === 'whatsapp'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            Boletim WhatsApp
          </button>
          <button
            onClick={() => setActiveTab('mprj')}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors cursor-pointer ${
              activeTab === 'mprj'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            Dossiê Técnico (MPRJ / SME)
          </button>
          <button
            onClick={() => setActiveTab('gemini')}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1 ${
              activeTab === 'gemini'
                ? 'bg-amber-500 text-slate-950 shadow-xs'
                : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            Assistente Gemini IA
          </button>
        </div>
      </div>

      {/* ABA 1: BOLETIM PREVENTIVO COMUNITÁRIO (WHATSAPP) */}
      {activeTab === 'whatsapp' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-white dark:bg-slate-900 rounded-xl p-5 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Share2 className="w-4 h-4 text-emerald-500" />
                  Boletim Preventivo Comunitário (Formato WhatsApp)
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Linguagem acessível para pais, responsáveis, grêmios e professores.
                </p>
              </div>

              {isApproved ? (
                <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1 bg-emerald-500/10 px-2 py-1 rounded-sm border border-emerald-500/20">
                  <CheckCheck className="w-4 h-4" />
                  APROVADO POR RESPONSÁVEL
                </span>
              ) : (
                <span className="text-xs font-bold text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2 py-1 rounded-sm border border-amber-500/20">
                  AGUARDANDO APROVAÇÃO
                </span>
              )}
            </div>

            {/* Caixa de Texto do Boletim Formatada */}
            <div className="relative">
              <pre className="w-full bg-slate-50 dark:bg-slate-950 p-4 rounded-xl border border-slate-200 dark:border-slate-800 text-xs font-sans whitespace-pre-wrap text-slate-800 dark:text-slate-200 leading-relaxed font-mono">
                {whatsappText}
              </pre>

              <button
                onClick={handleCopyWhatsApp}
                disabled={!isApproved}
                className={`mt-3 py-2.5 px-4 rounded-lg font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer ${
                  isApproved
                    ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm'
                    : 'bg-slate-200 dark:bg-slate-800 text-slate-400 cursor-not-allowed'
                }`}
              >
                {copiedMessage ? <CheckCheck className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                <span>
                  {copiedMessage ? 'Copiado para a Área de Transferência!' : isApproved ? 'Copiar Mensagem Formatada para WhatsApp' : 'Aprove o Boletim Abaixo para Liberar Cópia'}
                </span>
              </button>
            </div>
          </div>

          {/* Painel de Governança Humana (Critério Obrigatório do MVP) */}
          <div className="bg-white dark:bg-slate-900 rounded-xl p-5 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
              <Shield className="w-4 h-4 text-amber-500" />
              Controle de Governança Humana
            </h4>

            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              Conforme a especificação científica do projeto, nenhum boletim deve ser distribuído automaticamente sem a revisão e consentimento de um gestor ou liderança responsável.
            </p>

            <div className="space-y-3 pt-2 text-xs">
              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-medium mb-1">
                  Nome / Cargo do Aprovador:
                </label>
                <input
                  type="text"
                  value={approverName}
                  onChange={(e) => setApproverName(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg p-2 text-slate-900 dark:text-slate-100"
                />
              </div>

              <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700 text-[11px] text-slate-500">
                Data do aceite: {new Date().toLocaleDateString('pt-BR')} às{' '}
                {new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
              </div>

              <button
                onClick={() => setIsApproved(!isApproved)}
                className={`w-full py-2.5 px-3 rounded-lg font-bold text-xs flex items-center justify-center gap-2 cursor-pointer transition-colors ${
                  isApproved
                    ? 'bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100 dark:bg-rose-950/30 dark:border-rose-800'
                    : 'bg-slate-900 text-white dark:bg-amber-500 dark:text-slate-950'
                }`}
              >
                <FileCheck className="w-4 h-4" />
                <span>{isApproved ? 'Revogar Aprovação' : 'Aprovar Boletim para Envio'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ABA 2: DOSSIÊ TÉCNICO PARA GESTORES & AÇÃO CIVIL PÚBLICA (MPRJ) */}
      {activeTab === 'mprj' && (
        <div className="bg-white dark:bg-slate-900 rounded-xl p-6 border border-slate-200 dark:border-slate-800 shadow-xs space-y-6">
          <div className="border-b border-slate-100 dark:border-slate-800 pb-4">
            <div className="flex items-center gap-2 text-xs text-amber-600 dark:text-amber-400 font-bold uppercase tracking-wider mb-1">
              Subsídio Técnico para Gestão & Fiscalização Institucional
            </div>
            <h3 className="text-xl font-bold text-slate-900 dark:text-white">
              Dossiê Técnico de Exposição Térmica: {activeSchool.name}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Documento estruturado para complementar os diagnósticos de infraestrutura escolar e orientar prioridades de vistoria no âmbito da Ação Civil Pública do MPRJ (1ª e 2ª Promotorias de Tutela Coletiva da Educação).
            </p>
          </div>

          {/* Contexto da Oportunidade Institucional */}
          <div className="bg-slate-50 dark:bg-slate-800/40 rounded-xl p-4 border border-slate-200 dark:border-slate-700 text-xs space-y-2">
            <div className="flex items-center gap-2 text-slate-900 dark:text-white font-bold">
              <AlertCircle className="w-4 h-4 text-amber-500" />
              Contexto Institucional & Subsídio Técnico:
            </div>
            <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
              No âmbito das ações de tutela coletiva da educação do Ministério Público (MPRJ) sobre climatização e conforto térmico escolar na rede pública, este dossiê oferece um modelo para apoiar a priorização de vistorias técnicas e subsidiar planos de intervenção predial ao cruzar vulnerabilidade cadastral com a camada territorial de calor e persistência horária nos turnos letivos.
            </p>
          </div>

          {/* Quadro de Evidências Auditáveis da Unidade */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div className="border border-slate-200 dark:border-slate-800 rounded-xl p-4 space-y-2">
              <strong className="text-slate-900 dark:text-white block font-semibold">1. Identificação & Porte</strong>
              <div className="space-y-1 text-slate-600 dark:text-slate-400">
                <div>Código INEP: <span className="font-mono">{activeSchool.inepCode}</span></div>
                <div>Bairro / Região: {activeSchool.borough} ({activeSchool.region})</div>
                <div>Matrículas Totais: {formatIntegerPtBr(activeSchool.totalStudents)} alunos</div>
                <div>
                  Turnos:{' '}
                  {activeSchool.shiftsInformed === false
                    ? 'Turnos não informados no Censo (a confirmar com a escola)'
                    : activeSchool.shifts.join(', ')}
                </div>
              </div>
            </div>

            <div className="border border-slate-200 dark:border-slate-800 rounded-xl p-4 space-y-2">
              <strong className="text-slate-900 dark:text-white block font-semibold">2. Indicadores Desacoplados (72h)</strong>
              {(() => {
                const decoupled = calculateDecoupledRiskEvaluation(activeSchool, maxHI, activeSchool.inspection);
                return (
                  <div className="space-y-1 text-slate-600 dark:text-slate-400">
                    <div>Índice de Exposição Meteorológica (IE_met): <span className="font-mono font-bold text-amber-600">{decoupled.exposure.score}/100</span> ({decoupled.exposure.label})</div>
                    <div>Índice de Vulnerabilidade Física (IV_infra): <span className="font-mono font-bold text-rose-600">{decoupled.infrastructure.score}/100</span> ({decoupled.infrastructure.label})</div>
                    <div>Prioridade Combinada: <span className="font-mono font-bold uppercase">{decoupled.combinedPriority.replace('_', ' ')}</span> ({decoupled.combinedScore} pts)</div>
                    <div>
                      Fator de Ilha de Calor LST:{' '}
                      {activeSchool.heatIslandFactorLST !== null ? (
                        <span className="font-mono text-rose-600">{formatTempPtBr(activeSchool.heatIslandFactorLST, { signed: true })}</span>
                      ) : (
                        <span className="text-slate-400 italic">Pendente: cálculo por satélite ainda não importado</span>
                      )}
                    </div>
                  </div>
                );
              })()}
            </div>

            <div className="border border-slate-200 dark:border-slate-800 rounded-xl p-4 space-y-2">
              <strong className="text-slate-900 dark:text-white block font-semibold">3. Infraestrutura Cadastral vs. Vistoria</strong>
              <div className="space-y-1 text-slate-600 dark:text-slate-400">
                <div>Salas Climatizadas Declaradas: {activeSchool.declaredClimatizedRooms} de {activeSchool.totalRooms}</div>
                <div>Status em Vistoria: {activeSchool.inspection ? `${activeSchool.inspection.realAcStatus.replace('_', ' ')} (Exemplo)` : 'NÃO VISTORIADA'}</div>
                <div>Problema Elétrico Reportado: {activeSchool.inspection?.electricalOverloadReported ? 'SIM' : 'NÃO'}</div>
                <div>Cobertura Verificada: {activeSchool.inspection ? activeSchool.inspection.roofType.replace('_', ' ') : 'DESCONHECIDO'}</div>
              </div>
            </div>

            <div className="border border-slate-200 dark:border-slate-800 rounded-xl p-4 space-y-2">
              <strong className="text-slate-900 dark:text-white block font-semibold">4. Sensores e Estimativa de Ar</strong>
              {activeSchool.sentinelSensors && activeSchool.sentinelSensors.length > 0 ? (
                <div className="space-y-1 text-slate-600 dark:text-slate-400 font-mono">
                  {activeSchool.sentinelSensors.map((s, i) => (
                    <div key={i}>
                      {s.environment} (demo): <strong>{formatTempPtBr(s.temperatureC)}</strong> ({formatPercentIntPtBr(s.relativeHumidity)})
                      {typeof s.co2Ppm === 'number' && ` · CO2: ${formatIntegerPtBr(s.co2Ppm)} ppm`}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="space-y-1.5 text-slate-500 dark:text-slate-400">
                  <div className="italic">
                    Unidade sem sensor físico instalado. Temperatura interna e CO2 reais desabilitados até o piloto.
                  </div>
                  {airEstimate.status === 'disponivel' ? (
                    <div className="text-slate-700 dark:text-slate-300">
                      <strong>Estimativa de modelo (CO2):</strong> Turma média de {airEstimate.students} alunos ({airEstimate.shiftLabel});{' '}
                      {activeSchool.declaredClimatizedRooms > 0
                        ? `com split fechado, passa de 1.120 ppm em ~${airEstimate.firstMinuteAboveReferenceClosed} min de aula.`
                        : `com janelas abertas, pico estimado de ${formatIntegerPtBr(airEstimate.peakPpmOpenWindows ?? 0)} ppm.`}
                    </div>
                  ) : (
                    <div>Estimativa de ar pendente (turmas não carregadas).</div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Orientações de ventilação e ar externo no dossiê */}
          {(climatizedAirActionText || loadedOutdoorAirText) && (
            <div className="rounded-xl border border-cyan-500/30 bg-cyan-500/[0.06] p-4 text-xs space-y-2">
              <div className="font-bold text-cyan-950 dark:text-cyan-200 flex items-center gap-2">
                <Wind className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
                Orientações Preventivas de Renovação de Ar
              </div>
              {climatizedAirActionText && (
                <p className="text-slate-700 dark:text-slate-300 leading-relaxed">
                  {climatizedAirActionText}
                </p>
              )}
              {loadedOutdoorAirText && (
                <p className="text-amber-800 dark:text-amber-300 font-medium leading-relaxed">
                  {loadedOutdoorAirText}
                </p>
              )}
            </div>
          )}

          {/* Aviso Legal Obrigatório */}
          <div className="p-3 bg-slate-100 dark:bg-slate-800/80 rounded-lg text-slate-500 text-[11px] leading-relaxed">
            <strong>Ressalva Metodológica Legal:</strong> Este relatório constitui instrumento técnico preventivo baseado em dados abertos e modelos meteorológicos. Ele <strong>não substitui medições ocupacionais regulamentares de IBUTG (NR-15 / NHO-06 da Fundacentro) nem laudos periciais emitidos por engenheiros ou médicos do trabalho habilitados</strong>.
          </div>
        </div>
      )}

      {/* ABA 3: LABORATÓRIO & ASSISTENTE TÉCNICO GEMINI (AI STUDIO) */}
      {activeTab === 'gemini' && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-slate-900 rounded-xl p-5 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Cpu className="w-5 h-5 text-amber-500" />
                  Assistente Técnico com Google Gemini
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Geração de avaliação interpretativa com validação estrita em JSON Schema segundo a System Instruction oficial.
                </p>
              </div>

              <button
                onClick={handleTriggerGeminiAnalysis}
                disabled={isLoadingGemini}
                className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold rounded-lg text-xs flex items-center gap-2 cursor-pointer transition-colors shadow-xs"
              >
                {isLoadingGemini ? (
                  <>
                    <span className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                    <span>Processando Avaliação...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    <span>Avaliar Escola com Gemini</span>
                  </>
                )}
              </button>
            </div>

            {geminiError && (
              <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-700 dark:text-rose-300 text-xs">
                {geminiError}
              </div>
            )}

            {/* Resultado da Inferência do Gemini */}
            {geminiResult ? (
              <div className="space-y-4 pt-3 border-t border-slate-100 dark:border-slate-800 text-xs">
                {/* Parecer sobre Ar dentro da sala (Estimativa de modelo, sem sensor) */}
                {geminiResult.indoorAirStatus && (
                  <div className="p-4 rounded-xl bg-cyan-50/60 dark:bg-cyan-950/20 border border-cyan-200 dark:border-cyan-900/40 space-y-1.5">
                    <strong className="text-cyan-950 dark:text-cyan-200 block font-semibold flex items-center gap-1.5">
                      <Wind className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
                      Ar dentro da sala (estimativa por modelo, sem sensor):
                    </strong>
                    <p className="text-slate-700 dark:text-slate-300 leading-relaxed">
                      {geminiResult.indoorAirStatus}
                    </p>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Vulnerabilidades Confirmadas */}
                  <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 space-y-2">
                    <strong className="text-slate-900 dark:text-white block font-semibold">
                      Vulnerabilidades Confirmadas:
                    </strong>
                    <ul className="list-disc list-inside space-y-1 text-slate-600 dark:text-slate-300">
                      {geminiResult.confirmedVulnerabilities.map((v, i) => (
                        <li key={i}>{v}</li>
                      ))}
                    </ul>
                  </div>

                  {/* Informações Ausentes ou Desconhecidas */}
                  <div className="p-4 rounded-xl bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 space-y-2">
                    <strong className="text-amber-950 dark:text-amber-200 block font-semibold">
                      Informações Ausentes / Limitações de Dados:
                    </strong>
                    <ul className="list-disc list-inside space-y-1 text-amber-800 dark:text-amber-300">
                      {geminiResult.missingOrUnverifiedInformation.map((m, i) => (
                        <li key={i}>{m}</li>
                      ))}
                    </ul>
                  </div>
                </div>

                {/* Ações Preventivas Recomendadas */}
                <div className="p-4 rounded-xl bg-emerald-50/40 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/40 space-y-2">
                  <strong className="text-emerald-950 dark:text-emerald-200 block font-semibold">
                    Ações Preventivas Recomendadas pelo Assistente:
                  </strong>
                  <ul className="list-disc list-inside space-y-1 text-emerald-800 dark:text-emerald-300">
                    {geminiResult.recommendedPreventiveActions.map((a, i) => (
                      <li key={i}>{a}</li>
                    ))}
                  </ul>
                </div>

                {/* JSON Estruturado Validado */}
                <details className="p-3 rounded-lg bg-slate-900 text-slate-200 text-xs font-mono">
                  <summary className="cursor-pointer font-bold text-amber-400">
                    Ver Payload JSON Estruturado Validado (JSON Schema)
                  </summary>
                  <pre className="mt-2 text-[11px] overflow-x-auto whitespace-pre-wrap">
                    {JSON.stringify(geminiResult, null, 2)}
                  </pre>
                </details>
              </div>
            ) : (
              <div className="text-center py-8 text-slate-400 text-xs">
                Clique no botão acima para submeter os dados estruturados da escola (incluindo estimativa de CO2 e ar externo) ao modelo Gemini no backend.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
