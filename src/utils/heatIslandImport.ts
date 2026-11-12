/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { SchoolRecord, HeatIslandRecord } from '../types';
import { HeatIslandEntry } from '../data/heatIslandResults';
import { CLASSES_BY_SHIFT, CLASSES_BY_SHIFT_SOURCE } from '../data/classesByShift';

export interface ParseGeeHeatIslandResult {
  records: HeatIslandEntry[];
  errors: string[];
}

/**
 * Faz o parsing do CSV gerado pelo script do Google Earth Engine (termometro_ilha_de_calor.js)
 * Colunas esperadas:
 * inep, nome, municipio, lst_c, ref_metro_c, anom_metro_c, ref_mun_c, anom_mun_c, n_obs, arvores_200m_pct, qualidade, periodo, metodo
 */
export function parseGeeHeatIslandCsv(text: string): ParseGeeHeatIslandResult {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length > 0);
  const records: HeatIslandEntry[] = [];
  const errors: string[] = [];

  if (lines.length === 0) {
    return { records, errors: ['Arquivo CSV vazio'] };
  }

  // Parse header
  const headerLine = lines[0];
  const headers = headerLine.split(',').map((h) => h.trim().replace(/^["']|["']$/g, '').toLowerCase());

  const colIdx = (name: string) => headers.indexOf(name);
  const inepIdx = colIdx('inep');

  if (inepIdx === -1) {
    return { records, errors: ['Cabeçalho inválido: coluna inep ausente'] };
  }

  const parseNumber = (val: string | undefined): number | null => {
    if (!val) return null;
    const clean = val.trim().replace(/^["']|["']$/g, '');
    if (clean === '' || clean.toLowerCase() === 'null' || clean.toLowerCase() === 'na' || clean.toLowerCase() === 'nan') {
      return null;
    }
    const num = Number(clean);
    return isNaN(num) ? null : num;
  };

  const parseString = (val: string | undefined): string => {
    if (!val) return '';
    return val.trim().replace(/^["']|["']$/g, '');
  };

  for (let i = 1; i < lines.length; i++) {
    const rawLine = lines[i];
    // Split por vírgula respeitando aspas simples/duplas
    const parts: string[] = [];
    let current = '';
    let inQuotes = false;
    for (let charIdx = 0; charIdx < rawLine.length; charIdx++) {
      const char = rawLine[charIdx];
      if (char === '"' || char === "'") {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        parts.push(current);
        current = '';
      } else {
        current += char;
      }
    }
    parts.push(current);

    const inepRaw = parseString(parts[inepIdx]);
    const inepDigits = inepRaw.replace(/\D/g, '');

    if (!/^[0-9]{8}$/.test(inepDigits)) {
      errors.push(`Linha ${i + 1}: Código INEP inválido "${inepRaw}". Esperado exatamente 8 dígitos.`);
      continue;
    }

    const lst_c = colIdx('lst_c') >= 0 ? parseNumber(parts[colIdx('lst_c')]) : null;
    const ref_metro_c = colIdx('ref_metro_c') >= 0 ? parseNumber(parts[colIdx('ref_metro_c')]) : null;
    const anom_metro_c = colIdx('anom_metro_c') >= 0 ? parseNumber(parts[colIdx('anom_metro_c')]) : null;
    const ref_mun_c = colIdx('ref_mun_c') >= 0 ? parseNumber(parts[colIdx('ref_mun_c')]) : null;
    const anom_mun_c = colIdx('anom_mun_c') >= 0 ? parseNumber(parts[colIdx('anom_mun_c')]) : null;
    const n_obs = colIdx('n_obs') >= 0 ? parseNumber(parts[colIdx('n_obs')]) : null;
    const arvores_200m_pct = colIdx('arvores_200m_pct') >= 0 ? parseNumber(parts[colIdx('arvores_200m_pct')]) : null;
    const rawQuality = colIdx('qualidade') >= 0 ? parseString(parts[colIdx('qualidade')]).toLowerCase() : 'ok';
    const quality: 'ok' | 'poucas_observacoes' = rawQuality.includes('poucas') ? 'poucas_observacoes' : 'ok';
    const periodo = colIdx('periodo') >= 0 ? parseString(parts[colIdx('periodo')]) : 'verões 2021/22 a 2025/26';
    const metodo = colIdx('metodo') >= 0 ? parseString(parts[colIdx('metodo')]) : 'Landsat 8/9 LST mono-janela';
    const nome = colIdx('nome') >= 0 ? parseString(parts[colIdx('nome')]) : undefined;
    const municipio = colIdx('municipio') >= 0 ? parseString(parts[colIdx('municipio')]) : undefined;

    records.push({
      inep: inepDigits,
      nome,
      municipio,
      lstC: lst_c,
      anomalyMetroC: anom_metro_c,
      refMetroC: ref_metro_c,
      anomalyMunicipalC: anom_mun_c,
      refMunicipalC: ref_mun_c,
      nObs: n_obs,
      treeCover200mPct: arvores_200m_pct,
      quality,
      period: periodo || 'verões 2021/22 a 2025/26',
      method: metodo || 'Landsat 8/9 LST',
      source: 'Landsat 8/9 (USGS) & ESA WorldCover',
      importedAt: new Date().toISOString(),
    });
  }

  return { records, errors };
}

/**
 * Mescla os resultados da ilha de calor do Earth Engine e os dados de turmas por turno com o cadastro de escolas
 */
export function attachHeatIslandData(
  schools: SchoolRecord[],
  results: HeatIslandEntry[]
): SchoolRecord[] {
  const resultMap = new Map<string, HeatIslandEntry>();
  if (results && results.length > 0) {
    for (const r of results) {
      resultMap.set(r.inep, r);
    }
  }

  return schools.map((school) => {
    let updated = { ...school };
    const heatData = resultMap.get(school.inepCode);
    const classData = !school.isDemo ? CLASSES_BY_SHIFT[school.inepCode] : undefined;

    if (classData) {
      updated.classesByShift = classData;
      updated.classesByShiftSource = CLASSES_BY_SHIFT_SOURCE;
    }

    if (heatData) {
      updated.heatIslandFactorLST = heatData.anomalyMetroC;
      updated.greenCoveragePercent =
        heatData.treeCover200mPct !== null ? Math.round(heatData.treeCover200mPct) : null;
      updated.heatIsland = heatData;
    }

    return updated;
  });
}
