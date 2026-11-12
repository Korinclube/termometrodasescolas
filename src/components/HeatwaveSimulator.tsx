/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import {
  calculateHeatIndex,
  calculateApparentTemperature,
  estimateEnvelopeGain,
  getRiskBand,
  getRioHeatLevel,
} from '../utils/thermalMath';
import {
  AIR_CHANGES_PER_HOUR,
  CO2_MARGIN_ABOVE_OUTDOOR_PPM,
  CO2_REFERENCE_PPM,
  OUTDOOR_CO2_PPM,
  TEACHER_CO2_LS,
  co2GenerationPerStudent,
  requiredAirChangesPerHour,
  schoolAirEstimate,
  simulateClassroomCo2,
} from '../utils/airQualityMath';
import { INITIAL_SCHOOLS } from '../data/schoolsData';
import { HEAT_ISLAND_RESULTS } from '../data/heatIslandResults';
import { attachHeatIslandData } from '../utils/heatIslandImport';
import { RoofType, VentilationType, EnvelopeSimulationParameters, SchoolRecord } from '../types';
import { Sun, Building, Zap, Info, CheckCircle2, Wind, Flame } from 'lucide-react';
import { DataProvenanceBadge } from './DataProvenanceBadge';
import { TermTooltip } from './TermTooltip';
import { THERMAL_SCALE, ThermalStep, heatIndexToThermalStep } from '../styles/designTokens';
import {
  formatIntegerPtBr,
  formatNumberPtBr,
  formatPercentIntPtBr,
  formatTempPtBr,
} from '../utils/formatPtBr';

interface HeatwaveSimulatorProps {
  schools?: SchoolRecord[];
}

type StageOptionKey = 'infantil_fund1' | 'fundamental_2' | 'medio_eja';
type VentilationOptionKey = keyof typeof AIR_CHANGES_PER_HOUR;

const STAGE_CO2_OPTIONS: Record<StageOptionKey, { label: string; rateLs: number }> = {
  infantil_fund1: { label: 'Infantil e Fundamental 1 (6 anos)', rateLs: 0.0033 },
  fundamental_2: { label: 'Fundamental 2 (11 anos)', rateLs: 0.0041 },
  medio_eja: { label: 'Médio e EJA (16 anos)', rateLs: 0.0049 },
};

const VENTILATION_OPTIONS: { key: VentilationOptionKey; label: string; ach: number }[] = [
  { key: 'fechada_split', label: 'Fechada com split (0,5 troca/h)', ach: AIR_CHANGES_PER_HOUR.fechada_split },
  { key: 'fresta_aberta', label: 'Fresta aberta (1,5 troca/h)', ach: AIR_CHANGES_PER_HOUR.fresta_aberta },
  { key: 'janelas_abertas', label: 'Janelas abertas (3,0 trocas/h)', ach: AIR_CHANGES_PER_HOUR.janelas_abertas },
  { key: 'ventilacao_cruzada', label: 'Ventilação cruzada (6,0 trocas/h)', ach: AIR_CHANGES_PER_HOUR.ventilacao_cruzada },
];

const BAND_LABELS: Record<'normal' | 'atencao' | 'alerta' | 'perigo', string> = {
  normal: 'Normal',
  atencao: 'Atenção',
  alerta: 'Alerta',
  perigo: 'Perigo',
};

const QUICK_SCENARIOS = [
  {
    id: 'bangu',
    label: 'Bangu extremo (41,5 °C)',
    temp: 41.5,
    rh: 58,
    rad: 950,
    wind: 4,
  },
  {
    id: 'iraja',
    label: 'Irajá tarde crítica (38 °C)',
    temp: 38.0,
    rh: 68,
    rad: 850,
    wind: 6,
  },
  {
    id: 'umidade',
    label: 'Umidade alta (35 °C / 72%)',
    temp: 35.0,
    rh: 72,
    rad: 750,
    wind: 8,
  },
  {
    id: 'ameno',
    label: 'Ameno com brisa (29 °C)',
    temp: 29.0,
    rh: 55,
    rad: 450,
    wind: 16,
  },
];

function riskBandToStep(
  riskBand: 'normal' | 'atencao' | 'alerta' | 'perigo',
  heatIndexC: number
): ThermalStep {
  if (riskBand === 'perigo') return 5;
  if (riskBand === 'alerta') return 4;
  if (riskBand === 'atencao') return 3;
  return heatIndexToThermalStep(heatIndexC);
}

const INPUT_CONTROL_CLASS =
  'w-full min-h-[44px] px-3 py-2 text-xs sm:text-sm bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] hover:border-[var(--border-strong)] rounded-[var(--radius-control)] text-[var(--text-primary)] ui-transition cursor-pointer';

