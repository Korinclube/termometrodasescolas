/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { DayForecastSummary, HourlyForecastPoint } from '../types';
import { calculateRothfuszHeatIndex, calculateShiftExposure, getRioHeatLevel, getRiskBand } from '../utils/thermalMath';

export type WeatherScenarioKey = 'live_open_meteo' | 'super_el_nino' | 'historico_alemao' | 'verao_tipico';

export interface WeatherScenarioOption {
  key: WeatherScenarioKey;
  label: string;
  description: string;
  tempPeakC: number;
  expectedHeatLevel: 'NC1' | 'NC2' | 'NC3' | 'NC4' | 'NC5';
}

export const WEATHER_SCENARIOS: WeatherScenarioOption[] = [
  {
    key: 'live_open_meteo',
    label: 'Previsão Open-Meteo (Ao Vivo / 72h)',
    description: 'Consulta em tempo real à API aberta Open-Meteo para a malha meteorológica do Rio de Janeiro.',
    tempPeakC: 35.5,
    expectedHeatLevel: 'NC3',
  },
  {
    key: 'super_el_nino',
    label: 'Cenário Super El Niño 2026/27 (Onda Severa)',
    description: 'Simulação calibrada com persistência de 3 dias consecutivos de Índice de Calor entre 40 ºC e 44 ºC na Zona Norte e Baixada.',
    tempPeakC: 39.5,
    expectedHeatLevel: 'NC4',
  },
  {
    key: 'historico_alemao',
    label: 'Pico Histórico de Verão (43,9 ºC no Alemão / NC5)',
    description: 'Cenário análogo ao recorde térmico registrado no Morro do Adeus e Bangu com IC superior a 46 ºC.',
    tempPeakC: 43.9,
    expectedHeatLevel: 'NC5',
  },
  {
    key: 'verao_tipico',
    label: 'Verão Carioca Moderado (NC1 / NC2)',
    description: 'Dias ensolarados típicos com brisa marinha, pico térmico entre 31 ºC e 33 ºC e índice de calor ameno.',
    tempPeakC: 32.4,
    expectedHeatLevel: 'NC2',
  },
];

/**
 * Gera uma série horária sintética de 72 horas para cenários calibrados
 */
export function generateScenarioHourlyData(
  scenarioKey: WeatherScenarioKey,
  baseDate: Date = new Date(),
  microclimateOffsetC: number = 0
): HourlyForecastPoint[] {
  const points: HourlyForecastPoint[] = [];

  // Parâmetros base por cenário
  let minTemp = 24;
  let maxTemp = 33;
  let baseHumidityDay = 62;
  let baseHumidityNight = 82;
  let baseRadiationPeak = 850;

  if (scenarioKey === 'super_el_nino') {
    minTemp = 27;
    maxTemp = 39.5;
    baseHumidityDay = 65;
    baseHumidityNight = 88;
    baseRadiationPeak = 1050;
  } else if (scenarioKey === 'historico_alemao') {
    minTemp = 29;
    maxTemp = 43.2;
    baseHumidityDay = 66;
    baseHumidityNight = 86;
    baseRadiationPeak = 1120;
  } else if (scenarioKey === 'verao_tipico') {
    minTemp = 22;
    maxTemp = 32.0;
    baseHumidityDay = 58;
    baseHumidityNight = 78;
    baseRadiationPeak = 750;
  } else {
    // Live approximation base
    minTemp = 24.5;
    maxTemp = 35.0;
    baseHumidityDay = 63;
    baseHumidityNight = 84;
    baseRadiationPeak = 920;
  }

  // Gera 72 horas consecutivas a partir de hoje às 00:00
  const startDay = new Date(baseDate);
  startDay.setHours(0, 0, 0, 0);

  for (let i = 0; i < 72; i++) {
    const ptDate = new Date(startDay.getTime() + i * 3600 * 1000);
    const hour = ptDate.getHours();

    // Curva diurna solar senoidal (mínima às 06h, máxima às 14h)
    const diurnalFactor = Math.max(0, Math.sin(((hour - 6) / 16) * Math.PI));
    const diurnalCurv = Math.cos(((hour - 14) / 12) * Math.PI) * 0.5 + 0.5;

    // Variação dia 1, dia 2, dia 3 (ligeira onda progressiva)
    const dayIndex = Math.floor(i / 24);
    const dayWaveOffset = (dayIndex - 1) * 0.8;

    const temp = minTemp + (maxTemp - minTemp) * diurnalCurv + dayWaveOffset + microclimateOffsetC;
    // Umidade é inversamente proporcional à temperatura
    const rh = baseHumidityNight - (baseHumidityNight - baseHumidityDay) * diurnalFactor;

    // Radiação solar só existe entre 06h e 18h
    const radiation = hour >= 6 && hour <= 18 ? baseRadiationPeak * Math.sin(((hour - 6) / 12) * Math.PI) : 0;
    const windSpeed = 6 + 10 * diurnalFactor + (Math.sin(i * 0.5) * 3);

    const heatIndex = calculateRothfuszHeatIndex(temp, rh);
    const heatLevelRio = getRioHeatLevel(heatIndex);
    const riskBand = getRiskBand(heatIndex);

    points.push({
      time: ptDate.toISOString(),
      temperatureC: Math.round(temp * 10) / 10,
      relativeHumidity: Math.round(rh),
      shortwaveRadiationWm2: Math.round(Math.max(0, radiation)),
      windSpeedKmh: Math.round(windSpeed * 10) / 10,
      heatIndexC: heatIndex,
      heatLevelRio,
      riskBand,
    });
  }

  return points;
}

/**
 * Agrupa os pontos de 72h em resumos diários com turnos escolares
 */
export function aggregateDaysForecast(hourlyPoints: HourlyForecastPoint[]): DayForecastSummary[] {
  const daysMap = new Map<string, HourlyForecastPoint[]>();

  hourlyPoints.forEach((pt) => {
    const dayKey = pt.time.split('T')[0];
    if (!daysMap.has(dayKey)) {
      daysMap.set(dayKey, []);
    }
    daysMap.get(dayKey)!.push(pt);
  });

  const daySummaries: DayForecastSummary[] = [];

  const daysWeekNames = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];

  let consecutiveHotDays = 0;

  Array.from(daysMap.entries()).slice(0, 3).forEach(([dateStr, points]) => {
    const d = new Date(dateStr + 'T12:00:00');
    const dayLabel = `${daysWeekNames[d.getDay()]}, ${d.getDate()} de ${d.toLocaleString('pt-BR', { month: 'short' })}`;

    let maxTemp = -999;
    let minTemp = 999;
    let maxHI = -999;

    points.forEach((p) => {
      if (p.temperatureC > maxTemp) maxTemp = p.temperatureC;
      if (p.temperatureC < minTemp) minTemp = p.temperatureC;
      if (p.heatIndexC > maxHI) maxHI = p.heatIndexC;
    });

    if (maxHI >= 36) {
      consecutiveHotDays += 1;
    } else {
      consecutiveHotDays = 0;
    }

    const overallRioLevel = getRioHeatLevel(maxHI, Math.max(1, consecutiveHotDays));

    const manha = calculateShiftExposure(points, 'manha');
    const tarde = calculateShiftExposure(points, 'tarde');
    const integral = calculateShiftExposure(points, 'integral');

    daySummaries.push({
      date: dateStr,
      dayLabel,
      maxTemperatureC: maxTemp,
      minTemperatureC: minTemp,
      maxHeatIndexC: maxHI,
      overallRioLevel,
      shifts: {
        manha,
        tarde,
        integral,
      },
      hourly: points,
    });
  });

  return daySummaries;
}
