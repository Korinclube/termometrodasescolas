/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { EducationStage, SchoolRecord, SchoolInspection, HourlyForecastPoint } from '../types';

/**
 * Constantes de referência para o modelo de qualidade do ar e CO2
 * NOTA: Todos os valores marcados como provisórios serão recalibrados com os sensores do piloto.
 */
export const OUTDOOR_CO2_PPM = 420; // Ar externo de referência; a NBR 17037 pede medir o ar externo junto
export const CO2_MARGIN_ABOVE_OUTDOOR_PPM = 700; // Limite diferencial da ABNT NBR 17037
export const CO2_REFERENCE_PPM = OUTDOOR_CO2_PPM + CO2_MARGIN_ABOVE_OUTDOOR_PPM; // 1.120 ppm

/**
 * Geração de CO2 por pessoa sentada em sala, em L/s.
 * Valores medianos para 6, 11 e 16 anos (Carrasco, Molina e Jones,
 * "An evaluation of CO2 emission rates by Chilean school children", AIVC).
 */
export const CO2_GENERATION_LS: Record<EducationStage, number> = {
  infantil: 0.0033,
  fundamental_1: 0.0033,
  fundamental_2: 0.0041,
  medio: 0.0049,
  eja: 0.0049,
};

// Professor contado com o valor de 16 anos (subestima um pouco)
export const TEACHER_CO2_LS = 0.0049;

// Sala de referência: 50 m² e 3 m de pé-direito = 150 m³ (provisório até a vistoria medir a sala)
export const DEFAULT_ROOM = { areaM2: 50, heightM: 3 };

// Taxas de renovação de ar (trocas por hora - ACH) - provisórios até calibração com dados do piloto
export const AIR_CHANGES_PER_HOUR = {
  fechada_split: 0.5, // Porta e janelas fechadas, apenas infiltração por frestas
  fresta_aberta: 1.5,
  janelas_abertas: 3.0,
  ventilacao_cruzada: 6.0, // Janelas e porta abertas em lados opostos
};

export interface Co2GenerationResult {
  rateLs: number;
  isFallback: boolean;
}

/**
 * 1. Média de CO2_GENERATION_LS ponderada pelas matrículas de cada etapa.
 * Se o total for zero, devolve 0.0033 e isFallback: true.
 */
export function co2GenerationPerStudent(
  enrollmentByStage?: SchoolRecord['enrollmentByStage']
): Co2GenerationResult {
  if (!enrollmentByStage) {
    return { rateLs: 0.0033, isFallback: true };
  }

  const stages: EducationStage[] = ['infantil', 'fundamental_1', 'fundamental_2', 'medio', 'eja'];
  let totalStudents = 0;
  let weightedSum = 0;

  for (const stage of stages) {
    const count = enrollmentByStage[stage] || 0;
    totalStudents += count;
    weightedSum += count * CO2_GENERATION_LS[stage];
  }

  if (totalStudents <= 0) {
    return { rateLs: 0.0033, isFallback: true };
  }

  return {
    rateLs: weightedSum / totalStudents,
    isFallback: false,
  };
}

/**
 * 2. Concentração de CO2 em regime permanente (Steady State):
 * Css = outdoorPpm + (totalGenerationLs * 3.6 / roomVolumeM3) * 1e6 / airChangesPerHour
 */
export function steadyStateCo2(
  totalGenerationLs: number,
  roomVolumeM3: number,
  airChangesPerHour: number,
  outdoorPpm: number = OUTDOOR_CO2_PPM
): number {
  if (airChangesPerHour <= 0 || roomVolumeM3 <= 0) {
    return outdoorPpm;
  }
  return outdoorPpm + ((totalGenerationLs * 3.6) / roomVolumeM3) * 1e6 / airChangesPerHour;
}

export interface SimulationOptions {
  students: number;
  generationPerStudentLs: number;
  roomVolumeM3: number;
  achClass: number;
  achRecess?: number;
  ventilateMinutesAtClassEnd?: number;
  achVentilation?: number;
  outdoorPpm?: number;
}

