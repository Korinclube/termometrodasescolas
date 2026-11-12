/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  HourlyForecastPoint,
  PriorityLevel,
  SchoolInspection,
  SchoolRecord,
  ShiftExposureSummary,
  ThermalExposureResult,
  InfrastructureVulnerabilityResult,
  DecoupledRiskEvaluation,
  EnvelopeSimulationParameters,
} from '../types';
import { formatPercentIntPtBr, formatTempPtBr } from './formatPtBr';

/**
 * Calcula o Índice de Calor (Heat Index) utilizando a metodologia oficial
 * do National Weather Service (NWS / NOAA), baseada na equação de regressão de Rothfusz (1990)
 * com conversão explícita para Fahrenheit, fórmula preliminar de Steadman e ajustes de baixa/alta umidade relativa.
 *
 * @param tempC Temperatura do ar em graus Celsius
 * @param rh Umidade relativa do ar em porcentagem (0 a 100)
 * @returns Índice de calor em graus Celsius (arredondado para 1 casa decimal)
 */
export function calculateHeatIndex(tempC: number, rh: number): number {
  if (isNaN(tempC) || isNaN(rh)) {
    return NaN;
  }
  // Clampa a umidade relativa entre 0 e 100
  const clampedRh = Math.max(0, Math.min(100, rh));
  const tF = tempC * (9 / 5) + 32;

  // Fórmula preliminar simples de Steadman (NWS SR 90-23)
  const simpleHI = 0.5 * (tF + 61.0 + (tF - 68.0) * 1.2 + clampedRh * 0.094);

  // Para valores abaixo de 80 °F (~26.7 °C), o NWS aplica diretamente a equação linear de Steadman
  if (simpleHI < 80) {
    const hiC = (simpleHI - 32) * (5 / 9);
    return Math.round(hiC * 10) / 10;
  }

  // Regressão completa de Rothfusz (9 termos polinomiais)
  let hiF =
    -42.379 +
    2.04901523 * tF +
    10.14333127 * clampedRh -
    0.22475541 * tF * clampedRh -
    0.00683783 * tF * tF -
    0.05481717 * clampedRh * clampedRh +
    0.00122874 * tF * tF * clampedRh +
    0.00085282 * tF * clampedRh * clampedRh -
    0.00000199 * tF * tF * clampedRh * clampedRh;

  // Ajuste 1: Umidade baixa (RH < 13%) e 80 <= tF <= 112
  if (clampedRh < 13 && tF >= 80 && tF <= 112) {
    const adj = ((13 - clampedRh) / 4) * Math.sqrt(Math.max(0, (17 - Math.abs(tF - 95)) / 17));
    hiF -= adj;
  }
  // Ajuste 2: Umidade alta (RH > 85%) e 80 <= tF <= 87
  else if (clampedRh > 85 && tF >= 80 && tF <= 87) {
    const adj = ((clampedRh - 85) / 10) * ((87 - tF) / 5);
    hiF += adj;
  }

  const hiC = (hiF - 32) * (5 / 9);
  return Math.round(hiC * 10) / 10;
}

/**
 * Alias mantido para compatibilidade de nomenclatura
 */
export const calculateRothfuszHeatIndex = calculateHeatIndex;

/**
 * Calcula a Temperatura Aparente de Steadman (1984, 1994) em ambiente sombreado/interno com ventilação.
 * NÃO é sinônimo do Índice de Calor NWS (utiliza pressão de vapor e velocidade do vento).
 *
 * @param tempC Temperatura do ar (°C)
 * @param rh Umidade relativa (%)
 * @param windSpeedMs Velocidade do vento em m/s (padrão: 1.0 m/s para ambientes semi-abertos)
 */
export function calculateApparentTemperature(
  tempC: number,
  rh: number,
  windSpeedMs: number = 1.0
): number {
  if (isNaN(tempC) || isNaN(rh)) return tempC;
  const clampedRh = Math.max(0, Math.min(100, rh));
  // Pressão de vapor d'água (hPa) via equação de Magnus-Tetens
  const e = (clampedRh / 100) * 6.105 * Math.exp((17.27 * tempC) / (237.7 + tempC));
  // Fórmula de Steadman para temperatura aparente
  const at = tempC + 0.33 * e - 0.7 * windSpeedMs - 4.0;
  return Math.round(at * 10) / 10;
}

