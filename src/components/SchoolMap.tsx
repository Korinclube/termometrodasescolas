/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { SchoolRecord, WeatherObservationStation, DayForecastSummary } from '../types';
import {
  Search,
  SlidersHorizontal,
  X,
  ChevronUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Eye,
  ArrowUpRight,
  CheckCircle2,
  HelpCircle,
} from 'lucide-react';
import {
  calculateDecoupledRiskEvaluation,
  calculateInfrastructureVulnerabilityIndex,
} from '../utils/thermalMath';
import { schoolAirEstimate } from '../utils/airQualityMath';
import { DataProvenanceBadge } from './DataProvenanceBadge';
import {
  RealSchoolMapCanvas,
  LAYER_DOT_COLORS,
  SchoolMarkerEvaluation,
} from './RealSchoolMapCanvas';
import { ToggleChip } from './ToggleChip';
import { TermTooltip } from './TermTooltip';
import { HowToReadModal } from './HowToReadModal';
import {
  THERMAL_SCALE,
  ThermalStep,
  heatIndexToThermalStep,
  priorityToThermalStep,
} from '../styles/designTokens';
import {
  formatIntegerPtBr,
  formatNumberPtBr,
  formatPercentIntPtBr,
  formatTempPtBr,
} from '../utils/formatPtBr';
import { getInmetStateLabel } from '../utils/inmetUtils';

const INTRO_DISMISSED_KEY = 'termo_escolas_intro_dismissed_v1';

interface SchoolMapProps {
  schools: SchoolRecord[];
  stations: WeatherObservationStation[];
  selectedSchoolId: string | null;
  onSelectSchool: (schoolId: string) => void;
  onOpenSchoolDetail: (schoolId: string) => void;
  onOpenMonitoring?: () => void;
  onOpenAboutData?: () => void;
  maxForecastHeatIndex: number;
  daysSummary?: DayForecastSummary[];
  airQualityStatus?: 'loading' | 'disponivel' | 'indisponivel';
  isForecastLoading?: boolean;
}

function lstToThermalStep(lst: number): ThermalStep {
  if (lst >= 4.0) return 5;
  if (lst >= 2.5) return 4;
  if (lst >= 1.0) return 3;
  if (lst >= 0) return 2;
  return 1;
}

function treeCoverToThermalStep(pct: number): ThermalStep {
  if (pct < 10) return 5;
  if (pct < 15) return 4;
  if (pct < 22) return 3;
  if (pct < 30) return 2;
  return 1;
}

