/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * ============================================================================
 * TESTE UNITÁRIO: MODELO DE QUALIDADE DO AR E CO2 EM SALAS DE AULA
 * ============================================================================
 * 
 * Validação física e algorítmica:
 * (a) Transient CO2 após 50 min em sala fechada (30 alunos, g=0.0033, 150 m³, 0.5 ACH)
 * (b) Taxa de renovação necessária (requiredAirChangesPerHour)
 * (c) Steady-state CO2 com janelas abertas (3.0 ACH)
 * (d) E.M. Bahia (37 alunos, Fundamental 2, 150 m³, 0.5 ACH): firstMinuteAboveReference = 12
 * (e) Escola sem turmas cadastradas: status 'pendente' e nenhum NaN
 * (f) Vazão de ar externo necessária por pessoa (requiredOutdoorAirPerPersonM3h)
 * (g) Seleção dos melhores horários para ventilação (bestVentilationHours) com exclusão de ar carregado
 */

import {
  steadyStateCo2,
  simulateClassroomCo2,
  requiredAirChangesPerHour,
  requiredOutdoorAirPerPersonM3h,
  schoolAirEstimate,
  bestVentilationHours,
  CO2_GENERATION_LS,
  TEACHER_CO2_LS,
  AIR_CHANGES_PER_HOUR,
  DEFAULT_ROOM,
} from '../src/utils/airQualityMath.js';
import { SchoolRecord, HourlyForecastPoint } from '../src/types.js';

let passedTests = 0;
let failedTests = 0;

function assert(condition: boolean, title: string, details?: string) {
  if (condition) {
    passedTests++;
    console.log(`[PASS] ${title}`);
  } else {
    failedTests++;
    console.error(`[FAIL] ${title} - ${details || 'Condição falsa'}`);
  }
}

console.log('\n--- Teste (a): Concentração de CO2 no minuto 50 (30 alunos, g=0.0033, 150 m³, 0.5 ACH) ---');
const simA = simulateClassroomCo2({
  students: 30,
  generationPerStudentLs: 0.0033,
  roomVolumeM3: 150,
  achClass: 0.5,
});
const co2At50 = simA.series[50];
assert(
  Math.abs(co2At50 - 2119) <= 1,
  'Concentração no minuto 50 é 2.119 ppm (tolerância ±1 ppm)',
  `Obtido: ${co2At50.toFixed(2)} ppm`
);

console.log('\n--- Teste (b): requiredAirChangesPerHour(30, 0.0033, 150) = 3.56 ---');
const achB = requiredAirChangesPerHour(30, 0.0033, 150);
assert(
  Math.abs(achB - 3.56) <= 0.01,
  'Renovação necessária para 30 alunos em 150 m³ é 3,56 trocas/h (tolerância ±0.01)',
  `Obtido: ${achB.toFixed(4)}`
);

console.log('\n--- Teste (c): steadyStateCo2 com 30 alunos, g=0.0033, professor, 150 m³ e 3 trocas/h = 1.251 ppm ---');
const totalGenC = 30 * 0.0033 + TEACHER_CO2_LS;
const cssC = steadyStateCo2(totalGenC, 150, 3);
assert(
  Math.abs(cssC - 1251) <= 1,
  'Steady-state com 3 trocas/h é 1.251 ppm (tolerância ±1 ppm)',
  `Obtido: ${cssC.toFixed(2)} ppm`
);

console.log('\n--- Teste (d): E.M. Bahia (37 alunos, Fundamental 2, 150 m³, 0.5 ACH): firstMinuteAboveReference = 12 ---');
const simBahia = simulateClassroomCo2({
  students: 37,
  generationPerStudentLs: CO2_GENERATION_LS.fundamental_2, // 0.0041
  roomVolumeM3: 150,
  achClass: AIR_CHANGES_PER_HOUR.fechada_split, // 0.5
});
assert(
  simBahia.firstMinuteAboveReference === 12,
  'E.M. Bahia ultrapassa a referência (1.120 ppm) no 12º minuto de aula',
  `Obtido: minuto ${simBahia.firstMinuteAboveReference}`
);