/**
 * MODELO EXPERIMENTAL DE GANHO TÉRMICO DA ENVOLTÓRIA (Sandbox do Simulador)
 * ATENÇÃO: Trata-se de um modelo determinístico experimental de sensibilidade comparativa
 * para apoiar decisões de intervenção predial. NÃO constitui previsão validada de temperatura interna.
 */
export function estimateEnvelopeGain(
  params: EnvelopeSimulationParameters,
  outdoorTempC: number,
  solarRadiationWm2: number = 750
): {
  estimatedDeltaC: number;
  simulatedIndoorTempC: number;
  label: string;
  caveats: string[];
} {
  let delta = 0;
  const caveats: string[] = [
    'Modelo experimental de sensibilidade - não substitui medição instrumental com sensores.',
  ];

  // 1. Coeficiente de Transmissão Térmica da Cobertura (U-value aproximado)
  switch (params.roofType) {
    case 'telha_metalica':
      delta += 4.5 * (1 - params.shadingFactor * 0.7);
      caveats.push('Telha metálica simples: alta irradiância para o interior da sala.');
      break;
    case 'fibrocimento':
      delta += 3.8 * (1 - params.shadingFactor * 0.6);
      caveats.push('Telha de fibrocimento: condutividade elevada sem barreira radiante.');
      break;
    case 'laje_concreto':
      delta += 2.2;
      caveats.push('Laje maciça: inércia térmica que retarda o pico para o fim do turno da tarde.');
      break;
    case 'termoacustica':
      delta += 0.8;
      caveats.push('Telha termoacústica: atenuação substancial da carga solar.');
      break;
    default:
      delta += 2.5;
  }

  // 2. Radiação Solar e Orientação da Fachada
  const radiationFactor = Math.min(1.2, solarRadiationWm2 / 800);
  if (params.solarOrientation === 'oeste') {
    delta += 2.0 * radiationFactor;
    caveats.push('Fachada voltada para o Oeste recebe insolação crítica no período mais quente do dia.');
  } else if (params.solarOrientation === 'norte') {
    delta += 1.2 * radiationFactor;
  } else if (params.solarOrientation === 'leste') {
    delta += 0.6 * radiationFactor;
  }

  // 3. Ventilação e Remoção de Calor
  if (params.ventilationType === 'cruzada_adequada') {
    delta -= 2.5; // Arrefecimento passivo por fluxo contínuo
  } else if (params.ventilationType === 'unilateral_parcial') {
    delta -= 0.8;
  } else if (params.ventilationType === 'bloqueada_ou_fechada') {
    delta += 1.5;
    caveats.push('Ventilação bloqueada aprisiona calor metabólico e estagna o ar.');
  }

  // 4. Carga Metabólica Interna (Alunos)
  // ~100W por aluno em repouso / sala média de 40m²
  if (params.studentOccupancy >= 40) {
    delta += 1.8;
    caveats.push('Superlotação (≥40 alunos) aumenta significativamente a carga térmica interna.');
  } else if (params.studentOccupancy >= 25) {
    delta += 1.0;
  } else {
    delta += 0.4;
  }

  // 5. Impacto do Status da Rede Elétrica
  if (params.powerGridStatus === 'blackout' || params.powerGridStatus === 'sobrecarga') {
    delta += 3.0;
    caveats.push('Queda ou sobrecarga elétrica desativa ventiladores e ar-condicionado.');
  }

  const simulatedIndoor = Math.round((outdoorTempC + delta) * 10) / 10;
  const roundedDelta = Math.round(delta * 10) / 10;

  let label = 'Ganho Térmico Moderado';
  if (roundedDelta >= 6) label = 'Aprisionamento Térmico Crítico';
  else if (roundedDelta >= 4) label = 'Sobrecarga Térmica Severa';
  else if (roundedDelta <= 0) label = 'Atenuação Passiva Funcional';

  return {
    estimatedDeltaC: roundedDelta,
    simulatedIndoorTempC: simulatedIndoor,
    label,
    caveats,
  };
}

export function getRiskBand(heatIndexC: number): 'normal' | 'atencao' | 'alerta' | 'perigo' {
  if (heatIndexC >= 44) return 'perigo';
  if (heatIndexC >= 40) return 'alerta';
  if (heatIndexC >= 36) return 'atencao';
  return 'normal';
}

