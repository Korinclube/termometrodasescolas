/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  InmetHourlyObservation,
  InmetObservationState,
  InmetStationsStatusSummary,
  WeatherObservationStation,
} from '../src/types';
import { calculateRothfuszHeatIndex } from '../src/utils/thermalMath';
import {
  INMET_RJ_TARGET_STATIONS,
  INMET_TARGET_CODES,
} from '../src/utils/inmetUtils';

const INMET_BASE_URL = 'https://apitempo.inmet.gov.br';
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hora
const COOLDOWN_MS = 30 * 60 * 1000; // 30 minutos após 401, 403, 404 ou 429
const STALE_THRESHOLD_MS = 3 * 60 * 60 * 1000; // 3 horas
const DEFAULT_TIMEOUT_MS = 6000;
const COOLDOWN_STATUS_CODES = new Set([401, 403, 404, 429]);

const EXPECTED_HOURLY_FIELDS = [
  'DT_MEDICAO',
  'HR_MEDICAO',
  'TEM_INS',
  'TEM_MAX',
  'TEM_MIN',
  'UMD_INS',
] as const;

export interface InmetRawStation {
  CD_ESTACAO?: string;
  DC_NOME?: string;
  SG_ESTADO?: string;
  CD_SITUACAO?: string;
  VL_LATITUDE?: string | number | null;
  VL_LONGITUDE?: string | number | null;
  [key: string]: unknown;
}

export interface InmetRawHourlyRow {
  DT_MEDICAO?: string | null;
  HR_MEDICAO?: string | number | null;
  TEM_INS?: string | number | null;
  TEM_MAX?: string | number | null;
  TEM_MIN?: string | number | null;
  UMD_INS?: string | number | null;
  [key: string]: unknown;
}

export interface InmetHourlyFetchResult {
  code: string;
  observations: InmetHourlyObservation[];
  latestValid: InmetHourlyObservation | null;
  observationState: InmetObservationState;
  schemaValid: boolean;
  missingFields: string[];
  error: string | null;
  fromCache: boolean;
}

export interface InmetDiagnostics {
  tokenPresent: 'sim' | 'não';
  lastSuccessAt: string | null;
  lastError: string | null;
}

export interface InmetStationsResponsePayload {
  stations: WeatherObservationStation[];
  status: InmetStationsStatusSummary;
}

export interface InmetClientDependencies {
  fetchFn?: typeof fetch;
  nowFn?: () => number;
  getTokenFn?: () => string | undefined;
  timeoutMs?: number;
}

interface CacheEntry<T> {
  timestamp: number;
  data: T;
}

/**
 * Mascara qualquer token do INMET em URLs, mensagens de erro ou logs.
 */
export function maskInmetToken(input: string, token?: string): string {
  let masked = String(input || '');
  if (token && token.trim().length > 0) {
    const trimmed = token.trim();
    masked = masked.split(trimmed).join('***');
    const encoded = encodeURIComponent(trimmed);
    if (encoded !== trimmed) {
      masked = masked.split(encoded).join('***');
    }
  }
  masked = masked.replace(
    /(\/token\/estacao\/[^/\s]+\/[^/\s]+\/[^/\s]+\/)([^/\s?#]+)/gi,
    '$1***'
  );
  return masked;
}

/**
 * Parser tolerante para campos numéricos do INMET que chegam como texto, número ou nulo.
 */
export function parseInmetNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (
      trimmed === '' ||
      trimmed.toLowerCase() === 'null' ||
      trimmed.toLowerCase() === 'nan' ||
      trimmed === '-'
    ) {
      return null;
    }
    const normalized = trimmed.replace(',', '.');
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

/**
 * Formata data YYYY-MM-DD no fuso horário de Brasília (America/Sao_Paulo).
 */
export function formatDateBrt(ms: number): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date(ms));

  const year = parts.find((p) => p.type === 'year')?.value ?? '1970';
  const month = parts.find((p) => p.type === 'month')?.value ?? '01';
  const day = parts.find((p) => p.type === 'day')?.value ?? '01';
  return `${year}-${month}-${day}`;
}

/**
 * Converte DT_MEDICAO + HR_MEDICAO (UTC) para data, hora e ISO no horário de Brasília.
 */
