/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  HourlyForecastPoint,
  InmetObservationState,
  WeatherObservationStation,
} from '../types';

export interface InmetTargetStationMeta {
  code: string;
  shortName: string;
  defaultLatitude: number;
  defaultLongitude: number;
}

/**
 * As 7 estações automáticas reais do INMET selecionadas para o Rio de Janeiro e Região Metropolitana.
 * Estas coordenadas padrão só entram em cena se o endpoint /estacoes/T estiver fora do ar.
 * Nenhuma leitura meteorológica fictícia é armazenada aqui.
 */
export const INMET_RJ_TARGET_STATIONS: InmetTargetStationMeta[] = [
  {
    code: 'A621',
    shortName: 'Vila Militar',
    defaultLatitude: -22.8617,
    defaultLongitude: -43.4114,
  },
  {
    code: 'A603',
    shortName: 'Xerém',
    defaultLatitude: -22.5833,
    defaultLongitude: -43.2833,
  },
  {
    code: 'A601',
    shortName: 'Seropédica',
    defaultLatitude: -22.7578,
    defaultLongitude: -43.6847,
  },
  {
    code: 'A627',
    shortName: 'Niterói',
    defaultLatitude: -22.9056,
    defaultLongitude: -43.1036,
  },
  {
    code: 'A636',
    shortName: 'Jacarepaguá',
    defaultLatitude: -22.9394,
    defaultLongitude: -43.4028,
  },
  {
    code: 'A652',
    shortName: 'Forte de Copacabana',
    defaultLatitude: -22.9869,
    defaultLongitude: -43.1894,
  },
  {
    code: 'A602',
    shortName: 'Marambaia',
    defaultLatitude: -23.0497,
    defaultLongitude: -43.5958,
  },
];

export const INMET_TARGET_CODES = new Set(INMET_RJ_TARGET_STATIONS.map((s) => s.code));

export const INITIAL_INMET_STATIONS: WeatherObservationStation[] = INMET_RJ_TARGET_STATIONS.map(
  (meta) => ({
    id: `inmet-${meta.code.toLowerCase()}`,
    stationCode: meta.code,
    name: `${meta.shortName} (${meta.code})`,
    network: 'INMET',
    latitude: meta.defaultLatitude,
    longitude: meta.defaultLongitude,
    lastUpdated: null,
    temperatureC: null,
    tempMaxC: null,
    tempMinC: null,
    humidityPercent: null,
    heatIndexC: null,
    status: 'operante',
    observationState: 'aguardando_token',
    observedAtBrt: null,
    observedTimeLabel: null,
    hourlyObservations: [],
  })
);

/**
 * Distância geodésica em quilômetros (fórmula de Haversine).
 */
export function calculateDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  if (
    !Number.isFinite(lat1) ||
    !Number.isFinite(lon1) ||
    !Number.isFinite(lat2) ||
    !Number.isFinite(lon2)
  ) {
    return NaN;
  }

  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 10) / 10;
}

/**
 * Enriquece a lista de estações com a distância até a escola selecionada,
 * identifica a mais próxima e ordena da mais próxima para a mais distante.
 */
export function enrichStationsWithDistance(
  stations: WeatherObservationStation[],
  schoolLat: number,
  schoolLon: number
): WeatherObservationStation[] {
  if (stations.length === 0) return [];

  const withDistances = stations.map((st) => ({
    ...st,
    distanceKm: calculateDistanceKm(schoolLat, schoolLon, st.latitude, st.longitude),
    isNearest: false,
  }));

  let minIndex = -1;
  let minDistance = Infinity;
  for (let i = 0; i < withDistances.length; i++) {
    const d = withDistances[i].distanceKm;
    if (Number.isFinite(d) && d < minDistance) {
      minDistance = d;
      minIndex = i;
    }
  }

  if (minIndex >= 0) {
    withDistances[minIndex] = {
      ...withDistances[minIndex],
      isNearest: true,
    };
  }

  return withDistances.sort((a, b) => {
    const da = Number.isFinite(a.distanceKm) ? a.distanceKm! : Infinity;
    const db = Number.isFinite(b.distanceKm) ? b.distanceKm! : Infinity;
    return da - db;
  });
}