/**
 * Classificação oficial dos Níveis de Calor da Cidade do Rio de Janeiro
 * conforme o Decreto Municipal nº 54.740/2024 (Protocolo de Enfrentamento ao Calor Extremo):
 *
 * - NC1 (Rotina / Sem Alerta): Índice de Calor < 36 °C
 * - NC2 (Calor Moderado): Índice de Calor entre 36 °C e 40 °C por 1 a 2 dias consecutivos
 * - NC3 (Calor Alto): Índice de Calor entre 36 °C e 40 °C por 3+ dias consecutivos, OU entre 40 °C e 44 °C por 1 a 2 dias
 * - NC4 (Calor Muito Alto): Índice de Calor entre 40 °C e 44 °C por 3+ dias consecutivos, OU acima de 44 °C por 1 a 2 dias
 * - NC5 (Calor Extremo): Índice de Calor acima de 44 °C por 3 ou mais dias consecutivos
 *
 * @param heatIndexC Índice de calor em graus Celsius
 * @param consecutiveDays Número de dias consecutivos previstos/registrados na mesma faixa (padrão 1)
 */
export function getRioHeatLevel(
  heatIndexC: number,
  consecutiveDays: number = 1
): 'NC1' | 'NC2' | 'NC3' | 'NC4' | 'NC5' {
  if (isNaN(heatIndexC) || heatIndexC < 36) {
    return 'NC1';
  }
  if (heatIndexC >= 36 && heatIndexC < 40) {
    return consecutiveDays >= 3 ? 'NC3' : 'NC2';
  }
  if (heatIndexC >= 40 && heatIndexC <= 44) {
    return consecutiveDays >= 3 ? 'NC4' : 'NC3';
  }
  // heatIndexC > 44
  return consecutiveDays >= 3 ? 'NC5' : 'NC4';
}

export function calculateShiftExposure(
  hourly: HourlyForecastPoint[],
  shift: 'manha' | 'tarde' | 'integral'
): ShiftExposureSummary {
  const startHour = shift === 'manha' ? 7 : shift === 'tarde' ? 12 : 7;
  const endHour = shift === 'manha' ? 12 : shift === 'tarde' ? 17 : 17;

  const shiftPoints = hourly.filter((p) => {
    const date = new Date(p.time);
    const hour = date.getHours();
    return hour >= startHour && hour < endHour;
  });

  if (shiftPoints.length === 0) {
    return {
      shift,
      label: shift === 'manha' ? 'Manhã (07h-12h)' : shift === 'tarde' ? 'Tarde (12h-17h)' : 'Integral (07h-17h)',
      hours36Plus: 0,
      hours40Plus: 0,
      hours44Plus: 0,
      maxHeatIndexC: 0,
      peakHour: '--:--',
      riskBand: 'normal',
    };
  }

  let hours36 = 0;
  let hours40 = 0;
  let hours44 = 0;
  let maxHI = -999;
  let peakHour = '';

  shiftPoints.forEach((pt) => {
    if (pt.heatIndexC >= 36) hours36++;
    if (pt.heatIndexC >= 40) hours40++;
    if (pt.heatIndexC >= 44) hours44++;

    if (pt.heatIndexC > maxHI) {
      maxHI = pt.heatIndexC;
      const d = new Date(pt.time);
      peakHour = `${String(d.getHours()).padStart(2, '0')}:00`;
    }
  });

  const riskBand = getRiskBand(maxHI);

  return {
    shift,
    label: shift === 'manha' ? 'Manhã (07h-12h)' : shift === 'tarde' ? 'Tarde (12h-17h)' : 'Integral (07h-17h)',
    hours36Plus: hours36,
    hours40Plus: hours40,
    hours44Plus: hours44,
    maxHeatIndexC: maxHI,
    peakHour,
    riskBand,
  };
}

/**
 * 1. ÍNDICE DE EXPOSIÇÃO METEOROLÓGICA (IE_met) — Escala 0 a 100
 * Desacoplado da infraestrutura física do prédio.
 */