export function convertInmetUtcToBrt(
  dtMedicao: unknown,
  hrMedicao: unknown
): { dateBrt: string; hourBrt: string; isoBrt: string; utcMs: number } | null {
  if (typeof dtMedicao !== 'string') return null;
  const datePart = dtMedicao.trim().slice(0, 10);
  const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(datePart);
  if (!dateMatch) return null;

  const year = parseInt(dateMatch[1], 10);
  const month = parseInt(dateMatch[2], 10);
  const day = parseInt(dateMatch[3], 10);

  let hh = 0;
  let mm = 0;
  const hrRaw = String(hrMedicao ?? '').trim();
  if (/^\d{1,4}$/.test(hrRaw)) {
    const padded = hrRaw.padStart(4, '0');
    hh = parseInt(padded.slice(0, 2), 10);
    mm = parseInt(padded.slice(2, 4), 10);
  } else if (/^\d{1,2}:\d{2}/.test(hrRaw)) {
    const [hStr, mStr] = hrRaw.split(':');
    hh = parseInt(hStr, 10);
    mm = parseInt(mStr.slice(0, 2), 10);
  } else {
    return null;
  }

  if (hh < 0 || hh > 23 || mm < 0 || mm > 59) return null;

  const utcMs = Date.UTC(year, month - 1, day, hh, mm, 0, 0);
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date(utcMs));

  const yBrt = parts.find((p) => p.type === 'year')?.value;
  const mBrt = parts.find((p) => p.type === 'month')?.value;
  const dBrt = parts.find((p) => p.type === 'day')?.value;
  const hBrt = parts.find((p) => p.type === 'hour')?.value;
  const minBrt = parts.find((p) => p.type === 'minute')?.value;

  if (!yBrt || !mBrt || !dBrt || !hBrt || !minBrt) return null;

  const dateBrt = `${yBrt}-${mBrt}-${dBrt}`;
  const hourBrt = `${hBrt}:${minBrt}`;
  const isoBrt = `${dateBrt}T${hourBrt}:00-03:00`;

  return { dateBrt, hourBrt, isoBrt, utcMs };
}

/**
 * Valida a presença dos campos esperados na primeira linha real da resposta horária.
 */
export function validateInmetHourlySchema(rows: InmetRawHourlyRow[]): {
  schemaValid: boolean;
  missingFields: string[];
} {
  if (!Array.isArray(rows) || rows.length === 0) {
    return { schemaValid: true, missingFields: [] };
  }
  const firstRow = rows[0];
  if (!firstRow || typeof firstRow !== 'object') {
    return { schemaValid: false, missingFields: [...EXPECTED_HOURLY_FIELDS] };
  }
  const keys = new Set(Object.keys(firstRow));
  const missingFields = EXPECTED_HOURLY_FIELDS.filter((field) => !keys.has(field));
  return {
    schemaValid: missingFields.length === 0,
    missingFields,
  };
}

/**
 * Faz o parse tolerante de uma lista de leituras horárias do INMET.
 * Horas sem dado permanecem com campos nulos (nunca interpoladas).
 */
