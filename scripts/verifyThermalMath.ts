/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Script de verificação matemática independente das equações de Rothfusz (NWS/NOAA),
 * Temperatura Aparente de Steadman e Modelo Experimental de Envoltória.
 */

import {
  calculateHeatIndex,
  calculateApparentTemperature,
  estimateEnvelopeGain,
  getRioHeatLevel,
} from '../src/utils/thermalMath.js';

interface TestCase {
  name: string;
  tempC: number;
  rh: number;
  expectedMinC: number;
  expectedMaxC: number;
  source: string;
}

const NWS_BENCHMARK_CASES: TestCase[] = [
  {
    name: 'NOAA Caso 1 - Conforto/Limite Steadman simples',
    tempC: 25.0,
    rh: 50,
    expectedMinC: 24.5,
    expectedMaxC: 26.5,
    source: 'NWS Steadman simple formula (T < 80°F)',
  },
  {
    name: 'NOAA Caso 2 - 30°C com 70% UR (Alerta Térmico)',
    tempC: 30.0,
    rh: 70,
    expectedMinC: 34.5,
    expectedMaxC: 37.0,
    source: 'NOAA Heat Index Calculator (86°F, 70% RH -> ~96°F = 35.6°C)',
  },
  {
    name: 'NOAA Caso 3 - 35°C com 60% UR (Perigo Crítico)',
    tempC: 35.0,
    rh: 60,
    expectedMinC: 44.0,
    expectedMaxC: 47.5,
    source: 'NOAA Heat Index Calculator (95°F, 60% RH -> ~114°F = 45.6°C)',
  },
  {
    name: 'NOAA Caso 4 - 40°C com 40% UR (Onda de calor seca)',
    tempC: 40.0,
    rh: 40,
    expectedMinC: 47.0,
    expectedMaxC: 51.5,
    source: 'NOAA Heat Index Calculator (104°F, 40% RH -> ~121°F = 49.4°C)',
  },
  {
    name: 'NOAA Caso 5 - Ajuste de Umidade Alta (80°F, 90% RH)',
    tempC: 26.7,
    rh: 90,
    expectedMinC: 27.0,
    expectedMaxC: 30.5,
    source: 'NOAA High RH adjustment for tF in [80, 87]',
  },
];

console.log('====================================================');
console.log('   VERIFICAÇÃO MATEMÁTICA INDEPENDENTE - TERMO-SST   ');
console.log('====================================================\n');

let passed = 0;
let failed = 0;

for (const tc of NWS_BENCHMARK_CASES) {
  const result = calculateHeatIndex(tc.tempC, tc.rh);
  const isOk = result >= tc.expectedMinC && result <= tc.expectedMaxC;
  if (isOk) {
    console.log(`[PASS] ${tc.name}:`);
    console.log(`       Input: ${tc.tempC}°C, ${tc.rh}% RH -> HI = ${result}°C (esperado: [${tc.expectedMinC}, ${tc.expectedMaxC}] °C)`);
    passed++;
  } else {
    console.error(`[FAIL] ${tc.name}:`);
    console.error(`       Input: ${tc.tempC}°C, ${tc.rh}% RH -> HI = ${result}°C (esperado: [${tc.expectedMinC}, ${tc.expectedMaxC}] °C)`);
    failed++;
  }
}

// Teste de Limites e Entradas Inválidas
console.log('\n--- Teste de Limites e Robustez Numérica ---');

const nanTest = calculateHeatIndex(NaN, 50);
if (isNaN(nanTest)) {
  console.log('[PASS] Entrada NaN tratada sem crash');
  passed++;
} else {
  console.error('[FAIL] Falha no teste de NaN');
  failed++;
}

const negativeRhTest = calculateHeatIndex(32, -10);
if (!isNaN(negativeRhTest) && negativeRhTest >= 28 && negativeRhTest <= 35) {
  console.log(`[PASS] Umidade negativa clampada para 0% (Resultado: ${negativeRhTest}°C)`);
  passed++;
} else {
  console.error('[FAIL] Falha no teste de umidade negativa');
  failed++;
}