export function calculateExposureIndex(
  school: SchoolRecord,
  maxForecastHeatIndex: number
): ThermalExposureResult {
  let score = 0;
  let maxPossibleScore = 50; // Base: Previsão meteorológica do tempo (teto 50 pts)
  const factors: string[] = [];

  // Pico de Calor Previsto (0 a 50 pts)
  if (maxForecastHeatIndex >= 44) {
    score += 50;
    factors.push(`Pico térmico extremo em faixa de Perigo (${formatTempPtBr(maxForecastHeatIndex)})`);
  } else if (maxForecastHeatIndex >= 40) {
    score += 38;
    factors.push(`Pico térmico severo em faixa de Alerta (${formatTempPtBr(maxForecastHeatIndex)})`);
  } else if (maxForecastHeatIndex >= 36) {
    score += 24;
    factors.push(`Pico térmico em faixa de Atenção (${formatTempPtBr(maxForecastHeatIndex)})`);
  } else {
    score += 10;
    factors.push(`Pico térmico brando dentro do esperado (${formatTempPtBr(maxForecastHeatIndex)})`);
  }

  // Fator Territorial de Ilha de Calor LST (0 a 35 pts)
  // Limiares de 4,5, 3,0 e 1,5 °C são provisórios e serão recalibrados com os dados reais do Earth Engine.
  if (school.heatIslandFactorLST === null || school.heatIslandFactorLST === undefined || isNaN(school.heatIslandFactorLST)) {
    factors.push('Ilha de calor: pendente');
  } else {
    maxPossibleScore += 35;
    if (school.heatIslandFactorLST >= 4.5) {
      score += 35;
      factors.push(`Inserida em epicentro de ilha de calor (${formatTempPtBr(school.heatIslandFactorLST, { signed: true })} LST)`);
    } else if (school.heatIslandFactorLST >= 3.0) {
      score += 22;
      factors.push(`Ilha de calor moderada no bairro (${formatTempPtBr(school.heatIslandFactorLST, { signed: true })} LST)`);
    } else if (school.heatIslandFactorLST >= 1.5) {
      score += 12;
      factors.push(`Aquecimento de superfície compatível com a média da cidade`);
    } else {
      score += 4;
      factors.push(`Área com menor retenção térmica superficial (orla / encosta)`);
    }
  }

  // Arborização no Entorno (0 a 15 pts)
  if (school.greenCoveragePercent === null || school.greenCoveragePercent === undefined || isNaN(school.greenCoveragePercent)) {
    factors.push('Arborização do entorno: pendente');
  } else {
    maxPossibleScore += 15;
    if (school.greenCoveragePercent < 10) {
      score += 15;
      factors.push(`Escassez severa de verde no quarteirão (< 10%)`);
    } else if (school.greenCoveragePercent < 20) {
      score += 8;
      factors.push(`Baixo sombreamento arbóreo no entorno (${formatPercentIntPtBr(school.greenCoveragePercent)})`);
    }
  }

  const isPartial = maxPossibleScore < 100;
  score = Math.min(100, Math.round(score));

  // O nível passa a ser calculado sobre score / maxPossibleScore nas mesmas proporções (0.75, 0.55, 0.35)
  const ratio = maxPossibleScore > 0 ? score / maxPossibleScore : 0;

  let level: 'baixa' | 'moderada' | 'alta' | 'extrema' = 'baixa';
  let label = isPartial ? 'Exposição Baixa (Índice parcial: só previsão do tempo)' : 'Exposição Baixa';

  if (ratio >= 0.75) {
    level = 'extrema';
    label = isPartial ? 'Exposição Extrema (Índice parcial: só previsão do tempo)' : 'Exposição Extrema';
  } else if (ratio >= 0.55) {
    level = 'alta';
    label = isPartial ? 'Exposição Alta (Índice parcial: só previsão do tempo)' : 'Exposição Alta';
  } else if (ratio >= 0.35) {
    level = 'moderada';
    label = isPartial ? 'Exposição Moderada (Índice parcial: só previsão do tempo)' : 'Exposição Moderada';
  }

  return {
    score,
    level,
    label,
    factors,
    maxPossibleScore,
    isPartial,
  };
}

/**
 * 2. ÍNDICE DE VULNERABILIDADE DA INFRAESTRUTURA ESCOLAR (IV_infra) — Escala 0 a 100
 * Desacoplado do clima momentâneo, refletindo a condição física verificada do prédio.
 * Pondera a data da vistoria e a disparidade entre o Censo oficial e a realidade de campo.
 */
