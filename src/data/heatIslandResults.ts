/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Resultados de anomalia de temperatura de superfície (LST) e cobertura arbórea
 * gerados pelo script do Google Earth Engine (termometro_ilha_de_calor.js)
 * a partir de imagens Landsat 8/9 (USGS, verões 2021/22 a 2025/26) e ESA WorldCover (raio 200m).
 * 
 * Atualizado automaticamente em 2026-11-04T09:28:49.092Z via scripts/importHeatIsland.ts.
 */

import { HeatIslandRecord } from '../types';

export interface HeatIslandEntry extends HeatIslandRecord {
  inep: string;
  nome?: string;
  municipio?: string;
}

export const HEAT_ISLAND_RESULTS: HeatIslandEntry[] = [
  {
    "inep": "33074615",
    "nome": "E.M. Olegário Mariano",
    "municipio": "Rio de Janeiro",
    "lstC": 46.20705384692335,
    "anomalyMetroC": 4.080202057841837,
    "refMetroC": 42.12685178908152,
    "anomalyMunicipalC": 3.5800679399195423,
    "refMunicipalC": 42.626985907003814,
    "nObs": 29.876074174581635,
    "treeCover200mPct": 1.240153986271595,
    "quality": "ok",
    "period": "2021-12-01/2026-04-01 (dez-mar)",
    "method": "termometro-lst-v1",
    "source": "Landsat 8/9 (USGS) & ESA WorldCover",
    "importedAt": "2026-11-04T09:28:49.090Z"
  },
  {
    "inep": "33076464",
    "nome": "E.M. Waldemar Falcão",
    "municipio": "Rio de Janeiro",
    "lstC": 44.85916301520798,
    "anomalyMetroC": 2.7323112261264537,
    "refMetroC": 42.12685178908152,
    "anomalyMunicipalC": 2.2321771082041586,
    "refMunicipalC": 42.626985907003814,
    "nObs": 26.434561482820975,
    "treeCover200mPct": 0.6676596710285158,
    "quality": "ok",
    "period": "2021-12-01/2026-04-01 (dez-mar)",
    "method": "termometro-lst-v1",
    "source": "Landsat 8/9 (USGS) & ESA WorldCover",
    "importedAt": "2026-11-04T09:28:49.090Z"
  },
  {
    "inep": "33072965",
    "nome": "E.M. Manoel Bomfim",
    "municipio": "Rio de Janeiro",
    "lstC": 44.651405201047844,
    "anomalyMetroC": 2.5245534119663144,
    "refMetroC": 42.12685178908152,
    "anomalyMunicipalC": 2.0244192940440198,
    "refMunicipalC": 42.626985907003814,
    "nObs": 29.63433932406466,
    "treeCover200mPct": 3.655865180698709,
    "quality": "ok",
    "period": "2021-12-01/2026-04-01 (dez-mar)",
    "method": "termometro-lst-v1",
    "source": "Landsat 8/9 (USGS) & ESA WorldCover",
    "importedAt": "2026-11-04T09:28:49.090Z"
  },
  {
    "inep": "33069131",
    "nome": "E.M. Bahia",
    "municipio": "Rio de Janeiro",
    "lstC": 44.53066749536444,
    "anomalyMetroC": 2.4038157062829466,
    "refMetroC": 42.12685178908152,
    "anomalyMunicipalC": 1.9036815883606524,
    "refMunicipalC": 42.626985907003814,
    "nObs": 34.444909029268835,
    "treeCover200mPct": 3.831674008041572,
    "quality": "ok",
    "period": "2021-12-01/2026-04-01 (dez-mar)",
    "method": "termometro-lst-v1",
    "source": "Landsat 8/9 (USGS) & ESA WorldCover",
    "importedAt": "2026-11-04T09:28:49.090Z"
  },
  {
    "inep": "33074313",
    "nome": "E.M. Alfredo de Paula Freitas",
    "municipio": "Rio de Janeiro",
    "lstC": 43.91384865863895,
    "anomalyMetroC": 1.7869968695574325,
    "refMetroC": 42.12685178908152,
    "anomalyMunicipalC": 1.2868627516351392,
    "refMunicipalC": 42.626985907003814,
    "nObs": 32.23208229708343,
    "treeCover200mPct": 0.07421247468044981,
    "quality": "ok",
    "period": "2021-12-01/2026-04-01 (dez-mar)",
    "method": "termometro-lst-v1",
    "source": "Landsat 8/9 (USGS) & ESA WorldCover",
    "importedAt": "2026-11-04T09:28:49.090Z"
  },
  {
    "inep": "33144591",
    "nome": "Creche Municipal Jécia de Freitas Ferreira",
    "municipio": "Rio de Janeiro",
    "lstC": 43.590921834118994,
    "anomalyMetroC": 1.464070045037473,
    "refMetroC": 42.12685178908152,
    "anomalyMunicipalC": 0.96393592711518,
    "refMunicipalC": 42.626985907003814,
    "nObs": 32.09002488124859,
    "treeCover200mPct": 5.241683182435952,
    "quality": "ok",
    "period": "2021-12-01/2026-04-01 (dez-mar)",
    "method": "termometro-lst-v1",
    "source": "Landsat 8/9 (USGS) & ESA WorldCover",
    "importedAt": "2026-11-04T09:28:49.090Z"
  },
  {
    "inep": "33062110",
    "nome": "E.M. Prof. Scintilla Exel",
    "municipio": "Queimados",
    "lstC": 42.86124778760638,
    "anomalyMetroC": 0.7343959985248826,
    "refMetroC": 42.12685178908152,
    "anomalyMunicipalC": 1.9287607328762497,
    "refMunicipalC": 40.93248705473015,
    "nObs": 31.53655500226347,
    "treeCover200mPct": 2.764176965580317,
    "quality": "ok",
    "period": "2021-12-01/2026-04-01 (dez-mar)",
    "method": "termometro-lst-v1",
    "source": "Landsat 8/9 (USGS) & ESA WorldCover",
    "importedAt": "2026-11-04T09:28:49.090Z"
  },
  {
    "inep": "33077746",
    "nome": "E.M. Barão da Taquara",
    "municipio": "Rio de Janeiro",
    "lstC": 42.61046990162733,
    "anomalyMetroC": 0.48361811254579706,
    "refMetroC": 42.12685178908152,
    "anomalyMunicipalC": -0.016516005376496168,
    "refMunicipalC": 42.626985907003814,
    "nObs": 31.7657362413832,
    "treeCover200mPct": 5.244131905970902,
    "quality": "ok",
    "period": "2021-12-01/2026-04-01 (dez-mar)",
    "method": "termometro-lst-v1",
    "source": "Landsat 8/9 (USGS) & ESA WorldCover",
    "importedAt": "2026-11-04T09:28:49.090Z"
  },
  {
    "inep": "33104379",
    "nome": "CIEP 175 José Lins do Rego",
    "municipio": "São João de Meriti",
    "lstC": 41.897865866881574,
    "anomalyMetroC": -0.22898592219992883,
    "refMetroC": 42.12685178908152,
    "anomalyMunicipalC": -1.5385548252843897,
    "refMunicipalC": 43.43642069216598,
    "nObs": 25.0692229385816,
    "treeCover200mPct": 23.496003120651608,
    "quality": "ok",
    "period": "2021-12-01/2026-04-01 (dez-mar)",
    "method": "termometro-lst-v1",
    "source": "Landsat 8/9 (USGS) & ESA WorldCover",
    "importedAt": "2026-11-04T09:28:49.090Z"
  },
  {
    "inep": "33058610",
    "nome": "C.E. Dom Walmor",
    "municipio": "Nova Iguaçu",
    "lstC": 41.52496544288013,
    "anomalyMetroC": -0.6018863462013888,
    "refMetroC": 42.12685178908152,
    "anomalyMunicipalC": -0.03637416241333711,
    "refMunicipalC": 41.56133960529347,
    "nObs": 23.91814785463603,
    "treeCover200mPct": 33.90974333880911,
    "quality": "ok",
    "period": "2021-12-01/2026-04-01 (dez-mar)",
    "method": "termometro-lst-v1",
    "source": "Landsat 8/9 (USGS) & ESA WorldCover",
    "importedAt": "2026-11-04T09:28:49.090Z"
  },
  {
    "inep": "33063397",
    "nome": "C.E. Amaro Cavalcanti",
    "municipio": "Rio de Janeiro",
    "lstC": 38.828495537853556,
    "anomalyMetroC": -3.2983562512279576,
    "refMetroC": 42.12685178908152,
    "anomalyMunicipalC": -3.7984903691502514,
    "refMunicipalC": 42.626985907003814,
    "nObs": 30.375105012601512,
    "treeCover200mPct": 24.149453131588675,
    "quality": "ok",
    "period": "2021-12-01/2026-04-01 (dez-mar)",
    "method": "termometro-lst-v1",
    "source": "Landsat 8/9 (USGS) & ESA WorldCover",
    "importedAt": "2026-11-04T09:28:49.090Z"
  },
  {
    "inep": "33086206",
    "nome": "E.M. Tenente Antônio João",
    "municipio": "Rio de Janeiro",
    "lstC": 36.26533698153614,
    "anomalyMetroC": -5.861514807545371,
    "refMetroC": 42.12685178908152,
    "anomalyMunicipalC": null,
    "refMunicipalC": null,
    "nObs": 32.984288459364755,
    "treeCover200mPct": 32.98428862379982,
    "quality": "ok",
    "period": "2021-12-01/2026-04-01 (dez-mar)",
    "method": "termometro-lst-v1",
    "source": "Landsat 8/9 (USGS) & ESA WorldCover",
    "importedAt": "2026-11-04T09:28:49.090Z"
  }
];