export interface SimulationMinutePoint {
  minute: number;
  co2Ppm: number;
  isClassMinute: boolean;
}

export interface SimulationResult {
  series: number[]; // ppm a cada minuto (índice 0 a 220)
  detailedSeries: SimulationMinutePoint[];
  peakPpm: number;
  classMinutes: number; // 200 minutos de aula
  minutesAboveReference: number; // Apenas minutos de aula
  firstMinuteAboveReference: number | null; // Minuto do turno em que passa de 1.120 ppm
}

/**
 * 3. Simula a evolução da concentração de CO2 ao longo de um turno de referência:
 * 4 aulas de 50 min; recreio de 20 min após a 2ª aula, com a sala vazia.
 * Total = 220 minutos (200 min de aula + 20 min de recreio).
 */
export function simulateClassroomCo2(opts: SimulationOptions): SimulationResult {
  const {
    students,
    generationPerStudentLs,
    roomVolumeM3,
    achClass,
    achRecess = achClass,
    ventilateMinutesAtClassEnd = 0,
    achVentilation = 6.0,
    outdoorPpm = OUTDOOR_CO2_PPM,
  } = opts;

  const totalClassGenLs = students * generationPerStudentLs + TEACHER_CO2_LS;
  const totalDuration = 220; // 4 * 50 + 20

  const series: number[] = new Array(totalDuration + 1);
  const detailedSeries: SimulationMinutePoint[] = [];

  series[0] = outdoorPpm;
  detailedSeries.push({ minute: 0, co2Ppm: outdoorPpm, isClassMinute: false });

  let minutesAboveReference = 0;
  let firstMinuteAboveReference: number | null = null;
  let peakPpm = outdoorPpm;

  // Passo a passo minuto a minuto
  for (let m = 1; m <= totalDuration; m++) {
    // Determina se é aula ou recreio
    // Aula 1: 1 a 50
    // Aula 2: 51 a 100
    // Recreio: 101 a 120 (20 min)
    // Aula 3: 121 a 170
    // Aula 4: 171 a 220
    const isRecess = m > 100 && m <= 120;
    const isClassMinute = !isRecess;

    let currentGenLs: number;
    let currentAch: number;

    if (isRecess) {
      currentGenLs = 0;
      currentAch = achRecess;
    } else {
      currentGenLs = totalClassGenLs;
      // Posição dentro da aula de 50 min
      let minuteInClass: number;
      if (m <= 50) minuteInClass = m;
      else if (m <= 100) minuteInClass = m - 50;
      else if (m <= 170) minuteInClass = m - 120;
      else minuteInClass = m - 170;

      const isEndVentilation =
        ventilateMinutesAtClassEnd > 0 && minuteInClass > 50 - ventilateMinutesAtClassEnd;

      currentAch = isEndVentilation ? achVentilation : achClass;
    }

    const css = steadyStateCo2(currentGenLs, roomVolumeM3, currentAch, outdoorPpm);
    const prevC = series[m - 1];
    const newC = css + (prevC - css) * Math.exp((-currentAch * 1) / 60);

    series[m] = newC;
    detailedSeries.push({ minute: m, co2Ppm: Math.round(newC), isClassMinute });

    if (newC > peakPpm) {
      peakPpm = newC;
    }

    if (isClassMinute && newC >= CO2_REFERENCE_PPM) {
      minutesAboveReference++;
      if (firstMinuteAboveReference === null) {
        firstMinuteAboveReference = m;
      }
    }
  }

  return {
    series,
    detailedSeries,
    peakPpm: Math.round(peakPpm),
    classMinutes: 200,
    minutesAboveReference,
    firstMinuteAboveReference,
  };
}

/**
 * 4. ACH necessário para manter o CO2 dentro do limite da ABNT NBR 17037 (+700 ppm):
 * (students * g + TEACHER_CO2_LS) * 3.6 / (roomVolumeM3 * CO2_MARGIN_ABOVE_OUTDOOR_PPM * 1e-6)
 */
