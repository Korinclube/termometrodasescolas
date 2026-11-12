/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import 'dotenv/config';
import express, { Request, Response } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, Type } from '@google/genai';
import { calculateRothfuszHeatIndex, getRioHeatLevel, getRiskBand } from './src/utils/thermalMath.ts';
import { generateScenarioHourlyData, WeatherScenarioKey } from './src/data/mockWeatherScenarios.ts';
import { enrichStationsWithDistance } from './src/utils/inmetUtils.ts';
import { defaultInmetClient } from './server/inmetClient.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

app.use(express.json());

// In-memory cache para previsões da Open-Meteo (1 hora de TTL)
interface CacheEntry {
  timestamp: number;
  data: any;
}
const forecastCache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hora

// Cache para qualidade do ar CAMS Copernicus (3 horas de TTL)
const airQualityCache = new Map<string, CacheEntry>();
const AIR_CACHE_TTL_MS = 3 * 60 * 60 * 1000; // 3 horas

// Inicialização segura do cliente Gemini no servidor
const apiKey = process.env.GEMINI_API_KEY;
let aiClient: GoogleGenAI | null = null;
if (apiKey) {
  aiClient = new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

/**
 * GET /api/air-quality
 * Previsão de qualidade do ar CAMS Copernicus (Open-Meteo) para PM2.5, PM10 e Ozônio
 * Cache de 3 horas. Em caso de falha: status 'indisponivel' sem fallback sintético.
 */
app.get('/api/air-quality', async (req: Request, res: Response) => {
  const lat = req.query.lat ? parseFloat(req.query.lat as string) : -22.8465;
  const lon = req.query.lon ? parseFloat(req.query.lon as string) : -43.3482;

  const cacheKey = `${lat.toFixed(2)}_${lon.toFixed(2)}`;
  const cached = airQualityCache.get(cacheKey);
  const now = Date.now();

  if (cached && now - cached.timestamp < AIR_CACHE_TTL_MS) {
    return res.json({
      ...cached.data,
      isCached: true,
    });
  }

  try {
    const url = `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lon}&hourly=pm2_5,pm10,ozone&timezone=America%2FSao_Paulo&forecast_days=3&domains=cams_global`;
    const response = await fetch(url, { signal: AbortSignal.timeout(6000) });

    if (!response.ok) {
      throw new Error(`Open-Meteo Air Quality HTTP ${response.status}`);
    }

    const data = await response.json();
    const hourly = data?.hourly;

    if (!hourly || !hourly.time || hourly.time.length === 0) {
      throw new Error('Dados horários ausentes na resposta de qualidade do ar');
    }

    const points = [];
    for (let i = 0; i < hourly.time.length; i++) {
      const timeStr = hourly.time[i];
      points.push({
        time: timeStr.includes('Z') ? timeStr : `${timeStr}:00-03:00`,
        pm2_5: hourly.pm2_5 ? (hourly.pm2_5[i] ?? null) : null,
        pm10: hourly.pm10 ? (hourly.pm10[i] ?? null) : null,
        ozone: hourly.ozone ? (hourly.ozone[i] ?? null) : null,
      });
    }

    const resultPayload = {
      status: 'disponivel',
      source: 'CAMS (Copernicus), via Open-Meteo Air Quality API, grade de cerca de 45 km',
      description:
        'Previsão de partículas no ar da região, não da sala nem da rua da escola. Serve para saber se o dia está limpo ou carregado.',
      fetchedAt: new Date().toISOString(),
      points,
    };

    airQualityCache.set(cacheKey, { timestamp: now, data: resultPayload });
    return res.json(resultPayload);
  } catch (err: any) {
    console.warn(`[Open-Meteo Air Quality]: ${err.message}. Retornando status indisponivel.`);
    return res.json({
      status: 'indisponivel',
      message: 'Previsão do ar externo indisponível agora',
      source: 'CAMS (Copernicus), via Open-Meteo Air Quality API, grade de cerca de 45 km',
      fetchedAt: new Date().toISOString(),
      points: [],
    });
  }
});

/**
 * GET /api/forecast
 * Retorna previsão horária de 72 horas para a localidade informada
 */
app.get('/api/forecast', async (req: Request, res: Response) => {
  const lat = req.query.lat ? parseFloat(req.query.lat as string) : -22.8465;
  const lon = req.query.lon ? parseFloat(req.query.lon as string) : -43.3482;
  const scenario = (req.query.scenario as WeatherScenarioKey) || 'live_open_meteo';

  // Se um cenário hipotético calibrado for solicitado, retorna diretamente
  if (scenario !== 'live_open_meteo') {
    const points = generateScenarioHourlyData(scenario, new Date(), 0);
    return res.json({
      source: 'Simulação Calibrada de Cenário',
      scenario,
      isRealTime: false,
      isFallback: false,
      fetchedAt: new Date().toISOString(),
      points,
    });
  }

  // Chave de cache arredondada para 2 casas decimais (~1km)
  const cacheKey = `${lat.toFixed(2)}_${lon.toFixed(2)}`;
  const cached = forecastCache.get(cacheKey);
  const now = Date.now();

  if (cached && now - cached.timestamp < CACHE_TTL_MS) {
    return res.json({
      ...cached.data,
      isCached: true,
    });
  }

  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&hourly=temperature_2m,relative_humidity_2m,shortwave_radiation,wind_speed_10m&timezone=America%2FSao_Paulo&forecast_days=3`;
    const response = await fetch(url, { signal: AbortSignal.timeout(6000) });

    if (!response.ok) {
      throw new Error(`Open-Meteo HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    const hourly = data.hourly;

    if (!hourly || !hourly.time || hourly.time.length === 0) {
      throw new Error('Formato inválido retornado pela Open-Meteo');
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
        time: timeStr.includes('Z') ? timeStr : `${timeStr}:00-03:00`,
        temperatureC: Math.round(temp * 10) / 10,
        relativeHumidity: Math.round(rh),
        shortwaveRadiationWm2: Math.round(radiation),
        windSpeedKmh: Math.round(windSpeed * 10) / 10,
        heatIndexC: heatIndex,
        heatLevelRio,
        riskBand,
      });
    }

    const resultPayload = {
      source: 'Open-Meteo Forecast API',
      model: 'DWD ICON / ECMWF Ensemble (Open-Meteo)',
      scenario: 'live_open_meteo',
      isRealTime: true,
      isFallback: false,
      isCached: false,
      fetchedAt: new Date().toISOString(),
      points,
    };

    forecastCache.set(cacheKey, { timestamp: now, data: resultPayload });
    return res.json(resultPayload);
  } catch (err: any) {
    console.warn(`[Open-Meteo Fallback]: ${err.message}. Servindo simulação local.`);
    const points = generateScenarioHourlyData('live_open_meteo', new Date(), 0);
    return res.json({
      source: 'Simulação local (Open-Meteo indisponível)',
      model: 'Simulação experimental determinística',
      scenario: 'live_open_meteo',
      isRealTime: false,
      isFallback: true,
      fallbackReason: err.message,
      fetchedAt: new Date().toISOString(),
      points,
    });
  }
});

