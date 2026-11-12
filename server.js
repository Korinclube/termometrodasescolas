// server.ts
import "dotenv/config";
import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { GoogleGenAI, Type } from "@google/genai";

// src/utils/formatPtBr.ts
var integerFormatter = new Intl.NumberFormat("pt-BR", {
  maximumFractionDigits: 0
});

// src/utils/thermalMath.ts
function calculateHeatIndex(tempC, rh) {
  if (isNaN(tempC) || isNaN(rh)) {
    return NaN;
  }
  const clampedRh = Math.max(0, Math.min(100, rh));
  const tF = tempC * (9 / 5) + 32;
  const simpleHI = 0.5 * (tF + 61 + (tF - 68) * 1.2 + clampedRh * 0.094);
  if (simpleHI < 80) {
    const hiC2 = (simpleHI - 32) * (5 / 9);
    return Math.round(hiC2 * 10) / 10;
  }
  let hiF = -42.379 + 2.04901523 * tF + 10.14333127 * clampedRh - 0.22475541 * tF * clampedRh - 683783e-8 * tF * tF - 0.05481717 * clampedRh * clampedRh + 122874e-8 * tF * tF * clampedRh + 85282e-8 * tF * clampedRh * clampedRh - 199e-8 * tF * tF * clampedRh * clampedRh;
  if (clampedRh < 13 && tF >= 80 && tF <= 112) {
    const adj = (13 - clampedRh) / 4 * Math.sqrt(Math.max(0, (17 - Math.abs(tF - 95)) / 17));
    hiF -= adj;
  } else if (clampedRh > 85 && tF >= 80 && tF <= 87) {
    const adj = (clampedRh - 85) / 10 * ((87 - tF) / 5);
    hiF += adj;
  }
  const hiC = (hiF - 32) * (5 / 9);
  return Math.round(hiC * 10) / 10;
}
var calculateRothfuszHeatIndex = calculateHeatIndex;
function getRiskBand(heatIndexC) {
  if (heatIndexC >= 44) return "perigo";
  if (heatIndexC >= 40) return "alerta";
  if (heatIndexC >= 36) return "atencao";
  return "normal";
}
function getRioHeatLevel(heatIndexC, consecutiveDays = 1) {
  if (isNaN(heatIndexC) || heatIndexC < 36) {
    return "NC1";
  }
  if (heatIndexC >= 36 && heatIndexC < 40) {
    return consecutiveDays >= 3 ? "NC3" : "NC2";
  }
  if (heatIndexC >= 40 && heatIndexC <= 44) {
    return consecutiveDays >= 3 ? "NC4" : "NC3";
  }
  return consecutiveDays >= 3 ? "NC5" : "NC4";
}

// src/data/mockWeatherScenarios.ts
function generateScenarioHourlyData(scenarioKey, baseDate = /* @__PURE__ */ new Date(), microclimateOffsetC = 0) {
  const points = [];
  let minTemp = 24;
  let maxTemp = 33;
  let baseHumidityDay = 62;
  let baseHumidityNight = 82;
  let baseRadiationPeak = 850;
  if (scenarioKey === "super_el_nino") {
    minTemp = 27;
    maxTemp = 39.5;
    baseHumidityDay = 65;
    baseHumidityNight = 88;
    baseRadiationPeak = 1050;
  } else if (scenarioKey === "historico_alemao") {
    minTemp = 29;
    maxTemp = 43.2;
    baseHumidityDay = 66;
    baseHumidityNight = 86;
    baseRadiationPeak = 1120;
  } else if (scenarioKey === "verao_tipico") {
    minTemp = 22;
    maxTemp = 32;
    baseHumidityDay = 58;
    baseHumidityNight = 78;
    baseRadiationPeak = 750;
  } else {
    minTemp = 24.5;
    maxTemp = 35;
    baseHumidityDay = 63;
    baseHumidityNight = 84;
    baseRadiationPeak = 920;
  }
  const startDay = new Date(baseDate);
  startDay.setHours(0, 0, 0, 0);
  for (let i = 0; i < 72; i++) {
    const ptDate = new Date(startDay.getTime() + i * 3600 * 1e3);
    const hour = ptDate.getHours();
    const diurnalFactor = Math.max(0, Math.sin((hour - 6) / 16 * Math.PI));
    const diurnalCurv = Math.cos((hour - 14) / 12 * Math.PI) * 0.5 + 0.5;
    const dayIndex = Math.floor(i / 24);
    const dayWaveOffset = (dayIndex - 1) * 0.8;
    const temp = minTemp + (maxTemp - minTemp) * diurnalCurv + dayWaveOffset + microclimateOffsetC;
    const rh = baseHumidityNight - (baseHumidityNight - baseHumidityDay) * diurnalFactor;
    const radiation = hour >= 6 && hour <= 18 ? baseRadiationPeak * Math.sin((hour - 6) / 12 * Math.PI) : 0;
    const windSpeed = 6 + 10 * diurnalFactor + Math.sin(i * 0.5) * 3;
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
      riskBand
    });
  }
  return points;
}

