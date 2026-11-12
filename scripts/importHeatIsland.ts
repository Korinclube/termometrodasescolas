/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Script de importação dos resultados de Ilha de Calor do Google Earth Engine
 * Uso: npx tsx scripts/importHeatIsland.ts [caminho_do_csv]
 */

import fs from 'fs';
import path from 'path';
import { parseGeeHeatIslandCsv } from '../src/utils/heatIslandImport.ts';
import { INITIAL_SCHOOLS } from '../src/data/schoolsData.ts';

const defaultCsvPath = path.resolve(process.cwd(), 'data/termometro_ilha_calor_escolas.csv');
const targetTsPath = path.resolve(process.cwd(), 'src/data/heatIslandResults.ts');

const csvPath = process.argv[2] ? path.resolve(process.cwd(), process.argv[2]) : defaultCsvPath;

if (!fs.existsSync(csvPath)) {
  console.log(`[Aviso] Arquivo CSV não encontrado em: ${csvPath}`);
  console.log(`Para importar os dados reais quando o script do Earth Engine for executado, coloque o arquivo em data/termometro_ilha_calor_escolas.csv e execute novamente.`);
  process.exit(0);
}

const csvContent = fs.readFileSync(csvPath, 'utf-8');
const { records, errors } = parseGeeHeatIslandCsv(csvContent);

console.log(`Registros parseados com sucesso: ${records.length}`);
if (errors.length > 0) {
  console.warn(`Erros/Linhas ignoradas (${errors.length}):`);
  errors.forEach((e) => console.warn(`  - ${e}`));
}

// Verifica quantas escolas casaram com INITIAL_SCHOOLS
const registeredIneps = new Set(INITIAL_SCHOOLS.map((s) => s.inepCode));
let matchedCount = 0;
let unmatchedCount = 0;

for (const rec of records) {
  if (registeredIneps.has(rec.inep)) {
    matchedCount++;
  } else {
    unmatchedCount++;
  }
}

console.log(`Escolas casadas com INITIAL_SCHOOLS: ${matchedCount}`);
console.log(`Registros do CSV sem correspondência no INITIAL_SCHOOLS: ${unmatchedCount}`);

// Reescreve src/data/heatIslandResults.ts preservando exatamente os valores
const fileContent = `/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Resultados de anomalia de temperatura de superfície (LST) e cobertura arbórea
 * gerados pelo script do Google Earth Engine (termometro_ilha_de_calor.js)
 * a partir de imagens Landsat 8/9 (USGS, verões 2021/22 a 2025/26) e ESA WorldCover (raio 200m).
 * 
 * Atualizado automaticamente em ${new Date().toISOString()} via scripts/importHeatIsland.ts.
 */

import { HeatIslandRecord } from '../types';

export interface HeatIslandEntry extends HeatIslandRecord {
  inep: string;
  nome?: string;
  municipio?: string;
}

export const HEAT_ISLAND_RESULTS: HeatIslandEntry[] = ${JSON.stringify(records, null, 2)};
`;

fs.writeFileSync(targetTsPath, fileContent, 'utf-8');
console.log(`Arquivo salvo com sucesso em: ${targetTsPath}`);