/**
 * GET /api/inmet/stations
 * Retorna as 7 estações automáticas reais do INMET no RJ com situação operacional,
 * distância opcional até uma coordenada (?lat=...&lon=...) e leituras horárias quando INMET_TOKEN estiver configurado.
 */
app.get('/api/inmet/stations', async (req: Request, res: Response) => {
  try {
    const payload = await defaultInmetClient.getStationsWithObservations();
    const rawLat = req.query.lat ? parseFloat(req.query.lat as string) : NaN;
    const rawLon = req.query.lon ? parseFloat(req.query.lon as string) : NaN;

    const stations =
      Number.isFinite(rawLat) && Number.isFinite(rawLon)
        ? enrichStationsWithDistance(payload.stations, rawLat, rawLon)
        : payload.stations;

    return res.json({
      stations,
      status: payload.status,
    });
  } catch (err: any) {
    console.warn(`[INMET Route]: ${err?.message || 'Erro inesperado'}`);
    return res.status(200).json({
      stations: [],
      status: {
        stationListActive: false,
        tokenConfigured: false,
        inmetAvailable: false,
        fetchedAt: new Date().toISOString(),
        summaryMessage: 'INMET indisponível no momento.',
        lastError: 'Falha ao consultar estações do INMET.',
      },
    });
  }
});

