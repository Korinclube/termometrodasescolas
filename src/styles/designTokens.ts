/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type ThermalStep = 1 | 2 | 3 | 4 | 5;

export interface ThermalScaleEntry {
  step: ThermalStep;
  label: string;
  rioLevel: 'NC1' | 'NC2' | 'NC3' | 'NC4' | 'NC5';
  solidVar: string;
  bgVar: string;
  borderVar: string;
  textVar: string;
  hexSolid: string;
  markerGlyphColor: string;
}

/**
 * Escala térmica única em 5 passos (azul frio -> vermelho quente).
 * Usada exclusivamente para dados térmicos, índices e prioridades.
 */
export const THERMAL_SCALE: Record<ThermalStep, ThermalScaleEntry> = {
  1: {
    step: 1,
    label: 'Baixa',
    rioLevel: 'NC1',
    solidVar: 'var(--thermal-1-solid)',
    bgVar: 'var(--thermal-1-bg)',
    borderVar: 'var(--thermal-1-border)',
    textVar: 'var(--thermal-1-text)',
    hexSolid: '#1d4ed8',
    markerGlyphColor: '#ffffff',
  },
  2: {
    step: 2,
    label: 'Moderada',
    rioLevel: 'NC2',
    solidVar: 'var(--thermal-2-solid)',
    bgVar: 'var(--thermal-2-bg)',
    borderVar: 'var(--thermal-2-border)',
    textVar: 'var(--thermal-2-text)',
    hexSolid: '#0f766e',
    markerGlyphColor: '#ffffff',
  },
  3: {
    step: 3,
    label: 'Atenção',
    rioLevel: 'NC3',
    solidVar: 'var(--thermal-3-solid)',
    bgVar: 'var(--thermal-3-bg)',
    borderVar: 'var(--thermal-3-border)',
    textVar: 'var(--thermal-3-text)',
    hexSolid: '#eab308',
    markerGlyphColor: '#181a1d',
  },
  4: {
    step: 4,
    label: 'Alta',
    rioLevel: 'NC4',
    solidVar: 'var(--thermal-4-solid)',
    bgVar: 'var(--thermal-4-bg)',
    borderVar: 'var(--thermal-4-border)',
    textVar: 'var(--thermal-4-text)',
    hexSolid: '#c2410c',
    markerGlyphColor: '#ffffff',
  },
  5: {
    step: 5,
    label: 'Muito Alta',
    rioLevel: 'NC5',
    solidVar: 'var(--thermal-5-solid)',
    bgVar: 'var(--thermal-5-bg)',
    borderVar: 'var(--thermal-5-border)',
    textVar: 'var(--thermal-5-text)',
    hexSolid: '#b91c1c',
    markerGlyphColor: '#ffffff',
  },
};

export function priorityToThermalStep(
  priority: 'muito_alta' | 'alta' | 'moderada' | 'baixa'
): ThermalStep {
  if (priority === 'muito_alta') return 5;
  if (priority === 'alta') return 4;
  if (priority === 'moderada') return 3;
  return 1;
}

export function heatIndexToThermalStep(heatIndexC: number): ThermalStep {
  if (heatIndexC >= 44) return 5;
  if (heatIndexC >= 40) return 4;
  if (heatIndexC >= 36) return 3;
  if (heatIndexC >= 32) return 2;
  return 1;
}
