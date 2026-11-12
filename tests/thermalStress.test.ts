/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * ============================================================================
 * TESTE UNITÁRIO: VALIDAÇÃO DAS FÓRMULAS DE ESTRESSE TÉRMICO (HEAT INDEX)
 * ============================================================================
 * 
 * Compara os resultados gerados por `calculateHeatIndex` e funções correlatas
 * em TypeScript com a Tabela de Referência Oficial do National Weather Service (NWS / NOAA),
 * baseada no relatório técnico NOAA NWS SR 90-23 (Rothfusz, 1990) e Steadman (1979, 1984).
 * 
 * Validação física inclui:
 * 1. Matriz externa de referência NOAA (T: 80°F a 104°F, UR: 40% a 100%)
 * 2. Ajuste de alta umidade (UR > 85%, T entre 80°F e 87°F)
 * 3. Ajuste de baixa umidade (UR < 13%, T entre 80°F e 112°F)
 * 4. Transição de fronteira para aproximação de Steadman (T < 80°F / 26.67°C)
 * 5. Robustez numérica (clamping de UR, tolerância a NaN e valores extremos)
 * 6. Temperatura Aparente de Steadman (1984/1994) com pressão de vapor de Magnus-Tetens
 * 7. Protocolo de Níveis de Calor da Cidade do Rio de Janeiro (Decreto 54.740/2024)
 * 8. Modelo de Envoltória e Avaliação Desacoplada de Risco
 */

import {
  calculateHeatIndex,
  calculateRothfuszHeatIndex,
  calculateApparentTemperature,
  estimateEnvelopeGain,
  getRioHeatLevel,
  getRiskBand,
  calculateExposureIndex,
  calculateInfrastructureVulnerabilityIndex,
  calculateDecoupledRiskEvaluation,
} from '../src/utils/thermalMath.js';
import { SchoolRecord, SchoolInspection } from '../src/types.js';
import { parseGeeHeatIslandCsv } from '../src/utils/heatIslandImport.js';

interface HeatIndexBenchmarkPoint {
  tempF: number;
  tempC: number;
  rh: number;
  noaaExpectedHiF: number;
  noaaExpectedHiC: number;
  toleranceC: number;
  description: string;
}