export function calculateInfrastructureVulnerabilityIndex(
  school: SchoolRecord,
  inspection?: SchoolInspection
): InfrastructureVulnerabilityResult {
  let score = 0;
  const factors: string[] = [];
  const activeInspection = inspection || school.inspection;

  let isAudited = false;
  let auditDate: string | undefined = undefined;
  let confidenceMultiplier = 0.65; // Base sem vistoria auditada
  let gapDescription: string | undefined = undefined;

  const censoClimatizedRatio = school.totalRooms > 0 ? school.declaredClimatizedRooms / school.totalRooms : 0;

  if (activeInspection) {
    isAudited = true;
    auditDate = activeInspection.inspectedAt;

    // Cálculo da recência da vistoria para ponderar a confiabilidade
    if (activeInspection.inspectedAt) {
      const inspectTime = new Date(activeInspection.inspectedAt).getTime();
      const nowTime = new Date().getTime();
      const diffDays = Math.max(0, (nowTime - inspectTime) / (1000 * 3600 * 24));

      if (diffDays <= 45) {
        confidenceMultiplier = 1.0; // Vistoria recente (peso total)
      } else if (diffDays <= 120) {
        confidenceMultiplier = 0.85;
      } else {
        confidenceMultiplier = 0.7; // Vistoria antiga
      }
    } else {
      confidenceMultiplier = 0.85;
    }

    // 1. Climatização Real Verificada vs. Censo (Disparidade Crítica)
    if (activeInspection.realAcStatus === 'inoperante_eletrica') {
      score += 45;
      factors.push('Aparelhos inoperantes por sobrecarga elétrica, subestação desarmando ou furto de cabos');
      if (censoClimatizedRatio >= 0.7) {
        gapDescription = `Disparidade: Censo declara ${formatPercentIntPtBr(censoClimatizedRatio * 100)} de climatização, mas vistoria física confirmou inoperância por rede elétrica.`;
      }
    } else if (activeInspection.realAcStatus === 'parcial_inoperante') {
      score += 30;
      factors.push('Parte significativa dos condicionadores de ar está inoperante ou sem manutenção');
    } else if (activeInspection.realAcStatus === 'operante') {
      score += 5;
      factors.push('Climatização funcional e operante verificada in loco');
    } else {
      score += 20;
      factors.push('Condição dos aparelhos não detalhada na vistoria');
    }

    // 2. Material de Cobertura / Telhado (0 a 25 pts)
    if (activeInspection.roofType === 'fibrocimento') {
      score += 22;
      factors.push('Cobertura de telha de fibrocimento sem forro isolante (alta absorção térmica)');
    } else if (activeInspection.roofType === 'telha_metalica') {
      score += 25;
      factors.push('Telha metálica simples sem manta térmica (efeito radiante extremo)');
    } else if (activeInspection.roofType === 'laje_concreto') {
      score += 15;
      factors.push('Laje maciça exposta (inércia térmica que retém calor até o fim da tarde)');
    } else if (activeInspection.roofType === 'termoacustica') {
      score += 3;
      factors.push('Telha termoacústica ou isolamento com manta refletiva');
    }

    // 3. Ventilação Natural Cruzada (0 a 15 pts)
    if (activeInspection.ventilationType === 'bloqueada_ou_fechada') {
      score += 15;
      factors.push('Ventilação natural bloqueada ou janelas mantidas fechadas por ruído urbano');
    } else if (activeInspection.ventilationType === 'unilateral_parcial') {
      score += 8;
      factors.push('Ventilação unilateral com circulação de ar limitada');
    } else if (activeInspection.ventilationType === 'cruzada_adequada') {
      score += 0;
      factors.push('Corrente de ar natural cruzada funcional');
    }

    // 4. Acesso a Água Potável Fresca (0 a 15 pts)
    if (activeInspection.waterAccess === 'critico') {
      score += 15;
      factors.push('Oferta crítica de água resfriada (bebedouros sem filtro ou vazão insuficiente)');
    } else if (activeInspection.waterAccess === 'parcial') {
      score += 7;
      factors.push('Acesso parcial a água resfriada');
    }

  } else {
    // Escola SEM vistoria física: depende apenas do Censo Escolar
    isAudited = false;
    confidenceMultiplier = 0.55;

    if (censoClimatizedRatio < 0.2) {
      score += 40;
      factors.push(`Censo Escolar registra apenas ${formatPercentIntPtBr(censoClimatizedRatio * 100)} das salas climatizadas`);
    } else if (censoClimatizedRatio < 0.6) {
      score += 25;
      factors.push(`Censo Escolar registra climatização parcial (${formatPercentIntPtBr(censoClimatizedRatio * 100)})`);
    } else {
      score += 15;
      factors.push(`Censo Escolar declara climatização em ${formatPercentIntPtBr(censoClimatizedRatio * 100)} das salas`);
    }

    factors.push('AVISO: Dados de telhado, rede elétrica e ventilação permanecem DESCONHECIDOS (sem vistoria)');
  }

  score = Math.min(100, Math.round(score));

  let level: 'adequada' | 'atencao' | 'critica' | 'colapso' = 'adequada';
  let label = 'Infraestrutura Adequada';

  if (score >= 75) {
    level = 'colapso';
    label = 'Vulnerabilidade Crítica / Risco de Colapso';
  } else if (score >= 50) {
    level = 'critica';
    label = 'Alta Vulnerabilidade Estrutural';
  } else if (score >= 30) {
    level = 'atencao';
    label = 'Vulnerabilidade Moderada';
  }

  return {
    score,
    level,
    label,
    factors,
    isAudited,
    auditDate,
    confidenceMultiplier,
    gapDescription,
  };
}

