/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

const decimalFormatters = new Map<number, Intl.NumberFormat>();

function normalizeDecimals(decimals: number | undefined, fallback: number): number {
  if (decimals === undefined || !Number.isFinite(decimals)) return fallback;
  return Math.max(0, Math.min(6, Math.trunc(decimals)));
}

function getDecimalFormatter(decimals: number): Intl.NumberFormat {
  const safeDecimals = normalizeDecimals(decimals, 1);
  let fmt = decimalFormatters.get(safeDecimals);
  if (!fmt) {
    fmt = new Intl.NumberFormat('pt-BR', {
      minimumFractionDigits: safeDecimals,
      maximumFractionDigits: safeDecimals,
    });
    decimalFormatters.set(safeDecimals, fmt);
  }
  return fmt;
}

const integerFormatter = new Intl.NumberFormat('pt-BR', {
  maximumFractionDigits: 0,
});

/**
 * Formata um número decimal no padrão pt-BR (vírgula decimal).
 * Ex.: formatNumberPtBr(31.9) => "31,9"
 * Ex.: formatNumberPtBr(1.8, { signed: true }) => "+1,8"
 */
export function formatNumberPtBr(
  value: number,
  options?: { decimals?: number; signed?: boolean }
): string {
  const decimals = normalizeDecimals(options?.decimals, 1);
  const signed = options?.signed ?? false;

  if (!Number.isFinite(value)) return '-';

  const factor = Math.pow(10, decimals);
  const rounded = Math.round(value * factor) / factor;
  const normalized = Object.is(rounded, -0) ? 0 : rounded;
  const formatted = getDecimalFormatter(decimals).format(normalized);

  if (signed && normalized > 0) {
    return `+${formatted}`;
  }
  return formatted;
}

/**
 * Formata temperatura em graus Celsius no padrão pt-BR.
 * Ex.: formatTempPtBr(31.9) => "31,9 °C"
 * Ex.: formatTempPtBr(1.8, { signed: true }) => "+1,8 °C"
 */
export function formatTempPtBr(
  value: number,
  options?: { decimals?: number; signed?: boolean; unit?: string }
): string {
  if (!Number.isFinite(value)) return '-';
  const unit = options?.unit ?? '°C';
  return `${formatNumberPtBr(value, options)} ${unit}`;
}

/**
 * Formata percentual inteiro sem casa decimal no padrão pt-BR.
 * Ex.: formatPercentIntPtBr(0.0) => "0%"
 * Ex.: formatPercentIntPtBr(12.6) => "13%"
 */
export function formatPercentIntPtBr(
  value: number,
  options?: { signed?: boolean }
): string {
  if (!Number.isFinite(value)) return '0%';
  const rounded = Math.round(value);
  const normalized = Object.is(rounded, -0) ? 0 : rounded;
  const formatted = integerFormatter.format(normalized);
  if (options?.signed && normalized > 0) {
    return `+${formatted}%`;
  }
  return `${formatted}%`;
}

/**
 * Formata percentual com precisão configurável no padrão pt-BR.
 * Padrão: 0 casas decimais (inteiro).
 */
export function formatPercentPtBr(
  value: number,
  options?: { decimals?: number; signed?: boolean }
): string {
  const decimals = normalizeDecimals(options?.decimals, 0);
  if (decimals === 0) {
    return formatPercentIntPtBr(value, { signed: options?.signed });
  }
  if (!Number.isFinite(value)) return '-';
  return `${formatNumberPtBr(value, { decimals, signed: options?.signed })}%`;
}

/**
 * Formata inteiro com separador de milhar em pt-BR.
 * Ex.: formatIntegerPtBr(1120) => "1.120"
 */
export function formatIntegerPtBr(value: number): string {
  if (!Number.isFinite(value)) return '0';
  const rounded = Math.round(value);
  const normalized = Object.is(rounded, -0) ? 0 : rounded;
  return integerFormatter.format(normalized);
}