console.log('\n--- Teste (e): Escola sem turmas cadastradas: status pendente e nenhum NaN ---');
const dummySchoolNoClasses: SchoolRecord = {
  id: 'esc-test-noclasses',
  inepCode: '99999999',
  name: 'Escola Teste Sem Turmas',
  officialName: 'ESCOLA TESTE SEM TURMAS',
  network: 'municipal',
  municipality: 'Rio de Janeiro',
  municipalityIbgeCode: '3304557',
  borough: 'Centro',
  region: 'Centro/Sul',
  address: 'Rua Teste, 100',
  latitude: -22.9,
  longitude: -43.2,
  coordinatesSource: 'Teste',
  totalStudents: 100,
  enrollmentByStage: { infantil: 50, fundamental_1: 50, fundamental_2: 0, medio: 0, eja: 0 },
  nightEnrollment: 0,
  stages: ['infantil', 'fundamental_1'],
  shifts: [],
  shiftsInformed: false,
  totalRooms: 5,
  declaredClimatizedRooms: 5,
  declaredClimatizationStatus: 'total',
  climatizationHistory: [],
  dataSource: 'Teste',
  dataReferenceYear: 2025,
  dataQuality: 'alta',
  isSentinel: false,
  heatIslandFactorLST: null,
  greenCoveragePercent: null,
};
const estimatePending = schoolAirEstimate(dummySchoolNoClasses);
assert(
  estimatePending.status === 'pendente',
  'Escola sem turmas retorna status pendente',
  `Status: ${estimatePending.status}`
);
const hasAnyNaN = Object.values(estimatePending).some((v) => typeof v === 'number' && isNaN(v));
assert(!hasAnyNaN, 'Nenhum campo numérico no resultado é NaN');

console.log('\n--- Teste (f): requiredOutdoorAirPerPersonM3h(0.0033) = 16.97 ---');
const flowF = requiredOutdoorAirPerPersonM3h(0.0033);
assert(
  Math.abs(flowF - 16.97) <= 0.01,
  'Vazão de ar de fora por pessoa é 16,97 m³/h (tolerância ±0.01)',
  `Obtido: ${flowF.toFixed(4)}`
);

console.log('\n--- Teste (g): bestVentilationHours com 4 horas sintéticas (hora mais fresca com PM2.5 de 40 fica de fora) ---');
const syntheticHourly: HourlyForecastPoint[] = [
  {
    time: '2026-11-04T07:00:00',
    temperatureC: 24,
    relativeHumidity: 70,
    shortwaveRadiationWm2: 100,
    windSpeedKmh: 5,
    heatIndexC: 25.0, // A mais fresca de todas!
    pm2_5: 40.0, // Mas ar carregado (> 25 µg/m³)
    heatLevelRio: 'NC1',
    riskBand: 'normal',
  },
  {
    time: '2026-11-04T08:00:00',
    temperatureC: 26,
    relativeHumidity: 65,
    shortwaveRadiationWm2: 250,
    windSpeedKmh: 6,
    heatIndexC: 27.0,
    pm2_5: 18.0, // Limpo
    heatLevelRio: 'NC1',
    riskBand: 'normal',
  },
  {
    time: '2026-11-04T09:00:00',
    temperatureC: 28,
    relativeHumidity: 60,
    shortwaveRadiationWm2: 400,
    windSpeedKmh: 7,
    heatIndexC: 29.5,
    pm2_5: 15.0, // Limpo
    heatLevelRio: 'NC1',
    riskBand: 'normal',
  },
  {
    time: '2026-11-04T10:00:00',
    temperatureC: 31,
    relativeHumidity: 55,
    shortwaveRadiationWm2: 600,
    windSpeedKmh: 8,
    heatIndexC: 34.0,
    pm2_5: 12.0, // Limpo, porém muito quente
    heatLevelRio: 'NC2',
    riskBand: 'atencao',
  },
];

const bestVent = bestVentilationHours(syntheticHourly, ['07:00', '08:00', '09:00', '10:00']);
assert(
  !bestVent.hours.includes('07:00'),
  'A hora mais fresca (07:00 com PM2,5=40) foi devidamente excluída devido à poluição externa',
  `Horas selecionadas: ${bestVent.hours.join(', ')}`
);
assert(
  bestVent.hours.length === 2 && bestVent.hours[0] === '08:00' && bestVent.hours[1] === '09:00',
  'As 2 horas selecionadas foram 08:00 e 09:00 (mais frescas entre as com PM2,5 <= 25)',
  `Horas selecionadas: ${bestVent.hours.join(', ')}`
);

console.log('\n================================================================');
console.log(`  RESUMO DA VALIDAÇÃO DO AR:`);
console.log(`  Passou: ${passedTests}`);
console.log(`  Falhou: ${failedTests}`);
console.log('================================================================');

if (failedTests > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