/**
 * 3. MATRIZ DE PRIORIDADE PREVENTIVA COMBINADA
 * Cruza o Índice de Exposição Meteorológica com o Índice de Vulnerabilidade da Infraestrutura.
 */
export function calculateDecoupledRiskEvaluation(
  school: SchoolRecord,
  maxForecastHeatIndex: number,
  inspection?: SchoolInspection
): DecoupledRiskEvaluation {
  const exposure = calculateExposureIndex(school, maxForecastHeatIndex);
  const infrastructure = calculateInfrastructureVulnerabilityIndex(school, inspection);

  // Score ponderado: 45% Exposição + 55% Vulnerabilidade Estrutural
  const combinedScore = Math.round(exposure.score * 0.45 + infrastructure.score * 0.55);

  let combinedPriority: PriorityLevel = 'baixa';
  let operationalGuideline = 'Manter rotina preventiva padrão com incentivo à hidratação.';

  if (combinedScore >= 70 || (exposure.level === 'extrema' && infrastructure.level !== 'adequada')) {
    combinedPriority = 'muito_alta';
    operationalGuideline =
      'URGÊNCIA MÁXIMA: Alta exposição somada a fragilidade estrutural verificada. Priorizar vistoria da SME/SEEDUC, remanejar turmas para áreas sombreadas e ativar centros de hidratação.';
  } else if (combinedScore >= 50 || infrastructure.level === 'colapso') {
    combinedPriority = 'alta';
    operationalGuideline =
      'PRIORIDADE ALTA: Condições térmicas adversas com limitações de refrigeração. Adequar horários da cozinha escolar e suspender atividades físicas ao sol.';
  } else if (combinedScore >= 30) {
    combinedPriority = 'moderada';
    operationalGuideline =
      'ACOMPANHAMENTO: Manter bebedouros abastecidos e janelas abertas para ventilação.';
  }

  const rationales: string[] = [
    `Índice de Exposição Meteorológica: ${exposure.score}/100 (${exposure.label})`,
    `Índice de Vulnerabilidade da Infraestrutura: ${infrastructure.score}/100 (${infrastructure.label})`,
    ...(infrastructure.gapDescription ? [infrastructure.gapDescription] : []),
  ];

  return {
    exposure,
    infrastructure,
    combinedPriority,
    combinedScore,
    operationalGuideline,
    rationales,
  };
}

export function calculateExperimentalPriority(
  school: SchoolRecord,
  maxForecastHeatIndex: number,
  inspection?: SchoolInspection
): { priority: PriorityLevel; score: number; rationales: string[] } {
  const evalResult = calculateDecoupledRiskEvaluation(school, maxForecastHeatIndex, inspection);
  return {
    priority: evalResult.combinedPriority,
    score: evalResult.combinedScore,
    rationales: evalResult.rationales,
  };
}
