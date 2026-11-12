/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  DayForecastSummary,
  HourlyForecastPoint,
  WeatherObservationStation,
  SchoolRecord,
} from '../types';
import { BellRing, Wind, X, Database, Clock, MapPin } from 'lucide-react';
import { DataProvenanceBadge } from './DataProvenanceBadge';
import { TermTooltip } from './TermTooltip';
import { bestVentilationHours } from '../utils/airQualityMath';
import {
  THERMAL_SCALE,
  ThermalStep,
  heatIndexToThermalStep,
} from '../styles/designTokens';
import {
  formatIntegerPtBr,
  formatNumberPtBr,
  formatPercentIntPtBr,
  formatTempPtBr,
} from '../utils/formatPtBr';
import {
  buildForecastVsObservedComparison,
  getInmetStateLabel,
} from '../utils/inmetUtils';

interface Monitoring72hProps {
  daysSummary: DayForecastSummary[];
  hourlyForecast?: HourlyForecastPoint[];
  stations: WeatherObservationStation[];
  sourceMeta: {
    source: string;
    model?: string;
    fetchedAt: string;
    isRealTime: boolean;
    isFallback: boolean;
    isCached?: boolean;
    fallbackReason?: string;
  };
  airQualityStatus?: 'loading' | 'disponivel' | 'indisponivel';
  activeSchool?: SchoolRecord;
  onSelectSchoolNavigate?: () => void;
  onOpenNotificationSettings?: () => void;
  onOpenAboutData?: () => void;
}

const MANHA_HOURS = ['07:00', '08:00', '09:00', '10:00', '11:00'];
const TARDE_HOURS = ['12:00', '13:00', '14:00', '15:00', '16:00'];
const INTEGRAL_HOURS = [...MANHA_HOURS, ...TARDE_HOURS];

const BAND_LABELS: Record<'normal' | 'atencao' | 'alerta' | 'perigo', string> = {
  normal: 'Normal',
  atencao: 'Atenção',
  alerta: 'Alerta',
  perigo: 'Perigo',
};

function riskBandToStep(
  riskBand: 'normal' | 'atencao' | 'alerta' | 'perigo',
  heatIndexC: number
): ThermalStep {
  if (riskBand === 'perigo') return 5;
  if (riskBand === 'alerta') return 4;
  if (riskBand === 'atencao') return 3;
  return heatIndexToThermalStep(heatIndexC);
}

function formatShortDate(dateStr: string): string {
  const parts = dateStr.split('-');
  if (parts.length !== 3) return dateStr;
  return `${parts[2]}/${parts[1]}`;
}

function formatHourLabel(timeIso: string): string {
  const hour = new Date(timeIso).getHours();
  return `${String(hour).padStart(2, '0')}h`;
}

function getShiftAirSummary(
  hourly: HourlyForecastPoint[],
  shiftHours: string[],
  airQualityStatus: 'loading' | 'disponivel' | 'indisponivel'
) {
  const bestRes = bestVentilationHours(hourly, shiftHours);
  const shiftPoints = hourly.filter((pt) =>
    shiftHours.some((sh) => pt.time.includes(sh) || pt.time.endsWith(sh))
  );

  if (airQualityStatus === 'loading') {
    return { status: 'loading' as const, bestRes, maxPm25: null, loadedHours: [] as string[] };
  }

  const pmValues = shiftPoints
    .map((p) => p.pm2_5)
    .filter((v): v is number => v !== undefined && v !== null);

  if (airQualityStatus !== 'disponivel' || pmValues.length === 0) {
    return { status: 'indisponivel' as const, bestRes, maxPm25: null, loadedHours: [] as string[] };
  }

  const maxPm25 = Math.max(...pmValues);
  const loadedHours = shiftPoints
    .filter((p) => (p.pm2_5 ?? 0) > 25)
    .map((p) => {
      if (p.time.includes('T')) return `${p.time.split('T')[1].slice(0, 2)}h`;
      return p.time.slice(0, 5);
    });

  return { status: 'disponivel' as const, bestRes, maxPm25, loadedHours };
}

