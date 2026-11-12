/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import assert from 'node:assert/strict';
import {
  createInmetClient,
  convertInmetUtcToBrt,
  maskInmetToken,
  parseInmetHourlyRows,
} from '../server/inmetClient.ts';
import {
  buildForecastVsObservedComparison,
  enrichStationsWithDistance,
} from '../src/utils/inmetUtils.ts';
import { calculateRothfuszHeatIndex } from '../src/utils/thermalMath.ts';
import { HourlyForecastPoint } from '../src/types.ts';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

const SAMPLE_STATIONS_API = [
  {
    CD_ESTACAO: 'A621',
    DC_NOME: 'VILA MILITAR',
    SG_ESTADO: 'RJ',
    CD_SITUACAO: 'Operante',
    VL_LATITUDE: '-22.8617',
    VL_LONGITUDE: '-43.4114',
  },
  {
    CD_ESTACAO: 'A603',
    DC_NOME: 'XEREM',
    SG_ESTADO: 'RJ',
    CD_SITUACAO: 'Operante',
    VL_LATITUDE: '-22.5833',
    VL_LONGITUDE: '-43.2833',
  },
  {
    CD_ESTACAO: 'A601',
    DC_NOME: 'SEROPEDICA-ECOLOGIA AGRICOLA',
    SG_ESTADO: 'RJ',
    CD_SITUACAO: 'Operante',
    VL_LATITUDE: '-22.7578',
    VL_LONGITUDE: '-43.6847',
  },
  {
    CD_ESTACAO: 'A627',
    DC_NOME: 'NITEROI',
    SG_ESTADO: 'RJ',
    CD_SITUACAO: 'Pane',
    VL_LATITUDE: '-22.9056',
    VL_LONGITUDE: '-43.1036',
  },
  {
    CD_ESTACAO: 'A636',
    DC_NOME: 'RIO DE JANEIRO - JACAREPAGUA',
    SG_ESTADO: 'RJ',
    CD_SITUACAO: 'Operante',
    VL_LATITUDE: '-22.9394',
    VL_LONGITUDE: '-43.4028',
  },
  {
    CD_ESTACAO: 'A652',
    DC_NOME: 'RIO DE JANEIRO - FORTE DE COPACABANA',
    SG_ESTADO: 'RJ',
    CD_SITUACAO: 'Operante',
    VL_LATITUDE: '-22.9869',
    VL_LONGITUDE: '-43.1894',
  },
  {
    CD_ESTACAO: 'A602',
    DC_NOME: 'RIO DE JANEIRO - MARAMBAIA',
    SG_ESTADO: 'RJ',
    CD_SITUACAO: 'Operante',
    VL_LATITUDE: '-23.0497',
    VL_LONGITUDE: '-43.5958',
  },
  // Estação de outro estado não deve entrar
  {
    CD_ESTACAO: 'A701',
    DC_NOME: 'SAO PAULO',
    SG_ESTADO: 'SP',
    CD_SITUACAO: 'Operante',
    VL_LATITUDE: '-23.4963',
    VL_LONGITUDE: '-46.6200',
  },
];