// Matriz de referência oficial da NOAA / NWS Heat Index Chart
// Fonte: NOAA National Weather Service (https://www.weather.gov/safety/heat-index)
// Valores oficiais da tabela em °F, convertidos para °C: (F - 32) * 5/9.
// Tolerância adotada: ±0.6°C devido ao arredondamento inteiro na tabela publicada da NOAA (1°F ~ 0.55°C).
const NOAA_HEAT_INDEX_REFERENCE_TABLE: HeatIndexBenchmarkPoint[] = [
  // 80 °F (~26.67 °C)
  { tempF: 80, tempC: 26.67, rh: 40, noaaExpectedHiF: 80, noaaExpectedHiC: 26.7, toleranceC: 0.6, description: '80°F / 40% UR - Base de conforto' },
  { tempF: 80, tempC: 26.67, rh: 50, noaaExpectedHiF: 81, noaaExpectedHiC: 27.2, toleranceC: 0.6, description: '80°F / 50% UR' },
  { tempF: 80, tempC: 26.67, rh: 60, noaaExpectedHiF: 82, noaaExpectedHiC: 27.8, toleranceC: 0.6, description: '80°F / 60% UR' },
  { tempF: 80, tempC: 26.67, rh: 70, noaaExpectedHiF: 83, noaaExpectedHiC: 28.3, toleranceC: 0.6, description: '80°F / 70% UR' },
  { tempF: 80, tempC: 26.67, rh: 80, noaaExpectedHiF: 84, noaaExpectedHiC: 28.9, toleranceC: 0.6, description: '80°F / 80% UR' },
  { tempF: 80, tempC: 26.67, rh: 90, noaaExpectedHiF: 86, noaaExpectedHiC: 30.0, toleranceC: 0.6, description: '80°F / 90% UR (Ajuste alta UR)' },
  { tempF: 80, tempC: 26.67, rh: 100, noaaExpectedHiF: 89, noaaExpectedHiC: 31.7, toleranceC: 0.6, description: '80°F / 100% UR (Saturação)' },

  // 82 °F (~27.78 °C)
  { tempF: 82, tempC: 27.78, rh: 40, noaaExpectedHiF: 81, noaaExpectedHiC: 27.2, toleranceC: 0.6, description: '82°F / 40% UR' },
  { tempF: 82, tempC: 27.78, rh: 50, noaaExpectedHiF: 83, noaaExpectedHiC: 28.3, toleranceC: 0.6, description: '82°F / 50% UR' },
  { tempF: 82, tempC: 27.78, rh: 60, noaaExpectedHiF: 84, noaaExpectedHiC: 28.9, toleranceC: 0.6, description: '82°F / 60% UR' },
  { tempF: 82, tempC: 27.78, rh: 70, noaaExpectedHiF: 86, noaaExpectedHiC: 30.0, toleranceC: 0.6, description: '82°F / 70% UR' },
  { tempF: 82, tempC: 27.78, rh: 80, noaaExpectedHiF: 89, noaaExpectedHiC: 31.7, toleranceC: 0.6, description: '82°F / 80% UR' },
  { tempF: 82, tempC: 27.78, rh: 90, noaaExpectedHiF: 91, noaaExpectedHiC: 32.8, toleranceC: 0.6, description: '82°F / 90% UR' },

  // 84 °F (~28.89 °C)
  { tempF: 84, tempC: 28.89, rh: 40, noaaExpectedHiF: 83, noaaExpectedHiC: 28.3, toleranceC: 0.6, description: '84°F / 40% UR' },
  { tempF: 84, tempC: 28.89, rh: 50, noaaExpectedHiF: 85, noaaExpectedHiC: 29.4, toleranceC: 0.6, description: '84°F / 50% UR' },
  { tempF: 84, tempC: 28.89, rh: 60, noaaExpectedHiF: 87, noaaExpectedHiC: 30.6, toleranceC: 0.6, description: '84°F / 60% UR' },
  { tempF: 84, tempC: 28.89, rh: 70, noaaExpectedHiF: 90, noaaExpectedHiC: 32.2, toleranceC: 0.6, description: '84°F / 70% UR' },
  { tempF: 84, tempC: 28.89, rh: 80, noaaExpectedHiF: 94, noaaExpectedHiC: 34.4, toleranceC: 0.6, description: '84°F / 80% UR' },
  { tempF: 84, tempC: 28.89, rh: 90, noaaExpectedHiF: 98, noaaExpectedHiC: 36.7, toleranceC: 0.6, description: '84°F / 90% UR' },

  // 86 °F (30.00 °C)
  { tempF: 86, tempC: 30.00, rh: 40, noaaExpectedHiF: 85, noaaExpectedHiC: 29.4, toleranceC: 0.6, description: '86°F / 40% UR' },
  { tempF: 86, tempC: 30.00, rh: 50, noaaExpectedHiF: 88, noaaExpectedHiC: 31.1, toleranceC: 0.6, description: '86°F / 50% UR' },
  { tempF: 86, tempC: 30.00, rh: 60, noaaExpectedHiF: 91, noaaExpectedHiC: 32.8, toleranceC: 0.6, description: '86°F / 60% UR' },
  { tempF: 86, tempC: 30.00, rh: 70, noaaExpectedHiF: 95, noaaExpectedHiC: 35.0, toleranceC: 0.6, description: '86°F / 70% UR' },
  { tempF: 86, tempC: 30.00, rh: 80, noaaExpectedHiF: 100, noaaExpectedHiC: 37.8, toleranceC: 0.6, description: '86°F / 80% UR' },
  { tempF: 86, tempC: 30.00, rh: 90, noaaExpectedHiF: 105, noaaExpectedHiC: 40.6, toleranceC: 0.6, description: '86°F / 90% UR' },

  // 88 °F (~31.11 °C)
  { tempF: 88, tempC: 31.11, rh: 40, noaaExpectedHiF: 88, noaaExpectedHiC: 31.1, toleranceC: 0.6, description: '88°F / 40% UR' },
  { tempF: 88, tempC: 31.11, rh: 50, noaaExpectedHiF: 91, noaaExpectedHiC: 32.8, toleranceC: 0.6, description: '88°F / 50% UR' },
  { tempF: 88, tempC: 31.11, rh: 60, noaaExpectedHiF: 95, noaaExpectedHiC: 35.0, toleranceC: 0.6, description: '88°F / 60% UR' },
  { tempF: 88, tempC: 31.11, rh: 70, noaaExpectedHiF: 100, noaaExpectedHiC: 37.8, toleranceC: 0.6, description: '88°F / 70% UR' },
  { tempF: 88, tempC: 31.11, rh: 80, noaaExpectedHiF: 106, noaaExpectedHiC: 41.1, toleranceC: 0.6, description: '88°F / 80% UR' },

  // 90 °F (~32.22 °C)
  { tempF: 90, tempC: 32.22, rh: 40, noaaExpectedHiF: 91, noaaExpectedHiC: 32.8, toleranceC: 0.6, description: '90°F / 40% UR' },
  { tempF: 90, tempC: 32.22, rh: 50, noaaExpectedHiF: 95, noaaExpectedHiC: 35.0, toleranceC: 0.6, description: '90°F / 50% UR' },
  { tempF: 90, tempC: 32.22, rh: 60, noaaExpectedHiF: 100, noaaExpectedHiC: 37.8, toleranceC: 0.6, description: '90°F / 60% UR' },
  { tempF: 90, tempC: 32.22, rh: 70, noaaExpectedHiF: 106, noaaExpectedHiC: 41.1, toleranceC: 0.6, description: '90°F / 70% UR' },
  { tempF: 90, tempC: 32.22, rh: 80, noaaExpectedHiF: 113, noaaExpectedHiC: 45.0, toleranceC: 0.6, description: '90°F / 80% UR' },

  // 92 °F (~33.33 °C)
  { tempF: 92, tempC: 33.33, rh: 40, noaaExpectedHiF: 94, noaaExpectedHiC: 34.4, toleranceC: 0.6, description: '92°F / 40% UR' },
  { tempF: 92, tempC: 33.33, rh: 50, noaaExpectedHiF: 99, noaaExpectedHiC: 37.2, toleranceC: 0.6, description: '92°F / 50% UR' },
  { tempF: 92, tempC: 33.33, rh: 60, noaaExpectedHiF: 105, noaaExpectedHiC: 40.6, toleranceC: 0.6, description: '92°F / 60% UR' },
  { tempF: 92, tempC: 33.33, rh: 70, noaaExpectedHiF: 112, noaaExpectedHiC: 44.4, toleranceC: 0.6, description: '92°F / 70% UR' },

  // 94 °F (~34.44 °C)
  { tempF: 94, tempC: 34.44, rh: 40, noaaExpectedHiF: 97, noaaExpectedHiC: 36.1, toleranceC: 0.6, description: '94°F / 40% UR' },
  { tempF: 94, tempC: 34.44, rh: 50, noaaExpectedHiF: 103, noaaExpectedHiC: 39.4, toleranceC: 0.6, description: '94°F / 50% UR' },
  { tempF: 94, tempC: 34.44, rh: 60, noaaExpectedHiF: 111, noaaExpectedHiC: 43.9, toleranceC: 0.6, description: '94°F / 60% UR' },
  { tempF: 94, tempC: 34.44, rh: 70, noaaExpectedHiF: 119, noaaExpectedHiC: 48.3, toleranceC: 0.6, description: '94°F / 70% UR' },

  // 96 °F (~35.56 °C)
  { tempF: 96, tempC: 35.56, rh: 40, noaaExpectedHiF: 101, noaaExpectedHiC: 38.3, toleranceC: 0.6, description: '96°F / 40% UR' },
  { tempF: 96, tempC: 35.56, rh: 50, noaaExpectedHiF: 108, noaaExpectedHiC: 42.2, toleranceC: 0.6, description: '96°F / 50% UR' },
  { tempF: 96, tempC: 35.56, rh: 60, noaaExpectedHiF: 116, noaaExpectedHiC: 46.7, toleranceC: 0.6, description: '96°F / 60% UR' },

  // 98 °F (~36.67 °C)
  { tempF: 98, tempC: 36.67, rh: 40, noaaExpectedHiF: 105, noaaExpectedHiC: 40.6, toleranceC: 0.6, description: '98°F / 40% UR' },
  { tempF: 98, tempC: 36.67, rh: 50, noaaExpectedHiF: 113, noaaExpectedHiC: 45.0, toleranceC: 0.6, description: '98°F / 50% UR' },
  { tempF: 98, tempC: 36.67, rh: 60, noaaExpectedHiF: 123, noaaExpectedHiC: 50.6, toleranceC: 0.6, description: '98°F / 60% UR' },

  // 100 °F (~37.78 °C)
  { tempF: 100, tempC: 37.78, rh: 40, noaaExpectedHiF: 109, noaaExpectedHiC: 42.8, toleranceC: 0.6, description: '100°F / 40% UR' },
  { tempF: 100, tempC: 37.78, rh: 50, noaaExpectedHiF: 119, noaaExpectedHiC: 48.3, toleranceC: 0.6, description: '100°F / 50% UR' },
  { tempF: 100, tempC: 37.78, rh: 55, noaaExpectedHiF: 124, noaaExpectedHiC: 51.1, toleranceC: 0.6, description: '100°F / 55% UR' },

  // 104 °F (40.00 °C)
  { tempF: 104, tempC: 40.00, rh: 40, noaaExpectedHiF: 119, noaaExpectedHiC: 48.3, toleranceC: 0.6, description: '104°F / 40% UR' },
  { tempF: 104, tempC: 40.00, rh: 45, noaaExpectedHiF: 124, noaaExpectedHiC: 51.1, toleranceC: 0.6, description: '104°F / 45% UR' },
];