export function requiredAirChangesPerHour(
  students: number,
  generationPerStudentLs: number,
  roomVolumeM3: number
): number {
  if (roomVolumeM3 <= 0) return 0;
  const totalGenLs = students * generationPerStudentLs + TEACHER_CO2_LS;
  const numerator = totalGenLs * 3.6;
  const denominator = roomVolumeM3 * (CO2_MARGIN_ABOVE_OUTDOOR_PPM * 1e-6);
  return numerator / denominator;
}

/**
 * 5. Vazão de ar externo necessária por pessoa (m³/h):
 * g * 3.6 / (CO2_MARGIN_ABOVE_OUTDOOR_PPM * 1e-6)
 */
export function requiredOutdoorAirPerPersonM3h(generationPerStudentLs: number): number {
  return (generationPerStudentLs * 3.6) / (CO2_MARGIN_ABOVE_OUTDOOR_PPM * 1e-6);
}

export interface SchoolAirEstimateResult {
  status: 'disponivel' | 'pendente';
  selectedShift?: 'manha' | 'tarde';
  shiftLabel?: string;
  students?: number;
  maxClassSize?: number;
  roomVolumeM3?: number;
  generationPerStudentLs?: number;
  firstMinuteAboveReferenceClosed?: number | null;
  peakPpmOpenWindows?: number;
  requiredAch?: number;
  requiredOutdoorAirM3h?: number;
  pmocStatus?: string;
  acType?: string;
  windowsOperable?: string;
}

/**
 * 6. Calcula a estimativa de ar dentro da sala para uma escola específica
 */
export function schoolAirEstimate(
  school: SchoolRecord,
  inspection?: SchoolInspection
): SchoolAirEstimateResult {
  if (!school.classesByShift || school.classesByShift.length === 0) {
    return { status: 'pendente' };
  }

  // Escolhe o turno diurno (manhã ou tarde) com a maior avgClassSize
  const daytimeShifts = school.classesByShift.filter(
    (c) => c.shift === 'manha' || c.shift === 'tarde'
  );

  if (daytimeShifts.length === 0) {
    return { status: 'pendente' };
  }

  // Ordena por avgClassSize decrescente
  daytimeShifts.sort((a, b) => b.avgClassSize - a.avgClassSize);
  const bestShift = daytimeShifts[0];

  const students = Math.round(bestShift.avgClassSize);
  const maxClassSize = bestShift.maxClassSize;

  // Volume da sala: da vistoria se houver dimensões válidas, senão DEFAULT_ROOM (150 m³)
  let roomVolumeM3 = DEFAULT_ROOM.areaM2 * DEFAULT_ROOM.heightM;
  if (
    inspection?.roomDimensions &&
    inspection.roomDimensions.lengthM > 0 &&
    inspection.roomDimensions.widthM > 0 &&
    inspection.roomDimensions.heightM > 0
  ) {
    roomVolumeM3 =
      inspection.roomDimensions.lengthM *
      inspection.roomDimensions.widthM *
      inspection.roomDimensions.heightM;
  }

  const { rateLs } = co2GenerationPerStudent(school.enrollmentByStage);

  // Simulação com sala fechada (0.5 ACH)
  const closedSim = simulateClassroomCo2({
    students,
    generationPerStudentLs: rateLs,
    roomVolumeM3,
    achClass: AIR_CHANGES_PER_HOUR.fechada_split,
  });

  // Simulação com janelas abertas (3.0 ACH)
  const openSim = simulateClassroomCo2({
    students,
    generationPerStudentLs: rateLs,
    roomVolumeM3,
    achClass: AIR_CHANGES_PER_HOUR.janelas_abertas,
  });

  const reqAch = requiredAirChangesPerHour(students, rateLs, roomVolumeM3);
  const totalGenLs = students * rateLs + TEACHER_CO2_LS;
  const reqAirM3h = (totalGenLs * 3.6) / (CO2_MARGIN_ABOVE_OUTDOOR_PPM * 1e-6);

  return {
    status: 'disponivel',
    selectedShift: bestShift.shift as 'manha' | 'tarde',
    shiftLabel: bestShift.shift === 'manha' ? 'manhã' : 'tarde',
    students,
    maxClassSize,
    roomVolumeM3: Math.round(roomVolumeM3),
    generationPerStudentLs: rateLs,
    firstMinuteAboveReferenceClosed: closedSim.firstMinuteAboveReference,
    peakPpmOpenWindows: openSim.peakPpm,
    requiredAch: Number(reqAch.toFixed(2)),
    requiredOutdoorAirM3h: Math.round(reqAirM3h),
    pmocStatus: inspection?.pmocStatus || 'desconhecido',
    acType: inspection?.acType,
    windowsOperable: inspection?.windowsOperable,
  };
}