export const SchoolMap: React.FC<SchoolMapProps> = ({
  schools,
  stations,
  selectedSchoolId,
  onSelectSchool,
  onOpenSchoolDetail,
  onOpenMonitoring,
  onOpenAboutData,
  maxForecastHeatIndex,
  daysSummary,
  airQualityStatus = 'loading',
  isForecastLoading = false,
}) => {
  const [introDismissed, setIntroDismissed] = useState<boolean>(() => {
    try {
      return typeof window !== 'undefined' && window.localStorage.getItem(INTRO_DISMISSED_KEY) === '1';
    } catch {
      return false;
    }
  });
  const [isHowToReadOpen, setIsHowToReadOpen] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRegion, setSelectedRegion] = useState<string>('all');
  const [selectedNetwork, setSelectedNetwork] = useState<string>('all');
  const [selectedPriority, setSelectedPriority] = useState<string>('all');
  const [selectedVulnerability, setSelectedVulnerability] = useState<string>('all');
  const [onlySentinel, setOnlySentinel] = useState(false);
  const [onlyWithInspection, setOnlyWithInspection] = useState(false);

  // Filtros: desktop em linha quando aberto; celular em folha inferior
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);

  // Controle de camadas visíveis no mapa
  const [showHeatIslands, setShowHeatIslands] = useState(true);
  const [showGreenAreas, setShowGreenAreas] = useState(true);
  const [showStations, setShowStations] = useState(true);
  const [showDemo, setShowDemo] = useState(false);

  const onSelectSchoolRef = useRef(onSelectSchool);
  onSelectSchoolRef.current = onSelectSchool;
  const handleSelectSchool = useCallback((schoolId: string) => {
    onSelectSchoolRef.current(schoolId);
  }, []);

  const onOpenSchoolDetailRef = useRef(onOpenSchoolDetail);
  onOpenSchoolDetailRef.current = onOpenSchoolDetail;
  const handleOpenSchoolDetail = useCallback((schoolId: string) => {
    onOpenSchoolDetailRef.current(schoolId);
  }, []);

  const handleToggleHeatIslands = useCallback(() => {
    setShowHeatIslands((prev) => !prev);
  }, []);

  const handleToggleGreenAreas = useCallback(() => {
    setShowGreenAreas((prev) => !prev);
  }, []);

  const handleToggleStations = useCallback(() => {
    setShowStations((prev) => !prev);
  }, []);

  useEffect(() => {
    if (!filtersOpen && !mobileDrawerOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setFiltersOpen(false);
        setMobileDrawerOpen(false);
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [filtersOpen, mobileDrawerOpen]);

  const handleDismissIntro = () => {
    setIntroDismissed(true);
    try {
      window.localStorage.setItem(INTRO_DISMISSED_KEY, '1');
    } catch {
      // Ignora se localStorage estiver bloqueado
    }
  };

  const activeFilterCount =
    (selectedRegion !== 'all' ? 1 : 0) +
    (selectedNetwork !== 'all' ? 1 : 0) +
    (selectedPriority !== 'all' ? 1 : 0) +
    (selectedVulnerability !== 'all' ? 1 : 0) +
    (onlySentinel ? 1 : 0) +
    (onlyWithInspection ? 1 : 0) +
    (showDemo ? 1 : 0);

  const handleResetFilters = () => {
    setSearchQuery('');
    setSelectedRegion('all');
    setSelectedNetwork('all');
    setSelectedPriority('all');
    setSelectedVulnerability('all');
    setOnlySentinel(false);
    setOnlyWithInspection(false);
    setShowDemo(false);
  };

  // Memoização da avaliação térmica por escola (reaproveitada na filtragem, marcadores e painel)
  const schoolRiskById = useMemo(() => {
    const map = new Map<string, ReturnType<typeof calculateDecoupledRiskEvaluation>>();
    for (const school of schools) {
      map.set(
        school.id,
        calculateDecoupledRiskEvaluation(school, maxForecastHeatIndex, school.inspection)
      );
    }
    return map;
  }, [schools, maxForecastHeatIndex]);

  // Filtragem das escolas (lógica preservada integralmente)
  const filteredSchools = useMemo(() => {
    return schools.filter((school) => {
      if (!showDemo && school.isDemo) return false;

      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const matchName = school.name.toLowerCase().includes(q);
        const matchInep = school.inepCode.includes(q);
        const matchBorough = school.borough.toLowerCase().includes(q);
        const matchMunicipality = school.municipality.toLowerCase().includes(q);
        if (!matchName && !matchInep && !matchBorough && !matchMunicipality) return false;
      }

      if (selectedRegion !== 'all' && school.region !== selectedRegion) return false;
      if (selectedNetwork !== 'all' && school.network !== selectedNetwork) return false;
      if (onlySentinel && !school.isSentinel) return false;
      if (onlyWithInspection && !school.inspection) return false;

      if (selectedPriority !== 'all') {
        const evalRes =
          schoolRiskById.get(school.id) ??
          calculateDecoupledRiskEvaluation(school, maxForecastHeatIndex, school.inspection);
        if (evalRes.combinedPriority !== selectedPriority) return false;
      }

      if (selectedVulnerability !== 'all') {
        const infraRes = calculateInfrastructureVulnerabilityIndex(school, school.inspection);
        if (infraRes.level !== selectedVulnerability) return false;
      }

      return true;
    });
  }, [
    schools,
    schoolRiskById,
    showDemo,
    searchQuery,
    selectedRegion,
    selectedNetwork,
    selectedPriority,
    selectedVulnerability,
    onlySentinel,
    onlyWithInspection,
    maxForecastHeatIndex,
  ]);

  // Memoização dos marcadores de escolas para evitar recálculo e re-renderização ao alternar camadas
  const memoizedSchoolMarkers = useMemo<SchoolMarkerEvaluation[]>(() => {
    return filteredSchools.map((school) => {
      const evalRes =
        schoolRiskById.get(school.id) ??
        calculateDecoupledRiskEvaluation(school, maxForecastHeatIndex, school.inspection);
      return {
        school,
        priorityKey: evalRes.combinedPriority,
        thermalStep: priorityToThermalStep(evalRes.combinedPriority),
      };
    });
  }, [filteredSchools, schoolRiskById, maxForecastHeatIndex]);

  const activeSchool = useMemo(() => {
    if (filteredSchools.length === 0) return undefined;
    return filteredSchools.find((s) => s.id === selectedSchoolId) || filteredSchools[0];
  }, [filteredSchools, selectedSchoolId]);

  const [isSchoolTransitioning, setIsSchoolTransitioning] = useState(false);
  const prevSchoolIdRef = useRef<string | undefined>(activeSchool?.id);

  useEffect(() => {
    const currentId = activeSchool?.id;
    if (!currentId) {
      prevSchoolIdRef.current = currentId;
      setIsSchoolTransitioning(false);
      return;
    }

    if (prevSchoolIdRef.current === currentId) return;
    prevSchoolIdRef.current = currentId;
    setIsSchoolTransitioning(true);

    const timer = window.setTimeout(() => {
      setIsSchoolTransitioning(false);
    }, 180);

    return () => window.clearTimeout(timer);
  }, [activeSchool?.id]);

  const activeSchoolIndex = useMemo(() => {
    if (!activeSchool) return -1;
    return filteredSchools.findIndex((s) => s.id === activeSchool.id);
  }, [filteredSchools, activeSchool]);

  const canNavigateSchools = filteredSchools.length > 1 && activeSchoolIndex !== -1;

  const handlePreviousSchool = () => {
    if (!canNavigateSchools) return;
    const prevIndex = (activeSchoolIndex - 1 + filteredSchools.length) % filteredSchools.length;
    handleSelectSchool(filteredSchools[prevIndex].id);
  };

  const handleNextSchool = () => {
    if (!canNavigateSchools) return;
    const nextIndex = (activeSchoolIndex + 1) % filteredSchools.length;
    handleSelectSchool(filteredSchools[nextIndex].id);
  };

  const todayMaxPm25 = useMemo(() => {
    if (airQualityStatus !== 'disponivel' || !daysSummary || !daysSummary[0]) return null;
    const vals = daysSummary[0].hourly
      .map((h) => h.pm2_5)
      .filter((v): v is number => v !== undefined && v !== null);
    if (vals.length === 0) return null;
    return Math.max(...vals);
  }, [airQualityStatus, daysSummary]);

  const activeAirEstimate = useMemo(() => {
    if (!activeSchool) return null;
    return schoolAirEstimate(activeSchool, activeSchool.inspection);
  }, [activeSchool]);

  const activeEval = useMemo(() => {
    if (!activeSchool) return null;
    return (
      schoolRiskById.get(activeSchool.id) ??
      calculateDecoupledRiskEvaluation(activeSchool, maxForecastHeatIndex, activeSchool.inspection)
    );
  }, [activeSchool, schoolRiskById, maxForecastHeatIndex]);

  const heatStep = heatIndexToThermalStep(maxForecastHeatIndex);
  const priorityStep = activeEval ? priorityToThermalStep(activeEval.combinedPriority) : 1;
  const priorityScale = THERMAL_SCALE[priorityStep];

  const lstStep: ThermalStep | null =
    activeSchool && activeSchool.heatIslandFactorLST !== null
      ? lstToThermalStep(activeSchool.heatIslandFactorLST)
      : null;

  const treeStep: ThermalStep | null =
    activeSchool && activeSchool.greenCoveragePercent !== null
      ? treeCoverToThermalStep(activeSchool.greenCoveragePercent)
      : null;

  // Cálculo de apresentação para o 4º indicador (Ar na sala)
  const airIndicator = useMemo(() => {
    if (!activeSchool || !activeAirEstimate || activeAirEstimate.status !== 'disponivel') {
      return {
        value: 'Pendente',
        unit: '',
        context: 'Turmas ainda não carregadas',
        step: 3 as ThermalStep,
        isPending: true,
      };
    }

    const contextText = `Turno ${activeAirEstimate.shiftLabel} · ${activeAirEstimate.students} alunos/turma`;

    if (activeSchool.declaredClimatizedRooms > 0) {
      if (activeSchool.inspection?.acType === 'central_com_renovacao') {
        return {
          value: 'Renovação',
          unit: 'com filtro',
          context: contextText,
          step: 2 as ThermalStep,
          isPending: false,
        };
      }
      const mins = activeAirEstimate.firstMinuteAboveReferenceClosed;
      return {
        value: mins !== null && mins !== undefined ? `~${formatIntegerPtBr(mins)}` : '> 200',
        unit: 'min',
        context: 'até o CO2 passar de 1.120 ppm',
        step: (mins !== null && mins !== undefined && mins <= 45 ? 4 : 3) as ThermalStep,
        isPending: false,
      };
    }

    if (activeSchool.inspection?.windowsOperable === 'nenhuma') {
      return {
        value: 'Fechada',
        unit: 'na vistoria',
        context: contextText,
        step: 5 as ThermalStep,
        isPending: false,
      };
    }

    const peakPpm = activeAirEstimate.peakPpmOpenWindows ?? 0;
    return {
      value: `~${formatIntegerPtBr(peakPpm)}`,
      unit: 'ppm',
      context: 'pico estimado (janelas abertas)',
      step: (peakPpm > 1120 ? 4 : 2) as ThermalStep,
      isPending: false,
    };
  }, [activeSchool, activeAirEstimate]);

  const filterSelectClass =
    'min-h-[44px] min-w-0 bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] hover:border-[var(--border-strong)] rounded-[var(--radius-control)] px-2.5 py-2 text-xs text-[var(--text-primary)] ui-transition cursor-pointer';

  const renderSchoolPanelBody = () => {
    if (!activeSchool || !activeEval) {
      return (
        <div className="py-10 px-4 text-center space-y-3">
          <p className="text-sm text-[var(--text-secondary)]">
            Nenhuma escola corresponde aos filtros aplicados.
          </p>
          <button
            type="button"
            onClick={handleResetFilters}
            className="min-h-[44px] px-4 py-2 rounded-[var(--radius-control)] border border-[var(--border-strong)] text-xs font-semibold text-[var(--text-primary)] hover:bg-[var(--bg-surface-subtle)] ui-transition cursor-pointer"
          >
            Limpar filtros
          </button>
        </div>
      );
    }

    return (
      <div className="space-y-4">
        {/* Navegação rápida entre escolas filtradas */}
        <div
          aria-label="Navegação entre escolas"
          className="flex items-center justify-between gap-2 pb-3 border-b border-[var(--border-subtle)]"
        >
          <button
            type="button"
            onClick={handlePreviousSchool}
            disabled={!canNavigateSchools}
            aria-label="Escola anterior"
            className={`min-h-[44px] px-2.5 py-2 rounded-[var(--radius-control)] border text-xs font-semibold inline-flex items-center gap-1 ui-transition whitespace-nowrap ${
              canNavigateSchools
                ? 'border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)] cursor-pointer'
                : 'border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] text-[var(--text-muted)] opacity-45 cursor-not-allowed'
            }`}
          >
            <ChevronLeft className="w-4 h-4 shrink-0" />
            <span>Escola anterior</span>
          </button>

          <span className="text-xs text-[var(--text-muted)] tabular-nums whitespace-nowrap">
            {activeSchoolIndex + 1} de {filteredSchools.length}
          </span>

          <button
            type="button"
            onClick={handleNextSchool}
            disabled={!canNavigateSchools}
            aria-label="Próxima escola"
            className={`min-h-[44px] px-2.5 py-2 rounded-[var(--radius-control)] border text-xs font-semibold inline-flex items-center gap-1 ui-transition whitespace-nowrap ${
              canNavigateSchools
                ? 'border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)] cursor-pointer'
                : 'border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] text-[var(--text-muted)] opacity-45 cursor-not-allowed'
            }`}
          >
            <span>Próxima escola</span>
            <ChevronRight className="w-4 h-4 shrink-0" />
          </button>
        </div>

        {/* Identificação da escola */}
        <div className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-semibold text-[var(--text-secondary)]">
              {activeSchool.network === 'municipal' ? 'Rede Municipal' : 'Rede Estadual (SEEDUC)'}
            </span>
            <span className="font-code text-xs text-[var(--text-muted)]">
              INEP {activeSchool.inepCode}
            </span>
          </div>

          <h2 className="text-lg font-semibold text-[var(--text-primary)] leading-snug">
            {activeSchool.name}
          </h2>

          <p className="text-xs text-[var(--text-secondary)]">
            {activeSchool.borough}, {activeSchool.municipality}
          </p>

          <div className="flex flex-wrap items-center gap-2 pt-0.5">
            <span
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[var(--radius-control)] border text-xs font-semibold"
              style={{
                backgroundColor: priorityScale.bgVar,
                borderColor: priorityScale.borderVar,
                color: priorityScale.textVar,
              }}
            >
              <span
                aria-hidden="true"
                className="w-2 h-2 rounded-full shrink-0"
                style={{ backgroundColor: priorityScale.solidVar }}
              />
              <span>Prioridade {priorityScale.label}</span>
            </span>

            {activeSchool.isSentinel && (
              <span className="inline-flex items-center px-2 py-1 rounded-[var(--radius-control)] border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] text-xs text-[var(--text-secondary)]">
                Escola-sentinela
              </span>
            )}

            {activeSchool.isDemo && (
              <span className="inline-flex items-center px-2 py-1 rounded-[var(--radius-control)] border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] text-xs text-[var(--text-secondary)]">
                Simulado
              </span>
            )}
          </div>
        </div>

        {/* 4 Indicadores padronizados (skeleton durante carregamento/troca + entrada suave escalonada) */}
        {(() => {
          const isWeatherCardLoading =
            isSchoolTransitioning || isForecastLoading || airQualityStatus === 'loading';
          const isLocalCardLoading = isSchoolTransitioning;

          const renderIndicatorSkeleton = (label: string) => (
            <div
              role="status"
              aria-label={`Carregando ${label}`}
              className="space-y-2 pt-0.5"
            >
              <div className="h-7 w-24 rounded-[var(--radius-control)] indicator-skeleton-bar" />
              <div className="h-3.5 w-32 max-w-full rounded-[var(--radius-control)] indicator-skeleton-bar" />
            </div>
          );

          return (
            <div className="grid grid-cols-1 min-[440px]:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2 gap-3">
              {/* 1. Calor previsto */}
              <div
                aria-busy={isWeatherCardLoading}
                className="p-3 rounded-[var(--radius-control)] bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] space-y-1 min-w-0 ui-transition"
              >
                <div className="flex items-center justify-between gap-1">
                  <span className="text-xs text-[var(--text-muted)] leading-snug">
                    Calor previsto
                  </span>
                  <TermTooltip
                    term="Exposição climática (IE_met)"
                    explanation={`Pontuação ${activeEval.exposure.score}/100: combina a previsão de calor nas próximas 24 horas, a ilha de calor e a falta de árvores no entorno.`}
                    align="left"
                  />
                </div>

                {isWeatherCardLoading ? (
                  renderIndicatorSkeleton('Calor previsto')
                ) : (
                  <div
                    key={`heat-${activeSchool.id}`}
                    className="space-y-1 indicator-card-enter indicator-delay-0"
                  >
                    <div className="flex items-baseline gap-1 min-w-0">
                      <span
                        className="text-2xl font-semibold tabular-nums leading-tight"
                        style={{ color: THERMAL_SCALE[heatStep].textVar }}
                      >
                        {formatNumberPtBr(maxForecastHeatIndex)}
                      </span>
                      <span className="text-sm text-[var(--text-secondary)]">°C</span>
                    </div>

                    <div className="text-xs text-[var(--text-secondary)] leading-snug tabular-nums">
                      {airQualityStatus === 'disponivel' && todayMaxPm25 !== null ? (
                        <span>PM2,5 externo máx: {formatNumberPtBr(todayMaxPm25)} µg/m³</span>
                      ) : (
                        <span>Ar externo indisponível agora</span>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* 2. Ilha de calor */}
              <div
                aria-busy={isLocalCardLoading}
                className="p-3 rounded-[var(--radius-control)] bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] space-y-1 min-w-0 ui-transition"
              >
                <div className="flex items-center justify-between gap-1">
                  <span className="text-xs text-[var(--text-muted)] leading-snug">
                    Ilha de calor
                  </span>
                  <TermTooltip
                    term="Ilha de calor por satélite (LST)"
                    explanation="Diferença de temperatura da superfície do terreno (LST, Landsat 8/9) em comparação com a média da Região Metropolitana do Rio."
                  />
                </div>

                {isLocalCardLoading ? (
                  renderIndicatorSkeleton('Ilha de calor')
                ) : (
                  <div
                    key={`lst-${activeSchool.id}`}
                    className="space-y-1 indicator-card-enter indicator-delay-1"
                  >
                    <div className="flex items-baseline gap-1 min-w-0">
                      {activeSchool.heatIslandFactorLST !== null && lstStep !== null ? (
                        <>
                          <span
                            className="text-2xl font-semibold tabular-nums leading-tight"
                            style={{ color: THERMAL_SCALE[lstStep].textVar }}
                          >
                            {formatNumberPtBr(activeSchool.heatIslandFactorLST, { signed: true })}
                          </span>
                          <span className="text-sm text-[var(--text-secondary)]">°C</span>
                        </>
                      ) : (
                        <span className="text-lg font-semibold text-[var(--text-muted)]">
                          Pendente
                        </span>
                      )}
                    </div>

                    <div className="text-xs text-[var(--text-secondary)] leading-snug tabular-nums">
                      {activeSchool.heatIsland?.lstC != null
                        ? `Superfície mediana: ${formatTempPtBr(activeSchool.heatIsland.lstC)}`
                        : 'Cálculo por satélite pendente'}
                    </div>
                  </div>
                )}
              </div>

              {/* 3. Árvores */}
              <div
                aria-busy={isLocalCardLoading}
                className="p-3 rounded-[var(--radius-control)] bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] space-y-1 min-w-0 ui-transition"
              >
                <div className="flex items-center justify-between gap-1">
                  <span className="text-xs text-[var(--text-muted)] leading-snug">
                    Árvores
                  </span>
                  <TermTooltip
                    term="Cobertura arbórea (200 m)"
                    explanation="Proporção de copas de árvores em um raio de 200 metros ao redor da escola, medida por satélite (ESA WorldCover)."
                    align="left"
                  />
                </div>

                {isLocalCardLoading ? (
                  renderIndicatorSkeleton('Árvores')
                ) : (
                  <div
                    key={`tree-${activeSchool.id}`}
                    className="space-y-1 indicator-card-enter indicator-delay-2"
                  >
                    <div className="flex items-baseline gap-1 min-w-0">
                      {activeSchool.greenCoveragePercent !== null && treeStep !== null ? (
                        <>
                          <span
                            className="text-2xl font-semibold tabular-nums leading-tight"
                            style={{ color: THERMAL_SCALE[treeStep].textVar }}
                          >
                            {formatIntegerPtBr(Math.round(activeSchool.greenCoveragePercent))}
                          </span>
                          <span className="text-sm text-[var(--text-secondary)]">%</span>
                        </>
                      ) : (
                        <span className="text-lg font-semibold text-[var(--text-muted)]">
                          Pendente
                        </span>
                      )}
                    </div>

                    <div className="text-xs text-[var(--text-secondary)] leading-snug">
                      {activeSchool.greenCoveragePercent !== null
                        ? 'Raio de 200 m ao redor'
                        : 'Cálculo por satélite pendente'}
                    </div>
                  </div>
                )}
              </div>

              {/* 4. Ar na sala */}
              <div
                aria-busy={isLocalCardLoading}
                className="p-3 rounded-[var(--radius-control)] bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] space-y-1 min-w-0 ui-transition"
              >
                <div className="flex items-center justify-between gap-1">
                  <span className="text-xs text-[var(--text-muted)] leading-snug">
                    Ar na sala
                  </span>
                  <TermTooltip
                    term="Estimativa sem sensor (NBR 17037)"
                    explanation="Estimativa teórica de acúmulo de CO2 por aluno, calculada sem sensor físico segundo a norma brasileira ABNT NBR 17037."
                  />
                </div>

                {isLocalCardLoading ? (
                  renderIndicatorSkeleton('Ar na sala')
                ) : (
                  <div
                    key={`air-${activeSchool.id}`}
                    className="space-y-1 indicator-card-enter indicator-delay-3"
                  >
                    <div className="flex items-baseline gap-1 min-w-0">
                      <span
                        className="text-2xl font-semibold tabular-nums leading-tight"
                        style={{
                          color: airIndicator.isPending
                            ? 'var(--text-muted)'
                            : THERMAL_SCALE[airIndicator.step].textVar,
                        }}
                      >
                        {airIndicator.value}
                      </span>
                      {airIndicator.unit && (
                        <span className="text-sm text-[var(--text-secondary)]">
                          {airIndicator.unit}
                        </span>
                      )}
                    </div>

                    <div className="text-xs text-[var(--text-secondary)] leading-snug">
                      {airIndicator.context}
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })()}

        {/* Situação da vistoria */}
        <div className="pt-3 border-t border-[var(--border-subtle)] flex items-start justify-between gap-3 text-xs">
          <div className="space-y-1 min-w-0">
            <div className="flex items-center gap-1">
              <span className="font-semibold text-[var(--text-primary)]">
                Situação da vistoria
              </span>
              <TermTooltip
                term="Vulnerabilidade predial (IV_infra)"
                explanation={`Pontuação ${activeEval.infrastructure.score}/100: avalia aparelhos de ar, tipo de telhado, ventilação das janelas e acesso à água fresca.`}
                align="left"
              />
            </div>

            {activeSchool.inspection ? (
              <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                Ar real:{' '}
                <strong className="font-semibold text-[var(--text-primary)] capitalize">
                  {activeSchool.inspection.realAcStatus.replace('_', ' ')}
                </strong>
                {activeSchool.inspection.acNotes ? ` · ${activeSchool.inspection.acNotes}` : ''}
                {` · ${activeSchool.declaredClimatizedRooms}/${activeSchool.totalRooms} salas no Censo`}
              </p>
            ) : (
              <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                Telhado, fiação e janelas constam como desconhecidos até vistoria presencial ({activeSchool.declaredClimatizedRooms}/{activeSchool.totalRooms} salas climatizadas no Censo).
              </p>
            )}
          </div>

          {activeSchool.inspection ? (
            <span
              className="inline-flex items-center gap-1 text-xs font-semibold shrink-0"
              style={{ color: THERMAL_SCALE[2].textVar }}
            >
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>Vistoriada</span>
            </span>
          ) : (
            <span
              className="inline-flex items-center gap-1 text-xs font-semibold shrink-0"
              style={{ color: THERMAL_SCALE[3].textVar }}
            >
              <HelpCircle className="w-4 h-4 shrink-0" />
              <span>Pendente</span>
            </span>
          )}
        </div>

        {/* Estação INMET mais próxima */}
        {(() => {
          const nearestStation = stations.find((s) => s.isNearest) ?? stations[0];
          if (!nearestStation) return null;
          const stateLabel = getInmetStateLabel(nearestStation);
          const isWarning =
            nearestStation.observationState === 'estacao_em_pane' ||
            nearestStation.observationState === 'inmet_indisponivel' ||
            nearestStation.observationState === 'dado_atrasado';

          return (
            <div className="pt-3 border-t border-[var(--border-subtle)] flex items-start justify-between gap-2 text-xs">
              <div className="space-y-0.5 min-w-0">
                <span className="text-[var(--text-muted)] block">
                  Estação INMET mais próxima
                </span>
                <p className="font-semibold text-[var(--text-primary)] truncate">
                  {nearestStation.name}
                  {Number.isFinite(nearestStation.distanceKm)
                    ? ` · ${formatNumberPtBr(nearestStation.distanceKm!)} km`
                    : ''}
                </p>
              </div>
              <span
                className="inline-flex items-center px-2 py-0.5 rounded-[var(--radius-control)] border text-[11px] font-semibold shrink-0 whitespace-nowrap"
                style={
                  isWarning
                    ? {
                        backgroundColor: THERMAL_SCALE[3].bgVar,
                        borderColor: THERMAL_SCALE[3].borderVar,
                        color: THERMAL_SCALE[3].textVar,
                      }
                    : {
                        backgroundColor: 'var(--bg-surface-subtle)',
                        borderColor: 'var(--border-subtle)',
                        color: 'var(--text-secondary)',
                      }
                }
              >
                {stateLabel}
              </span>
            </div>
          );
        })()}

        {/* Botões padronizados: 1 primário preenchido, 1 secundário contorno */}
        <div className="space-y-2 pt-1">
          <button
            type="button"
            onClick={() => {
              setMobileDrawerOpen(false);
              onOpenSchoolDetail(activeSchool.id);
            }}
            className="w-full min-h-[44px] py-2.5 px-4 rounded-[var(--radius-control)] bg-[var(--action-primary)] text-[var(--action-primary-fg)] hover:bg-[var(--action-primary-hover)] text-sm font-semibold flex items-center justify-center gap-2 ui-transition cursor-pointer"
          >
            <Eye className="w-4 h-4 shrink-0" />
            <span>Abrir Ficha Técnica</span>
          </button>

          {onOpenMonitoring && (
            <button
              type="button"
              onClick={() => {
                setMobileDrawerOpen(false);
                onOpenMonitoring();
              }}
              className="w-full min-h-[44px] py-2.5 px-4 rounded-[var(--radius-control)] border border-[var(--border-strong)] bg-transparent text-[var(--text-primary)] hover:bg-[var(--bg-surface-subtle)] text-sm font-semibold flex items-center justify-center gap-1.5 ui-transition cursor-pointer"
            >
              <span>Ver Previsão 72h</span>
              <ArrowUpRight className="w-4 h-4 shrink-0" />
            </button>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* 1. Bloco de Abertura (pode ser fechado e não reaparece depois) */}
      {!introDismissed && (
        <section
          aria-label="Apresentação do painel"
          className="civic-card px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
        >
          <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
            O Termômetro das Escolas RJ cruza exposição ao calor e condições prediais para ajudar diretores, professores e gestores públicos a priorizar escolas na Região Metropolitana do Rio.
          </p>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setIsHowToReadOpen(true)}
              className="min-h-[44px] px-3.5 py-2 rounded-[var(--radius-control)] border border-[var(--border-strong)] text-xs font-semibold text-[var(--text-primary)] hover:bg-[var(--bg-surface-subtle)] ui-transition whitespace-nowrap cursor-pointer"
            >
              Como ler este painel
            </button>

            <button
              type="button"
              onClick={handleDismissIntro}
              aria-label="Fechar apresentação"
              title="Fechar apresentação"
              className="min-w-[44px] min-h-[44px] inline-flex items-center justify-center rounded-[var(--radius-control)] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-subtle)] ui-transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </section>
      )}

      {/* 2. Busca e Filtros (1 linha alinhada horizontalmente; no desktop filtros em linha única sem quebras) */}
      <section aria-label="Busca e filtros de escolas" className="space-y-3">
        <div className="flex items-center gap-2 flex-nowrap">
          <div className="relative flex-1 min-w-0">
            <Search className="w-4 h-4 text-[var(--text-muted)] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              aria-label="Buscar escola por nome, código INEP, bairro ou município"
              placeholder="Buscar escola, INEP, bairro ou município..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full min-h-[44px] pl-9 pr-9 py-2 bg-[var(--bg-surface)] border border-[var(--border-subtle)] hover:border-[var(--border-strong)] rounded-[var(--radius-control)] text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] ui-transition"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                aria-label="Limpar busca"
                className="absolute right-1.5 top-1/2 -translate-y-1/2 min-w-[36px] min-h-[36px] inline-flex items-center justify-center rounded-[var(--radius-control)] text-[var(--text-muted)] hover:text-[var(--text-primary)] ui-transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={() => setFiltersOpen((prev) => !prev)}
            aria-expanded={filtersOpen}
            className={`min-h-[44px] px-3.5 py-2 rounded-[var(--radius-control)] border text-xs font-semibold inline-flex items-center gap-2 ui-transition whitespace-nowrap shrink-0 cursor-pointer ${
              filtersOpen || activeFilterCount > 0
                ? 'border-[var(--border-strong)] bg-[var(--bg-surface-subtle)] text-[var(--text-primary)]'
                : 'border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:bg-[var(--bg-surface-subtle)] hover:text-[var(--text-primary)]'
            }`}
          >
            <SlidersHorizontal className="w-4 h-4 shrink-0" />
            <span>Filtros</span>
            {activeFilterCount > 0 && (
              <span
                aria-label={`${activeFilterCount} ${
                  activeFilterCount === 1 ? 'filtro ativo' : 'filtros ativos'
                }`}
                className="min-w-[20px] h-5 px-1.5 inline-flex items-center justify-center rounded-[var(--radius-control)] bg-[var(--action-primary)] text-[var(--action-primary-fg)] text-xs font-semibold tabular-nums"
              >
                {activeFilterCount}
              </span>
            )}
          </button>
        </div>

        {/* Desktop: filtros alinhados horizontalmente em uma única linha, sem quebras */}
        {filtersOpen && (
          <div className="hidden lg:flex items-center gap-1.5 flex-nowrap civic-card p-2.5">
            <select
              aria-label="Filtrar por Região"
              value={selectedRegion}
              onChange={(e) => setSelectedRegion(e.target.value)}
              className={`${filterSelectClass} flex-1`}
            >
              <option value="all">Todas regiões</option>
              <option value="Zona Norte">Zona Norte</option>
              <option value="Zona Oeste">Zona Oeste</option>
              <option value="Centro/Sul">Centro / Zona Sul</option>
              <option value="Baixada Fluminense">Baixada Fluminense</option>
            </select>

            <select
              aria-label="Filtrar por Rede de Ensino"
              value={selectedNetwork}
              onChange={(e) => setSelectedNetwork(e.target.value)}
              className={`${filterSelectClass} flex-1`}
            >
              <option value="all">Todas redes</option>
              <option value="municipal">Rede Municipal</option>
              <option value="estadual">Rede Estadual (SEEDUC)</option>
            </select>

            <select
              aria-label="Filtrar por Vulnerabilidade de Infraestrutura"
              value={selectedVulnerability}
              onChange={(e) => setSelectedVulnerability(e.target.value)}
              className={`${filterSelectClass} flex-1`}
            >
              <option value="all">Infraestrutura</option>
              <option value="colapso">Vulnerabilidade Crítica</option>
              <option value="critica">Alta Vulnerabilidade</option>
              <option value="atencao">Vulnerabilidade Moderada</option>
              <option value="adequada">Infraestrutura Adequada</option>
            </select>

            <select
              aria-label="Filtrar por Prioridade Preventiva"
              value={selectedPriority}
              onChange={(e) => setSelectedPriority(e.target.value)}
              className={`${filterSelectClass} flex-1`}
            >
              <option value="all">Prioridade</option>
              <option value="muito_alta">Muito Alta</option>
              <option value="alta">Alta</option>
              <option value="moderada">Moderada</option>
              <option value="baixa">Baixa</option>
            </select>

            <ToggleChip
              label="Sentinelas"
              active={onlySentinel}
              onClick={() => setOnlySentinel(!onlySentinel)}
            />
            <ToggleChip
              label="Com Vistoria"
              active={onlyWithInspection}
              onClick={() => setOnlyWithInspection(!onlyWithInspection)}
            />
            <ToggleChip
              label="Exemplo fictício"
              active={showDemo}
              onClick={() => setShowDemo(!showDemo)}
            />

            {(activeFilterCount > 0 || searchQuery.trim().length > 0) && (
              <button
                type="button"
                onClick={handleResetFilters}
                className="min-h-[44px] px-2.5 text-xs font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] underline underline-offset-4 whitespace-nowrap shrink-0 cursor-pointer"
              >
                Limpar
              </button>
            )}
          </div>
        )}
      </section>

      {/* Mobile: Folha inferior de filtros */}
      {filtersOpen && (
        <div
          className="lg:hidden fixed inset-0 z-50 flex items-end bg-[var(--backdrop-modal)] backdrop-blur-[4px]"
          role="dialog"
          aria-modal="true"
          aria-label="Filtros de escolas"
          onClick={() => setFiltersOpen(false)}
        >
          <div
            className="w-full max-h-[85vh] overflow-y-auto bg-[var(--bg-surface)] text-[var(--text-primary)] border-t border-[var(--border-strong)] rounded-t-[var(--radius-card)] shadow-[var(--shadow-modal)] p-5 space-y-4 pb-[calc(1.25rem+env(safe-area-inset-bottom))]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-3">
              <h2 className="text-base font-semibold text-[var(--text-primary)]">
                Filtrar escolas
              </h2>
              <button
                type="button"
                onClick={() => setFiltersOpen(false)}
                aria-label="Fechar filtros"
                className="min-w-[44px] min-h-[44px] inline-flex items-center justify-center rounded-[var(--radius-control)] text-[var(--text-muted)] hover:bg-[var(--bg-surface-subtle)] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <select
                aria-label="Filtrar por Região"
                value={selectedRegion}
                onChange={(e) => setSelectedRegion(e.target.value)}
                className={filterSelectClass}
              >
                <option value="all">Todas as Regiões</option>
                <option value="Zona Norte">Zona Norte</option>
                <option value="Zona Oeste">Zona Oeste</option>
                <option value="Centro/Sul">Centro / Zona Sul</option>
                <option value="Baixada Fluminense">Baixada Fluminense</option>
              </select>

              <select
                aria-label="Filtrar por Rede de Ensino"
                value={selectedNetwork}
                onChange={(e) => setSelectedNetwork(e.target.value)}
                className={filterSelectClass}
              >
                <option value="all">Todas as Redes</option>
                <option value="municipal">Rede Municipal</option>
                <option value="estadual">Rede Estadual (SEEDUC)</option>
              </select>

              <select
                aria-label="Filtrar por Vulnerabilidade de Infraestrutura"
                value={selectedVulnerability}
                onChange={(e) => setSelectedVulnerability(e.target.value)}
                className={filterSelectClass}
              >
                <option value="all">Toda Infraestrutura</option>
                <option value="colapso">Vulnerabilidade Crítica</option>
                <option value="critica">Alta Vulnerabilidade</option>
                <option value="atencao">Vulnerabilidade Moderada</option>
                <option value="adequada">Infraestrutura Adequada</option>
              </select>

              <select
                aria-label="Filtrar por Prioridade Preventiva"
                value={selectedPriority}
                onChange={(e) => setSelectedPriority(e.target.value)}
                className={filterSelectClass}
              >
                <option value="all">Todas as Prioridades</option>
                <option value="muito_alta">Muito Alta</option>
                <option value="alta">Alta</option>
                <option value="moderada">Moderada</option>
                <option value="baixa">Baixa</option>
              </select>
            </div>

            <div className="flex flex-wrap gap-2">
              <ToggleChip
                label="Sentinelas"
                active={onlySentinel}
                onClick={() => setOnlySentinel(!onlySentinel)}
              />
              <ToggleChip
                label="Com Vistoria"
                active={onlyWithInspection}
                onClick={() => setOnlyWithInspection(!onlyWithInspection)}
              />
              <ToggleChip
                label="Exemplo fictício"
                active={showDemo}
                onClick={() => setShowDemo(!showDemo)}
              />
            </div>

            <div className="flex items-center justify-between gap-3 pt-2 border-t border-[var(--border-subtle)]">
              <button
                type="button"
                onClick={handleResetFilters}
                className="min-h-[44px] px-3 text-xs font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] underline underline-offset-4 cursor-pointer"
              >
                Limpar filtros
              </button>

              <button
                type="button"
                onClick={() => setFiltersOpen(false)}
                className="min-h-[44px] px-5 py-2 rounded-[var(--radius-control)] bg-[var(--action-primary)] text-[var(--action-primary-fg)] text-sm font-semibold cursor-pointer"
              >
                Ver {filteredSchools.length}{' '}
                {filteredSchools.length === 1 ? 'escola' : 'escolas'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3. Visualizador Principal do Mapa + Painel Único da Escola (Desktop à direita; Celular em gaveta inferior) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">
        <div className="lg:col-span-8 civic-card p-3 sm:p-4 flex flex-col justify-between gap-3 min-w-0">
          <RealSchoolMapCanvas
            schools={filteredSchools}
            schoolMarkers={memoizedSchoolMarkers}
            stations={stations}
            activeSchool={activeSchool}
            maxForecastHeatIndex={maxForecastHeatIndex}
            showHeatIslands={showHeatIslands}
            showGreenAreas={showGreenAreas}
            showStations={showStations}
            onSelectSchool={handleSelectSchool}
            onOpenSchoolDetail={handleOpenSchoolDetail}
          />

          {/* Camadas como selos neutros com bolinha na cor usada no mapa */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
            <div className="flex flex-wrap items-center gap-2">
              <ToggleChip
                label="Ilhas de Calor"
                active={showHeatIslands}
                onClick={handleToggleHeatIslands}
                dotColor={LAYER_DOT_COLORS.heatIslands}
              />
              <ToggleChip
                label="Cobertura Arbórea"
                active={showGreenAreas}
                onClick={handleToggleGreenAreas}
                dotColor={LAYER_DOT_COLORS.greenAreas}
              />
              <ToggleChip
                label="Estações"
                active={showStations}
                onClick={handleToggleStations}
                dotColor={LAYER_DOT_COLORS.stations}
              />
            </div>

            <span className="text-xs text-[var(--text-muted)] tabular-nums">
              {filteredSchools.length} {filteredSchools.length === 1 ? 'escola no mapa' : 'escolas no mapa'}
            </span>
          </div>
        </div>

        {/* Desktop: Painel único da escola à direita */}
        <aside
          aria-label="Detalhes da escola selecionada"
          className="hidden lg:flex lg:col-span-4 civic-card p-5 flex-col justify-between min-w-0"
        >
          {renderSchoolPanelBody()}
        </aside>
      </div>

      {/* Celular (< lg): Gaveta inferior única da escola (fechada: nome, prioridade e 2 índices principais; aberta: restante) */}
      {activeSchool && activeEval && (
        <div className="lg:hidden">
          {mobileDrawerOpen && (
            <div
              className="fixed inset-0 z-30 bg-[var(--backdrop-modal)] backdrop-blur-[3px]"
              onClick={() => setMobileDrawerOpen(false)}
              aria-hidden="true"
            />
          )}

          <section
            aria-label="Painel da escola selecionada"
            className="fixed inset-x-0 bottom-[calc(56px+env(safe-area-inset-bottom))] z-30 bg-[var(--bg-surface)] text-[var(--text-primary)] border-t border-[var(--border-strong)] rounded-t-[var(--radius-card)] shadow-[var(--shadow-modal)] ui-transition"
          >
            {!mobileDrawerOpen ? (
              <div className="px-4 py-2.5 flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => setMobileDrawerOpen(true)}
                  aria-expanded={false}
                  className="flex-1 min-w-0 text-left min-h-[44px] flex flex-col justify-center gap-1 cursor-pointer"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-sm font-semibold text-[var(--text-primary)] truncate">
                      {activeSchool.name}
                    </span>
                    <span
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-[var(--radius-control)] border text-[11px] font-semibold shrink-0"
                      style={{
                        backgroundColor: priorityScale.bgVar,
                        borderColor: priorityScale.borderVar,
                        color: priorityScale.textVar,
                      }}
                    >
                      {priorityScale.label}
                    </span>
                  </div>

                  <div className="flex items-center gap-3 text-xs text-[var(--text-secondary)] tabular-nums">
                    <span className="inline-flex items-center gap-1">
                      <span>Calor:</span>
                      {isSchoolTransitioning || isForecastLoading ? (
                        <span className="inline-block h-3.5 w-12 rounded-[var(--radius-control)] indicator-skeleton-bar align-middle" />
                      ) : (
                        <strong
                          className="font-semibold indicator-card-enter"
                          style={{ color: THERMAL_SCALE[heatStep].textVar }}
                        >
                          {formatTempPtBr(maxForecastHeatIndex)}
                        </strong>
                      )}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span className="inline-flex items-center gap-1">
                      <span>Ilha:</span>
                      {isSchoolTransitioning ? (
                        <span className="inline-block h-3.5 w-12 rounded-[var(--radius-control)] indicator-skeleton-bar align-middle" />
                      ) : (
                        <strong
                          className="font-semibold indicator-card-enter"
                          style={{
                            color:
                              lstStep !== null ? THERMAL_SCALE[lstStep].textVar : 'var(--text-muted)',
                          }}
                        >
                          {activeSchool.heatIslandFactorLST !== null
                            ? formatTempPtBr(activeSchool.heatIslandFactorLST, { signed: true })
                            : 'Pendente'}
                        </strong>
                      )}
                    </span>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setMobileDrawerOpen(true)}
                  aria-label="Abrir detalhes da escola"
                  className="min-w-[44px] min-h-[44px] inline-flex items-center justify-center rounded-[var(--radius-control)] border border-[var(--border-subtle)] text-[var(--text-primary)] hover:bg-[var(--bg-surface-subtle)] shrink-0 cursor-pointer"
                >
                  <ChevronUp className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="max-h-[72vh] overflow-y-auto p-4 space-y-3">
                <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-2">
                  <span className="text-xs font-semibold text-[var(--text-muted)]">
                    Escola em foco
                  </span>
                  <button
                    type="button"
                    onClick={() => setMobileDrawerOpen(false)}
                    aria-label="Recolher painel da escola"
                    className="min-w-[44px] min-h-[44px] inline-flex items-center justify-center rounded-[var(--radius-control)] border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:bg-[var(--bg-surface-subtle)] cursor-pointer"
                  >
                    <ChevronDown className="w-4 h-4" />
                  </button>
                </div>

                {renderSchoolPanelBody()}
              </div>
            )}
          </section>
        </div>
      )}

      {/* 4. Diretório Rápido das Unidades Monitoradas */}
      <section className="civic-card">
        <div className="px-4 sm:px-5 py-3.5 border-b border-[var(--border-subtle)] flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold text-[var(--text-primary)]">
              Unidades escolares na base territorial ({filteredSchools.length})
            </h3>
            <p className="text-xs text-[var(--text-muted)]">
              Selecione uma escola para centralizar no mapa ou abrir a ficha técnica.
            </p>
          </div>

          <DataProvenanceBadge
            provenance={{
              source: 'Inep (Censo 2025) · Landsat 8/9 · ESA WorldCover',
              timestamp: 'Ano-base 2025 / Verões 2021-2026',
              location: 'RMRJ',
              nature: 'observacao',
              natureDescription:
                'Dados cadastrais declarados ao Inep e variáveis de superfície observadas por satélite.',
            }}
            variant="compact"
          />
        </div>

        {filteredSchools.length === 0 ? (
          <div className="p-8 text-center space-y-3">
            <p className="text-sm text-[var(--text-secondary)]">
              Nenhuma escola corresponde aos filtros aplicados.
            </p>
            <button
              type="button"
              onClick={handleResetFilters}
              className="min-h-[44px] px-4 py-2 rounded-[var(--radius-control)] border border-[var(--border-strong)] text-xs font-semibold text-[var(--text-primary)] hover:bg-[var(--bg-surface-subtle)] ui-transition cursor-pointer"
            >
              Limpar filtros
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-b-[var(--radius-card)]">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-[var(--border-subtle)] text-xs text-[var(--text-muted)] bg-[var(--bg-surface-subtle)]">
                  <th className="py-2.5 px-4 font-semibold">Escola</th>
                  <th className="py-2.5 px-3 font-semibold">Bairro / Município</th>
                  <th className="py-2.5 px-3 font-semibold text-right">Matrículas</th>
                  <th className="py-2.5 px-3 font-semibold text-right">Salas Clim.</th>
                  <th className="py-2.5 px-3 font-semibold text-right">Ilha de calor</th>
                  <th className="py-2.5 px-3 font-semibold text-right">Árvores 200 m</th>
                  <th className="py-2.5 px-3 font-semibold text-right">CO2 est.</th>
                  <th className="py-2.5 px-4 font-semibold text-right">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-subtle)]">
                {filteredSchools.map((school) => {
                  const isSelected = school.id === activeSchool?.id;
                  const airEst = schoolAirEstimate(school, school.inspection);
                  const rowLstStep =
                    school.heatIslandFactorLST !== null
                      ? lstToThermalStep(school.heatIslandFactorLST)
                      : null;
                  const rowTreeStep =
                    school.greenCoveragePercent !== null
                      ? treeCoverToThermalStep(school.greenCoveragePercent)
                      : null;

                  return (
                    <tr
                      key={school.id}
                      onClick={() => onSelectSchool(school.id)}
                      className={`cursor-pointer ui-transition ${
                        isSelected
                          ? 'bg-[var(--bg-surface-subtle)]'
                          : 'hover:bg-[var(--bg-surface-subtle)]/60'
                      }`}
                    >
                      <td className="py-2.5 px-4">
                        <div className="font-semibold text-[var(--text-primary)]">
                          {school.name}
                        </div>
                        <div className="text-xs text-[var(--text-muted)]">
                          <span className="font-code">INEP {school.inepCode}</span> ·{' '}
                          {school.network === 'municipal' ? 'Municipal' : 'Estadual'}
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-[var(--text-secondary)]">
                        {school.borough} ·{' '}
                        <span className="text-[var(--text-muted)]">{school.municipality}</span>
                      </td>
                      <td className="py-2.5 px-3 text-right tabular-nums text-[var(--text-secondary)]">
                        {formatIntegerPtBr(school.totalStudents)}
                      </td>
                      <td className="py-2.5 px-3 text-right tabular-nums text-[var(--text-secondary)]">
                        {school.declaredClimatizedRooms}/{school.totalRooms}
                      </td>
                      <td className="py-2.5 px-3 text-right tabular-nums">
                        {school.heatIslandFactorLST !== null && rowLstStep !== null ? (
                          <span
                            className="font-semibold"
                            style={{ color: THERMAL_SCALE[rowLstStep].textVar }}
                          >
                            {formatTempPtBr(school.heatIslandFactorLST, { signed: true })}
                          </span>
                        ) : (
                          <span className="text-[var(--text-muted)]">Pendente</span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-right tabular-nums">
                        {school.greenCoveragePercent !== null && rowTreeStep !== null ? (
                          <span
                            className="font-semibold"
                            style={{ color: THERMAL_SCALE[rowTreeStep].textVar }}
                          >
                            {formatPercentIntPtBr(school.greenCoveragePercent)}
                          </span>
                        ) : (
                          <span className="text-[var(--text-muted)]">Pendente</span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-right tabular-nums text-[var(--text-secondary)]">
                        {airEst.status === 'disponivel'
                          ? school.declaredClimatizedRooms > 0
                            ? `~${formatIntegerPtBr(airEst.firstMinuteAboveReferenceClosed ?? 0)} min`
                            : `~${formatIntegerPtBr(airEst.peakPpmOpenWindows ?? 0)} ppm`
                          : 'Pendente'}
                      </td>
                      <td className="py-2.5 px-4 text-right">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onOpenSchoolDetail(school.id);
                          }}
                          className="min-h-[36px] px-2.5 py-1 rounded-[var(--radius-control)] border border-[var(--border-subtle)] text-xs font-semibold text-[var(--text-primary)] hover:bg-[var(--bg-surface)] ui-transition cursor-pointer"
                        >
                          Ficha
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <HowToReadModal
        isOpen={isHowToReadOpen}
        onClose={() => setIsHowToReadOpen(false)}
        onOpenAboutData={() => onOpenAboutData?.()}
      />
    </div>
  );
};