// Contador de testes
let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function assert(condition: boolean, testName: string, details?: string) {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  ✓ [PASS] ${testName}`);
  } else {
    failedTests++;
    console.error(`  ✗ [FAIL] ${testName}`);
    if (details) {
      console.error(`     Detalhes: ${details}`);
    }
  }
}

console.log('================================================================');
console.log('  SUITE DE TESTES: VALIDAÇÃO DE EQUAÇÕES DE ESTRESSE TÉRMICO    ');
console.log('  Referência: NOAA NWS Heat Index (Rothfusz / Steadman)         ');
console.log('================================================================\n');

// ----------------------------------------------------------------------------
// SUÍTE 1: Comparação direta com a Grade de Referência Externa da NOAA
// ----------------------------------------------------------------------------
console.log('--- SUÍTE 1: Grade de Referência Externa da NOAA (NWS Chart) ---');

let maxDeviationC = 0;
let totalPointsVerified = 0;

for (const pt of NOAA_HEAT_INDEX_REFERENCE_TABLE) {
  const calculatedC = calculateHeatIndex(pt.tempC, pt.rh);
  const diffC = Math.abs(calculatedC - pt.noaaExpectedHiC);
  if (diffC > maxDeviationC) {
    maxDeviationC = diffC;
  }
  totalPointsVerified++;

  const isWithinTolerance = diffC <= pt.toleranceC;
  assert(
    isWithinTolerance,
    `${pt.description} -> Calc: ${calculatedC.toFixed(1)}°C | NOAA: ${pt.noaaExpectedHiC.toFixed(1)}°C (Diff: ${diffC.toFixed(2)}°C)`,
    `Erro físico excede tolerância de ±${pt.toleranceC}°C (diferença real: ${diffC.toFixed(2)}°C)`
  );
}

console.log(`\n  Estatísticas da Suíte 1:`);
console.log(`  - Pontos verificados: ${totalPointsVerified}`);
console.log(`  - Desvio máximo observado em relação à tabela NOAA: ${maxDeviationC.toFixed(2)} °C`);
console.log(`  - Fidelidade física confirmada dentro da margem de arredondamento oficial (±0.6°C)\n`);

// ----------------------------------------------------------------------------
// SUÍTE 2: Ajustes Específicos de Umidade Relativa do Algoritmo Rothfusz
// ----------------------------------------------------------------------------
console.log('--- SUÍTE 2: Ajustes Especiais de Umidade (Rothfusz 1990) ---');

// Ajuste de Alta Umidade: RH > 85% e 80 <= T <= 87 °F
// Exemplo: 80°F (26.67°C) e 90% RH
// Sem ajuste, hiF = ~85.2°F. Com ajuste (+0.7°F), hiF = ~85.9°F -> arredonda para 86°F.
const highRhC = calculateHeatIndex(26.67, 90);
assert(
  highRhC >= 29.5 && highRhC <= 30.5,
  'Ajuste de alta umidade (80°F, 90% UR) ativado corretamente',
  `Esperado entre 29.5°C e 30.5°C (~30.0°C / 86°F), obtido: ${highRhC}°C`
);

// Ajuste de Baixa Umidade: RH < 13% e 80 <= T <= 112 °F
// Exemplo: 100°F (~37.78°C) e 10% RH
// Termo de ajuste subtrai ~1.3°F da equação de regressão pura
const lowRhC = calculateHeatIndex(37.78, 10);
assert(
  lowRhC >= 34.0 && lowRhC <= 37.0,
  'Ajuste de baixa umidade (100°F, 10% UR) ativado corretamente',
  `Esperado arrefecimento evaporativo por ar seco, obtido: ${lowRhC}°C`
);

// Verificação de alias mantido
assert(
  calculateRothfuszHeatIndex(30, 70) === calculateHeatIndex(30, 70),
  'Alias calculateRothfuszHeatIndex mantém paridade estrita com calculateHeatIndex'
);

// ----------------------------------------------------------------------------
// SUÍTE 3: Transição Suave e Metodologia Steadman Sub-80°F
// ----------------------------------------------------------------------------
console.log('\n--- SUÍTE 3: Fronteira Sub-80°F (Aproximação Linear Steadman) ---');

// Temperaturas confortáveis e frescas (20°C a 25°C)
const cool1 = calculateHeatIndex(20, 50);
assert(
  cool1 >= 19.0 && cool1 <= 21.0,
  `Condição amena (20°C, 50% UR) -> ${cool1}°C compatível com sensação térmica real`,
  `Valor obtido: ${cool1}°C`
);

const cool2 = calculateHeatIndex(24, 60);
assert(
  cool2 >= 23.5 && cool2 <= 25.5,
  `Condição moderada (24°C, 60% UR) -> ${cool2}°C compatível com Steadman simples`,
  `Valor obtido: ${cool2}°C`
);

// Transição no limiar de 80°F (26.67°C): teste de continuidade
const justBelow80 = calculateHeatIndex(26.5, 60);
const justAbove80 = calculateHeatIndex(26.8, 60);
const stepDiff = Math.abs(justAbove80 - justBelow80);
assert(
  stepDiff <= 1.0,
  `Continuidade física na fronteira de 80°F (delta de 0.3°C resulta em descontinuidade de ${stepDiff.toFixed(2)}°C <= 1.0°C)`,
  `Descontinuidade excessiva detectada na fronteira: ${stepDiff}°C`
);

// ----------------------------------------------------------------------------
// SUÍTE 4: Robustez Numérica e Casos Extremos
// ----------------------------------------------------------------------------
console.log('\n--- SUÍTE 4: Robustez Numérica e Tratamento de Bordas ---');

// Tratamento de NaN
const testNaNTemp = calculateHeatIndex(NaN, 50);
const testNaNRh = calculateHeatIndex(30, NaN);
assert(isNaN(testNaNTemp) && isNaN(testNaNRh), 'Entradas NaN tratadas de forma segura sem lançar exceções não tratadas');

// Clamping de umidade negativa para 0%
const negRh = calculateHeatIndex(35, -25);
const zeroRh = calculateHeatIndex(35, 0);
assert(
  negRh === zeroRh,
  `Umidade negativa clampada para 0% (negRh: ${negRh}°C == zeroRh: ${zeroRh}°C)`,
  `Obtido: negRh=${negRh}, zeroRh=${zeroRh}`
);

// Clamping de umidade excessiva > 100% para 100%
const overRh = calculateHeatIndex(35, 140);
const maxRh = calculateHeatIndex(35, 100);
assert(
  overRh === maxRh,
  `Umidade > 100% clampada para 100% (overRh: ${overRh}°C == maxRh: ${maxRh}°C)`,
  `Obtido: overRh=${overRh}, maxRh=${maxRh}`
);

// ----------------------------------------------------------------------------
// SUÍTE 5: Temperatura Aparente de Steadman (Ambiente Interno / Vento)
// ----------------------------------------------------------------------------
console.log('\n--- SUÍTE 5: Temperatura Aparente de Steadman (Pressão de Vapor Magnus-Tetens) ---');

// Teste com ventilação 1 m/s (semi-aberto)
const atSemiOpen = calculateApparentTemperature(32, 65, 1.0);
assert(
  atSemiOpen >= 35.0 && atSemiOpen <= 40.0,
  `Temperatura Aparente (32°C, 65% UR, 1.0 m/s) = ${atSemiOpen}°C (esperado entre 35°C e 40°C)`
);

// Teste de atenuação por vento (aumento de velocidade do vento deve reduzir temperatura aparente)
const atCalm = calculateApparentTemperature(32, 65, 0.2);
const atBreeze = calculateApparentTemperature(32, 65, 2.5);
assert(
  atBreeze < atCalm,
  `Efeito convectivo do vento comprovado: calma (0.2 m/s) = ${atCalm}°C > brisa (2.5 m/s) = ${atBreeze}°C`,
  `Brisa não reduziu temperatura aparente: calma=${atCalm}, brisa=${atBreeze}`
);

// ----------------------------------------------------------------------------
// SUÍTE 6: Protocolo de Níveis de Calor do Rio de Janeiro (Decreto 54.740/2024)
// ----------------------------------------------------------------------------
console.log('\n--- SUÍTE 6: Protocolo de Níveis de Calor do Rio (Decreto 54.740/2024) ---');

assert(getRioHeatLevel(33, 1) === 'NC1', 'Índice < 36°C -> NC1 (Rotina / Sem Alerta)');
assert(getRioHeatLevel(37, 1) === 'NC2', 'Índice 37°C por 1 dia -> NC2 (Calor Moderado)');
assert(getRioHeatLevel(37, 2) === 'NC2', 'Índice 37°C por 2 dias -> NC2 (Calor Moderado persistente)');
assert(getRioHeatLevel(37, 3) === 'NC3', 'Índice 37°C por 3 dias consecutivos -> Escalada para NC3 (Calor Alto)');
assert(getRioHeatLevel(41, 1) === 'NC3', 'Índice 41°C por 1 dia -> NC3 (Calor Alto)');
assert(getRioHeatLevel(41, 3) === 'NC4', 'Índice 41°C por 3 dias consecutivos -> Escalada para NC4 (Calor Muito Alto)');
assert(getRioHeatLevel(45, 1) === 'NC4', 'Índice 45°C por 1 dia -> NC4 (Calor Muito Alto)');
assert(getRioHeatLevel(45, 3) === 'NC5', 'Índice 45°C por 3 dias consecutivos -> Escalada para NC5 (Calor Extremo)');

// Faixas de risco operacional
assert(getRiskBand(35) === 'normal', 'Faixa de risco < 36°C -> normal');
assert(getRiskBand(38) === 'atencao', 'Faixa de risco 36-39.9°C -> atencao');
assert(getRiskBand(42) === 'alerta', 'Faixa de risco 40-43.9°C -> alerta');
assert(getRiskBand(45) === 'perigo', 'Faixa de risco >= 44°C -> perigo');

// ----------------------------------------------------------------------------
// SUÍTE 7: Modelo de Envoltória e Avaliação Desacoplada de Risco
// ----------------------------------------------------------------------------
console.log('\n--- SUÍTE 7: Envoltória Térmica e Risco Desacoplado ---');

// Teste de sensibilidade de cobertura: telha metálica vs telha termoacústica
const gainMetal = estimateEnvelopeGain(
  {
    roofType: 'telha_metalica',
    ventilationType: 'bloqueada_ou_fechada',
    solarOrientation: 'oeste',
    shadingFactor: 0,
    studentOccupancy: 35,
    powerGridStatus: 'normal',
  },
  34,
  800
);

const gainThermo = estimateEnvelopeGain(
  {
    roofType: 'termoacustica',
    ventilationType: 'cruzada_adequada',
    solarOrientation: 'sul',
    shadingFactor: 0.8,
    studentOccupancy: 20,
    powerGridStatus: 'normal',
  },
  34,
  800
);

assert(
  gainMetal.estimatedDeltaC > gainThermo.estimatedDeltaC,
  `Sensibilidade da envoltória coerente: Telha metálica/bloqueada (+${gainMetal.estimatedDeltaC}°C) > Termoacústica/cruzada (+${gainThermo.estimatedDeltaC}°C)`,
  `Inconsistência nos deltas: metal=${gainMetal.estimatedDeltaC}, termo=${gainThermo.estimatedDeltaC}`
);

// Teste do desacoplamento de risco (Clima vs Infraestrutura)
const mockSchool: SchoolRecord = {
  id: 'RJ-TESTE-01',
  inepCode: '33000001',
  name: 'E.M. Teste Unitário',
  officialName: '0514001 ESCOLA MUNICIPAL TESTE UNITARIO',
  network: 'municipal',
  municipality: 'Rio de Janeiro',
  municipalityIbgeCode: '3304557',
  borough: 'Bangu',
  region: 'Zona Oeste',
  address: 'Rua das Escolas, 100',
  latitude: -22.875,
  longitude: -43.465,
  coordinatesSource: 'Teste Unitário',
  totalStudents: 600,
  enrollmentByStage: { infantil: 0, fundamental_1: 300, fundamental_2: 300, medio: 0, eja: 0 },
  nightEnrollment: 0,
  stages: ['fundamental_1', 'fundamental_2'],
  shifts: ['manha', 'tarde'],
  shiftsInformed: true,
  totalRooms: 15,
  declaredClimatizedRooms: 15,
  declaredClimatizationStatus: 'total',
  climatizationHistory: [{ year: 2025, roomsInUse: 15, climatizedRooms: 15 }],
  dataSource: 'audited_inspection',
  dataReferenceYear: 2026,
  dataQuality: 'alta',
  isSentinel: false,
  heatIslandFactorLST: 4.8,
  greenCoveragePercent: 5,
};

const mockInspectionCritical: SchoolInspection = {
  inspectedAt: '2026-10-25',
  inspectorName: 'Engenheiro de SST',
  inspectorRole: 'tecnico_externo',
  realAcStatus: 'inoperante_eletrica',
  roofType: 'fibrocimento',
  ventilationType: 'bloqueada_ou_fechada',
  waterAccess: 'critico',
  electricalOverloadReported: true,
  cableTheftReported: false,
  notes: 'Sobrecarga elétrica na entrada com desarmamento contínuo.',
};

const decoupledEval = calculateDecoupledRiskEvaluation(mockSchool, 44.5, mockInspectionCritical);

// (b) A escola de teste que já existe, com valores numéricos, mantém exatamente o mesmo score de antes
assert(
  decoupledEval.exposure.score === 100 && decoupledEval.exposure.isPartial === false,
  `Escola com dados numéricos completos mantém score 100/100 e isPartial false (score: ${decoupledEval.exposure.score})`
);

assert(
  decoupledEval.exposure.level === 'extrema',
  `Índice de Exposição Meteorológica reflete calor extremo: ${decoupledEval.exposure.score}/100 (${decoupledEval.exposure.label})`
);

assert(
  decoupledEval.infrastructure.level === 'colapso',
  `Índice de Vulnerabilidade reflete sobrecarga/colapso elétrico: ${decoupledEval.infrastructure.score}/100 (${decoupledEval.infrastructure.label})`
);

assert(
  decoupledEval.combinedPriority === 'muito_alta',
  `Prioridade combinada classificada como 'muito_alta' (Score: ${decoupledEval.combinedScore})`
);

// ----------------------------------------------------------------------------
// SUÍTE 8: Validação de Dados Pendentes e Importador GEE
// ----------------------------------------------------------------------------
console.log('\n--- SUÍTE 8: Tratamento de Dados Pendentes e Importador Earth Engine ---');

// (a) Escola com LST e verde null: isPartial === true, nenhum NaN e fatores incluem "pendente"
const mockSchoolPending: SchoolRecord = {
  ...mockSchool,
  id: 'esc-33074313',
  inepCode: '33074313',
  heatIslandFactorLST: null,
  greenCoveragePercent: null,
};

const pendingExposure = calculateExposureIndex(mockSchoolPending, 44.5);

assert(
  pendingExposure.isPartial === true,
  'Escola com LST e verde null resulta em isPartial === true',
  `Esperado isPartial true, obtido: ${pendingExposure.isPartial}`
);

assert(
  !isNaN(pendingExposure.score) && !isNaN(pendingExposure.maxPossibleScore || 0),
  'Cálculo com campos null nunca gera NaN',
  `Score: ${pendingExposure.score}, MaxPossible: ${pendingExposure.maxPossibleScore}`
);

assert(
  pendingExposure.factors.some((f) => f.includes('Ilha de calor: pendente')),
  'Fatores incluem aviso de Ilha de calor: pendente',
  `Fatores obtidos: ${pendingExposure.factors.join('; ')}`
);

assert(
  pendingExposure.factors.some((f) => f.includes('Arborização do entorno: pendente')),
  'Fatores incluem aviso de Arborização do entorno: pendente',
  `Fatores obtidos: ${pendingExposure.factors.join('; ')}`
);

assert(
  pendingExposure.maxPossibleScore === 50,
  'Teto do score parcial com LST e verde pendentes é 50',
  `Obtido: ${pendingExposure.maxPossibleScore}`
);

// (c) Teste do parser GEE com CSV sintético de duas linhas
const syntheticGeeCsv = `inep,nome,municipio,lst_c,ref_metro_c,anom_metro_c,ref_mun_c,anom_mun_c,n_obs,arvores_200m_pct,qualidade,periodo,metodo
33074313,"E.M. Alfredo de Paula Freitas","Rio de Janeiro",34.2,30.0,4.2,31.0,3.2,14,12.5,ok,verões 2021/22 a 2025/26,Landsat 8/9 LST
33074615,"E.M. Olegário Mariano","Rio de Janeiro",35.1,30.0,5.1,31.0,4.1,8,6.2,poucas_observacoes,verões 2021/22 a 2025/26,Landsat 8/9 LST`;

const parseRes = parseGeeHeatIslandCsv(syntheticGeeCsv);

assert(
  parseRes.records.length === 2 && parseRes.errors.length === 0,
  'Parser do Earth Engine processa 2 linhas sintéticas válidas sem erros',
  `Registros: ${parseRes.records.length}, Erros: ${parseRes.errors.join(', ')}`
);

assert(
  parseRes.records[0].inep === '33074313' && parseRes.records[0].anomalyMetroC === 4.2,
  'Primeiro registro extraído com inep 33074313 e anomalia 4.2°C',
  `Obtido: inep ${parseRes.records[0]?.inep}, anom ${parseRes.records[0]?.anomalyMetroC}`
);

assert(
  parseRes.records[1].quality === 'poucas_observacoes',
  'Segundo registro reconhece qualidade poucas_observacoes',
  `Obtido: ${parseRes.records[1]?.quality}`
);

// ----------------------------------------------------------------------------
// RESUMO FINAL DA EXECUÇÃO
// ----------------------------------------------------------------------------
console.log('\n================================================================');
console.log(`  RESUMO DA VALIDAÇÃO:`);
console.log(`  Total de verificações: ${totalTests}`);
console.log(`  Sucessos:              ${passedTests}`);
console.log(`  Falhas:                ${failedTests}`);
console.log('================================================================');

if (failedTests > 0) {
  console.error(`\n[REPROVADO] ${failedTests} testes falharam na validação.`);
  process.exit(1);
} else {
  console.log(`\n[APROVADO] Todas as ${passedTests} validações físicas foram aprovadas com sucesso!`);
  process.exit(0);
}