export interface BestVentilationHoursResult {
  hours: string[]; // ex: ['08:00', '09:00']
  notice?: string; // ex: 'sem dado de partículas' ou 'Ar externo carregado o turno todo: evite abrir janelas para a rua'
  allHoursLoaded: boolean;
}

/**
 * Determina os 2 melhores horários para abrir portas e janelas no turno:
 * Entre as horas com PM2,5 até 25 µg/m³, seleciona as 2 com menor índice de calor.
 * Se o ar externo estiver indisponível (pm2_5 === null/undefined), usa apenas o índice de calor e avisa.
 * Se todas as horas tiverem PM2,5 > 25 µg/m³, alerta sobre o ar externo carregado.
 */
export function bestVentilationHours(
  hourly: HourlyForecastPoint[],
  shiftHours: string[]
): BestVentilationHoursResult {
  if (!hourly || hourly.length === 0 || !shiftHours || shiftHours.length === 0) {
    return { hours: [], allHoursLoaded: false };
  }

  // Filtra os pontos horários pertencentes ao turno (ex: match no ISO string ou horário HH:MM)
  const shiftPoints = hourly.filter((pt) => {
    const timeStr = pt.time;
    // Checa se o horário termina com HH:00 correspondente
    return shiftHours.some((sh) => timeStr.includes(sh) || timeStr.endsWith(sh));
  });

  if (shiftPoints.length === 0) {
    return { hours: [], allHoursLoaded: false };
  }

  // Verifica se temos dados de PM2,5 válidos
  const hasPmData = shiftPoints.some((pt) => pt.pm2_5 !== undefined && pt.pm2_5 !== null);

  if (!hasPmData) {
    // Ordena puramente pelo menor heatIndexC
    const sorted = [...shiftPoints].sort((a, b) => a.heatIndexC - b.heatIndexC);
    const top2 = sorted.slice(0, 2).map((pt) => formatHour(pt.time));
    return {
      hours: top2,
      notice: 'sem dado de partículas',
      allHoursLoaded: false,
    };
  }

  // Com dados de partículas: filtra apenas horas com PM2,5 válido e <= 25 µg/m³
  const validPmPoints = shiftPoints.filter((pt) => pt.pm2_5 !== undefined && pt.pm2_5 !== null);
  const cleanPoints = validPmPoints.filter((pt) => (pt.pm2_5 as number) <= 25);

  if (cleanPoints.length === 0) {
    return {
      hours: [],
      notice: 'Ar externo carregado o turno todo: evite abrir janelas para a rua',
      allHoursLoaded: true,
    };
  }

  // Ordena os pontos limpos pelo menor índice de calor
  cleanPoints.sort((a, b) => a.heatIndexC - b.heatIndexC);
  const top2 = cleanPoints.slice(0, 2).map((pt) => formatHour(pt.time));

  return {
    hours: top2,
    allHoursLoaded: false,
  };
}

function formatHour(timeStr: string): string {
  // Se for "2026-11-04T08:00:00" ou similar, extrai "08:00"
  if (timeStr.includes('T')) {
    const part = timeStr.split('T')[1];
    return part.slice(0, 5);
  }
  if (timeStr.length >= 5) {
    return timeStr.slice(0, 5);
  }
  return timeStr;
}