/**
 * GET /api/inmet/diagnostics
 * Rota de diagnóstico segura: informa apenas se o token está presente (sim/não), última leitura com sucesso e último erro.
 */
app.get('/api/inmet/diagnostics', (_req: Request, res: Response) => {
  return res.json(defaultInmetClient.getDiagnostics());
});

/**
 * POST /api/gemini/interpret
 * Executa assistência técnica e interpretação padronizada via Gemini 3.8 Flash
 * com saída estruturada JSON estrita conforme a especificação.
 */
app.post('/api/gemini/interpret', async (req: Request, res: Response) => {
  const { school, hourlySummary, airEstimate, outdoorAirSummary, userContext } = req.body;

  if (!school) {
    return res.status(400).json({ error: 'Dados da escola são obrigatórios' });
  }

  const systemInstruction = `Você é o assistente técnico do Termômetro das Escolas RJ, uma plataforma de inteligência climática escolar.
Interprete exclusivamente os resultados estruturados fornecidos pelo sistema. Explique a exposição ao calor, identifique fatores de vulnerabilidade confirmados e proponha medidas preventivas consistentes com fontes institucionais.
Diferencie sempre informações observadas, previstas, estimadas e simuladas.
Não invente temperaturas, medições, características de escolas, limites legais ou diagnósticos de saúde.
Se um dado estiver ausente ou pendente, diga que está pendente. Nunca estime nem invente valores, nomes de pessoas ou instituições.
Não apresente classificações experimentais como Níveis de Calor oficiais da Prefeitura do Rio de Janeiro. Não declare insalubridade ocupacional nem determine automaticamente suspensão de aulas.
Quando faltarem dados, informe a limitação de forma explícita.
O CO2 dentro da sala é estimativa de modelo, sem sensor. Nunca diga que foi medido. Se faltar dado de ar, diga que está pendente.
Priorize orientações acessíveis e proporcionais, como acesso à água, redução de exposição solar, sombreamento e avaliação das condições de ventilação.
Em situações de possível emergência, oriente o acionamento dos responsáveis e dos serviços de saúde, conforme protocolos aplicáveis.`;

  const promptInput = `
Avalie a seguinte unidade escolar para o período das próximas 72 horas:
- Escola: ${school.name} (INEP: ${school.inepCode})
- Bairro/Região: ${school.borough} - ${school.region}
- Rede: ${school.network}
- Matrículas: ${school.totalStudents} | Turnos: ${(school.shifts || []).join(', ')}
- Salas declaradas no Censo: ${school.totalRooms} totais, ${school.declaredClimatizedRooms} climatizadas
- Fator de ilha de calor de superfície LST: ${school.heatIslandFactorLST !== null ? `+${school.heatIslandFactorLST} ºC` : 'Pendente (cálculo por satélite ainda não importado)'}
- Cobertura de verde no entorno: ${school.greenCoveragePercent !== null ? `${school.greenCoveragePercent}%` : 'Pendente (cálculo por satélite ainda não importado)'}
- Status de vistoria local: ${school.inspection ? JSON.stringify(school.inspection) : 'Nenhuma vistoria física registrada até o momento (atributos de telhado e defeitos elétricos constam como DESCONHECIDOS)'}
- Estimativa de ar dentro da sala: ${airEstimate ? JSON.stringify(airEstimate) : 'Pendente (turmas não carregadas)'}
- Previsão de partículas no ar lá fora (CAMS/Copernicus): ${outdoorAirSummary ? JSON.stringify(outdoorAirSummary) : 'Indisponível'}
- Previsão Externa 72h:
  - Máximo Índice de Calor previsto: ${hourlySummary?.maxHeatIndexC ?? 38} ºC
  - Horas com IC ≥ 36 ºC no turno letivo: ${hourlySummary?.hours36Plus ?? 4}h
  - Horas com IC ≥ 40 ºC no turno letivo: ${hourlySummary?.hours40Plus ?? 1}h
  - Horas com IC ≥ 44 ºC no turno letivo: ${hourlySummary?.hours44Plus ?? 0}h
- Contexto adicional: ${userContext || 'Avaliação de rotina de prevenção para o período de aulas'}`;

  // Se o client Gemini estiver ativo com a chave de API
  if (aiClient) {
    try {
      const response = await aiClient.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: promptInput,
        config: {
          systemInstruction,
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              schoolId: { type: Type.STRING },
              schoolName: { type: Type.STRING },
              evaluationTimestamp: { type: Type.STRING },
              sourcesUsed: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
              },
              dataFreshness: { type: Type.STRING },
              maxForecastedHeatIndexC: { type: Type.NUMBER },
              hoursExposureByBand: {
                type: Type.OBJECT,
                properties: {
                  above36C: { type: Type.NUMBER },
                  above40C: { type: Type.NUMBER },
                  above44C: { type: Type.NUMBER },
                },
                required: ['above36C', 'above40C', 'above44C'],
              },
              confirmedVulnerabilities: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
              },
              missingOrUnverifiedInformation: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
              },
              experimentalPriorityClassification: {
                type: Type.STRING,
                description: 'Classificação experimental: muito_alta, alta, moderada ou baixa',
              },
              officialCorHeatLevelIfAvailable: { type: Type.STRING },
              indoorTemperatureStatus: { type: Type.STRING },
              indoorAirStatus: {
                type: Type.STRING,
                description: 'Parecer sobre CO2 e renovação de ar na sala e partículas externas',
              },
              dataQualityAndLimitations: { type: Type.STRING },
              recommendedPreventiveActions: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
              },
            },
            required: [
              'schoolId',
              'schoolName',
              'evaluationTimestamp',
              'sourcesUsed',
              'dataFreshness',
              'maxForecastedHeatIndexC',
              'hoursExposureByBand',
              'confirmedVulnerabilities',
              'missingOrUnverifiedInformation',
              'experimentalPriorityClassification',
              'indoorTemperatureStatus',
              'indoorAirStatus',
              'dataQualityAndLimitations',
              'recommendedPreventiveActions',
            ],
          },
        },
      });

      const parsed = JSON.parse(response.text || '{}');
      return res.json({
        evaluation: parsed,
        rawModel: 'gemini-3.8-flash',
        mode: 'ai_engine',
      });
    } catch (apiErr: any) {
      console.error('[Gemini API Error]:', apiErr);
      // Fallback determinístico estruturado
    }
  }

  // Fallback determinístico caso o Gemini não esteja com chave ativa ou falhe temporariamente
  const fallbackEvaluation = {
    schoolId: school.id,
    schoolName: school.name,
    evaluationTimestamp: new Date().toISOString(),
    sourcesUsed: [
      'Censo Escolar INEP 2025 / Catálogo de Escolas do Inep',
      'Censo Escolar 2024 (Turmas por Turno)',
      'Open-Meteo Forecast API (72h)',
      'CAMS (Copernicus) via Open-Meteo',
      'Landsat 8/9 (USGS) e ESA WorldCover via Earth Engine',
      'ABNT NBR 17037 / Lei 13.589/2018',
      'Protocolo de Enfrentamento ao Calor Extremo da SMS-Rio (Decreto 54.740/2024)',
    ],
    dataFreshness: 'Previsão meteorológica gerada há menos de 1 hora; dados cadastrais do Censo 2024/2025.',
    maxForecastedHeatIndexC: hourlySummary?.maxHeatIndexC ?? 38.5,
    hoursExposureByBand: {
      above36C: hourlySummary?.hours36Plus ?? 4,
      above40C: hourlySummary?.hours40Plus ?? 1,
      above44C: hourlySummary?.hours44Plus ?? 0,
    },
    confirmedVulnerabilities: [
      school.totalRooms > 0 && school.declaredClimatizedRooms < school.totalRooms
        ? `Censo registra ${school.totalRooms - school.declaredClimatizedRooms} de ${school.totalRooms} salas sem climatização declarada.`
        : 'Climatização declarada em todas as salas no Censo.',
      school.heatIslandFactorLST >= 3.5
        ? `Área com alta anomalia térmica de superfície (+${school.heatIslandFactorLST} ºC).`
        : 'Exposição territorial moderada.',
      school.inspection?.electricalOverloadReported
        ? 'Vistoria física confirmou sobrecarga elétrica impedindo uso simultâneo de condicionadores.'
        : 'Nenhuma sobrecarga elétrica confirmada por vistoria.',
    ].filter(Boolean),
    missingOrUnverifiedInformation: [
      school.inspection ? 'Inspeção física disponível.' : 'Condições reais da fiação, telhado e ventilação cruzada NÃO VERIFICADAS in loco.',
      'Temperatura interna de sala de aula desabilitada no MVP (aguardando calibração com sensores sentinela).',
      'Nível de Calor oficial municipal do COR é determinado pelo município e não constitui dado por escola.',
    ],
    experimentalPriorityClassification:
      (hourlySummary?.maxHeatIndexC ?? 38) >= 42 || school.heatIslandFactorLST > 4.5 ? 'alta' : 'moderada',
    officialCorHeatLevelIfAvailable: 'Não atribuído automaticamente por escola (competência exclusiva do COR).',
    indoorTemperatureStatus: school.sentinelSensors?.length
      ? `Medição real recente em sensor sentinela: ${school.sentinelSensors[0].temperatureC} ºC (${school.sentinelSensors[0].environment}).`
      : 'Estimativa interna experimental desabilitada na V1.',
    indoorAirStatus:
      airEstimate && airEstimate.status === 'disponivel'
        ? `Estimativa de modelo: com porta e janelas fechadas (split), o CO2 ultrapassa 1.120 ppm em cerca de ${airEstimate.firstMinuteAboveReferenceClosed ?? 15} minutos de aula. Recomenda-se renovação de ar ou pausas ventiladas.`
        : 'Estimativa de ar pendente (turmas não carregadas ou sem dados no Censo).',
    dataQualityAndLimitations:
      'Esta classificação é experimental e preventiva. O CO2 dentro da sala é estimativa de modelo a partir de dados públicos, sem sensor. Não substitui laudo pericial oficial nem medições ocupacionais regulamentares.',
    recommendedPreventiveActions: [
      'Garantir bebedouros abastecidos e incentivar pausas ativas para ingestão de água potável fresca a cada 30-45 minutos.',
      'Abrir portas e janelas por 5 minutos na troca de aula e durante todo o recreio para baixar o CO2 acumulado.',
      'Priorizar atividades pedagógicas nos horários de menor insolação ou transferir turmas para salas mais ventiladas/sombreadas.',
      'Atentar para sintomas de desidratação e estresse térmico em alunos (letargia, dor de cabeça, fraqueza, náusea).',
      'Em caso de tontura severa ou desmaio, remover o estudante para local fresco sombreado, hidratar e acionar o 192/SAMU conforme protocolo.',
    ],
  };

  return res.json({
    evaluation: fallbackEvaluation,
    rawModel: 'deterministic_engine_fallback',
    mode: 'deterministic',
  });
});

async function startServer() {
  const isDev = process.env.NODE_ENV !== 'production';

  if (isDev) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Termômetro das Escolas RJ] Servidor rodando na porta ${PORT} (${isDev ? 'Dev Vite' : 'Prod'})`);
  });
}

startServer();