export const Monitoring72h: React.FC<Monitoring72hProps> = ({
  daysSummary,
  hourlyForecast,
  stations,
  sourceMeta,
  airQualityStatus = 'loading',
  activeSchool,
  onOpenNotificationSettings,
  onOpenAboutData,
}) => {
  const [selectedDayIndex, setSelectedDayIndex] = useState(0);
  const [selectedHourIndex, setSelectedHourIndex] = useState<number>(14);
  const [showSourcePopover, setShowSourcePopover] = useState(false);
  const sourcePopoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showSourcePopover) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShowSourcePopover(false);
    };
    const handlePointerDown = (e: MouseEvent) => {
      if (sourcePopoverRef.current && !sourcePopoverRef.current.contains(e.target as Node)) {
        setShowSourcePopover(false);
      }
    };
    window.addEventListener('keydown', handleKey);
    document.addEventListener('mousedown', handlePointerDown);
    return () => {
      window.removeEventListener('keydown', handleKey);
      document.removeEventListener('mousedown', handlePointerDown);
    };
  }, [showSourcePopover]);

  const activeDay = daysSummary[selectedDayIndex] || daysSummary[0];
  const activeHourly: HourlyForecastPoint[] = activeDay ? activeDay.hourly : [];
  const safeHourIndex =
    selectedHourIndex >= 0 && selectedHourIndex < activeHourly.length
      ? selectedHourIndex
      : Math.min(14, Math.max(0, activeHourly.length - 1));
  const selectedPoint = activeHourly[safeHourIndex];

  const manhaAir = getShiftAirSummary(activeHourly, MANHA_HOURS, airQualityStatus);
  const tardeAir = getShiftAirSummary(activeHourly, TARDE_HOURS, airQualityStatus);
  const integralAir = getShiftAirSummary(activeHourly, INTEGRAL_HOURS, airQualityStatus);

  const formattedUpdatedTime = new Date(sourceMeta.fetchedAt).toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  });

  // Turno mais crítico entre os turnos letivos (Manhã vs Tarde)
  const criticalShiftKey: 'manha' | 'tarde' =
    activeDay && activeDay.shifts.manha.maxHeatIndexC > activeDay.shifts.tarde.maxHeatIndexC
      ? 'manha'
      : 'tarde';

  const renderShiftAirFooter = (airInfo: ReturnType<typeof getShiftAirSummary>) => (
    <div className="mt-3 pt-3 border-t border-[var(--border-subtle)] space-y-1 text-xs">
      <div className="flex items-center gap-1.5 font-semibold text-[var(--text-primary)]">
        <Wind className="w-3.5 h-3.5 text-[var(--text-muted)] shrink-0" />
        <span>Ar lá fora e janela</span>
      </div>

      {airInfo.status === 'loading' ? (
        <p className="text-[var(--text-muted)]">Carregando previsão do ar externo...</p>
      ) : airInfo.status === 'indisponivel' ? (
        <>
          <p className="text-[var(--text-secondary)]">
            Previsão do ar externo indisponível agora
          </p>
          {airInfo.bestRes.hours.length > 0 && (
            <p className="text-[var(--text-muted)] leading-snug">
              Melhor horário para abrir porta e janelas:{' '}
              <strong className="font-semibold text-[var(--text-primary)] tabular-nums">
                {airInfo.bestRes.hours.join(' e ')}
              </strong>{' '}
              ({airInfo.bestRes.notice || 'sem dado de partículas'}).
            </p>
          )}
        </>
      ) : (
        <>
          <p className="text-[var(--text-secondary)] tabular-nums">
            Partículas finas (PM2,5): máx{' '}
            <strong
              className="font-semibold"
              style={{
                color:
                  airInfo.maxPm25! > 25 ? THERMAL_SCALE[5].textVar : 'var(--text-primary)',
              }}
            >
              {formatNumberPtBr(airInfo.maxPm25!)} µg/m³
            </strong>
          </p>
          {airInfo.loadedHours.length > 0 && (
            <p
              className="font-semibold leading-snug"
              style={{ color: THERMAL_SCALE[5].textVar }}
            >
              Ar externo carregado (&gt; 25 µg/m³): {airInfo.loadedHours.join(', ')}.
            </p>
          )}
          <p className="text-[var(--text-secondary)] leading-snug">
            {airInfo.bestRes.allHoursLoaded ? (
              <strong style={{ color: THERMAL_SCALE[5].textVar }}>
                Ar externo carregado o turno todo: evite abrir janelas para a rua
              </strong>
            ) : (
              <span>
                Melhor horário para ventilar:{' '}
                <strong className="font-semibold text-[var(--text-primary)] tabular-nums">
                  {airInfo.bestRes.hours.join(' e ')}
                </strong>
              </span>
            )}
          </p>
        </>
      )}
    </div>
  );

  // Configuração dos 3 cards de turno
  const shiftCards = activeDay
    ? [
        {
          key: 'manha' as const,
          title: 'Manhã',
          window: '07h às 12h',
          summary: activeDay.shifts.manha,
          airInfo: manhaAir,
          context: `Pico às ${activeDay.shifts.manha.peakHour}`,
          showDangerRow: activeDay.shifts.manha.hours44Plus > 0,
        },
        {
          key: 'tarde' as const,
          title: 'Tarde',
          window: '12h às 17h',
          summary: activeDay.shifts.tarde,
          airInfo: tardeAir,
          context: `Pico às ${activeDay.shifts.tarde.peakHour}`,
          showDangerRow: true,
        },
        {
          key: 'integral' as const,
          title: 'Integral',
          window: '07h às 17h',
          summary: activeDay.shifts.integral,
          airInfo: integralAir,
          context: `Duração de 10 h · pico às ${activeDay.shifts.integral.peakHour}`,
          showDangerRow: activeDay.shifts.integral.hours44Plus > 0,
        },
      ]
    : [];

  // Gráfico SVG das 24 horas
  const svgW = 600;
  const svgH = 210;
  const padL = 40;
  const padR = 12;
  const padT = 16;
  const padB = 28;
  const plotW = svgW - padL - padR;
  const plotH = svgH - padT - padB;
  const yMin = 22;
  const maxHourlyHI = activeHourly.reduce((acc, pt) => Math.max(acc, pt.heatIndexC), 46);
  const yMax = Math.max(48, Math.ceil(maxHourlyHI / 2) * 2 + 2);
  const yForTemp = (temp: number) => {
    const clamped = Math.max(yMin, Math.min(yMax, temp));
    return padT + plotH - ((clamped - yMin) / (yMax - yMin)) * plotH;
  };

  const chartThresholds = [
    { temp: 36, label: '36 °C Atenção', color: THERMAL_SCALE[3].solidVar },
    { temp: 40, label: '40 °C Alerta', color: THERMAL_SCALE[4].solidVar },
    { temp: 44, label: '44 °C Perigo', color: THERMAL_SCALE[5].solidVar },
  ];

  const yTicks = [24, 28, 32, 36, 40, 44, 48].filter((v) => v >= yMin && v <= yMax);

  return (
    <div className="space-y-5">
      {/* 1. Topo da aba em 1 linha compacta */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 min-w-0">
          <h2 className="text-lg sm:text-xl font-semibold text-[var(--text-primary)] tracking-tight">
            Previsão 72h
          </h2>

          {/* Selo Previsão/Simulado clicável com fonte completa */}
          <div ref={sourcePopoverRef} className="relative inline-flex items-center">
            <button
              type="button"
              onClick={() => setShowSourcePopover((prev) => !prev)}
              aria-expanded={showSourcePopover}
              className="min-h-[32px] px-2.5 py-1 rounded-[var(--radius-control)] text-xs font-semibold border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--border-strong)] ui-transition cursor-pointer"
            >
              {sourceMeta.isFallback ? 'Simulado' : 'Previsão'}
            </button>

            {showSourcePopover && (
              <div
                role="dialog"
                aria-label="Detalhes da fonte da previsão"
                className="absolute left-0 top-full mt-2 z-50 w-80 max-w-[calc(100vw-2rem)] p-4 bg-[var(--bg-surface)] rounded-[var(--radius-card)] shadow-[var(--shadow-overlay)] border border-[var(--border-subtle)] text-xs text-[var(--text-secondary)] space-y-2.5"
              >
                <div className="flex items-center justify-between pb-2 border-b border-[var(--border-subtle)]">
                  <span className="font-semibold text-[var(--text-primary)]">
                    {sourceMeta.isFallback ? 'Modo simulação local' : 'Previsão numérica'}
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowSourcePopover(false)}
                    aria-label="Fechar detalhes da fonte"
                    className="p-1 rounded text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>

                <p className="leading-relaxed">
                  {sourceMeta.isFallback
                    ? 'Conexão externa indisponível no momento. Dados calculados com perfil determinístico local.'
                    : 'Previsão horária contínua de 72 horas para a temperatura, umidade, vento e partículas externas na localização da escola.'}
                </p>

                <div className="space-y-1.5 pt-1">
                  <div className="flex items-start gap-2">
                    <Database className="w-3.5 h-3.5 text-[var(--text-muted)] shrink-0 mt-0.5" />
                    <span>
                      <strong className="font-semibold text-[var(--text-primary)]">Tempo:</strong>{' '}
                      {sourceMeta.source}
                      {sourceMeta.model ? ` (${sourceMeta.model})` : ''}
                    </span>
                  </div>
                  <div className="flex items-start gap-2">
                    <Wind className="w-3.5 h-3.5 text-[var(--text-muted)] shrink-0 mt-0.5" />
                    <span>
                      <strong className="font-semibold text-[var(--text-primary)]">Ar externo:</strong>{' '}
                      CAMS (Copernicus) via Open-Meteo, grade de ~45 km
                    </span>
                  </div>
                  <div className="flex items-start gap-2">
                    <Clock className="w-3.5 h-3.5 text-[var(--text-muted)] shrink-0 mt-0.5" />
                    <span>
                      <strong className="font-semibold text-[var(--text-primary)]">Referência:</strong>{' '}
                      Atualizado às {formattedUpdatedTime}
                      {sourceMeta.isCached ? ' (Cache 1h)' : ''}
                    </span>
                  </div>
                  <div className="flex items-start gap-2">
                    <MapPin className="w-3.5 h-3.5 text-[var(--text-muted)] shrink-0 mt-0.5" />
                    <span>
                      <strong className="font-semibold text-[var(--text-primary)]">Local:</strong>{' '}
                      {activeSchool
                        ? `${activeSchool.name} (${activeSchool.borough})`
                        : 'Região Metropolitana do Rio de Janeiro'}
                    </span>
                  </div>
                  {sourceMeta.isFallback && sourceMeta.fallbackReason && (
                    <p className="text-[var(--text-muted)] pt-1">
                      Motivo: {sourceMeta.fallbackReason}
                    </p>
                  )}
                </div>

                {onOpenAboutData && (
                  <button
                    type="button"
                    onClick={() => {
                      setShowSourcePopover(false);
                      onOpenAboutData();
                    }}
                    className="w-full min-h-[36px] px-3 py-1.5 rounded-[var(--radius-control)] border border-[var(--border-subtle)] text-xs font-semibold text-[var(--text-primary)] hover:bg-[var(--bg-surface-subtle)] ui-transition cursor-pointer"
                  >
                    Ver metodologia completa em Sobre os dados
                  </button>
                )}
              </div>
            )}
          </div>

          <span className="text-xs text-[var(--text-muted)] tabular-nums">
            Atualizado às {formattedUpdatedTime}
          </span>
        </div>

        {onOpenNotificationSettings && (
          <button
            type="button"
            onClick={onOpenNotificationSettings}
            className="min-h-[44px] px-3.5 py-2 rounded-[var(--radius-control)] border border-[var(--border-strong)] bg-transparent text-[var(--text-primary)] hover:bg-[var(--bg-surface-subtle)] text-xs font-semibold inline-flex items-center gap-1.5 ui-transition whitespace-nowrap shrink-0 cursor-pointer"
          >
            <BellRing className="w-4 h-4 shrink-0" />
            <span>Receber alertas</span>
          </button>
        )}
      </div>

      {/* 2. Seletor de Dia em controle segmentado (largura total no celular, ativo em grafite) */}
      <div
        role="tablist"
        aria-label="Selecionar dia da previsão"
        className="w-full md:w-auto md:inline-grid grid grid-cols-3 gap-1 p-1 rounded-[var(--radius-card)] bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)]"
      >
        {daysSummary.map((day, idx) => {
          const isSelected = idx === selectedDayIndex;
          const label = idx === 0 ? 'Hoje' : idx === 1 ? 'Amanhã' : 'Depois';

          return (
            <button
              key={day.date}
              type="button"
              role="tab"
              aria-selected={isSelected}
              onClick={() => {
                setSelectedDayIndex(idx);
                setSelectedHourIndex(14);
              }}
              className={`min-h-[44px] px-2.5 sm:px-4 py-2 rounded-[var(--radius-control)] text-left ui-transition cursor-pointer min-w-0 ${
                isSelected
                  ? 'bg-[var(--action-primary)] text-[var(--action-primary-fg)] shadow-[var(--shadow-card)]'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface)]/70'
              }`}
            >
              <div className="text-xs font-semibold truncate">{label}</div>
              <div
                className={`text-xs truncate ${
                  isSelected ? 'opacity-90' : 'text-[var(--text-muted)]'
                }`}
              >
                <span className="sm:hidden tabular-nums">{formatShortDate(day.date)}</span>
                <span className="hidden sm:inline">{day.dayLabel}</span>
              </div>
              <div
                className={`text-xs font-semibold tabular-nums mt-0.5 truncate ${
                  isSelected ? 'opacity-95' : 'text-[var(--text-primary)]'
                }`}
              >
                Máx {formatTempPtBr(day.maxHeatIndexC)}
              </div>
            </button>
          );
        })}
      </div>

      {/* 3. Cards de Turno (1 por linha no celular, 3 no desktop) */}
      {activeDay && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {shiftCards.map((card) => {
            const step = riskBandToStep(card.summary.riskBand, card.summary.maxHeatIndexC);
            const scale = THERMAL_SCALE[step];
            const isCriticalShift = card.key === criticalShiftKey;

            return (
              <section
                key={card.key}
                aria-label={`Previsão para o turno ${card.title}`}
                className="civic-card p-4 sm:p-5 flex flex-col justify-between min-w-0"
                style={
                  isCriticalShift
                    ? {
                        borderLeftWidth: '4px',
                        borderLeftColor: scale.solidVar,
                      }
                    : undefined
                }
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div className="min-w-0">
                      <h3 className="text-sm font-semibold text-[var(--text-primary)]">
                        {card.title}
                      </h3>
                      <p className="text-xs text-[var(--text-muted)]">{card.window}</p>
                    </div>

                    <span
                      className="inline-flex items-center px-2.5 py-0.5 rounded-[var(--radius-control)] border text-xs font-semibold shrink-0"
                      style={{
                        backgroundColor: scale.bgVar,
                        borderColor: scale.borderVar,
                        color: scale.textVar,
                      }}
                    >
                      {BAND_LABELS[card.summary.riskBand]}
                    </span>
                  </div>

                  {/* Padrão dos indicadores do Mapa: número grande tabular sans, unidade menor, contexto */}
                  <div className="space-y-1">
                    <div className="flex items-baseline gap-1">
                      <span
                        className="text-2xl font-semibold tabular-nums leading-tight"
                        style={{ color: scale.textVar }}
                      >
                        {formatNumberPtBr(card.summary.maxHeatIndexC)}
                      </span>
                      <span className="text-sm text-[var(--text-secondary)]">°C</span>
                    </div>
                    <p className="text-xs text-[var(--text-secondary)] leading-snug tabular-nums">
                      {card.context}
                    </p>
                  </div>

                  {/* Linhas em linguagem simples com tooltip de explicação */}
                  <div className="mt-4 pt-3 border-t border-[var(--border-subtle)] space-y-2 text-xs">
                    <div className="flex items-center justify-between gap-2 text-[var(--text-secondary)]">
                      <span className="inline-flex items-center gap-1 min-w-0">
                        <span>Horas em atenção</span>
                        <TermTooltip
                          term="Horas em atenção (IC ≥ 36 °C)"
                          explanation="Quantidade de horas do turno em que o Índice de Calor (IC) atinge 36 °C ou mais. O IC combina temperatura do ar e umidade para estimar o calor sentido pelo corpo."
                          align="left"
                        />
                      </span>
                      <strong className="font-semibold text-[var(--text-primary)] tabular-nums shrink-0">
                        {formatIntegerPtBr(card.summary.hours36Plus)} h
                      </strong>
                    </div>

                    <div className="flex items-center justify-between gap-2 text-[var(--text-secondary)]">
                      <span className="inline-flex items-center gap-1 min-w-0">
                        <span>Horas em alerta</span>
                        <TermTooltip
                          term="Horas em alerta (IC ≥ 40 °C)"
                          explanation="Quantidade de horas do turno em que o Índice de Calor (IC) atinge 40 °C ou mais. Indica necessidade de hidratação contínua e suspensão de atividades ao sol."
                          align="left"
                        />
                      </span>
                      <strong
                        className="font-semibold tabular-nums shrink-0"
                        style={{
                          color:
                            card.summary.hours40Plus > 0
                              ? THERMAL_SCALE[4].textVar
                              : 'var(--text-primary)',
                        }}
                      >
                        {formatIntegerPtBr(card.summary.hours40Plus)} h
                      </strong>
                    </div>

                    {card.showDangerRow && (
                      <div className="flex items-center justify-between gap-2 text-[var(--text-secondary)]">
                        <span className="inline-flex items-center gap-1 min-w-0">
                          <span>Horas em perigo</span>
                          <TermTooltip
                            term="Horas em perigo (IC ≥ 44 °C)"
                            explanation="Quantidade de horas do turno com Índice de Calor (IC) de 44 °C ou mais, limiar crítico adotado pela Secretaria Municipal de Educação."
                            align="left"
                          />
                        </span>
                        <strong
                          className="font-semibold tabular-nums shrink-0"
                          style={{
                            color:
                              card.summary.hours44Plus > 0
                                ? THERMAL_SCALE[5].textVar
                                : 'var(--text-primary)',
                          }}
                        >
                          {formatIntegerPtBr(card.summary.hours44Plus)} h
                        </strong>
                      </div>
                    )}
                  </div>
                </div>

                {renderShiftAirFooter(card.airInfo)}
              </section>
            );
          })}
        </div>
      )}

      {/* 4. Gráfico Horário das 24 Horas */}
      <section className="civic-card p-4 sm:p-5 space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-0.5">
            <div className="flex items-center gap-1.5">
              <h3 className="text-sm sm:text-base font-semibold text-[var(--text-primary)]">
                Evolução horária do Índice de Calor (24h)
              </h3>
              <TermTooltip
                term="Índice de Calor (IC)"
                explanation="Medida combinada de temperatura do ar e umidade relativa (NOAA/NWS) que representa o esforço térmico percebido pelo organismo. A área sombreada marca o horário escolar (07h às 17h)."
                align="left"
              />
            </div>
            <p className="text-xs text-[var(--text-muted)]">
              Passe o cursor ou toque em uma barra para ver os valores de cada hora.
            </p>
          </div>

          {selectedPoint && (
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 bg-[var(--bg-surface-subtle)] px-3 py-2 rounded-[var(--radius-control)] border border-[var(--border-subtle)] text-xs tabular-nums">
              <span className="font-semibold text-[var(--text-primary)]">
                {formatHourLabel(selectedPoint.time)}
              </span>
              <span className="text-[var(--text-secondary)]">
                Sensação:{' '}
                <strong
                  className="font-semibold"
                  style={{
                    color: THERMAL_SCALE[heatIndexToThermalStep(selectedPoint.heatIndexC)].textVar,
                  }}
                >
                  {formatTempPtBr(selectedPoint.heatIndexC)}
                </strong>
              </span>
              <span className="text-[var(--text-secondary)]">
                Ar: {formatTempPtBr(selectedPoint.temperatureC)}
              </span>
              <span className="text-[var(--text-secondary)]">
                Umidade: {formatPercentIntPtBr(selectedPoint.relativeHumidity)}
              </span>
              <span className="text-[var(--text-secondary)]">
                Vento: {formatIntegerPtBr(selectedPoint.windSpeedKmh)} km/h
              </span>
              {airQualityStatus === 'disponivel' &&
                selectedPoint.pm2_5 !== undefined &&
                selectedPoint.pm2_5 !== null && (
                  <span
                    className="font-semibold"
                    style={{
                      color:
                        selectedPoint.pm2_5 > 25
                          ? THERMAL_SCALE[5].textVar
                          : 'var(--text-primary)',
                    }}
                  >
                    PM2,5: {formatNumberPtBr(selectedPoint.pm2_5)} µg/m³
                  </span>
                )}
            </div>
          )}
        </div>

        {/* SVG responsivo com eixos discretos e linhas de limite na escala térmica */}
        <div className="w-full">
          <svg
            viewBox={`0 0 ${svgW} ${svgH}`}
            role="img"
            aria-label="Gráfico horário do Índice de Calor nas próximas 24 horas"
            className="w-full max-h-[260px] h-auto block select-none"
          >
            {/* Faixa discreta do horário escolar (07h às 17h) */}
            {activeHourly.length >= 17 && (
              <rect
                x={padL + (7 / 24) * plotW}
                y={padT}
                width={(10 / 24) * plotW}
                height={plotH}
                fill="var(--bg-surface-subtle)"
                opacity={0.7}
              />
            )}

            {/* Grades horizontais discretas e eixo Y */}
            {yTicks.map((tick) => {
              const ty = yForTemp(tick);
              return (
                <g key={tick}>
                  <line
                    x1={padL}
                    y1={ty}
                    x2={svgW - padR}
                    y2={ty}
                    stroke="var(--border-subtle)"
                    strokeWidth={1}
                  />
                  <text
                    x={padL - 8}
                    y={ty + 4}
                    textAnchor="end"
                    fill="var(--text-muted)"
                    fontSize="11"
                  >
                    {tick}°
                  </text>
                </g>
              );
            })}

            {/* Linhas de limite nas cores da escala térmica */}
            {chartThresholds.map((th) => {
              if (th.temp < yMin || th.temp > yMax) return null;
              const ty = yForTemp(th.temp);
              return (
                <g key={th.temp}>
                  <line
                    x1={padL}
                    y1={ty}
                    x2={svgW - padR}
                    y2={ty}
                    stroke={th.color}
                    strokeWidth={1.25}
                    strokeDasharray="4 3"
                    opacity={0.8}
                  />
                  <text
                    x={svgW - padR - 4}
                    y={ty - 4}
                    textAnchor="end"
                    fill={th.color}
                    fontSize="10"
                    fontWeight={600}
                  >
                    {th.label}
                  </text>
                </g>
              );
            })}

            {/* Barras das 24 horas */}
            {activeHourly.map((pt, idx) => {
              const barSlotW = plotW / Math.max(1, activeHourly.length);
              const barW = Math.max(6, barSlotW - 4);
              const x = padL + idx * barSlotW + (barSlotW - barW) / 2;
              const topY = yForTemp(pt.heatIndexC);
              const barH = Math.max(3, padT + plotH - topY);
              const step = heatIndexToThermalStep(pt.heatIndexC);
              const isSelected = idx === safeHourIndex;
              const hour = new Date(pt.time).getHours();
              const showTick = hour === 0 || hour === 3 || hour === 7 || hour === 12 || hour === 17 || hour === 20 || hour === 23;

              return (
                <g
                  key={pt.time || idx}
                  className="cursor-pointer"
                  onMouseEnter={() => setSelectedHourIndex(idx)}
                  onClick={() => setSelectedHourIndex(idx)}
                >
                  <rect
                    x={padL + idx * barSlotW}
                    y={padT}
                    width={barSlotW}
                    height={plotH}
                    fill="transparent"
                  />
                  <rect
                    x={x}
                    y={topY}
                    width={barW}
                    height={barH}
                    rx={3}
                    fill={THERMAL_SCALE[step].solidVar}
                    opacity={isSelected ? 1 : 0.82}
                    stroke={isSelected ? 'var(--border-focus)' : 'none'}
                    strokeWidth={isSelected ? 1.5 : 0}
                  />
                  {showTick && (
                    <text
                      x={x + barW / 2}
                      y={svgH - 8}
                      textAnchor="middle"
                      fill={isSelected ? 'var(--text-primary)' : 'var(--text-muted)'}
                      fontSize="11"
                      fontWeight={isSelected ? 600 : 400}
                    >
                      {hour}h
                    </text>
                  )}
                </g>
              );
            })}
          </svg>
        </div>

        {/* Legenda curta da escala térmica */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-[var(--text-secondary)]">
          {([1, 2, 3, 4, 5] as ThermalStep[]).map((step) => {
            const labelText =
              step === 1
                ? 'Normal (< 32 °C)'
                : step === 2
                ? 'Normal (32–35,9 °C)'
                : step === 3
                ? 'Atenção (36–39,9 °C)'
                : step === 4
                ? 'Alerta (40–43,9 °C)'
                : 'Perigo (≥ 44 °C)';

            return (
              <div key={step} className="inline-flex items-center gap-1.5">
                <span
                  aria-hidden="true"
                  className="w-3 h-3 rounded-xs shrink-0"
                  style={{ backgroundColor: THERMAL_SCALE[step].solidVar }}
                />
                <span>{labelText}</span>
              </div>
            );
          })}
        </div>

        <p className="text-xs text-[var(--text-muted)] leading-relaxed pt-1 border-t border-[var(--border-subtle)]">
          <strong>Nota de rigor conceitual:</strong> As faixas acima refletem a intensidade horária do Índice de Calor (NOAA/NWS) no turno escolar. A decretação formal dos Níveis de Calor (NC1 a NC5) do Centro de Operações Rio (COR) segue protocolo próprio da Prefeitura que exige persistência temporal de dias consecutivos.
        </p>
      </section>

      {/* 5. Tabela Horária com cabeçalho fixo e rolagem interna */}
      <section className="civic-card overflow-hidden">
        <div className="px-4 sm:px-5 py-3.5 border-b border-[var(--border-subtle)] flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold text-[var(--text-primary)]">
              Tabela horária de previsão ({activeDay?.dayLabel})
            </h3>
            <p className="text-xs text-[var(--text-muted)]">
              Toque em uma linha para destacar o horário no gráfico.
            </p>
          </div>
          <span className="text-xs text-[var(--text-muted)] tabular-nums">
            {activeHourly.length} horas
          </span>
        </div>

        <div className="max-h-72 overflow-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="sticky top-0 z-10 bg-[var(--bg-surface-subtle)] border-b border-[var(--border-subtle)] text-[var(--text-muted)]">
              <tr>
                <th className="py-2.5 px-4 font-semibold whitespace-nowrap">Hora</th>
                <th className="py-2.5 px-3 font-semibold text-right whitespace-nowrap">
                  Índice de Calor
                </th>
                <th className="py-2.5 px-3 font-semibold text-right whitespace-nowrap">
                  Temp. Ar
                </th>
                <th className="py-2.5 px-3 font-semibold text-right whitespace-nowrap">
                  Umidade
                </th>
                <th className="py-2.5 px-3 font-semibold text-right whitespace-nowrap">Vento</th>
                <th className="py-2.5 px-3 font-semibold text-right whitespace-nowrap">PM2,5</th>
                <th className="py-2.5 px-4 font-semibold text-right whitespace-nowrap">
                  Situação
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-subtle)]">
              {activeHourly.map((pt, idx) => {
                const step = riskBandToStep(pt.riskBand, pt.heatIndexC);
                const scale = THERMAL_SCALE[step];
                const isSelected = idx === safeHourIndex;

                return (
                  <tr
                    key={pt.time || idx}
                    onClick={() => setSelectedHourIndex(idx)}
                    className={`cursor-pointer ui-transition ${
                      isSelected
                        ? 'bg-[var(--bg-surface-subtle)]'
                        : 'hover:bg-[var(--bg-surface-subtle)]/60'
                    }`}
                  >
                    <td className="py-2.5 px-4 font-semibold text-[var(--text-primary)] tabular-nums whitespace-nowrap">
                      {formatHourLabel(pt.time)}
                    </td>
                    <td
                      className="py-2.5 px-3 text-right font-semibold tabular-nums whitespace-nowrap"
                      style={{ color: scale.textVar }}
                    >
                      {formatTempPtBr(pt.heatIndexC)}
                    </td>
                    <td className="py-2.5 px-3 text-right text-[var(--text-secondary)] tabular-nums whitespace-nowrap">
                      {formatTempPtBr(pt.temperatureC)}
                    </td>
                    <td className="py-2.5 px-3 text-right text-[var(--text-secondary)] tabular-nums whitespace-nowrap">
                      {formatPercentIntPtBr(pt.relativeHumidity)}
                    </td>
                    <td className="py-2.5 px-3 text-right text-[var(--text-secondary)] tabular-nums whitespace-nowrap">
                      {formatIntegerPtBr(pt.windSpeedKmh)} km/h
                    </td>
                    <td
                      className="py-2.5 px-3 text-right tabular-nums whitespace-nowrap"
                      style={{
                        color:
                          pt.pm2_5 !== undefined && pt.pm2_5 !== null && pt.pm2_5 > 25
                            ? THERMAL_SCALE[5].textVar
                            : 'var(--text-secondary)',
                      }}
                    >
                      {airQualityStatus === 'disponivel' &&
                      pt.pm2_5 !== undefined &&
                      pt.pm2_5 !== null
                        ? `${formatNumberPtBr(pt.pm2_5)} µg/m³`
                        : '-'}
                    </td>
                    <td className="py-2.5 px-4 text-right whitespace-nowrap">
                      <span
                        className="inline-flex items-center px-2 py-0.5 rounded-[var(--radius-control)] border text-xs font-semibold"
                        style={{
                          backgroundColor: scale.bgVar,
                          borderColor: scale.borderVar,
                          color: scale.textVar,
                        }}
                      >
                        {BAND_LABELS[pt.riskBand]}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* 6. Cartão "Previsto x Observado" (oculto até haver leitura observada real do INMET) */}
      {(() => {
        const allHourly =
          hourlyForecast && hourlyForecast.length > 0
            ? hourlyForecast
            : daysSummary.flatMap((d) => d.hourly);
        const comparison = buildForecastVsObservedComparison(stations, allHourly);
        if (!comparison) return null;

        const obsHiStep =
          comparison.observedHeatIndexC !== null
            ? heatIndexToThermalStep(comparison.observedHeatIndexC)
            : null;
        const fcHiStep = heatIndexToThermalStep(comparison.forecastHeatIndexC);

        return (
          <section
            aria-label="Previsto versus observado"
            className="civic-card p-4 sm:p-5 space-y-3"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-semibold text-[var(--text-primary)]">
                  Previsto x Observado ({comparison.observedHourLabel} BRT)
                </h3>
                <p className="text-xs text-[var(--text-muted)]">
                  Comparação entre Open-Meteo e a estação mais próxima: {comparison.station.name}
                  {Number.isFinite(comparison.station.distanceKm)
                    ? ` (${formatNumberPtBr(comparison.station.distanceKm!)} km)`
                    : ''}
                </p>
              </div>
              <span className="inline-flex items-center px-2 py-0.5 rounded-[var(--radius-control)] border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] text-xs font-semibold text-[var(--text-secondary)]">
                {getInmetStateLabel(comparison.station)}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div className="p-3 rounded-[var(--radius-control)] bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] space-y-1">
                <span className="text-[var(--text-muted)] block">Temperatura do ar</span>
                <div className="flex items-baseline justify-between gap-2 tabular-nums">
                  <span>
                    Obs:{' '}
                    <strong className="font-semibold text-[var(--text-primary)]">
                      {formatTempPtBr(comparison.observedTempC)}
                    </strong>
                  </span>
                  <span className="text-[var(--text-secondary)]">
                    Prev: {formatTempPtBr(comparison.forecastTempC)}
                  </span>
                </div>
                <span className="text-[var(--text-muted)] tabular-nums block">
                  Diferença: {formatTempPtBr(comparison.tempDiffC, { signed: true })}
                </span>
              </div>

              <div className="p-3 rounded-[var(--radius-control)] bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] space-y-1">
                <span className="text-[var(--text-muted)] block">Umidade relativa</span>
                <div className="flex items-baseline justify-between gap-2 tabular-nums">
                  <span>
                    Obs:{' '}
                    <strong className="font-semibold text-[var(--text-primary)]">
                      {comparison.observedHumidityPercent !== null
                        ? formatPercentIntPtBr(comparison.observedHumidityPercent)
                        : '-'}
                    </strong>
                  </span>
                  <span className="text-[var(--text-secondary)]">
                    Prev: {formatPercentIntPtBr(comparison.forecastHumidityPercent)}
                  </span>
                </div>
              </div>

              <div className="p-3 rounded-[var(--radius-control)] bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] space-y-1">
                <span className="text-[var(--text-muted)] block">Índice de Calor</span>
                <div className="flex items-baseline justify-between gap-2 tabular-nums">
                  <span>
                    Obs:{' '}
                    <strong
                      className="font-semibold"
                      style={{
                        color:
                          obsHiStep !== null
                            ? THERMAL_SCALE[obsHiStep].textVar
                            : 'var(--text-muted)',
                      }}
                    >
                      {comparison.observedHeatIndexC !== null
                        ? formatTempPtBr(comparison.observedHeatIndexC)
                        : '-'}
                    </strong>
                  </span>
                  <span style={{ color: THERMAL_SCALE[fcHiStep].textVar }}>
                    Prev: {formatTempPtBr(comparison.forecastHeatIndexC)}
                  </span>
                </div>
                {comparison.heatIndexDiffC !== null && (
                  <span className="text-[var(--text-muted)] tabular-nums block">
                    Diferença: {formatTempPtBr(comparison.heatIndexDiffC, { signed: true })}
                  </span>
                )}
              </div>
            </div>
          </section>
        );
      })()}

      {/* 7. Estações Meteorológicas Automáticas do INMET (RJ) */}
      <section className="civic-card overflow-hidden">
        <div className="px-4 sm:px-5 py-3.5 border-b border-[var(--border-subtle)] flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold text-[var(--text-primary)]">
              Estações automáticas em superfície (INMET RJ)
            </h3>
            <p className="text-xs text-[var(--text-muted)]">
              {activeSchool
                ? `Ordenadas por distância até ${activeSchool.name}.`
                : 'Situação operacional e distância até a escola selecionada.'}
            </p>
          </div>

          <DataProvenanceBadge
            provenance={{
              source: 'INMET (Estações Automáticas RJ)',
              timestamp: 'Atualização horária (cache 1h)',
              location: 'Região Metropolitana do Rio',
              nature: 'observacao',
              natureDescription:
                'Lista oficial de estações automáticas do INMET no RJ. Nenhuma leitura simulada é exibida nestas estações.',
            }}
            variant="compact"
          />
        </div>

        <div className="max-h-72 overflow-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="sticky top-0 z-10 bg-[var(--bg-surface-subtle)] border-b border-[var(--border-subtle)] text-[var(--text-muted)]">
              <tr>
                <th className="py-2.5 px-4 font-semibold whitespace-nowrap">Estação</th>
                <th className="py-2.5 px-3 font-semibold text-right whitespace-nowrap">
                  Distância
                </th>
                <th className="py-2.5 px-3 font-semibold whitespace-nowrap">Operação</th>
                <th className="py-2.5 px-3 font-semibold text-right whitespace-nowrap">
                  Temp. Ar
                </th>
                <th className="py-2.5 px-3 font-semibold text-right whitespace-nowrap">
                  Umidade
                </th>
                <th className="py-2.5 px-3 font-semibold text-right whitespace-nowrap">
                  Índice de Calor
                </th>
                <th className="py-2.5 px-4 font-semibold text-right whitespace-nowrap">
                  Situação
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-subtle)]">
              {stations.map((station) => {
                const hasTemp =
                  station.temperatureC !== null && station.temperatureC !== undefined;
                const hasHumidity =
                  station.humidityPercent !== null && station.humidityPercent !== undefined;
                const hasHeatIndex =
                  station.heatIndexC !== null && station.heatIndexC !== undefined;
                const hiStep = hasHeatIndex
                  ? heatIndexToThermalStep(station.heatIndexC!)
                  : null;
                const stateLabel = getInmetStateLabel(station);
                const state = station.observationState ?? 'aguardando_token';

                const badgeStyle =
                  state === 'estacao_em_pane' || state === 'inmet_indisponivel'
                    ? {
                        backgroundColor: THERMAL_SCALE[5].bgVar,
                        borderColor: THERMAL_SCALE[5].borderVar,
                        color: THERMAL_SCALE[5].textVar,
                      }
                    : state === 'dado_atrasado'
                    ? {
                        backgroundColor: THERMAL_SCALE[3].bgVar,
                        borderColor: THERMAL_SCALE[3].borderVar,
                        color: THERMAL_SCALE[3].textVar,
                      }
                    : state === 'leitura'
                    ? {
                        backgroundColor: THERMAL_SCALE[2].bgVar,
                        borderColor: THERMAL_SCALE[2].borderVar,
                        color: THERMAL_SCALE[2].textVar,
                      }
                    : {
                        backgroundColor: 'var(--bg-surface-subtle)',
                        borderColor: 'var(--border-subtle)',
                        color: 'var(--text-secondary)',
                      };

                return (
                  <tr key={station.id} className="hover:bg-[var(--bg-surface-subtle)]/60">
                    <td className="py-2.5 px-4">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="font-semibold text-[var(--text-primary)]">
                          {station.name}
                        </span>
                        {station.isNearest && (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded-[var(--radius-control)] border border-[var(--border-strong)] bg-[var(--bg-surface-subtle)] text-[11px] font-semibold text-[var(--text-primary)]">
                            Mais próxima
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-[var(--text-muted)] tabular-nums">
                        {station.stationCode ? `${station.stationCode} · ` : ''}
                        {formatNumberPtBr(station.latitude, { decimals: 2 })},{' '}
                        {formatNumberPtBr(station.longitude, { decimals: 2 })}
                      </div>
                    </td>
                    <td className="py-2.5 px-3 text-right text-[var(--text-secondary)] tabular-nums whitespace-nowrap">
                      {station.distanceKm !== undefined && Number.isFinite(station.distanceKm)
                        ? `${formatNumberPtBr(station.distanceKm)} km`
                        : '-'}
                    </td>
                    <td className="py-2.5 px-3 text-[var(--text-secondary)] whitespace-nowrap">
                      {station.status === 'manutencao' ? 'Pane' : 'Operante'}
                    </td>
                    <td className="py-2.5 px-3 text-right text-[var(--text-secondary)] tabular-nums whitespace-nowrap">
                      {hasTemp ? formatTempPtBr(station.temperatureC!) : '-'}
                    </td>
                    <td className="py-2.5 px-3 text-right text-[var(--text-secondary)] tabular-nums whitespace-nowrap">
                      {hasHumidity ? formatPercentIntPtBr(station.humidityPercent!) : '-'}
                    </td>
                    <td
                      className="py-2.5 px-3 text-right font-semibold tabular-nums whitespace-nowrap"
                      style={{
                        color: hiStep !== null ? THERMAL_SCALE[hiStep].textVar : 'var(--text-muted)',
                      }}
                    >
                      {hasHeatIndex ? formatTempPtBr(station.heatIndexC!) : '-'}
                    </td>
                    <td className="py-2.5 px-4 text-right whitespace-nowrap">
                      <span
                        className="inline-flex items-center px-2 py-0.5 rounded-[var(--radius-control)] border text-xs font-semibold"
                        style={badgeStyle}
                      >
                        {stateLabel}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};