export const HeatwaveSimulator: React.FC<HeatwaveSimulatorProps> = ({ schools }) => {
  const [simMode, setSimMode] = useState<'calor' | 'ar'>('calor');

  const availableSchools = useMemo(() => {
    const base =
      schools && schools.length > 0
        ? schools
        : attachHeatIslandData(INITIAL_SCHOOLS, HEAT_ISLAND_RESULTS);
    return base.filter((s) => !s.isDemo && s.classesByShift && s.classesByShift.length > 0);
  }, [schools]);

  // Estado do Simulador de Ar da Sala (CO2)
  const [selectedAirSchoolId, setSelectedAirSchoolId] = useState<string>('livre');
  const [airStudents, setAirStudents] = useState<number>(35);
  const [airStageKey, setAirStageKey] = useState<StageOptionKey>('fundamental_2');
  const [airAreaM2, setAirAreaM2] = useState<number>(50);
  const [airHeightM, setAirHeightM] = useState<number>(3.0);
  const [airVentKey, setAirVentKey] = useState<VentilationOptionKey>('fechada_split');
  const [recessOpen, setRecessOpen] = useState<boolean>(true);
  const [endClassVent, setEndClassVent] = useState<boolean>(false);
  const [hoveredMinute, setHoveredMinute] = useState<number | null>(null);

  const handleSelectAirSchool = (schoolId: string) => {
    setSelectedAirSchoolId(schoolId);
    if (schoolId === 'livre') return;
    const found = availableSchools.find((s) => s.id === schoolId);
    if (!found) return;

    const est = schoolAirEstimate(found, found.inspection);
    if (est.status === 'disponivel' && est.students) {
      setAirStudents(Math.max(10, Math.min(50, est.students)));
    }
    const { rateLs } = co2GenerationPerStudent(found.enrollmentByStage);
    if (rateLs <= 0.0037) setAirStageKey('infantil_fund1');
    else if (rateLs <= 0.0045) setAirStageKey('fundamental_2');
    else setAirStageKey('medio_eja');
  };

  const airGenerationLs = STAGE_CO2_OPTIONS[airStageKey].rateLs;
  const airRoomVolumeM3 = Math.round(airAreaM2 * airHeightM * 10) / 10;
  const airAchClass = AIR_CHANGES_PER_HOUR[airVentKey];

  const airSim = useMemo(
    () =>
      simulateClassroomCo2({
        students: airStudents,
        generationPerStudentLs: airGenerationLs,
        roomVolumeM3: airRoomVolumeM3,
        achClass: airAchClass,
        achRecess: recessOpen ? AIR_CHANGES_PER_HOUR.ventilacao_cruzada : airAchClass,
        ventilateMinutesAtClassEnd: endClassVent ? 5 : 0,
        achVentilation: AIR_CHANGES_PER_HOUR.ventilacao_cruzada,
      }),
    [airStudents, airGenerationLs, airRoomVolumeM3, airAchClass, recessOpen, endClassVent]
  );

  const airRequiredAch = requiredAirChangesPerHour(airStudents, airGenerationLs, airRoomVolumeM3);
  const airRequiredM3h =
    ((airStudents * airGenerationLs + TEACHER_CO2_LS) * 3.6) /
    (CO2_MARGIN_ABOVE_OUTDOOR_PPM * 1e-6);

  // 1. Condições meteorológicas externas hipotéticas
  const [outdoorTempC, setOutdoorTempC] = useState<number>(36.0);
  const [relativeHumidity, setRelativeHumidity] = useState<number>(65);
  const [solarRadiationWm2, setSolarRadiationWm2] = useState<number>(850);
  const [windSpeedKmh, setWindSpeedKmh] = useState<number>(8);

  // 2. Parâmetros da Envoltória Predial (Cenário Base)
  const [roofType, setRoofType] = useState<RoofType>('fibrocimento');
  const [ventilation, setVentilation] = useState<VentilationType>('unilateral_parcial');
  const [solarOrientation, setSolarOrientation] = useState<'oeste' | 'norte' | 'leste' | 'sul'>('oeste');
  const [shadingFactor, setShadingFactor] = useState<number>(0.2);
  const [occupancyCount, setOccupancyCount] = useState<number>(35);
  const [powerGridStatus, setPowerGridStatus] = useState<'normal' | 'blackout' | 'sobrecarga'>('normal');

  // 3. Cenário com Intervenções Físicas de Mitigação (Cenário Comparado)
  const [applyReflectiveRoof, setApplyReflectiveRoof] = useState<boolean>(true);
  const [applyCrossVentilation, setApplyCrossVentilation] = useState<boolean>(true);
  const [applyExternalShading, setApplyExternalShading] = useState<boolean>(true);
  const [stabilizePowerGrid, setStabilizePowerGrid] = useState<boolean>(true);

  // Cálculos determinísticos externos
  const outdoorHeatIndex = calculateHeatIndex(outdoorTempC, relativeHumidity);
  const outdoorApparentTemp = calculateApparentTemperature(
    outdoorTempC,
    relativeHumidity,
    windSpeedKmh / 3.6
  );
  const outdoorRisk = getRiskBand(outdoorHeatIndex);
  const outdoorNC = getRioHeatLevel(outdoorHeatIndex);

  // Cenário Base (Atual)
  const baseParams: EnvelopeSimulationParameters = {
    roofType,
    ventilationType: ventilation,
    solarOrientation,
    shadingFactor,
    studentOccupancy: occupancyCount,
    powerGridStatus,
  };
  const baseResult = estimateEnvelopeGain(baseParams, outdoorTempC, solarRadiationWm2);
  const baseIndoorHI = calculateHeatIndex(baseResult.simulatedIndoorTempC, relativeHumidity);
  const baseIndoorRisk = getRiskBand(baseIndoorHI);

  // Cenário Mitigado (Intervenção Proposta)
  const mitigatedRoof: RoofType = applyReflectiveRoof ? 'termoacustica' : roofType;
  const mitigatedVent: VentilationType = applyCrossVentilation ? 'cruzada_adequada' : ventilation;
  const mitigatedShading: number = applyExternalShading
    ? Math.min(1, shadingFactor + 0.5)
    : shadingFactor;
  const mitigatedPower = stabilizePowerGrid ? 'normal' : powerGridStatus;

  const mitigatedParams: EnvelopeSimulationParameters = {
    roofType: mitigatedRoof,
    ventilationType: mitigatedVent,
    solarOrientation,
    shadingFactor: mitigatedShading,
    studentOccupancy: occupancyCount,
    powerGridStatus: mitigatedPower,
  };
  const mitigatedResult = estimateEnvelopeGain(mitigatedParams, outdoorTempC, solarRadiationWm2);
  const mitigatedIndoorHI = calculateHeatIndex(mitigatedResult.simulatedIndoorTempC, relativeHumidity);
  const mitigatedIndoorRisk = getRiskBand(mitigatedIndoorHI);

  const deltaBenefit =
    Math.round((baseResult.simulatedIndoorTempC - mitigatedResult.simulatedIndoorTempC) * 10) / 10;

  const outdoorStep = riskBandToStep(outdoorRisk, outdoorHeatIndex);
  const baseStep = riskBandToStep(baseIndoorRisk, baseIndoorHI);
  const mitigatedStep = riskBandToStep(mitigatedIndoorRisk, mitigatedIndoorHI);

  return (
    <div className="space-y-6">
      {/* Cabeçalho compacto da aba com selo de procedência e alternador segmentado em grafite */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3 min-w-0">
          <h2 className="text-lg sm:text-xl font-semibold text-[var(--text-primary)] tracking-tight">
            Simulador
          </h2>

          <DataProvenanceBadge
            provenance={{
              source:
                simMode === 'calor'
                  ? 'Modelo teórico de transferência térmica da envoltória'
                  : 'Balanço de massa de CO2 (ABNT NBR 17037 / Carrasco, Molina e Jones)',
              timestamp:
                simMode === 'calor'
                  ? 'Parâmetros interativos definidos pelo usuário'
                  : 'Simulação interativa de 4 aulas (220 min)',
              location:
                simMode === 'calor'
                  ? 'Sala de aula hipotética'
                  : selectedAirSchoolId === 'livre'
                  ? 'Sala hipotética com parâmetros livres'
                  : availableSchools.find((s) => s.id === selectedAirSchoolId)?.name ||
                    'Escola selecionada',
              nature: 'cenario_hipotetico',
              natureDescription:
                simMode === 'calor'
                  ? 'Simulador de sensibilidade térmica para comparar intervenções prediais. Não substitui medição por sensores in situ nem previsão meteorológica oficial.'
                  : 'Simulação hipotética de concentração de CO2 por aula. Trocas de ar são provisórias até calibração no piloto.',
            }}
            variant="compact"
          />
        </div>

        <div
          role="tablist"
          aria-label="Selecionar modelo do simulador"
          className="w-full sm:w-auto grid grid-cols-2 gap-1 p-1 rounded-[var(--radius-card)] bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)]"
        >
          <button
            type="button"
            role="tab"
            aria-selected={simMode === 'calor'}
            onClick={() => setSimMode('calor')}
            className={`min-h-[44px] px-4 py-2 rounded-[var(--radius-control)] text-xs sm:text-sm font-semibold flex items-center justify-center gap-1.5 ui-transition cursor-pointer whitespace-nowrap ${
              simMode === 'calor'
                ? 'bg-[var(--action-primary)] text-[var(--action-primary-fg)] shadow-[var(--shadow-card)]'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            <Flame className="w-4 h-4 shrink-0" />
            <span>Calor na sala</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={simMode === 'ar'}
            onClick={() => setSimMode('ar')}
            className={`min-h-[44px] px-4 py-2 rounded-[var(--radius-control)] text-xs sm:text-sm font-semibold flex items-center justify-center gap-1.5 ui-transition cursor-pointer whitespace-nowrap ${
              simMode === 'ar'
                ? 'bg-[var(--action-primary)] text-[var(--action-primary-fg)] shadow-[var(--shadow-card)]'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            <Wind className="w-4 h-4 shrink-0" />
            <span>Ar da sala</span>
          </button>
        </div>
      </div>

      {/* MODO 1: CALOR NA SALA */}
      {simMode === 'calor' && (
        <div className="space-y-6">
          {/* Cenários rápidos */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-[var(--text-muted)] mr-1">
              Cenários rápidos:
            </span>
            {QUICK_SCENARIOS.map((preset) => {
              const isPresetActive =
                outdoorTempC === preset.temp &&
                relativeHumidity === preset.rh &&
                solarRadiationWm2 === preset.rad &&
                windSpeedKmh === preset.wind;

              return (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => {
                    setOutdoorTempC(preset.temp);
                    setRelativeHumidity(preset.rh);
                    setSolarRadiationWm2(preset.rad);
                    setWindSpeedKmh(preset.wind);
                  }}
                  className={`min-h-[36px] px-3 py-1.5 text-xs font-semibold rounded-[var(--radius-control)] border ui-transition cursor-pointer ${
                    isPresetActive
                      ? 'bg-[var(--action-primary)] text-[var(--action-primary-fg)] border-[var(--action-primary)]'
                      : 'bg-[var(--bg-surface)] text-[var(--text-secondary)] border-[var(--border-subtle)] hover:text-[var(--text-primary)] hover:border-[var(--border-strong)]'
                  }`}
                >
                  {preset.label}
                </button>
              );
            })}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Colunas 1 e 2: Controles de Entrada */}
            <div className="lg:col-span-2 space-y-6">
              {/* 1. Condições Meteorológicas Externas Hipotéticas */}
              <section className="civic-card p-4 sm:p-6 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-[var(--border-subtle)]">
                  <div className="flex items-center gap-2">
                    <Sun className="w-4 h-4 text-[var(--text-secondary)] shrink-0" />
                    <h3 className="text-sm font-semibold text-[var(--text-primary)]">
                      1. Condições meteorológicas externas hipotéticas
                    </h3>
                    <TermTooltip
                      term="Modelo de sensibilidade"
                      explanation="Os valores internos exibidos representam um modelo conceitual de sensibilidade térmica da envoltória para comparar intervenções prediais. Não constituem previsão oficial nem medição em salas reais."
                      align="left"
                    />
                  </div>
                  <span className="text-xs text-[var(--text-muted)]">Ambiente hipotético</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <label htmlFor="sim-outdoor-temp" className="font-semibold text-[var(--text-secondary)]">
                        Temperatura do ar externo
                      </label>
                      <span
                        className="font-semibold tabular-nums"
                        style={{ color: THERMAL_SCALE[heatIndexToThermalStep(outdoorTempC)].textVar }}
                      >
                        {formatTempPtBr(outdoorTempC)}
                      </span>
                    </div>
                    <input
                      id="sim-outdoor-temp"
                      type="range"
                      min="26"
                      max="45"
                      step="0.5"
                      value={outdoorTempC}
                      onChange={(e) => setOutdoorTempC(parseFloat(e.target.value))}
                      className="w-full h-2 accent-[var(--action-primary)] cursor-pointer"
                    />
                    <div className="flex justify-between text-xs text-[var(--text-muted)] tabular-nums">
                      <span>26 °C (ameno)</span>
                      <span>36 °C (onda típica)</span>
                      <span>45 °C (extremo)</span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <label htmlFor="sim-rh" className="font-semibold text-[var(--text-secondary)]">
                        Umidade relativa do ar
                      </label>
                      <span className="font-semibold text-[var(--text-primary)] tabular-nums">
                        {formatPercentIntPtBr(relativeHumidity)}
                      </span>
                    </div>
                    <input
                      id="sim-rh"
                      type="range"
                      min="25"
                      max="95"
                      step="1"
                      value={relativeHumidity}
                      onChange={(e) => setRelativeHumidity(parseInt(e.target.value, 10))}
                      className="w-full h-2 accent-[var(--action-primary)] cursor-pointer"
                    />
                    <div className="flex justify-between text-xs text-[var(--text-muted)] tabular-nums">
                      <span>25% (seco)</span>
                      <span>65% (média verão RJ)</span>
                      <span>95% (úmido)</span>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <label htmlFor="sim-solar" className="font-semibold text-[var(--text-secondary)]">
                        Radiação solar global
                      </label>
                      <span className="font-semibold text-[var(--text-primary)] tabular-nums">
                        {formatIntegerPtBr(solarRadiationWm2)} W/m²
                      </span>
                    </div>
                    <select
                      id="sim-solar"
                      value={solarRadiationWm2}
                      onChange={(e) => setSolarRadiationWm2(parseInt(e.target.value, 10))}
                      className={INPUT_CONTROL_CLASS}
                    >
                      <option value={950}>950 W/m² · Céu aberto / Sol a pino (12h-14h)</option>
                      <option value={750}>750 W/m² · Insolação média de tarde (14h-16h)</option>
                      <option value={450}>450 W/m² · Parcialmente nublado</option>
                      <option value={180}>180 W/m² · Céu encoberto</option>
                    </select>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <label htmlFor="sim-wind" className="font-semibold text-[var(--text-secondary)]">
                        Velocidade do vento
                      </label>
                      <span className="font-semibold text-[var(--text-primary)] tabular-nums">
                        {formatIntegerPtBr(windSpeedKmh)} km/h ({formatNumberPtBr(windSpeedKmh / 3.6)} m/s)
                      </span>
                    </div>
                    <input
                      id="sim-wind"
                      type="range"
                      min="0"
                      max="35"
                      step="1"
                      value={windSpeedKmh}
                      onChange={(e) => setWindSpeedKmh(parseInt(e.target.value, 10))}
                      className="w-full h-2 accent-[var(--action-primary)] cursor-pointer"
                    />
                    <div className="flex justify-between text-xs text-[var(--text-muted)] tabular-nums">
                      <span>0 km/h (calmaria)</span>
                      <span>10 km/h (brisa leve)</span>
                      <span>30 km/h (moderado)</span>
                    </div>
                  </div>
                </div>
              </section>

              {/* 2. Parâmetros da Edificação Escolar (Cenário Base) */}
              <section className="civic-card p-4 sm:p-6 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-[var(--border-subtle)]">
                  <div className="flex items-center gap-2">
                    <Building className="w-4 h-4 text-[var(--text-secondary)] shrink-0" />
                    <h3 className="text-sm font-semibold text-[var(--text-primary)]">
                      2. Parâmetros da edificação escolar (cenário base)
                    </h3>
                  </div>
                  <span className="text-xs text-[var(--text-muted)]">Condições da sala</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                  <div className="space-y-1.5">
                    <label htmlFor="sim-roof" className="block font-semibold text-[var(--text-secondary)]">
                      Tipo de cobertura
                    </label>
                    <select
                      id="sim-roof"
                      value={roofType}
                      onChange={(e) => setRoofType(e.target.value as RoofType)}
                      className={INPUT_CONTROL_CLASS}
                    >
                      <option value="fibrocimento">Fibrocimento sem forro (+3,8 °C)</option>
                      <option value="telha_metalica">Telha metálica simples (+4,5 °C)</option>
                      <option value="laje_concreto">Laje de concreto maciça (+2,2 °C)</option>
                      <option value="termoacustica">Telha termoacústica / manta (+0,8 °C)</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label htmlFor="sim-vent" className="block font-semibold text-[var(--text-secondary)]">
                      Ventilação natural
                    </label>
                    <select
                      id="sim-vent"
                      value={ventilation}
                      onChange={(e) => setVentilation(e.target.value as VentilationType)}
                      className={INPUT_CONTROL_CLASS}
                    >
                      <option value="bloqueada_ou_fechada">Bloqueada / Janelas fechadas (+1,5 °C)</option>
                      <option value="unilateral_parcial">Unilateral parcial (-0,8 °C)</option>
                      <option value="cruzada_adequada">Cruzada adequada (-2,5 °C)</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label htmlFor="sim-orient" className="block font-semibold text-[var(--text-secondary)]">
                      Orientação da fachada
                    </label>
                    <select
                      id="sim-orient"
                      value={solarOrientation}
                      onChange={(e) => setSolarOrientation(e.target.value as any)}
                      className={INPUT_CONTROL_CLASS}
                    >
                      <option value="oeste">Oeste (Sol da tarde poente - Crítico)</option>
                      <option value="norte">Norte (Insolação contínua)</option>
                      <option value="leste">Leste (Sol da manhã)</option>
                      <option value="sul">Sul (Menor carga direta)</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label htmlFor="sim-occ" className="block font-semibold text-[var(--text-secondary)]">
                      Alunos por sala
                    </label>
                    <select
                      id="sim-occ"
                      value={occupancyCount}
                      onChange={(e) => setOccupancyCount(parseInt(e.target.value, 10))}
                      className={INPUT_CONTROL_CLASS}
                    >
                      <option value={15}>15 alunos (Turma reduzida)</option>
                      <option value={30}>30 alunos (Padrão)</option>
                      <option value={45}>45 alunos (Superlotação crítica)</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label htmlFor="sim-shade" className="block font-semibold text-[var(--text-secondary)]">
                      Sombreamento arbóreo / brises
                    </label>
                    <select
                      id="sim-shade"
                      value={shadingFactor}
                      onChange={(e) => setShadingFactor(parseFloat(e.target.value))}
                      className={INPUT_CONTROL_CLASS}
                    >
                      <option value={0}>0% · Paredes e janelas expostas ao sol</option>
                      <option value={0.3}>30% · Árvores esparsas no pátio</option>
                      <option value={0.7}>70% · Bosque denso ou brises externos</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label htmlFor="sim-grid" className="block font-semibold text-[var(--text-secondary)]">
                      Rede elétrica da escola
                    </label>
                    <select
                      id="sim-grid"
                      value={powerGridStatus}
                      onChange={(e) => setPowerGridStatus(e.target.value as any)}
                      className={INPUT_CONTROL_CLASS}
                    >
                      <option value="normal">Rede estável (Ventiladores ativos)</option>
                      <option value="sobrecarga">Sobrecarga elétrica / Desarme (+3,0 °C)</option>
                      <option value="blackout">Queda total de energia / Furto de cabos (+3,0 °C)</option>
                    </select>
                  </div>
                </div>
              </section>

              {/* 3. Intervenções Físicas Propostas para Mitigação */}
              <section className="civic-card p-4 sm:p-6 space-y-4">
                <div className="space-y-1 pb-3 border-b border-[var(--border-subtle)]">
                  <div className="flex items-center gap-2">
                    <Zap className="w-4 h-4 text-[var(--text-secondary)] shrink-0" />
                    <h3 className="text-sm font-semibold text-[var(--text-primary)]">
                      3. Intervenções físicas propostas para mitigação
                    </h3>
                  </div>
                  <p className="text-xs text-[var(--text-muted)]">
                    Selecione melhorias de engenharia civil e infraestrutura para comparar o benefício térmico estimado:
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <label
                    className={`flex items-start gap-3 p-3.5 rounded-[var(--radius-control)] border ui-transition cursor-pointer ${
                      applyReflectiveRoof
                        ? 'bg-[var(--bg-surface-subtle)] border-[var(--border-strong)]'
                        : 'bg-[var(--bg-surface)] border-[var(--border-subtle)] hover:border-[var(--border-strong)]'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={applyReflectiveRoof}
                      onChange={(e) => setApplyReflectiveRoof(e.target.checked)}
                      className="w-4 h-4 mt-0.5 rounded accent-[var(--action-primary)] shrink-0 cursor-pointer"
                    />
                    <div className="space-y-1">
                      <span className="block font-semibold text-[var(--text-primary)]">
                        Substituição por telha termoacústica
                      </span>
                      <span className="block text-[var(--text-secondary)] leading-relaxed">
                        Substitui telha de fibrocimento ou metálica por painel sanduíche com poliuretano ou manta refletiva.
                      </span>
                    </div>
                  </label>

                  <label
                    className={`flex items-start gap-3 p-3.5 rounded-[var(--radius-control)] border ui-transition cursor-pointer ${
                      applyCrossVentilation
                        ? 'bg-[var(--bg-surface-subtle)] border-[var(--border-strong)]'
                        : 'bg-[var(--bg-surface)] border-[var(--border-subtle)] hover:border-[var(--border-strong)]'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={applyCrossVentilation}
                      onChange={(e) => setApplyCrossVentilation(e.target.checked)}
                      className="w-4 h-4 mt-0.5 rounded accent-[var(--action-primary)] shrink-0 cursor-pointer"
                    />
                    <div className="space-y-1">
                      <span className="block font-semibold text-[var(--text-primary)]">
                        Abertura de ventilação cruzada
                      </span>
                      <span className="block text-[var(--text-secondary)] leading-relaxed">
                        Instalação de cobogós, basculantes opostos ou ventilação zenital para fluxo contínuo de ar.
                      </span>
                    </div>
                  </label>

                  <label
                    className={`flex items-start gap-3 p-3.5 rounded-[var(--radius-control)] border ui-transition cursor-pointer ${
                      applyExternalShading
                        ? 'bg-[var(--bg-surface-subtle)] border-[var(--border-strong)]'
                        : 'bg-[var(--bg-surface)] border-[var(--border-subtle)] hover:border-[var(--border-strong)]'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={applyExternalShading}
                      onChange={(e) => setApplyExternalShading(e.target.checked)}
                      className="w-4 h-4 mt-0.5 rounded accent-[var(--action-primary)] shrink-0 cursor-pointer"
                    />
                    <div className="space-y-1">
                      <span className="block font-semibold text-[var(--text-primary)]">
                        Brises e arborização de entorno
                      </span>
                      <span className="block text-[var(--text-secondary)] leading-relaxed">
                        Instalação de brises na fachada oeste e plantio comunitário de árvores para sombrear paredes.
                      </span>
                    </div>
                  </label>

                  <label
                    className={`flex items-start gap-3 p-3.5 rounded-[var(--radius-control)] border ui-transition cursor-pointer ${
                      stabilizePowerGrid
                        ? 'bg-[var(--bg-surface-subtle)] border-[var(--border-strong)]'
                        : 'bg-[var(--bg-surface)] border-[var(--border-subtle)] hover:border-[var(--border-strong)]'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={stabilizePowerGrid}
                      onChange={(e) => setStabilizePowerGrid(e.target.checked)}
                      className="w-4 h-4 mt-0.5 rounded accent-[var(--action-primary)] shrink-0 cursor-pointer"
                    />
                    <div className="space-y-1">
                      <span className="block font-semibold text-[var(--text-primary)]">
                        Reforma da subestação elétrica
                      </span>
                      <span className="block text-[var(--text-secondary)] leading-relaxed">
                        Garante que a rede suporte os ventiladores e aparelhos sem desarmes frequentes do disjuntor.
                      </span>
                    </div>
                  </label>
                </div>
              </section>
            </div>

            {/* Coluna 3: Resultados Comparativos */}
            <aside className="space-y-4">
              <div className="civic-card p-4 sm:p-6 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-[var(--border-subtle)]">
                  <h3 className="text-sm font-semibold text-[var(--text-primary)]">
                    Resultados comparados
                  </h3>
                  <span
                    className="inline-flex items-center px-2.5 py-0.5 rounded-[var(--radius-control)] border text-xs font-semibold tabular-nums"
                    style={{
                      backgroundColor:
                        deltaBenefit > 0 ? THERMAL_SCALE[2].bgVar : 'var(--bg-surface-subtle)',
                      borderColor:
                        deltaBenefit > 0 ? THERMAL_SCALE[2].borderVar : 'var(--border-subtle)',
                      color:
                        deltaBenefit > 0 ? THERMAL_SCALE[2].textVar : 'var(--text-secondary)',
                    }}
                  >
                    Redução: -{formatTempPtBr(deltaBenefit)}
                  </span>
                </div>

                {/* Condição Externa de Referência */}
                <div className="p-3.5 rounded-[var(--radius-card)] bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] space-y-1.5 text-xs">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[var(--text-muted)]">Exterior (referência)</span>
                    <span
                      className="inline-flex items-center px-2 py-0.5 rounded-[var(--radius-control)] border text-xs font-semibold"
                      style={{
                        backgroundColor: THERMAL_SCALE[outdoorStep].bgVar,
                        borderColor: THERMAL_SCALE[outdoorStep].borderVar,
                        color: THERMAL_SCALE[outdoorStep].textVar,
                      }}
                    >
                      {BAND_LABELS[outdoorRisk]}
                    </span>
                  </div>

                  <div className="flex items-baseline justify-between gap-2">
                    <div className="flex items-baseline gap-1">
                      <span
                        className="text-2xl font-semibold tabular-nums leading-tight"
                        style={{ color: THERMAL_SCALE[outdoorStep].textVar }}
                      >
                        {formatNumberPtBr(outdoorTempC)}
                      </span>
                      <span className="text-sm text-[var(--text-secondary)]">°C</span>
                    </div>
                    <span className="text-[var(--text-secondary)] tabular-nums">
                      IC:{' '}
                      <strong className="font-semibold text-[var(--text-primary)]">
                        {formatTempPtBr(outdoorHeatIndex)}
                      </strong>{' '}
                      ({outdoorNC})
                    </span>
                  </div>

                  <p className="text-[var(--text-muted)] tabular-nums">
                    Temperatura aparente (Steadman): {formatTempPtBr(outdoorApparentTemp)}
                  </p>
                </div>

                {/* Cenário Base (Sem Reforma) */}
                <div
                  className="p-4 rounded-[var(--radius-card)] bg-[var(--bg-surface)] border border-[var(--border-subtle)] space-y-2 text-xs"
                  style={{
                    borderLeftWidth: '4px',
                    borderLeftColor: THERMAL_SCALE[baseStep].solidVar,
                  }}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-[var(--text-primary)]">
                      Cenário base (sem reforma)
                    </span>
                    <span
                      className="inline-flex items-center px-2 py-0.5 rounded-[var(--radius-control)] border text-xs font-semibold shrink-0"
                      style={{
                        backgroundColor: THERMAL_SCALE[baseStep].bgVar,
                        borderColor: THERMAL_SCALE[baseStep].borderVar,
                        color: THERMAL_SCALE[baseStep].textVar,
                      }}
                    >
                      {BAND_LABELS[baseIndoorRisk]}
                    </span>
                  </div>

                  <div className="flex items-baseline justify-between gap-2">
                    <div className="flex items-baseline gap-1">
                      <span
                        className="text-2xl font-semibold tabular-nums leading-tight"
                        style={{ color: THERMAL_SCALE[baseStep].textVar }}
                      >
                        {formatNumberPtBr(baseResult.simulatedIndoorTempC)}
                      </span>
                      <span className="text-sm text-[var(--text-secondary)]">°C</span>
                    </div>
                    <span className="font-semibold text-[var(--text-secondary)] tabular-nums">
                      IC: {formatTempPtBr(baseIndoorHI)}
                    </span>
                  </div>

                  <div className="text-[var(--text-secondary)] tabular-nums">
                    Diferencial térmico:{' '}
                    <strong className="font-semibold text-[var(--text-primary)]">
                      {formatTempPtBr(baseResult.estimatedDeltaC, { signed: true })}
                    </strong>
                  </div>
                  <p className="text-[var(--text-muted)] leading-snug">{baseResult.label}</p>
                </div>

                {/* Cenário com Intervenção */}
                <div
                  className="p-4 rounded-[var(--radius-card)] bg-[var(--bg-surface)] border border-[var(--border-subtle)] space-y-2 text-xs"
                  style={{
                    borderLeftWidth: '4px',
                    borderLeftColor: THERMAL_SCALE[mitigatedStep].solidVar,
                  }}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-[var(--text-primary)] inline-flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-[var(--text-secondary)] shrink-0" />
                      <span>Cenário com intervenção</span>
                    </span>
                    <span
                      className="inline-flex items-center px-2 py-0.5 rounded-[var(--radius-control)] border text-xs font-semibold shrink-0"
                      style={{
                        backgroundColor: THERMAL_SCALE[mitigatedStep].bgVar,
                        borderColor: THERMAL_SCALE[mitigatedStep].borderVar,
                        color: THERMAL_SCALE[mitigatedStep].textVar,
                      }}
                    >
                      {BAND_LABELS[mitigatedIndoorRisk]}
                    </span>
                  </div>

                  <div className="flex items-baseline justify-between gap-2">
                    <div className="flex items-baseline gap-1">
                      <span
                        className="text-2xl font-semibold tabular-nums leading-tight"
                        style={{ color: THERMAL_SCALE[mitigatedStep].textVar }}
                      >
                        {formatNumberPtBr(mitigatedResult.simulatedIndoorTempC)}
                      </span>
                      <span className="text-sm text-[var(--text-secondary)]">°C</span>
                    </div>
                    <span className="font-semibold text-[var(--text-secondary)] tabular-nums">
                      IC: {formatTempPtBr(mitigatedIndoorHI)}
                    </span>
                  </div>

                  <div className="text-[var(--text-secondary)] tabular-nums">
                    Diferencial térmico:{' '}
                    <strong className="font-semibold text-[var(--text-primary)]">
                      {formatTempPtBr(mitigatedResult.estimatedDeltaC, { signed: true })}
                    </strong>
                  </div>
                  <p className="text-[var(--text-muted)] leading-snug">{mitigatedResult.label}</p>
                </div>

                {/* Síntese Comparativa do Ganho */}
                <div className="p-3.5 rounded-[var(--radius-card)] bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] text-xs space-y-1.5">
                  <strong className="block font-semibold text-[var(--text-primary)]">
                    Impacto estimado da intervenção
                  </strong>
                  <p className="text-[var(--text-secondary)] leading-relaxed">
                    As melhorias de envoltória e ventilação resultam em redução teórica de{' '}
                    <strong className="font-semibold text-[var(--text-primary)] tabular-nums">
                      {formatTempPtBr(deltaBenefit)}
                    </strong>{' '}
                    na temperatura ambiente da sala e diminuem o estresse térmico em até{' '}
                    <strong className="font-semibold text-[var(--text-primary)] tabular-nums">
                      {formatTempPtBr(baseIndoorHI - mitigatedIndoorHI)}
                    </strong>{' '}
                    de sensação térmica.
                  </p>
                </div>

                {/* Hipóteses e Limitações */}
                <div className="pt-2 border-t border-[var(--border-subtle)] text-xs text-[var(--text-muted)] space-y-1.5">
                  <div className="font-semibold text-[var(--text-secondary)] flex items-center gap-1.5">
                    <Info className="w-3.5 h-3.5 shrink-0" />
                    <span>Hipóteses do modelo físico</span>
                  </div>
                  <ul className="list-disc pl-4 space-y-1 leading-relaxed">
                    {baseResult.caveats.map((c, i) => (
                      <li key={i}>{c}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </aside>
          </div>
        </div>
      )}

      {/* MODO 2: AR DA SALA (BALANÇO DE MASSA CO2) */}
      {simMode === 'ar' && (() => {
        const maxPpmScale = Math.max(2400, Math.ceil(airSim.peakPpm / 400) * 400);
        const svgW = 640;
        const svgH = 230;
        const padL = 48;
        const padR = 14;
        const padT = 18;
        const padB = 30;
        const plotW = svgW - padL - padR;
        const plotH = svgH - padT - padB;

        const xForMin = (m: number) => padL + (m / 220) * plotW;
        const yForPpm = (ppm: number) =>
          padT + plotH - (Math.min(ppm, maxPpmScale) / maxPpmScale) * plotH;

        const linePoints = airSim.series
          .map((ppm, m) => `${xForMin(m).toFixed(1)},${yForPpm(ppm).toFixed(1)}`)
          .join(' ');

        const refY = yForPpm(CO2_REFERENCE_PPM);
        const recessX1 = xForMin(100);
        const recessX2 = xForMin(120);

        const activeMinute = hoveredMinute !== null ? hoveredMinute : 220;
        const activePpm = Math.round(airSim.series[activeMinute] ?? OUTDOOR_CO2_PPM);
        const activePhase =
          activeMinute === 0
            ? 'Início do turno'
            : activeMinute <= 50
            ? 'Aula 1'
            : activeMinute <= 100
            ? 'Aula 2'
            : activeMinute <= 120
            ? 'Recreio (sala vazia)'
            : activeMinute <= 170
            ? 'Aula 3'
            : 'Aula 4';

        const peakExceeded = airSim.peakPpm > CO2_REFERENCE_PPM;
        const minutesExceeded = airSim.minutesAboveReference > 0;

        const updateHoveredFromClientX = (clientX: number, rect: DOMRect) => {
          const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
          const min = Math.max(0, Math.min(220, Math.round(ratio * 220)));
          setHoveredMinute(min);
        };

        return (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Controles do Simulador de CO2 */}
            <section className="civic-card p-4 sm:p-6 space-y-4 text-xs">
              <div className="flex items-center justify-between gap-2 pb-3 border-b border-[var(--border-subtle)]">
                <div className="flex items-center gap-2">
                  <Wind className="w-4 h-4 text-[var(--text-secondary)] shrink-0" />
                  <h3 className="text-sm font-semibold text-[var(--text-primary)]">
                    Parâmetros da sala e da turma
                  </h3>
                </div>
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor="sim-air-school"
                  className="block font-semibold text-[var(--text-secondary)]"
                >
                  Escola (Censo 2024/2025) ou valores livres
                </label>
                <select
                  id="sim-air-school"
                  aria-label="Selecionar escola para simulação de CO2"
                  value={selectedAirSchoolId}
                  onChange={(e) => handleSelectAirSchool(e.target.value)}
                  className={INPUT_CONTROL_CLASS}
                >
                  <option value="livre">Valores livres (personalizado)</option>
                  {availableSchools.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.borough})
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <label htmlFor="sim-air-students" className="font-semibold text-[var(--text-secondary)]">
                    Alunos na sala
                  </label>
                  <span className="font-semibold text-[var(--text-primary)] tabular-nums">
                    {formatIntegerPtBr(airStudents)} alunos (+1 docente)
                  </span>
                </div>
                <input
                  id="sim-air-students"
                  type="range"
                  min="10"
                  max="50"
                  step="1"
                  value={airStudents}
                  onChange={(e) => {
                    setSelectedAirSchoolId('livre');
                    setAirStudents(parseInt(e.target.value, 10));
                  }}
                  className="w-full h-2 accent-[var(--action-primary)] cursor-pointer"
                />
                <div className="flex justify-between text-xs text-[var(--text-muted)] tabular-nums">
                  <span>10</span>
                  <span>30</span>
                  <span>50 alunos</span>
                </div>
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor="sim-air-stage"
                  className="block font-semibold text-[var(--text-secondary)]"
                >
                  Etapa predominante (geração de CO2)
                </label>
                <select
                  id="sim-air-stage"
                  aria-label="Etapa escolar para simulação de CO2"
                  value={airStageKey}
                  onChange={(e) => {
                    setSelectedAirSchoolId('livre');
                    setAirStageKey(e.target.value as StageOptionKey);
                  }}
                  className={INPUT_CONTROL_CLASS}
                >
                  {Object.entries(STAGE_CO2_OPTIONS).map(([key, opt]) => (
                    <option key={key} value={key}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-1">
                    <label htmlFor="sim-air-area" className="font-semibold text-[var(--text-secondary)]">
                      Área (m²)
                    </label>
                    <span className="font-semibold text-[var(--text-primary)] tabular-nums">
                      {formatIntegerPtBr(airAreaM2)} m²
                    </span>
                  </div>
                  <input
                    id="sim-air-area"
                    type="range"
                    min="30"
                    max="80"
                    step="1"
                    value={airAreaM2}
                    onChange={(e) => setAirAreaM2(parseInt(e.target.value, 10))}
                    className="w-full h-2 accent-[var(--action-primary)] cursor-pointer"
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-1">
                    <label htmlFor="sim-air-height" className="font-semibold text-[var(--text-secondary)]">
                      Pé-direito (m)
                    </label>
                    <span className="font-semibold text-[var(--text-primary)] tabular-nums">
                      {formatNumberPtBr(airHeightM)} m
                    </span>
                  </div>
                  <input
                    id="sim-air-height"
                    type="range"
                    min="2.6"
                    max="4.0"
                    step="0.1"
                    value={airHeightM}
                    onChange={(e) => setAirHeightM(parseFloat(e.target.value))}
                    className="w-full h-2 accent-[var(--action-primary)] cursor-pointer"
                  />
                </div>
              </div>

              <div className="rounded-[var(--radius-control)] bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] px-3 py-2 flex items-center justify-between text-xs">
                <span className="text-[var(--text-secondary)]">Volume calculado da sala</span>
                <strong className="font-semibold text-[var(--text-primary)] tabular-nums">
                  {formatNumberPtBr(airRoomVolumeM3, {
                    decimals: Number.isInteger(airRoomVolumeM3) ? 0 : 1,
                  })}{' '}
                  m³
                </strong>
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor="sim-air-vent"
                  className="block font-semibold text-[var(--text-secondary)]"
                >
                  Ventilação durante a aula
                </label>
                <select
                  id="sim-air-vent"
                  aria-label="Condição de ventilação durante a aula"
                  value={airVentKey}
                  onChange={(e) => setAirVentKey(e.target.value as VentilationOptionKey)}
                  className={INPUT_CONTROL_CLASS}
                >
                  {VENTILATION_OPTIONS.map((opt) => (
                    <option key={opt.key} value={opt.key}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2 pt-3 border-t border-[var(--border-subtle)]">
                <label className="min-h-[44px] flex items-center justify-between gap-3 p-3 rounded-[var(--radius-control)] border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] hover:border-[var(--border-strong)] ui-transition cursor-pointer">
                  <span className="font-semibold text-[var(--text-primary)]">
                    Recreio com tudo aberto
                  </span>
                  <input
                    type="checkbox"
                    checked={recessOpen}
                    onChange={(e) => setRecessOpen(e.target.checked)}
                    className="w-4 h-4 rounded accent-[var(--action-primary)] shrink-0 cursor-pointer"
                  />
                </label>

                <label className="min-h-[44px] flex items-center justify-between gap-3 p-3 rounded-[var(--radius-control)] border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] hover:border-[var(--border-strong)] ui-transition cursor-pointer">
                  <span className="font-semibold text-[var(--text-primary)]">
                    Abrir tudo 5 minutos no fim de cada aula
                  </span>
                  <input
                    type="checkbox"
                    checked={endClassVent}
                    onChange={(e) => setEndClassVent(e.target.checked)}
                    className="w-4 h-4 rounded accent-[var(--action-primary)] shrink-0 cursor-pointer"
                  />
                </label>
              </div>
            </section>

            {/* Gráfico Minuto a Minuto e Indicadores */}
            <section className="lg:col-span-2 civic-card p-4 sm:p-6 space-y-5">
              <div className="flex flex-wrap items-start justify-between gap-3 pb-3 border-b border-[var(--border-subtle)]">
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5">
                    <h3 className="text-sm sm:text-base font-semibold text-[var(--text-primary)]">
                      Evolução simulada de CO2 ao longo de 4 aulas
                    </h3>
                    <TermTooltip
                      term="Referência de CO2 (1.120 ppm)"
                      explanation="Baseada na ABNT NBR 17037 (+700 ppm acima do ar externo médio de 420 ppm). Acima desse valor, recomenda-se ampliar a renovação de ar da sala."
                      align="left"
                    />
                  </div>
                  <p className="text-xs text-[var(--text-muted)] tabular-nums">
                    4 aulas de 50 min com recreio de 20 min após a 2ª aula · ar externo a {formatIntegerPtBr(OUTDOOR_CO2_PPM)} ppm
                  </p>
                </div>

                <div className="px-3 py-1.5 rounded-[var(--radius-control)] bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] text-xs text-[var(--text-secondary)] tabular-nums">
                  Min {formatIntegerPtBr(activeMinute)} ({activePhase}):{' '}
                  <strong
                    className="font-semibold"
                    style={{
                      color:
                        activePpm > CO2_REFERENCE_PPM
                          ? THERMAL_SCALE[5].textVar
                          : 'var(--text-primary)',
                    }}
                  >
                    {formatIntegerPtBr(activePpm)} ppm
                  </strong>
                </div>
              </div>

              {/* Gráfico SVG Responsivo sem rolagem horizontal */}
              <div className="w-full">
                <svg
                  viewBox={`0 0 ${svgW} ${svgH}`}
                  role="img"
                  aria-label="Gráfico minuto a minuto da concentração simulada de CO2 em 4 aulas"
                  className="w-full max-h-[280px] h-auto block select-none"
                  onMouseLeave={() => setHoveredMinute(null)}
                >
                  {/* Faixa sombreada do Recreio (min 100 a 120) */}
                  <rect
                    x={recessX1}
                    y={padT}
                    width={recessX2 - recessX1}
                    height={plotH}
                    fill={THERMAL_SCALE[2].solidVar}
                    opacity={0.14}
                  />
                  <text
                    x={(recessX1 + recessX2) / 2}
                    y={padT + 13}
                    textAnchor="middle"
                    fill={THERMAL_SCALE[2].textVar}
                    fontSize="10"
                    fontWeight={600}
                  >
                    Recreio
                  </text>

                  {/* Linhas horizontais de grade Y */}
                  {[420, 1120, 2000, 3000, 4000]
                    .filter((v) => v <= maxPpmScale)
                    .map((tick) => {
                      const ty = yForPpm(tick);
                      const isRef = tick === CO2_REFERENCE_PPM;
                      return (
                        <g key={tick}>
                          <line
                            x1={padL}
                            y1={ty}
                            x2={svgW - padR}
                            y2={ty}
                            stroke={isRef ? THERMAL_SCALE[5].solidVar : 'var(--border-subtle)'}
                            strokeWidth={isRef ? 1.5 : 1}
                            strokeDasharray={isRef ? '5 4' : undefined}
                          />
                          <text
                            x={padL - 8}
                            y={ty + 4}
                            textAnchor="end"
                            fill={isRef ? THERMAL_SCALE[5].textVar : 'var(--text-muted)'}
                            fontSize="11"
                            fontWeight={isRef ? 600 : 400}
                          >
                            {formatIntegerPtBr(tick)}
                          </text>
                        </g>
                      );
                    })}

                  {/* Rótulo da linha de referência ABNT NBR 17037 */}
                  <text
                    x={svgW - padR - 4}
                    y={refY - 6}
                    textAnchor="end"
                    fill={THERMAL_SCALE[5].textVar}
                    fontSize="10"
                    fontWeight={600}
                  >
                    Referência ABNT NBR 17037 (1.120 ppm)
                  </text>

                  {/* Divisórias verticais entre aulas */}
                  {[50, 100, 120, 170, 220].map((mMark) => (
                    <line
                      key={mMark}
                      x1={xForMin(mMark)}
                      y1={padT}
                      x2={xForMin(mMark)}
                      y2={padT + plotH}
                      stroke="var(--border-subtle)"
                      strokeDasharray="2 3"
                    />
                  ))}

                  {/* Rótulos das aulas no eixo X */}
                  {[
                    { label: 'Aula 1', m: 25 },
                    { label: 'Aula 2', m: 75 },
                    { label: 'Aula 3', m: 145 },
                    { label: 'Aula 4', m: 195 },
                  ].map((seg) => (
                    <text
                      key={seg.label}
                      x={xForMin(seg.m)}
                      y={svgH - 8}
                      textAnchor="middle"
                      fill="var(--text-muted)"
                      fontSize="11"
                    >
                      {seg.label}
                    </text>
                  ))}

                  {/* Curva de CO2 simulada */}
                  <polyline
                    fill="none"
                    stroke={THERMAL_SCALE[1].solidVar}
                    strokeWidth="2.5"
                    strokeLinejoin="round"
                    points={linePoints}
                  />

                  {/* Guia vertical do hover / toque */}
                  {hoveredMinute !== null && (
                    <g>
                      <line
                        x1={xForMin(hoveredMinute)}
                        y1={padT}
                        x2={xForMin(hoveredMinute)}
                        y2={padT + plotH}
                        stroke="var(--border-strong)"
                        strokeWidth="1"
                      />
                      <circle
                        cx={xForMin(hoveredMinute)}
                        cy={yForPpm(airSim.series[hoveredMinute])}
                        r="4.5"
                        fill={THERMAL_SCALE[1].solidVar}
                        stroke="var(--bg-surface)"
                        strokeWidth="1.5"
                      />
                    </g>
                  )}

                  {/* Área invisível para captura de mouse e toque */}
                  <rect
                    x={padL}
                    y={padT}
                    width={plotW}
                    height={plotH}
                    fill="transparent"
                    className="cursor-crosshair"
                    onMouseMove={(e) =>
                      updateHoveredFromClientX(e.clientX, e.currentTarget.getBoundingClientRect())
                    }
                    onClick={(e) =>
                      updateHoveredFromClientX(e.clientX, e.currentTarget.getBoundingClientRect())
                    }
                  />
                </svg>
              </div>

              {/* 3 Métricas abaixo do gráfico */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                <div className="p-4 rounded-[var(--radius-card)] bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] space-y-1">
                  <span className="text-[var(--text-muted)] block">
                    Minutos acima da referência
                  </span>
                  <strong
                    className="text-xl font-semibold tabular-nums block"
                    style={{
                      color: minutesExceeded
                        ? THERMAL_SCALE[5].textVar
                        : THERMAL_SCALE[2].textVar,
                    }}
                  >
                    {formatIntegerPtBr(airSim.minutesAboveReference)} de{' '}
                    {formatIntegerPtBr(airSim.classMinutes)} min
                  </strong>
                  <span className="text-xs text-[var(--text-secondary)] block leading-snug tabular-nums">
                    {airSim.firstMinuteAboveReference !== null
                      ? `Cruza 1.120 ppm no ${airSim.firstMinuteAboveReference}º minuto`
                      : 'Permanece dentro da referência todo o turno'}
                  </span>
                </div>

                <div className="p-4 rounded-[var(--radius-card)] bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] space-y-1">
                  <span className="text-[var(--text-muted)] block">Pico estimado no turno</span>
                  <strong
                    className="text-xl font-semibold tabular-nums block"
                    style={{
                      color: peakExceeded
                        ? THERMAL_SCALE[4].textVar
                        : THERMAL_SCALE[2].textVar,
                    }}
                  >
                    {formatIntegerPtBr(airSim.peakPpm)} ppm
                  </strong>
                  <span className="text-xs text-[var(--text-secondary)] block leading-snug tabular-nums">
                    Referência ABNT NBR 17037: 1.120 ppm
                  </span>
                </div>

                <div className="p-4 rounded-[var(--radius-card)] bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] space-y-1">
                  <span className="text-[var(--text-muted)] block">
                    Renovação contínua necessária
                  </span>
                  <strong className="text-xl font-semibold text-[var(--text-primary)] tabular-nums block">
                    {formatIntegerPtBr(airRequiredM3h)} m³/h
                  </strong>
                  <span className="text-xs text-[var(--text-secondary)] block leading-snug tabular-nums">
                    {formatNumberPtBr(airRequiredAch, { decimals: 2 })} trocas/h na sala de{' '}
                    {formatNumberPtBr(airRoomVolumeM3, {
                      decimals: Number.isInteger(airRoomVolumeM3) ? 0 : 1,
                    })}{' '}
                    m³
                  </span>
                </div>
              </div>

              {/* Nota metodológica obrigatória */}
              <div className="p-3.5 rounded-[var(--radius-card)] bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] text-xs text-[var(--text-secondary)] flex items-start gap-2.5 leading-relaxed">
                <Info className="w-4 h-4 text-[var(--text-muted)] shrink-0 mt-0.5" />
                <span>
                  Trocas de ar por hora são valores provisórios. Abrir a sala nas trocas de aula ajuda, mas não substitui renovação de ar contínua.
                </span>
              </div>
            </section>
          </div>
        );
      })()}
    </div>
  );
};