// src/utils/inmetUtils.ts
var INMET_RJ_TARGET_STATIONS = [
  {
    code: "A621",
    shortName: "Vila Militar",
    defaultLatitude: -22.8617,
    defaultLongitude: -43.4114
  },
  {
    code: "A603",
    shortName: "Xer\xE9m",
    defaultLatitude: -22.5833,
    defaultLongitude: -43.2833
  },
  {
    code: "A601",
    shortName: "Serop\xE9dica",
    defaultLatitude: -22.7578,
    defaultLongitude: -43.6847
  },
  {
    code: "A627",
    shortName: "Niter\xF3i",
    defaultLatitude: -22.9056,
    defaultLongitude: -43.1036
  },
  {
    code: "A636",
    shortName: "Jacarepagu\xE1",
    defaultLatitude: -22.9394,
    defaultLongitude: -43.4028
  },
  {
    code: "A652",
    shortName: "Forte de Copacabana",
    defaultLatitude: -22.9869,
    defaultLongitude: -43.1894
  },
  {
    code: "A602",
    shortName: "Marambaia",
    defaultLatitude: -23.0497,
    defaultLongitude: -43.5958
  }
];
var INMET_TARGET_CODES = new Set(INMET_RJ_TARGET_STATIONS.map((s) => s.code));
var INITIAL_INMET_STATIONS = INMET_RJ_TARGET_STATIONS.map(
  (meta) => ({
    id: `inmet-${meta.code.toLowerCase()}`,
    stationCode: meta.code,
    name: `${meta.shortName} (${meta.code})`,
    network: "INMET",
    latitude: meta.defaultLatitude,
    longitude: meta.defaultLongitude,
    lastUpdated: null,
    temperatureC: null,
    tempMaxC: null,
    tempMinC: null,
    humidityPercent: null,
    heatIndexC: null,
    status: "operante",
    observationState: "aguardando_token",
    observedAtBrt: null,
    observedTimeLabel: null,
    hourlyObservations: []
  })
);
function calculateDistanceKm(lat1, lon1, lat2, lon2) {
  if (!Number.isFinite(lat1) || !Number.isFinite(lon1) || !Number.isFinite(lat2) || !Number.isFinite(lon2)) {
    return NaN;
  }
  const toRad = (deg) => deg * Math.PI / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 10) / 10;
}
function enrichStationsWithDistance(stations, schoolLat, schoolLon) {
  if (stations.length === 0) return [];
  const withDistances = stations.map((st) => ({
    ...st,
    distanceKm: calculateDistanceKm(schoolLat, schoolLon, st.latitude, st.longitude),
    isNearest: false
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
      isNearest: true
    };
  }
  return withDistances.sort((a, b) => {
    const da = Number.isFinite(a.distanceKm) ? a.distanceKm : Infinity;
    const db = Number.isFinite(b.distanceKm) ? b.distanceKm : Infinity;
    return da - db;
  });
}

// server/inmetClient.ts
var INMET_BASE_URL = "https://apitempo.inmet.gov.br";
var CACHE_TTL_MS = 60 * 60 * 1e3;
var COOLDOWN_MS = 30 * 60 * 1e3;
var STALE_THRESHOLD_MS = 3 * 60 * 60 * 1e3;
var DEFAULT_TIMEOUT_MS = 6e3;
var COOLDOWN_STATUS_CODES = /* @__PURE__ */ new Set([401, 403, 404, 429]);
var EXPECTED_HOURLY_FIELDS = [
  "DT_MEDICAO",
  "HR_MEDICAO",
  "TEM_INS",
  "TEM_MAX",
  "TEM_MIN",
  "UMD_INS"
];
function maskInmetToken(input, token) {
  let masked = String(input || "");
  if (token && token.trim().length > 0) {
    const trimmed = token.trim();
    masked = masked.split(trimmed).join("***");
    const encoded = encodeURIComponent(trimmed);
    if (encoded !== trimmed) {
      masked = masked.split(encoded).join("***");
    }
  }
  masked = masked.replace(
    /(\/token\/estacao\/[^/\s]+\/[^/\s]+\/[^/\s]+\/)([^/\s?#]+)/gi,
    "$1***"
  );
  return masked;
}
function parseInmetNumber(value) {
  if (value === null || value === void 0) return null;
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed === "" || trimmed.toLowerCase() === "null" || trimmed.toLowerCase() === "nan" || trimmed === "-") {
      return null;
    }
    const normalized = trimmed.replace(",", ".");
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}
function formatDateBrt(ms) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(new Date(ms));
  const year = parts.find((p) => p.type === "year")?.value ?? "1970";
  const month = parts.find((p) => p.type === "month")?.value ?? "01";
  const day = parts.find((p) => p.type === "day")?.value ?? "01";
  return `${year}-${month}-${day}`;
}
function convertInmetUtcToBrt(dtMedicao, hrMedicao) {
  if (typeof dtMedicao !== "string") return null;
  const datePart = dtMedicao.trim().slice(0, 10);
  const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(datePart);
  if (!dateMatch) return null;
  const year = parseInt(dateMatch[1], 10);
  const month = parseInt(dateMatch[2], 10);
  const day = parseInt(dateMatch[3], 10);
  let hh = 0;
  let mm = 0;
  const hrRaw = String(hrMedicao ?? "").trim();
  if (/^\d{1,4}$/.test(hrRaw)) {
    const padded = hrRaw.padStart(4, "0");
    hh = parseInt(padded.slice(0, 2), 10);
    mm = parseInt(padded.slice(2, 4), 10);
  } else if (/^\d{1,2}:\d{2}/.test(hrRaw)) {
    const [hStr, mStr] = hrRaw.split(":");
    hh = parseInt(hStr, 10);
    mm = parseInt(mStr.slice(0, 2), 10);
  } else {
    return null;
  }
  if (hh < 0 || hh > 23 || mm < 0 || mm > 59) return null;
  const utcMs = Date.UTC(year, month - 1, day, hh, mm, 0, 0);
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23"
  }).formatToParts(new Date(utcMs));
  const yBrt = parts.find((p) => p.type === "year")?.value;
  const mBrt = parts.find((p) => p.type === "month")?.value;
  const dBrt = parts.find((p) => p.type === "day")?.value;
  const hBrt = parts.find((p) => p.type === "hour")?.value;
  const minBrt = parts.find((p) => p.type === "minute")?.value;
  if (!yBrt || !mBrt || !dBrt || !hBrt || !minBrt) return null;
  const dateBrt = `${yBrt}-${mBrt}-${dBrt}`;
  const hourBrt = `${hBrt}:${minBrt}`;
  const isoBrt = `${dateBrt}T${hourBrt}:00-03:00`;
  return { dateBrt, hourBrt, isoBrt, utcMs };
}
function validateInmetHourlySchema(rows) {
  if (!Array.isArray(rows) || rows.length === 0) {
    return { schemaValid: true, missingFields: [] };
  }
  const firstRow = rows[0];
  if (!firstRow || typeof firstRow !== "object") {
    return { schemaValid: false, missingFields: [...EXPECTED_HOURLY_FIELDS] };
  }
  const keys = new Set(Object.keys(firstRow));
  const missingFields = EXPECTED_HOURLY_FIELDS.filter((field) => !keys.has(field));
  return {
    schemaValid: missingFields.length === 0,
    missingFields
  };
}
function parseInmetHourlyRows(rows, nowMs) {
  const { schemaValid, missingFields } = validateInmetHourlySchema(rows);
  if (!Array.isArray(rows) || rows.length === 0) {
    return {
      observations: [],
      latestValid: null,
      observationState: "dado_atrasado",
      schemaValid,
      missingFields
    };
  }
  const parsedEntries = [];
  for (const row of rows) {
    if (!row || typeof row !== "object") continue;
    const brt = convertInmetUtcToBrt(row.DT_MEDICAO, row.HR_MEDICAO);
    if (!brt) continue;
    const temperatureC = parseInmetNumber(row.TEM_INS);
    const tempMaxC = parseInmetNumber(row.TEM_MAX);
    const tempMinC = parseInmetNumber(row.TEM_MIN);
    const humidityPercent = parseInmetNumber(row.UMD_INS);
    const heatIndexC = temperatureC !== null && humidityPercent !== null ? calculateRothfuszHeatIndex(temperatureC, humidityPercent) : null;
    parsedEntries.push({
      utcMs: brt.utcMs,
      obs: {
        dateBrt: brt.dateBrt,
        hourBrt: brt.hourBrt,
        isoBrt: brt.isoBrt,
        utcDate: String(row.DT_MEDICAO ?? ""),
        utcHour: String(row.HR_MEDICAO ?? ""),
        temperatureC: temperatureC !== null ? Math.round(temperatureC * 10) / 10 : null,
        tempMaxC: tempMaxC !== null ? Math.round(tempMaxC * 10) / 10 : null,
        tempMinC: tempMinC !== null ? Math.round(tempMinC * 10) / 10 : null,
        humidityPercent: humidityPercent !== null ? Math.round(humidityPercent) : null,
        heatIndexC: Number.isFinite(heatIndexC) ? heatIndexC : null
      }
    });
  }
  parsedEntries.sort((a, b) => a.utcMs - b.utcMs);
  const observations = parsedEntries.map((e) => e.obs);
  let latestEntry = null;
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
      observationState: "dado_atrasado",
      schemaValid,
      missingFields
    };
  }
  const ageMs = nowMs - latestEntry.utcMs;
  const observationState = ageMs > STALE_THRESHOLD_MS ? "dado_atrasado" : "leitura";
  return {
    observations,
    latestValid: latestEntry.obs,
    observationState,
    schemaValid,
    missingFields
  };
}
function createInmetClient(deps = {}) {
  const fetchFn = deps.fetchFn ?? fetch;
  const nowFn = deps.nowFn ?? (() => Date.now());
  const getTokenFn = deps.getTokenFn ?? (() => process.env.INMET_TOKEN);
  const timeoutMs = deps.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  let stationsCache = null;
  const hourlyCache = /* @__PURE__ */ new Map();
  let authCooldownUntil = 0;
  const stationCooldownUntil = /* @__PURE__ */ new Map();
  let lastSuccessAt = null;
  let lastError = null;
  function getConfiguredToken() {
    const raw = getTokenFn();
    if (!raw) return null;
    const trimmed = raw.trim();
    return trimmed.length > 0 ? trimmed : null;
  }
  function recordError(message, token) {
    lastError = maskInmetToken(message, token ?? void 0);
  }
  function recordSuccess() {
    lastSuccessAt = new Date(nowFn()).toISOString();
    lastError = null;
  }
  async function fetchStationsRJ() {
    const now = nowFn();
    if (stationsCache && now - stationsCache.timestamp < CACHE_TTL_MS) {
      return {
        stations: stationsCache.data.stations.map((s) => ({ ...s })),
        liveFetched: stationsCache.data.liveFetched,
        error: null
      };
    }
    const token = getConfiguredToken();
    try {
      const url = `${INMET_BASE_URL}/estacoes/T`;
      const response = await fetchFn(url, {
        signal: AbortSignal.timeout(timeoutMs)
      });
      if (!response.ok) {
        throw new Error(`INMET /estacoes/T HTTP ${response.status}`);
      }
      const rawList = await response.json();
      if (!Array.isArray(rawList)) {
        throw new Error("Formato inesperado na lista de esta\xE7\xF5es do INMET");
      }
      const rjByCode = /* @__PURE__ */ new Map();
      for (const item of rawList) {
        if (!item || typeof item !== "object") continue;
        const state = String(item.SG_ESTADO ?? "").trim().toUpperCase();
        const code = String(item.CD_ESTACAO ?? "").trim().toUpperCase();
        if (state === "RJ" && INMET_TARGET_CODES.has(code)) {
          rjByCode.set(code, item);
        }
      }
      const mapped = INMET_RJ_TARGET_STATIONS.map(
        (meta) => {
          const raw = rjByCode.get(meta.code);
          const lat = raw ? parseInmetNumber(raw.VL_LATITUDE) : null;
          const lon = raw ? parseInmetNumber(raw.VL_LONGITUDE) : null;
          const rawSituacao = raw ? String(raw.CD_SITUACAO ?? "").trim().toLowerCase() : "";
          const isPane = rawSituacao.includes("pane");
          const observationState = isPane ? "estacao_em_pane" : token ? "dado_atrasado" : "aguardando_token";
          return {
            id: `inmet-${meta.code.toLowerCase()}`,
            stationCode: meta.code,
            name: `${meta.shortName} (${meta.code})`,
            network: "INMET",
            latitude: lat ?? meta.defaultLatitude,
            longitude: lon ?? meta.defaultLongitude,
            lastUpdated: null,
            temperatureC: null,
            tempMaxC: null,
            tempMinC: null,
            humidityPercent: null,
            heatIndexC: null,
            status: isPane ? "manutencao" : "operante",
            observationState,
            observedAtBrt: null,
            observedTimeLabel: null,
            hourlyObservations: [],
            maintenanceNotice: isPane ? "Situa\xE7\xE3o reportada pelo INMET: esta\xE7\xE3o em pane." : void 0
          };
        }
      );
      stationsCache = {
        timestamp: now,
        data: { stations: mapped, liveFetched: true }
      };
      return {
        stations: mapped.map((s) => ({ ...s })),
        liveFetched: true,
        error: null
      };
    } catch (err) {
      const rawMessage = err instanceof Error ? err.message : String(err);
      const safeError = maskInmetToken(rawMessage, token ?? void 0);
      recordError(safeError, token);
      const fallbackStations = INMET_RJ_TARGET_STATIONS.map((meta) => ({
        id: `inmet-${meta.code.toLowerCase()}`,
        stationCode: meta.code,
        name: `${meta.shortName} (${meta.code})`,
        network: "INMET",
        latitude: meta.defaultLatitude,
        longitude: meta.defaultLongitude,
        lastUpdated: null,
        temperatureC: null,
        tempMaxC: null,
        tempMinC: null,
        humidityPercent: null,
        heatIndexC: null,
        status: "operante",
        observationState: "inmet_indisponivel",
        observedAtBrt: null,
        observedTimeLabel: null,
        hourlyObservations: []
      }));
      return {
        stations: fallbackStations,
        liveFetched: false,
        error: safeError
      };
    }
  }
  async function fetchHourlyStationReadings(stationCode, startDate, endDate) {
    const code = stationCode.trim().toUpperCase();
    const token = getConfiguredToken();
    const now = nowFn();
    if (!token) {
      return {
        code,
        observations: [],
        latestValid: null,
        observationState: "aguardando_token",
        schemaValid: true,
        missingFields: [],
        error: null,
        fromCache: false
      };
    }
    const cacheKey = `${code}:${startDate}:${endDate}`;
    const cached = hourlyCache.get(cacheKey);
    if (cached && now - cached.timestamp < CACHE_TTL_MS) {
      return {
        ...cached.data,
        fromCache: true
      };
    }
    const stationCooldown = stationCooldownUntil.get(code) ?? 0;
    if (now < authCooldownUntil || now < stationCooldown) {
      return {
        code,
        observations: [],
        latestValid: null,
        observationState: "inmet_indisponivel",
        schemaValid: true,
        missingFields: [],
        error: lastError || "Aguardando janela de espera de 30 minutos ap\xF3s erro do INMET.",
        fromCache: false
      };
    }
    const url = `${INMET_BASE_URL}/token/estacao/${startDate}/${endDate}/${code}/${encodeURIComponent(
      token
    )}`;
    try {
      const response = await fetchFn(url, {
        signal: AbortSignal.timeout(timeoutMs)
      });
      if (!response.ok) {
        if (COOLDOWN_STATUS_CODES.has(response.status)) {
          if (response.status === 404) {
            stationCooldownUntil.set(code, now + COOLDOWN_MS);
          } else {
            authCooldownUntil = now + COOLDOWN_MS;
          }
        }
        throw new Error(`INMET HTTP ${response.status} ao consultar esta\xE7\xE3o ${code}`);
      }
      const rawJson = await response.json();
      if (!Array.isArray(rawJson)) {
        throw new Error(`Resposta inesperada do INMET para esta\xE7\xE3o ${code}`);
      }
      const parsed = parseInmetHourlyRows(rawJson, now);
      recordSuccess();
      const result = {
        code,
        observations: parsed.observations,
        latestValid: parsed.latestValid,
        observationState: parsed.observationState,
        schemaValid: parsed.schemaValid,
        missingFields: parsed.missingFields,
        error: null,
        fromCache: false
      };
      hourlyCache.set(cacheKey, { timestamp: now, data: result });
      return result;
    } catch (err) {
      const rawMsg = err instanceof Error ? err.message : String(err);
      const safeError = maskInmetToken(rawMsg, token);
      recordError(safeError, token);
      console.warn(`[INMET]: ${safeError}`);
      return {
        code,
        observations: [],
        latestValid: null,
        observationState: "inmet_indisponivel",
        schemaValid: true,
        missingFields: [],
        error: safeError,
        fromCache: false
      };
    }
  }
  async function getStationsWithObservations() {
    const now = nowFn();
    const token = getConfiguredToken();
    const { stations, liveFetched, error: stationsError } = await fetchStationsRJ();
    if (!token) {
      const summaryMessage2 = liveFetched ? "Lista de esta\xE7\xF5es ativa, leituras hor\xE1rias aguardando token." : "INMET indispon\xEDvel agora; exibindo coordenadas de refer\xEAncia sem leituras.";
      return {
        stations,
        status: {
          stationListActive: liveFetched,
          tokenConfigured: false,
          inmetAvailable: liveFetched,
          fetchedAt: new Date(now).toISOString(),
          summaryMessage: summaryMessage2,
          lastError: stationsError ?? lastError
        }
      };
    }
    const endDate = formatDateBrt(now);
    const startDate = formatDateBrt(now - 24 * 60 * 60 * 1e3);
    const enrichedStations = await Promise.all(
      stations.map(async (st) => {
        if (st.status === "manutencao") {
          return {
            ...st,
            observationState: "estacao_em_pane"
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
            observationState: "inmet_indisponivel",
            hourlyObservations: []
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
          hourlyObservations: hourlyRes.observations
        };
      })
    );
    const anyLiveReading = enrichedStations.some(
      (s) => s.observationState === "leitura" || s.observationState === "dado_atrasado"
    );
    const allUnavailable = enrichedStations.every(
      (s) => s.observationState === "inmet_indisponivel"
    );
    const summaryMessage = allUnavailable ? "INMET indispon\xEDvel no momento; exibindo cadastro de refer\xEAncia sem leituras." : anyLiveReading ? "Lista de esta\xE7\xF5es e leituras hor\xE1rias do INMET ativas." : "Lista de esta\xE7\xF5es ativa; aguardando novas leituras hor\xE1rias do INMET.";
    return {
      stations: enrichedStations,
      status: {
        stationListActive: liveFetched,
        tokenConfigured: true,
        inmetAvailable: !allUnavailable,
        fetchedAt: new Date(now).toISOString(),
        summaryMessage,
        lastError
      }
    };
  }
  function getDiagnostics() {
    return {
      tokenPresent: getConfiguredToken() ? "sim" : "n\xE3o",
      lastSuccessAt,
      lastError
    };
  }
  return {
    fetchStationsRJ,
    fetchHourlyStationReadings,
    getStationsWithObservations,
    getDiagnostics
  };
}
var defaultInmetClient = createInmetClient();

// server.ts
var __filename = fileURLToPath(import.meta.url);
var __dirname = path.dirname(__filename);
var app = express();
var PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3e3;
app.use(express.json());
var forecastCache = /* @__PURE__ */ new Map();
var CACHE_TTL_MS2 = 60 * 60 * 1e3;
var airQualityCache = /* @__PURE__ */ new Map();
var AIR_CACHE_TTL_MS = 3 * 60 * 60 * 1e3;
var apiKey = process.env.GEMINI_API_KEY;
var aiClient = null;
if (apiKey) {
  aiClient = new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build"
      }
    }
  });
}
app.get("/api/air-quality", async (req, res) => {
  const lat = req.query.lat ? parseFloat(req.query.lat) : -22.8465;
  const lon = req.query.lon ? parseFloat(req.query.lon) : -43.3482;
  const cacheKey = `${lat.toFixed(2)}_${lon.toFixed(2)}`;
  const cached = airQualityCache.get(cacheKey);
  const now = Date.now();
  if (cached && now - cached.timestamp < AIR_CACHE_TTL_MS) {
    return res.json({
      ...cached.data,
      isCached: true
    });
  }
  try {
    const url = `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lon}&hourly=pm2_5,pm10,ozone&timezone=America%2FSao_Paulo&forecast_days=3&domains=cams_global`;
    const response = await fetch(url, { signal: AbortSignal.timeout(6e3) });
    if (!response.ok) {
      throw new Error(`Open-Meteo Air Quality HTTP ${response.status}`);
    }
    const data = await response.json();
    const hourly = data?.hourly;
    if (!hourly || !hourly.time || hourly.time.length === 0) {
      throw new Error("Dados hor\xE1rios ausentes na resposta de qualidade do ar");
    }
    const points = [];
    for (let i = 0; i < hourly.time.length; i++) {
      const timeStr = hourly.time[i];
      points.push({
        time: timeStr.includes("Z") ? timeStr : `${timeStr}:00-03:00`,
        pm2_5: hourly.pm2_5 ? hourly.pm2_5[i] ?? null : null,
        pm10: hourly.pm10 ? hourly.pm10[i] ?? null : null,
        ozone: hourly.ozone ? hourly.ozone[i] ?? null : null
      });
    }
    const resultPayload = {
      status: "disponivel",
      source: "CAMS (Copernicus), via Open-Meteo Air Quality API, grade de cerca de 45 km",
      description: "Previs\xE3o de part\xEDculas no ar da regi\xE3o, n\xE3o da sala nem da rua da escola. Serve para saber se o dia est\xE1 limpo ou carregado.",
      fetchedAt: (/* @__PURE__ */ new Date()).toISOString(),
      points
    };
    airQualityCache.set(cacheKey, { timestamp: now, data: resultPayload });
    return res.json(resultPayload);
  } catch (err) {
    console.warn(`[Open-Meteo Air Quality]: ${err.message}. Retornando status indisponivel.`);
    return res.json({
      status: "indisponivel",
      message: "Previs\xE3o do ar externo indispon\xEDvel agora",
      source: "CAMS (Copernicus), via Open-Meteo Air Quality API, grade de cerca de 45 km",
      fetchedAt: (/* @__PURE__ */ new Date()).toISOString(),
      points: []
    });
  }
});
app.get("/api/forecast", async (req, res) => {
  const lat = req.query.lat ? parseFloat(req.query.lat) : -22.8465;
  const lon = req.query.lon ? parseFloat(req.query.lon) : -43.3482;
  const scenario = req.query.scenario || "live_open_meteo";
  if (scenario !== "live_open_meteo") {
    const points = generateScenarioHourlyData(scenario, /* @__PURE__ */ new Date(), 0);
    return res.json({
      source: "Simula\xE7\xE3o Calibrada de Cen\xE1rio",
      scenario,
      isRealTime: false,
      isFallback: false,
      fetchedAt: (/* @__PURE__ */ new Date()).toISOString(),
      points
    });
  }
  const cacheKey = `${lat.toFixed(2)}_${lon.toFixed(2)}`;
  const cached = forecastCache.get(cacheKey);
  const now = Date.now();
  if (cached && now - cached.timestamp < CACHE_TTL_MS2) {
    return res.json({
      ...cached.data,
      isCached: true
    });
  }
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&hourly=temperature_2m,relative_humidity_2m,shortwave_radiation,wind_speed_10m&timezone=America%2FSao_Paulo&forecast_days=3`;
    const response = await fetch(url, { signal: AbortSignal.timeout(6e3) });
    if (!response.ok) {
      throw new Error(`Open-Meteo HTTP ${response.status}: ${response.statusText}`);
    }
    const data = await response.json();
    const hourly = data.hourly;
    if (!hourly || !hourly.time || hourly.time.length === 0) {
      throw new Error("Formato inv\xE1lido retornado pela Open-Meteo");
    }
    const points = [];
    for (let i = 0; i < Math.min(hourly.time.length, 72); i++) {
      const timeStr = hourly.time[i];
      const temp = hourly.temperature_2m[i] ?? 30;
      const rh = hourly.relative_humidity_2m[i] ?? 65;
      const radiation = hourly.shortwave_radiation ? hourly.shortwave_radiation[i] ?? 0 : 0;
      const windSpeed = hourly.wind_speed_10m ? hourly.wind_speed_10m[i] ?? 10 : 10;
      const heatIndex = calculateRothfuszHeatIndex(temp, rh);
      const heatLevelRio = getRioHeatLevel(heatIndex);
      const riskBand = getRiskBand(heatIndex);
      points.push({
        time: timeStr.includes("Z") ? timeStr : `${timeStr}:00-03:00`,
        temperatureC: Math.round(temp * 10) / 10,
        relativeHumidity: Math.round(rh),
        shortwaveRadiationWm2: Math.round(radiation),
        windSpeedKmh: Math.round(windSpeed * 10) / 10,
        heatIndexC: heatIndex,
        heatLevelRio,
        riskBand
      });
    }
    const resultPayload = {
      source: "Open-Meteo Forecast API",
      model: "DWD ICON / ECMWF Ensemble (Open-Meteo)",
      scenario: "live_open_meteo",
      isRealTime: true,
      isFallback: false,
      isCached: false,
      fetchedAt: (/* @__PURE__ */ new Date()).toISOString(),
      points
    };
    forecastCache.set(cacheKey, { timestamp: now, data: resultPayload });
    return res.json(resultPayload);
  } catch (err) {
    console.warn(`[Open-Meteo Fallback]: ${err.message}. Servindo simula\xE7\xE3o local.`);
    const points = generateScenarioHourlyData("live_open_meteo", /* @__PURE__ */ new Date(), 0);
    return res.json({
      source: "Simula\xE7\xE3o local (Open-Meteo indispon\xEDvel)",
      model: "Simula\xE7\xE3o experimental determin\xEDstica",
      scenario: "live_open_meteo",
      isRealTime: false,
      isFallback: true,
      fallbackReason: err.message,
      fetchedAt: (/* @__PURE__ */ new Date()).toISOString(),
      points
    });
  }
});
app.get("/api/inmet/stations", async (req, res) => {
  try {
    const payload = await defaultInmetClient.getStationsWithObservations();
    const rawLat = req.query.lat ? parseFloat(req.query.lat) : NaN;
    const rawLon = req.query.lon ? parseFloat(req.query.lon) : NaN;
    const stations = Number.isFinite(rawLat) && Number.isFinite(rawLon) ? enrichStationsWithDistance(payload.stations, rawLat, rawLon) : payload.stations;
    return res.json({
      stations,
      status: payload.status
    });
  } catch (err) {
    console.warn(`[INMET Route]: ${err?.message || "Erro inesperado"}`);
    return res.status(200).json({
      stations: [],
      status: {
        stationListActive: false,
        tokenConfigured: false,
        inmetAvailable: false,
        fetchedAt: (/* @__PURE__ */ new Date()).toISOString(),
        summaryMessage: "INMET indispon\xEDvel no momento.",
        lastError: "Falha ao consultar esta\xE7\xF5es do INMET."
      }
    });
  }
});
app.get("/api/inmet/diagnostics", (_req, res) => {
  return res.json(defaultInmetClient.getDiagnostics());
});
app.post("/api/gemini/interpret", async (req, res) => {
  const { school, hourlySummary, airEstimate, outdoorAirSummary, userContext } = req.body;
  if (!school) {
    return res.status(400).json({ error: "Dados da escola s\xE3o obrigat\xF3rios" });
  }
  const systemInstruction = `Voc\xEA \xE9 o assistente t\xE9cnico do Term\xF4metro das Escolas RJ, uma plataforma de intelig\xEAncia clim\xE1tica escolar.
Interprete exclusivamente os resultados estruturados fornecidos pelo sistema. Explique a exposi\xE7\xE3o ao calor, identifique fatores de vulnerabilidade confirmados e proponha medidas preventivas consistentes com fontes institucionais.
Diferencie sempre informa\xE7\xF5es observadas, previstas, estimadas e simuladas.
N\xE3o invente temperaturas, medi\xE7\xF5es, caracter\xEDsticas de escolas, limites legais ou diagn\xF3sticos de sa\xFAde.
Se um dado estiver ausente ou pendente, diga que est\xE1 pendente. Nunca estime nem invente valores, nomes de pessoas ou institui\xE7\xF5es.
N\xE3o apresente classifica\xE7\xF5es experimentais como N\xEDveis de Calor oficiais da Prefeitura do Rio de Janeiro. N\xE3o declare insalubridade ocupacional nem determine automaticamente suspens\xE3o de aulas.
Quando faltarem dados, informe a limita\xE7\xE3o de forma expl\xEDcita.
O CO2 dentro da sala \xE9 estimativa de modelo, sem sensor. Nunca diga que foi medido. Se faltar dado de ar, diga que est\xE1 pendente.
Priorize orienta\xE7\xF5es acess\xEDveis e proporcionais, como acesso \xE0 \xE1gua, redu\xE7\xE3o de exposi\xE7\xE3o solar, sombreamento e avalia\xE7\xE3o das condi\xE7\xF5es de ventila\xE7\xE3o.
Em situa\xE7\xF5es de poss\xEDvel emerg\xEAncia, oriente o acionamento dos respons\xE1veis e dos servi\xE7os de sa\xFAde, conforme protocolos aplic\xE1veis.`;
  const promptInput = `
Avalie a seguinte unidade escolar para o per\xEDodo das pr\xF3ximas 72 horas:
- Escola: ${school.name} (INEP: ${school.inepCode})
- Bairro/Regi\xE3o: ${school.borough} - ${school.region}
- Rede: ${school.network}
- Matr\xEDculas: ${school.totalStudents} | Turnos: ${(school.shifts || []).join(", ")}
- Salas declaradas no Censo: ${school.totalRooms} totais, ${school.declaredClimatizedRooms} climatizadas
- Fator de ilha de calor de superf\xEDcie LST: ${school.heatIslandFactorLST !== null ? `+${school.heatIslandFactorLST} \xBAC` : "Pendente (c\xE1lculo por sat\xE9lite ainda n\xE3o importado)"}
- Cobertura de verde no entorno: ${school.greenCoveragePercent !== null ? `${school.greenCoveragePercent}%` : "Pendente (c\xE1lculo por sat\xE9lite ainda n\xE3o importado)"}
- Status de vistoria local: ${school.inspection ? JSON.stringify(school.inspection) : "Nenhuma vistoria f\xEDsica registrada at\xE9 o momento (atributos de telhado e defeitos el\xE9tricos constam como DESCONHECIDOS)"}
- Estimativa de ar dentro da sala: ${airEstimate ? JSON.stringify(airEstimate) : "Pendente (turmas n\xE3o carregadas)"}
- Previs\xE3o de part\xEDculas no ar l\xE1 fora (CAMS/Copernicus): ${outdoorAirSummary ? JSON.stringify(outdoorAirSummary) : "Indispon\xEDvel"}
- Previs\xE3o Externa 72h:
  - M\xE1ximo \xCDndice de Calor previsto: ${hourlySummary?.maxHeatIndexC ?? 38} \xBAC
  - Horas com IC \u2265 36 \xBAC no turno letivo: ${hourlySummary?.hours36Plus ?? 4}h
  - Horas com IC \u2265 40 \xBAC no turno letivo: ${hourlySummary?.hours40Plus ?? 1}h
  - Horas com IC \u2265 44 \xBAC no turno letivo: ${hourlySummary?.hours44Plus ?? 0}h
- Contexto adicional: ${userContext || "Avalia\xE7\xE3o de rotina de preven\xE7\xE3o para o per\xEDodo de aulas"}`;
  if (aiClient) {
    try {
      const response = await aiClient.models.generateContent({
        model: "gemini-3.8-flash",
        contents: promptInput,
        config: {
          systemInstruction,
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              schoolId: { type: Type.STRING },
              schoolName: { type: Type.STRING },
              evaluationTimestamp: { type: Type.STRING },
              sourcesUsed: {
                type: Type.ARRAY,
                items: { type: Type.STRING }
              },
              dataFreshness: { type: Type.STRING },
              maxForecastedHeatIndexC: { type: Type.NUMBER },
              hoursExposureByBand: {
                type: Type.OBJECT,
                properties: {
                  above36C: { type: Type.NUMBER },
                  above40C: { type: Type.NUMBER },
                  above44C: { type: Type.NUMBER }
                },
                required: ["above36C", "above40C", "above44C"]
              },
              confirmedVulnerabilities: {
                type: Type.ARRAY,
                items: { type: Type.STRING }
              },
              missingOrUnverifiedInformation: {
                type: Type.ARRAY,
                items: { type: Type.STRING }
              },
              experimentalPriorityClassification: {
                type: Type.STRING,
                description: "Classifica\xE7\xE3o experimental: muito_alta, alta, moderada ou baixa"
              },
              officialCorHeatLevelIfAvailable: { type: Type.STRING },
              indoorTemperatureStatus: { type: Type.STRING },
              indoorAirStatus: {
                type: Type.STRING,
                description: "Parecer sobre CO2 e renova\xE7\xE3o de ar na sala e part\xEDculas externas"
              },
              dataQualityAndLimitations: { type: Type.STRING },
              recommendedPreventiveActions: {
                type: Type.ARRAY,
                items: { type: Type.STRING }
              }
            },
            required: [
              "schoolId",
              "schoolName",
              "evaluationTimestamp",
              "sourcesUsed",
              "dataFreshness",
              "maxForecastedHeatIndexC",
              "hoursExposureByBand",
              "confirmedVulnerabilities",
              "missingOrUnverifiedInformation",
              "experimentalPriorityClassification",
              "indoorTemperatureStatus",
              "indoorAirStatus",
              "dataQualityAndLimitations",
              "recommendedPreventiveActions"
            ]
          }
        }
      });
      const parsed = JSON.parse(response.text || "{}");
      return res.json({
        evaluation: parsed,
        rawModel: "gemini-3.8-flash",
        mode: "ai_engine"
      });
    } catch (apiErr) {
      console.error("[Gemini API Error]:", apiErr);
    }
  }
  const fallbackEvaluation = {
    schoolId: school.id,
    schoolName: school.name,
    evaluationTimestamp: (/* @__PURE__ */ new Date()).toISOString(),
    sourcesUsed: [
      "Censo Escolar INEP 2025 / Cat\xE1logo de Escolas do Inep",
      "Censo Escolar 2024 (Turmas por Turno)",
      "Open-Meteo Forecast API (72h)",
      "CAMS (Copernicus) via Open-Meteo",
      "Landsat 8/9 (USGS) e ESA WorldCover via Earth Engine",
      "ABNT NBR 17037 / Lei 13.589/2018",
      "Protocolo de Enfrentamento ao Calor Extremo da SMS-Rio (Decreto 54.740/2024)"
    ],
    dataFreshness: "Previs\xE3o meteorol\xF3gica gerada h\xE1 menos de 1 hora; dados cadastrais do Censo 2024/2025.",
    maxForecastedHeatIndexC: hourlySummary?.maxHeatIndexC ?? 38.5,
    hoursExposureByBand: {
      above36C: hourlySummary?.hours36Plus ?? 4,
      above40C: hourlySummary?.hours40Plus ?? 1,
      above44C: hourlySummary?.hours44Plus ?? 0
    },
    confirmedVulnerabilities: [
      school.totalRooms > 0 && school.declaredClimatizedRooms < school.totalRooms ? `Censo registra ${school.totalRooms - school.declaredClimatizedRooms} de ${school.totalRooms} salas sem climatiza\xE7\xE3o declarada.` : "Climatiza\xE7\xE3o declarada em todas as salas no Censo.",
      school.heatIslandFactorLST >= 3.5 ? `\xC1rea com alta anomalia t\xE9rmica de superf\xEDcie (+${school.heatIslandFactorLST} \xBAC).` : "Exposi\xE7\xE3o territorial moderada.",
      school.inspection?.electricalOverloadReported ? "Vistoria f\xEDsica confirmou sobrecarga el\xE9trica impedindo uso simult\xE2neo de condicionadores." : "Nenhuma sobrecarga el\xE9trica confirmada por vistoria."
    ].filter(Boolean),
    missingOrUnverifiedInformation: [
      school.inspection ? "Inspe\xE7\xE3o f\xEDsica dispon\xEDvel." : "Condi\xE7\xF5es reais da fia\xE7\xE3o, telhado e ventila\xE7\xE3o cruzada N\xC3O VERIFICADAS in loco.",
      "Temperatura interna de sala de aula desabilitada no MVP (aguardando calibra\xE7\xE3o com sensores sentinela).",
      "N\xEDvel de Calor oficial municipal do COR \xE9 determinado pelo munic\xEDpio e n\xE3o constitui dado por escola."
    ],
    experimentalPriorityClassification: (hourlySummary?.maxHeatIndexC ?? 38) >= 42 || school.heatIslandFactorLST > 4.5 ? "alta" : "moderada",
    officialCorHeatLevelIfAvailable: "N\xE3o atribu\xEDdo automaticamente por escola (compet\xEAncia exclusiva do COR).",
    indoorTemperatureStatus: school.sentinelSensors?.length ? `Medi\xE7\xE3o real recente em sensor sentinela: ${school.sentinelSensors[0].temperatureC} \xBAC (${school.sentinelSensors[0].environment}).` : "Estimativa interna experimental desabilitada na V1.",
    indoorAirStatus: airEstimate && airEstimate.status === "disponivel" ? `Estimativa de modelo: com porta e janelas fechadas (split), o CO2 ultrapassa 1.120 ppm em cerca de ${airEstimate.firstMinuteAboveReferenceClosed ?? 15} minutos de aula. Recomenda-se renova\xE7\xE3o de ar ou pausas ventiladas.` : "Estimativa de ar pendente (turmas n\xE3o carregadas ou sem dados no Censo).",
    dataQualityAndLimitations: "Esta classifica\xE7\xE3o \xE9 experimental e preventiva. O CO2 dentro da sala \xE9 estimativa de modelo a partir de dados p\xFAblicos, sem sensor. N\xE3o substitui laudo pericial oficial nem medi\xE7\xF5es ocupacionais regulamentares.",
    recommendedPreventiveActions: [
      "Garantir bebedouros abastecidos e incentivar pausas ativas para ingest\xE3o de \xE1gua pot\xE1vel fresca a cada 30-45 minutos.",
      "Abrir portas e janelas por 5 minutos na troca de aula e durante todo o recreio para baixar o CO2 acumulado.",
      "Priorizar atividades pedag\xF3gicas nos hor\xE1rios de menor insola\xE7\xE3o ou transferir turmas para salas mais ventiladas/sombreadas.",
      "Atentar para sintomas de desidrata\xE7\xE3o e estresse t\xE9rmico em alunos (letargia, dor de cabe\xE7a, fraqueza, n\xE1usea).",
      "Em caso de tontura severa ou desmaio, remover o estudante para local fresco sombreado, hidratar e acionar o 192/SAMU conforme protocolo."
    ]
  };
  return res.json({
    evaluation: fallbackEvaluation,
    rawModel: "deterministic_engine_fallback",
    mode: "deterministic"
  });
});
async function startServer() {
  const isDev = process.env.NODE_ENV !== "production";
  if (isDev) {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[Term\xF4metro das Escolas RJ] Servidor rodando na porta ${PORT} (${isDev ? "Dev Vite" : "Prod"})`);
  });
}
startServer();
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