export function parseInmetHourlyRows(
  rows: InmetRawHourlyRow[],
  nowMs: number
): {
  observations: InmetHourlyObservation[];
  latestValid: InmetHourlyObservation | null;
  observationState: InmetObservationState;
  schemaValid: boolean;
  missingFields: string[];
} {
  const { schemaValid, missingFields } = validateInmetHourlySchema(rows);
  if (!Array.isArray(rows) || rows.length === 0) {
    return {
      observations: [],
      latestValid: null,
      observationState: 'dado_atrasado',
      schemaValid,
      missingFields,
    };
  }

  const parsedEntries: Array<{ obs: InmetHourlyObservation; utcMs: number }> = [];

  for (const row of rows) {
    if (!row || typeof row !== 'object') continue;
    const brt = convertInmetUtcToBrt(row.DT_MEDICAO, row.HR_MEDICAO);
    if (!brt) continue;

    const temperatureC = parseInmetNumber(row.TEM_INS);
    const tempMaxC = parseInmetNumber(row.TEM_MAX);
    const tempMinC = parseInmetNumber(row.TEM_MIN);
    const humidityPercent = parseInmetNumber(row.UMD_INS);

    // Índice de calor observado calculado com a mesma função da previsão
    const heatIndexC =
      temperatureC !== null && humidityPercent !== null
        ? calculateRothfuszHeatIndex(temperatureC, humidityPercent)
        : null;

    parsedEntries.push({
      utcMs: brt.utcMs,
      obs: {
        dateBrt: brt.dateBrt,
        hourBrt: brt.hourBrt,
        isoBrt: brt.isoBrt,
        utcDate: String(row.DT_MEDICAO ?? ''),
        utcHour: String(row.HR_MEDICAO ?? ''),
        temperatureC:
          temperatureC !== null ? Math.round(temperatureC * 10) / 10 : null,
        tempMaxC: tempMaxC !== null ? Math.round(tempMaxC * 10) / 10 : null,
        tempMinC: tempMinC !== null ? Math.round(tempMinC * 10) / 10 : null,
        humidityPercent:
          humidityPercent !== null ? Math.round(humidityPercent) : null,
        heatIndexC: Number.isFinite(heatIndexC) ? heatIndexC : null,
      },
    });
  }

  parsedEntries.sort((a, b) => a.utcMs - b.utcMs);
  const observations = parsedEntries.map((e) => e.obs);

  let latestEntry: { obs: InmetHourlyObservation; utcMs: number } | null = null;
  for (let i = parsedEntries.length - 1; i >= 0; i--) {
    if (parsedEntries[i].obs.temperatureC !== null) {
      latestEntry = parsedEntries[i];
      break;
    }
  }

  if (!latestEntry) {
    return {
      observations,
      latestValid: null,
      observationState: 'dado_atrasado',
      schemaValid,
      missingFields,
    };
  }

  const ageMs = nowMs - latestEntry.utcMs;
  const observationState: InmetObservationState =
    ageMs > STALE_THRESHOLD_MS ? 'dado_atrasado' : 'leitura';

  return {
    observations,
    latestValid: latestEntry.obs,
    observationState,
    schemaValid,
    missingFields,
  };
}