async function runTests() {
  console.log('=== Testes Offline INMET ===');

  // 1. Conversão UTC -> Horário de Brasília e mascaramento de token
  const brt = convertInmetUtcToBrt('2026-11-12', '1700');
  assert.ok(brt, 'Deve converter DT_MEDICAO + HR_MEDICAO UTC para BRT');
  assert.equal(brt.dateBrt, '2026-11-12');
  assert.equal(brt.hourBrt, '14:00');
  assert.equal(brt.isoBrt, '2026-11-12T14:00:00-03:00');

  const brtMidnight = convertInmetUtcToBrt('2026-11-13', '0100');
  assert.equal(brtMidnight?.dateBrt, '2026-11-12', '01:00 UTC deve recuar para dia anterior em BRT');
  assert.equal(brtMidnight?.hourBrt, '22:00');

  const secretToken = 'SEGREDO_INMET_12345';
  const rawUrl = `Falha em https://apitempo.inmet.gov.br/token/estacao/2026-11-11/2026-11-12/A621/${secretToken}`;
  const masked = maskInmetToken(rawUrl, secretToken);
  assert.equal(masked.includes(secretToken), false, 'Token não pode vazar na URL mascarada');
  assert.ok(masked.includes('***'), 'Token deve ser substituído por ***');

  // 2. Cenário SEM token: lista de estações real funciona, leituras nulas, zero chamada a /token/estacao
  {
    const calledUrls: string[] = [];
    const client = createInmetClient({
      getTokenFn: () => undefined,
      nowFn: () => Date.UTC(2026, 10, 12, 17, 30, 0),
      fetchFn: (async (url: string | URL | Request) => {
        const u = String(url);
        calledUrls.push(u);
        if (u.endsWith('/estacoes/T')) {
          return jsonResponse(SAMPLE_STATIONS_API);
        }
        throw new Error(`URL inesperada sem token: ${u}`);
      }) as typeof fetch,
    });

    const payload = await client.getStationsWithObservations();
    assert.equal(payload.stations.length, 7, 'Deve retornar exatamente as 7 estações do RJ');
    assert.equal(calledUrls.length, 1, 'Sem token só deve chamar /estacoes/T');
    assert.equal(payload.status.stationListActive, true);
    assert.equal(payload.status.tokenConfigured, false);

    const niteroi = payload.stations.find((s) => s.stationCode === 'A627');
    assert.equal(niteroi?.status, 'manutencao', 'A627 marcada como Pane no mock');
    assert.equal(niteroi?.observationState, 'estacao_em_pane');

    const vilaMilitar = payload.stations.find((s) => s.stationCode === 'A621');
    assert.equal(vilaMilitar?.observationState, 'aguardando_token');
    assert.equal(vilaMilitar?.temperatureC, null, 'Nunca inventar temperatura sem token');
    assert.equal(vilaMilitar?.humidityPercent, null, 'Nunca inventar umidade sem token');
    assert.equal(vilaMilitar?.heatIndexC, null, 'Nunca inventar índice de calor sem token');

    const diag = client.getDiagnostics();
    assert.equal(diag.tokenPresent, 'não');
    assert.equal(diag.lastSuccessAt, null);
    assert.equal(diag.lastError, null);

    // Enriquecimento de distância e cartão Previsto x Observado oculto
    const enriched = enrichStationsWithDistance(payload.stations, -22.8384, -43.3241);
    assert.equal(enriched[0].isNearest, true);
    assert.ok((enriched[0].distanceKm ?? 999) < 20);
    const forecastPoints: HourlyForecastPoint[] = [
      {
        time: '2026-11-12T14:00:00-03:00',
        temperatureC: 33.0,
        relativeHumidity: 60,
        shortwaveRadiationWm2: 750,
        windSpeedKmh: 12,
        heatIndexC: calculateRothfuszHeatIndex(33.0, 60),
        heatLevelRio: 'NC3',
        riskBand: 'atencao',
      },
    ];
    assert.equal(
      buildForecastVsObservedComparison(enriched, forecastPoints),
      null,
      'Cartão Previsto x Observado deve permanecer oculto sem leituras reais'
    );
  }

  // 3. Cenário COM token e dados válidos (valores como texto, UTC->BRT, IC observado, cache 1h)
  {
    let nowMs = Date.UTC(2026, 10, 12, 17, 30, 0); // 14:30 BRT
    let tokenCalls = 0;
    const client = createInmetClient({
      getTokenFn: () => secretToken,
      nowFn: () => nowMs,
      fetchFn: (async (url: string | URL | Request) => {
        const u = String(url);
        if (u.endsWith('/estacoes/T')) {
          return jsonResponse(SAMPLE_STATIONS_API);
        }
        if (u.includes('/token/estacao/')) {
          tokenCalls++;
          assert.ok(u.endsWith(`/${secretToken}`), 'Token deve ir na rota esperada');
          return jsonResponse([
            {
              DT_MEDICAO: '2026-11-12',
              HR_MEDICAO: '1600', // 13:00 BRT
              TEM_INS: '32.5',
              TEM_MAX: '33.1',
              TEM_MIN: '31.9',
              UMD_INS: '62',
            },
            {
              DT_MEDICAO: '2026-11-12',
              HR_MEDICAO: '1700', // 14:00 BRT
              TEM_INS: '34,2', // vírgula decimal tolerada
              TEM_MAX: '34.8',
              TEM_MIN: '32.5',
              UMD_INS: '58',
            },
          ]);
        }
        throw new Error(`URL inesperada: ${u}`);
      }) as typeof fetch,
    });

    const payload = await client.getStationsWithObservations();
    assert.equal(payload.status.tokenConfigured, true);
    const vila = payload.stations.find((s) => s.stationCode === 'A621')!;
    assert.equal(vila.observationState, 'leitura');
    assert.equal(vila.observedTimeLabel, '14:00');
    assert.equal(vila.temperatureC, 34.2);
    assert.equal(vila.humidityPercent, 58);
    assert.equal(vila.heatIndexC, calculateRothfuszHeatIndex(34.2, 58));

    const niteroi = payload.stations.find((s) => s.stationCode === 'A627')!;
    assert.equal(niteroi.observationState, 'estacao_em_pane', 'Estação em pane não busca leitura');

    // Segunda chamada dentro de 1h usa cache sem novas chamadas HTTP
    const callsBeforeCache = tokenCalls;
    await client.getStationsWithObservations();
    assert.equal(tokenCalls, callsBeforeCache, 'Cache de 1h deve evitar novas requisições');

    const diag = client.getDiagnostics();
    assert.equal(diag.tokenPresent, 'sim');
    assert.ok(diag.lastSuccessAt !== null);
    assert.equal(diag.lastError, null);

    // Cartão Previsto x Observado deve montar comparação correta
    const enriched = enrichStationsWithDistance(payload.stations, -22.8617, -43.4114);
    const forecastPoints: HourlyForecastPoint[] = [
      {
        time: '2026-11-12T14:00:00-03:00',
        temperatureC: 33.0,
        relativeHumidity: 60,
        shortwaveRadiationWm2: 780,
        windSpeedKmh: 10,
        heatIndexC: calculateRothfuszHeatIndex(33.0, 60),
        heatLevelRio: 'NC3',
        riskBand: 'atencao',
      },
    ];
    const comparison = buildForecastVsObservedComparison(enriched, forecastPoints);
    assert.ok(comparison !== null, 'Deve gerar comparação quando há leitura observada');
    assert.equal(comparison.station.stationCode, 'A621');
    assert.equal(comparison.observedTempC, 34.2);
    assert.equal(comparison.forecastTempC, 33.0);
    assert.equal(comparison.tempDiffC, 1.2);
  }

  // 4. Erro 401: cooldown de 30 minutos e token mascarado em erros/diagnóstico
  {
    let nowMs = Date.UTC(2026, 10, 12, 18, 0, 0);
    let hourlyAttempts = 0;
    const client = createInmetClient({
      getTokenFn: () => secretToken,
      nowFn: () => nowMs,
      fetchFn: (async (url: string | URL | Request) => {
        const u = String(url);
        if (u.includes('/token/estacao/')) {
          hourlyAttempts++;
          return jsonResponse({ message: `Token inválido ${u}` }, 401);
        }
        return jsonResponse(SAMPLE_STATIONS_API);
      }) as typeof fetch,
    });

    const first = await client.fetchHourlyStationReadings('A621', '2026-11-11', '2026-11-12');
    assert.equal(first.observationState, 'inmet_indisponivel');
    assert.equal(hourlyAttempts, 1);

    // Nova tentativa 5 minutos depois não deve chamar fetchFn (cooldown 30 min)
    nowMs += 5 * 60 * 1000;
    const second = await client.fetchHourlyStationReadings('A621', '2026-11-11', '2026-11-12');
    assert.equal(second.observationState, 'inmet_indisponivel');
    assert.equal(hourlyAttempts, 1, 'Erro 401 deve ativar espera de 30 minutos');

    const diag = client.getDiagnostics();
    assert.equal(diag.tokenPresent, 'sim');
    assert.ok(diag.lastError !== null);
    assert.equal(diag.lastError!.includes(secretToken), false, 'Diagnóstico nunca expõe o token');

    // Após 31 minutos pode tentar novamente
    nowMs += 26 * 60 * 1000;
    await client.fetchHourlyStationReadings('A621', '2026-11-11', '2026-11-12');
    assert.equal(hourlyAttempts, 2, 'Após 30 minutos deve voltar a tentar');
  }

  // 5. Erro 404: cooldown de 30 minutos por estação e resposta tolerante
  {
    let nowMs = Date.UTC(2026, 10, 12, 18, 0, 0);
    let hourlyAttempts = 0;
    const client = createInmetClient({
      getTokenFn: () => secretToken,
      nowFn: () => nowMs,
      fetchFn: (async () => jsonResponse({ error: 'Not Found' }, 404)) as typeof fetch,
    });

    const res404 = await client.fetchHourlyStationReadings('A621', '2026-11-11', '2026-11-12');
    assert.equal(res404.observationState, 'inmet_indisponivel');
    assert.ok(res404.error?.includes('404'));

    // Verifica que erro 404 também respeita janela de 30 minutos
    const clientCooldown = createInmetClient({
      getTokenFn: () => secretToken,
      nowFn: () => nowMs,
      fetchFn: (async () => {
        hourlyAttempts++;
        return jsonResponse({}, 404);
      }) as typeof fetch,
    });
    await clientCooldown.fetchHourlyStationReadings('A603', '2026-11-11', '2026-11-12');
    nowMs += 10 * 60 * 1000;
    await clientCooldown.fetchHourlyStationReadings('A603', '2026-11-11', '2026-11-12');
    assert.equal(hourlyAttempts, 1, 'Erro 404 deve aguardar 30 minutos antes de tentar novamente');
  }

  // 6. Lista vazia [] e leitura atrasada (> 3 horas)
  {
    const nowMs = Date.UTC(2026, 10, 12, 18, 0, 0);
    const client = createInmetClient({
      getTokenFn: () => secretToken,
      nowFn: () => nowMs,
      fetchFn: (async () => jsonResponse([])) as typeof fetch,
    });

    const emptyRes = await client.fetchHourlyStationReadings('A621', '2026-11-11', '2026-11-12');
    assert.equal(emptyRes.observations.length, 0);
    assert.equal(emptyRes.latestValid, null);
    assert.equal(emptyRes.observationState, 'dado_atrasado');

    // Leitura com mais de 3 horas de atraso deve marcar 'dado_atrasado'
    const staleParsed = parseInmetHourlyRows(
      [
        {
          DT_MEDICAO: '2026-11-12',
          HR_MEDICAO: '1300', // 5 horas antes de 18:00 UTC
          TEM_INS: '31.0',
          TEM_MAX: '31.5',
          TEM_MIN: '30.2',
          UMD_INS: '65',
        },
      ],
      nowMs
    );
    assert.equal(staleParsed.observationState, 'dado_atrasado');
    assert.equal(staleParsed.latestValid?.temperatureC, 31.0);
  }

  // 7. Campos nulos: não interpolar nem fabricar valores
  {
    const nowMs = Date.UTC(2026, 10, 12, 18, 0, 0);
    const parsedNulls = parseInmetHourlyRows(
      [
        {
          DT_MEDICAO: '2026-11-12',
          HR_MEDICAO: '1600',
          TEM_INS: '32.0',
          TEM_MAX: '32.5',
          TEM_MIN: '31.0',
          UMD_INS: '60',
        },
        {
          DT_MEDICAO: '2026-11-12',
          HR_MEDICAO: '1700',
          TEM_INS: null,
          TEM_MAX: null,
          TEM_MIN: null,
          UMD_INS: null,
        },
        {
          DT_MEDICAO: '2026-11-12',
          HR_MEDICAO: '1800',
          TEM_INS: '34.0',
          TEM_MAX: '34.4',
          TEM_MIN: '32.8',
          UMD_INS: null,
        },
      ],
      nowMs
    );

    assert.equal(parsedNulls.observations.length, 3);
    assert.equal(parsedNulls.observations[1].temperatureC, null, 'Hora sem dado permanece vazia');
    assert.equal(parsedNulls.observations[1].humidityPercent, null);
    assert.equal(parsedNulls.observations[1].heatIndexC, null);
    assert.equal(parsedNulls.observations[2].temperatureC, 34.0);
    assert.equal(parsedNulls.observations[2].heatIndexC, null, 'Sem umidade não fabrica IC');
    assert.equal(parsedNulls.latestValid?.hourBrt, '15:00');
  }

  console.log('Todos os testes offline do INMET passaram com sucesso!');
}

runTests().catch((err) => {
  console.error(err);
  process.exit(1);
});