const overRhTest = calculateHeatIndex(32, 120);
if (!isNaN(overRhTest) && overRhTest >= 38 && overRhTest <= 60) {
  console.log(`[PASS] Umidade acima de 100% clampada para 100% (Resultado: ${overRhTest}°C)`);
  passed++;
} else {
  console.error(`[FAIL] Falha no teste de umidade excessiva (Resultado: ${overRhTest}°C)`);
  failed++;
}

// Teste de Temperatura Aparente de Steadman
console.log('\n--- Teste de Temperatura Aparente (Steadman) ---');
const at1 = calculateApparentTemperature(30, 60, 1.0);
console.log(`Steadman AT (30°C, 60% UR, 1.0 m/s): ${at1}°C`);
if (at1 >= 29 && at1 <= 35) {
  console.log('[PASS] Temperatura Aparente consistente com valores tabelados de Steadman');
  passed++;
} else {
  console.error('[FAIL] Temperatura Aparente fora do esperado');
  failed++;
}

// Teste do Modelo Experimental de Envoltória
console.log('\n--- Teste do Simulador de Envoltória (Cenários Hipotéticos) ---');
const envelopeGainFibro = estimateEnvelopeGain(
  {
    roofType: 'fibrocimento',
    ventilationType: 'bloqueada_ou_fechada',
    solarOrientation: 'oeste',
    shadingFactor: 0,
    studentOccupancy: 45,
    powerGridStatus: 'sobrecarga',
  },
  36,
  800
);

console.log(`Cenário Crítico (Fibrocimento, Sem Vento, Oeste, 45 alunos, Sobrecarga):`);
console.log(`Delta: +${envelopeGainFibro.estimatedDeltaC}°C -> Simulado: ${envelopeGainFibro.simulatedIndoorTempC}°C (${envelopeGainFibro.label})`);
if (envelopeGainFibro.estimatedDeltaC > 5) {
  console.log('[PASS] Modelo de envoltória detecta sobrecarga extrema');
  passed++;
} else {
  console.error('[FAIL] Modelo de envoltória não refletiu severidade');
  failed++;
}

// Teste dos Níveis de Calor da Cidade do Rio de Janeiro (Decreto Municipal 54.740/2024)
console.log('\n--- Teste de Níveis de Calor do Rio (Decreto 54.740/2024) ---');

const RIO_HEAT_CASES = [
  { hi: 34.0, days: 1, expected: 'NC1', label: '34°C (Rotina / Sem Alerta)' },
  { hi: 37.5, days: 1, expected: 'NC2', label: '37.5°C 1 dia (Calor Moderado NC2)' },
  { hi: 37.5, days: 2, expected: 'NC2', label: '37.5°C 2 dias (Calor Moderado NC2)' },
  { hi: 37.5, days: 3, expected: 'NC3', label: '37.5°C 3 dias consecutivos (Escalada para NC3)' },
  { hi: 41.5, days: 1, expected: 'NC3', label: '41.5°C 1 dia (Calor Alto NC3)' },
  { hi: 41.5, days: 3, expected: 'NC4', label: '41.5°C 3 dias consecutivos (Escalada para NC4)' },
  { hi: 45.0, days: 1, expected: 'NC4', label: '45.0°C 1 dia (Calor Muito Alto NC4)' },
  { hi: 45.0, days: 3, expected: 'NC5', label: '45.0°C 3 dias consecutivos (Calor Extremo NC5)' },
];

for (const rc of RIO_HEAT_CASES) {
  const result = getRioHeatLevel(rc.hi, rc.days);
  if (result === rc.expected) {
    console.log(`[PASS] ${rc.label} -> ${result}`);
    passed++;
  } else {
    console.error(`[FAIL] ${rc.label} -> ${result} (esperado: ${rc.expected})`);
    failed++;
  }
}

console.log('\n====================================================');
console.log(`TOTAL: ${passed + failed} | SUCESSOS: ${passed} | FALHAS: ${failed}`);
console.log('====================================================');

if (failed > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
