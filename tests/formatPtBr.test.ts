/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  formatIntegerPtBr,
  formatNumberPtBr,
  formatPercentIntPtBr,
  formatPercentPtBr,
  formatTempPtBr,
} from '../src/utils/formatPtBr';

let passed = 0;
let failed = 0;

function assertEqual(actual: string, expected: string, label: string) {
  if (actual === expected) {
    console.log(`  [PASS] ${label} -> "${actual}"`);
    passed++;
  } else {
    console.error(`  [FAIL] ${label} -> esperado "${expected}", obtido "${actual}"`);
    failed++;
  }
}

console.log('--- Suíte de Formatação Numérica pt-BR (Intl.NumberFormat) ---');

assertEqual(formatNumberPtBr(31.9), '31,9', 'Decimal padrão com vírgula (31.9)');
assertEqual(formatNumberPtBr(1.8, { signed: true }), '+1,8', 'Decimal positivo com sinal (+1.8)');
assertEqual(formatNumberPtBr(-1.2, { signed: true }), '-1,2', 'Decimal negativo com sinal (-1.2)');
assertEqual(formatNumberPtBr(-0.001, { signed: true }), '0,0', 'Evita -0,0 após arredondamento');
assertEqual(formatNumberPtBr(3.56, { decimals: 2 }), '3,56', 'Precisão de 2 casas decimais');
assertEqual(formatNumberPtBr(Number.NaN), '-', 'NaN tratado com segurança');

assertEqual(formatTempPtBr(43.9), '43,9 °C', 'Temperatura padrão com vírgula e °C');
assertEqual(formatTempPtBr(1.8, { signed: true }), '+1,8 °C', 'Anomalia positiva assinada (+1,8 °C)');
assertEqual(formatTempPtBr(Number.POSITIVE_INFINITY), '-', 'Infinito tratado sem unidade solta');

assertEqual(formatPercentIntPtBr(0.0), '0%', 'Percentual zero sem casa decimal');
assertEqual(formatPercentIntPtBr(12.6), '13%', 'Percentual inteiro arredondado');
assertEqual(formatPercentPtBr(12.64, { decimals: 1 }), '12,6%', 'Percentual com 1 casa decimal');

assertEqual(formatIntegerPtBr(1120), '1.120', 'Separador de milhar pt-BR (1.120)');
assertEqual(formatIntegerPtBr(Number.NaN), '0', 'Inteiro NaN tratado como 0');

console.log(`\nResumo formatPtBr: ${passed} passou, ${failed} falhou.`);
if (failed > 0) {
  process.exit(1);
}