export function createInmetClient(deps: InmetClientDependencies = {}) {
  const fetchFn = deps.fetchFn ?? fetch;
  const nowFn = deps.nowFn ?? (() => Date.now());
  const getTokenFn = deps.getTokenFn ?? (() => process.env.INMET_TOKEN);
  const timeoutMs = deps.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  let stationsCache: CacheEntry<{
    stations: WeatherObservationStation[];
    liveFetched: boolean;
  }> | null = null;
  const hourlyCache = new Map<string, CacheEntry<InmetHourlyFetchResult>>();

  // Cooldown de 30 min para 401/403/429 (global de token) e 404 (por estação)
  let authCooldownUntil = 0;
  const stationCooldownUntil = new Map<string, number>();

  let lastSuccessAt: string | null = null;
  let lastError: string | null = null;

  function getConfiguredToken(): string | null {
    const raw = getTokenFn();
    if (!raw) return null;
    const trimmed = raw.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  function recordError(message: string, token?: string | null) {
    lastError = maskInmetToken(message, token ?? undefined);
  }

  function recordSuccess() {
    lastSuccessAt = new Date(nowFn()).toISOString();
    lastError = null;
  }

  /**
   * Busca as estações automáticas reais do INMET em RJ (sem precisar de token).
   */
  async function fetchStationsRJ(): Promise<{
    stations: WeatherObservationStation[];
    liveFetched: boolean;
    error: string | null;
  }> {
    const now = nowFn();
    if (stationsCache && now - stationsCache.timestamp < CACHE_TTL_MS) {
      return {
        stations: stationsCache.data.stations.map((s) => ({ ...s })),
        liveFetched: stationsCache.data.liveFetched,
        error: null,
      };
    }

    const token = getConfiguredToken();
    try {
      const url = `${INMET_BASE_URL}/estacoes/T`;
      const response = await fetchFn(url, {
        signal: AbortSignal.timeout(timeoutMs),
      });

      if (!response.ok) {
        throw new Error(`INMET /estacoes/T HTTP ${response.status}`);
      }

      const rawList = (await response.json()) as InmetRawStation[];
      if (!Array.isArray(rawList)) {
        throw new Error('Formato inesperado na lista de estações do INMET');
      }

      const rjByCode = new Map<string, InmetRawStation>();
      for (const item of rawList) {
        if (!item || typeof item !== 'object') continue;
        const state = String(item.SG_ESTADO ?? '').trim().toUpperCase();
        const code = String(item.CD_ESTACAO ?? '').trim().toUpperCase();
        if (state === 'RJ' && INMET_TARGET_CODES.has(code)) {
          rjByCode.set(code, item);
        }
      }

      const mapped: WeatherObservationStation[] = INMET_RJ_TARGET_STATIONS.map(
        (meta) => {
          const raw = rjByCode.get(meta.code);
          const lat = raw ? parseInmetNumber(raw.VL_LATITUDE) : null;
          const lon = raw ? parseInmetNumber(raw.VL_LONGITUDE) : null;
          const rawSituacao = raw
            ? String(raw.CD_SITUACAO ?? '').trim().toLowerCase()
            : '';
          const isPane = rawSituacao.includes('pane');

          const observationState: InmetObservationState = isPane
            ? 'estacao_em_pane'
            : token
            ? 'dado_atrasado'
            : 'aguardando_token';

          return {
            id: `inmet-${meta.code.toLowerCase()}`,
            stationCode: meta.code,
            name: `${meta.shortName} (${meta.code})`,
            network: 'INMET',
            latitude: lat ?? meta.defaultLatitude,
            longitude: lon ?? meta.defaultLongitude,
            lastUpdated: null,
            temperatureC: null,
            tempMaxC: null,
            tempMinC: null,
            humidityPercent: null,
            heatIndexC: null,
            status: isPane ? 'manutencao' : 'operante',
            observationState,
            observedAtBrt: null,
            observedTimeLabel: null,
            hourlyObservations: [],
            maintenanceNotice: isPane
              ? 'Situação reportada pelo INMET: estação em pane.'
              : undefined,
          };
        }
      );

      stationsCache = {
        timestamp: now,
        data: { stations: mapped, liveFetched: true },
      };

      return {
        stations: mapped.map((s) => ({ ...s })),
        liveFetched: true,
        error: null,
      };
    } catch (err: unknown) {
      const rawMessage = err instanceof Error ? err.message : String(err);
      const safeError = maskInmetToken(rawMessage, token ?? undefined);
      recordError(safeError, token);

      const fallbackStations: WeatherObservationStation[] =
        INMET_RJ_TARGET_STATIONS.map((meta) => ({
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
          observationState: 'inmet_indisponivel',
          observedAtBrt: null,
          observedTimeLabel: null,
          hourlyObservations: [],
        }));

      return {
        stations: fallbackStations,
        liveFetched: false,
        error: safeError,
      };
    }
  }

  /**
   * Busca leituras horárias para uma estação e período no INMET.
   * Rota esperada: /token/estacao/{inicio}/{fim}/{codigo}/{token}
   */
  async function fetchHourlyStationReadings(
    stationCode: string,
    startDate: string,
    endDate: string
  ): Promise<InmetHourlyFetchResult> {
    const code = stationCode.trim().toUpperCase();
    const token = getConfiguredToken();
    const now = nowFn();

    if (!token) {
      return {
        code,
        observations: [],
        latestValid: null,
        observationState: 'aguardando_token',
        schemaValid: true,
        missingFields: [],
        error: null,
        fromCache: false,
      };
    }

    const cacheKey = `${code}:${startDate}:${endDate}`;
    const cached = hourlyCache.get(cacheKey);
    if (cached && now - cached.timestamp < CACHE_TTL_MS) {
      return {
        ...cached.data,
        fromCache: true,
      };
    }

    const stationCooldown = stationCooldownUntil.get(code) ?? 0;
    if (now < authCooldownUntil || now < stationCooldown) {
      return {
        code,
        observations: [],
        latestValid: null,
        observationState: 'inmet_indisponivel',
        schemaValid: true,
        missingFields: [],
        error:
          lastError ||
          'Aguardando janela de espera de 30 minutos após erro do INMET.',
        fromCache: false,
      };
    }

    const url = `${INMET_BASE_URL}/token/estacao/${startDate}/${endDate}/${code}/${encodeURIComponent(
      token
    )}`;

    try {
      const response = await fetchFn(url, {
        signal: AbortSignal.timeout(timeoutMs),
      });

      if (!response.ok) {
        if (COOLDOWN_STATUS_CODES.has(response.status)) {
          if (response.status === 404) {
            stationCooldownUntil.set(code, now + COOLDOWN_MS);
          } else {
            authCooldownUntil = now + COOLDOWN_MS;
          }
        }
        throw new Error(`INMET HTTP ${response.status} ao consultar estação ${code}`);
      }

      const rawJson = (await response.json()) as unknown;
      if (!Array.isArray(rawJson)) {
        throw new Error(`Resposta inesperada do INMET para estação ${code}`);
      }

      const parsed = parseInmetHourlyRows(rawJson as InmetRawHourlyRow[], now);
      recordSuccess();

      const result: InmetHourlyFetchResult = {
        code,
        observations: parsed.observations,
        latestValid: parsed.latestValid,
        observationState: parsed.observationState,
        schemaValid: parsed.schemaValid,
        missingFields: parsed.missingFields,
        error: null,
        fromCache: false,
      };

      hourlyCache.set(cacheKey, { timestamp: now, data: result });
      return result;
    } catch (err: unknown) {
      const rawMsg = err instanceof Error ? err.message : String(err);
      const safeError = maskInmetToken(rawMsg, token);
      recordError(safeError, token);
      console.warn(`[INMET]: ${safeError}`);

      return {
        code,
        observations: [],
        latestValid: null,
        observationState: 'inmet_indisponivel',
        schemaValid: true,
        missingFields: [],
        error: safeError,
        fromCache: false,
      };
    }
  }

  /**
   * Retorna o conjunto completo das 7 estações RJ com o estado atualizado e leituras (quando houver token).
   */
  async function getStationsWithObservations(): Promise<InmetStationsResponsePayload> {
    const now = nowFn();
    const token = getConfiguredToken();
    const { stations, liveFetched, error: stationsError } = await fetchStationsRJ();

    if (!token) {
      const summaryMessage = liveFetched
        ? 'Lista de estações ativa, leituras horárias aguardando token.'
        : 'INMET indisponível agora; exibindo coordenadas de referência sem leituras.';

      return {
        stations,
        status: {
          stationListActive: liveFetched,
          tokenConfigured: false,
          inmetAvailable: liveFetched,
          fetchedAt: new Date(now).toISOString(),
          summaryMessage,
          lastError: stationsError ?? lastError,
        },
      };
    }

    const endDate = formatDateBrt(now);
    const startDate = formatDateBrt(now - 24 * 60 * 60 * 1000);

    const enrichedStations = await Promise.all(
      stations.map(async (st) => {
        if (st.status === 'manutencao') {
          return {
            ...st,
            observationState: 'estacao_em_pane' as InmetObservationState,
          };
        }

        const hourlyRes = await fetchHourlyStationReadings(
          st.stationCode || st.id,
          startDate,
          endDate
        );

        if (hourlyRes.error) {
          return {
            ...st,
            observationState: 'inmet_indisponivel' as InmetObservationState,
            hourlyObservations: [],
          };
        }

        const latest = hourlyRes.latestValid;
        return {
          ...st,
          temperatureC: latest?.temperatureC ?? null,
          tempMaxC: latest?.tempMaxC ?? null,
          tempMinC: latest?.tempMinC ?? null,
          humidityPercent: latest?.humidityPercent ?? null,
          heatIndexC: latest?.heatIndexC ?? null,
          lastUpdated: latest?.isoBrt ?? null,
          observedAtBrt: latest?.isoBrt ?? null,
          observedTimeLabel: latest?.hourBrt ?? null,
          observationState: hourlyRes.observationState,
          hourlyObservations: hourlyRes.observations,
        };
      })
    );

    const anyLiveReading = enrichedStations.some(
      (s) => s.observationState === 'leitura' || s.observationState === 'dado_atrasado'
    );
    const allUnavailable = enrichedStations.every(
      (s) => s.observationState === 'inmet_indisponivel'
    );

    const summaryMessage = allUnavailable
      ? 'INMET indisponível no momento; exibindo cadastro de referência sem leituras.'
      : anyLiveReading
      ? 'Lista de estações e leituras horárias do INMET ativas.'
      : 'Lista de estações ativa; aguardando novas leituras horárias do INMET.';

    return {
      stations: enrichedStations,
      status: {
        stationListActive: liveFetched,
        tokenConfigured: true,
        inmetAvailable: !allUnavailable,
        fetchedAt: new Date(now).toISOString(),
        summaryMessage,
        lastError,
      },
    };
  }

  function getDiagnostics(): InmetDiagnostics {
    return {
      tokenPresent: getConfiguredToken() ? 'sim' : 'não',
      lastSuccessAt,
      lastError,
    };
  }

  return {
    fetchStationsRJ,
    fetchHourlyStationReadings,
    getStationsWithObservations,
    getDiagnostics,
  };
}

export const defaultInmetClient = createInmetClient();