export function getInmetStateLabel(station: WeatherObservationStation): string {
  const state: InmetObservationState =
    station.observationState ??
    (station.status === 'manutencao' ? 'estacao_em_pane' : 'aguardando_token');

  switch (state) {
    case 'leitura':
      return station.observedTimeLabel
        ? `Leitura das ${station.observedTimeLabel}`
        : 'Leitura recente';
    case 'dado_atrasado':
      return 'Dado atrasado';
    case 'estacao_em_pane':
      return 'Estação em pane';
    case 'inmet_indisponivel':
      return 'INMET indisponível';
    case 'aguardando_token':
    default:
      return 'Aguardando token do INMET';
  }
}

export interface ForecastVsObservedComparison {
  station: WeatherObservationStation;
  observedIsoBrt: string;
  observedHourLabel: string;
  observedTempC: number;
  observedHumidityPercent: number | null;
  observedHeatIndexC: number | null;
  forecastTempC: number;
  forecastHumidityPercent: number;
  forecastHeatIndexC: number;
  tempDiffC: number;
  heatIndexDiffC: number | null;
}

/**
 * Monta a comparação Previsto (Open-Meteo) x Observado (estação mais próxima do INMET)
 * para a mesma hora em horário de Brasília. Retorna null se não houver leitura real.
 */
export function buildForecastVsObservedComparison(
  stations: WeatherObservationStation[],
  hourlyForecast: HourlyForecastPoint[]
): ForecastVsObservedComparison | null {
  if (stations.length === 0 || hourlyForecast.length === 0) return null;

  // Prioriza a estação mais próxima com leitura real válida; se a mais próxima não tiver leitura,
  // só exibe quando houver leitura observada na estação mais próxima (ou primeira operante mais próxima).
  const nearest = stations.find((s) => s.isNearest) || stations[0];
  if (!nearest) return null;

  const hasValidObserved =
    (nearest.observationState === 'leitura' || nearest.observationState === 'dado_atrasado') &&
    nearest.temperatureC !== null &&
    nearest.temperatureC !== undefined &&
    Number.isFinite(nearest.temperatureC) &&
    Boolean(nearest.observedAtBrt);

  if (!hasValidObserved || !nearest.observedAtBrt) {
    return null;
  }

  // Casa pelo prefixo YYYY-MM-DDTHH em horário de Brasília
  const obsHourPrefix = nearest.observedAtBrt.slice(0, 13);
  let matchedForecast = hourlyForecast.find((pt) => pt.time.slice(0, 13) === obsHourPrefix);

  if (!matchedForecast) {
    const obsMs = new Date(nearest.observedAtBrt).getTime();
    let bestDiff = Infinity;
    for (const pt of hourlyForecast) {
      const ptMs = new Date(pt.time).getTime();
      const diff = Math.abs(ptMs - obsMs);
      if (!Number.isNaN(diff) && diff < bestDiff && diff <= 90 * 60 * 1000) {
        bestDiff = diff;
        matchedForecast = pt;
      }
    }
  }

  if (!matchedForecast) return null;

  const obsTemp = nearest.temperatureC!;
  const obsHi =
    nearest.heatIndexC !== null && nearest.heatIndexC !== undefined
      ? nearest.heatIndexC
      : null;

  return {
    station: nearest,
    observedIsoBrt: nearest.observedAtBrt,
    observedHourLabel: nearest.observedTimeLabel || nearest.observedAtBrt.slice(11, 16),
    observedTempC: obsTemp,
    observedHumidityPercent: nearest.humidityPercent ?? null,
    observedHeatIndexC: obsHi,
    forecastTempC: matchedForecast.temperatureC,
    forecastHumidityPercent: matchedForecast.relativeHumidity,
    forecastHeatIndexC: matchedForecast.heatIndexC,
    tempDiffC: Math.round((obsTemp - matchedForecast.temperatureC) * 10) / 10,
    heatIndexDiffC:
      obsHi !== null
        ? Math.round((obsHi - matchedForecast.heatIndexC) * 10) / 10
        : null,
  };
}
