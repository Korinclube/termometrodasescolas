/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  Cpu,
  Layers,
  Thermometer,
  Building2,
  Compass,
  Clock,
  Sparkles,
  HelpCircle,
  FileText,
  Sliders,
  Radio,
  ExternalLink,
  ChevronRight,
  Download,
} from 'lucide-react';
import { DataProvenanceBadge } from './DataProvenanceBadge';
import { PilotSchoolProfile } from '../types';
import { formatNumberPtBr } from '../utils/formatPtBr';

export const PILOT_SCHOOLS: PilotSchoolProfile[] = [
  {
    schoolId: 'esc-33074313',
    schoolName: 'E.M. Alfredo de Paula Freitas',
    borough: 'Irajá',
    region: 'Zona Norte',
    pilotTier: 'sentinela_critica',
    rationale: 'Escola da Zona Norte que declara ao Censo 2025 todas as 12 salas em uso como climatizadas. O piloto vai verificar se a climatização declarada funciona na prática. Ilha de calor e tipo de telhado: a confirmar.',
    samplingIntervalMinutes: 5,
    scheduleWindow: '07:00 às 17:30 (dias letivos)',
    primaryDatalogger: 'Datalogger Comercial USB/Bluetooth (±0,3 °C) + Sensor de CO2 por infravermelho (NDIR), com leitura a cada 10 minutos, junto com temperatura e umidade',
    status: 'preparacao',
    targetRooms: [
      {
        id: 'rm-101',
        roomName: 'Sala 101 - 2º Andar (Sob Cobertura Poente)',
        floor: 'cobertura_sob_telhado',
        solarOrientation: 'oeste',
        roofType: 'outro_desconhecido',
        ventilationCondition: 'unilateral_parcial',
        averageOccupancy: 32,
        sensorDeviceModel: 'Elitech RC-51H (Sensor Interno NTC)',
        sensorHeightMeters: 1.25,
        distanceFromWindowMeters: 1.8,
        distanceFromAcMeters: 2.2,
        isHoldoutValidationSample: false, // Amostra de calibração
        notes: 'Pior caso de exposição à radiação vespertina. Características a confirmar na visita técnica.',
      },
      {
        id: 'rm-102',
        roomName: 'Sala 102 - 1º Andar (Intermediário Sombreado)',
        floor: 'intermediario',
        solarOrientation: 'leste',
        roofType: 'outro_desconhecido',
        ventilationCondition: 'cruzada_adequada',
        averageOccupancy: 30,
        sensorDeviceModel: 'Elitech RC-51H',
        sensorHeightMeters: 1.3,
        distanceFromWindowMeters: 2.0,
        distanceFromAcMeters: 2.5,
        isHoldoutValidationSample: true, // Amostra cega (out-of-sample espacial)
        notes: 'Sala de validação cruzada espacial: não participa do ajuste de coeficientes.',
      },
      {
        id: 'rm-patio',
        roomName: 'Pátio Central Sombreado',
        floor: 'terreo',
        solarOrientation: 'sul',
        roofType: 'outro_desconhecido',
        ventilationCondition: 'cruzada_adequada',
        averageOccupancy: 15,
        sensorDeviceModel: 'Testo 174H (Datalogger Calibrado)',
        sensorHeightMeters: 1.4,
        distanceFromWindowMeters: 3.0,
        distanceFromAcMeters: 5.0,
        isHoldoutValidationSample: true,
        notes: 'Referência de microclima semi-aberto sombreado para comparação com outdoor.',
      },
    ],
  },
  {
    schoolId: 'a-definir',
    schoolName: 'A definir pelo ranking de ilha de calor',
    borough: 'A definir',
    region: 'Zona Oeste ou Baixada Fluminense',
    pilotTier: 'sentinela_critica',
    rationale: 'Será escolhida entre as escolas públicas com maior anomalia de temperatura de superfície no cálculo do Earth Engine.',
    samplingIntervalMinutes: 5,
    scheduleWindow: '07:00 às 17:30 (dias letivos)',
    primaryDatalogger: 'Datalogger Termo-Higrômetro (±0,3 °C / ±3% UR) + Sensor de CO2 por infravermelho (NDIR), leitura a cada 10 minutos',
    status: 'preparacao',
    targetRooms: [],
  },
  {
    schoolId: 'esc-33104379',
    schoolName: 'CIEP 175 José Lins do Rego',
    borough: 'Parque Barreto, São João de Meriti',
    region: 'Baixada Fluminense',
    pilotTier: 'sentinela_contraste',
    rationale: 'Tipologia CIEP, com estrutura de concreto pré-moldado. Declara 18 de 18 salas climatizadas no Censo 2025. Ventilação e cobertura: a confirmar na visita.',
    samplingIntervalMinutes: 10,
    scheduleWindow: '07:00 às 17:30 (dias letivos)',
    primaryDatalogger: 'Datalogger Comercial + Sensor de CO2 por infravermelho (NDIR), com leitura a cada 10 minutos, junto com temperatura e umidade',
    status: 'preparacao',
    targetRooms: [
      {
        id: 'rm-ciep-01',
        roomName: 'Sala 204 - Andar Superior',
        floor: 'cobertura_sob_telhado',
        solarOrientation: 'norte',
        roofType: 'laje_concreto',
        ventilationCondition: 'desconhecido',
        averageOccupancy: 32,
        sensorDeviceModel: 'Testo 174H',
        sensorHeightMeters: 1.3,
        distanceFromWindowMeters: 2.5,
        distanceFromAcMeters: 3.0,
        isHoldoutValidationSample: false,
        notes: 'Avaliação da ventilação natural do sistema CIEP (a confirmar na visita técnica).',
      },
    ],
  },
  {
    schoolId: 'esc-33077746',
    schoolName: 'E.M. Barão da Taquara',
    borough: 'Taquara',
    region: 'Zona Oeste',
    pilotTier: 'sentinela_verde',
    rationale: 'Escola de contraste na Zona Oeste. Percentual de verde no entorno a calcular (ESA WorldCover, raio de 200 m).',
    samplingIntervalMinutes: 10,
    scheduleWindow: '07:00 às 17:30 (dias letivos)',
    primaryDatalogger: 'Datalogger Comercial USB + Sensor de CO2 por infravermelho (NDIR), leitura a cada 10 minutos',
    status: 'preparacao',
    targetRooms: [
      {
        id: 'rm-bt-01',
        roomName: 'Sala 03 - Térreo',
        floor: 'terreo',
        solarOrientation: 'leste',
        roofType: 'outro_desconhecido',
        ventilationCondition: 'cruzada_adequada',
        averageOccupancy: 25,
        sensorDeviceModel: 'Elitech RC-51H',
        sensorHeightMeters: 1.25,
        distanceFromWindowMeters: 2.0,
        distanceFromAcMeters: 2.5,
        isHoldoutValidationSample: true,
        notes: 'Escola de contraste microclimático (a confirmar na visita técnica).',
      },
    ],
  },
];

export const PilotAndValidation: React.FC = () => {
  const [activeSection, setActiveSection] = useState<'separation' | 'protocol' | 'hardware'>('separation');
  const [selectedSchoolId, setSelectedSchoolId] = useState<string>(PILOT_SCHOOLS[0].schoolId);

  const selectedPilot = PILOT_SCHOOLS.find((p) => p.schoolId === selectedSchoolId) || PILOT_SCHOOLS[0];

  return (
    <div className="space-y-6">
      {/* 1. Barra de Procedência Epistêmica da Seção */}
      <DataProvenanceBadge
        provenance={{
          source: 'Protocolo de Metodologia e Auditoria Científica (Plano de Trabalho)',
          timestamp: 'Ciclo Piloto 2024-2025 · Versão Homologada',
          location: 'Rede Pública Municipal do Rio de Janeiro',
          nature: 'observacao',
          natureDescription: 'Diretrizes metodológicas para garantir rigor científico e separar verificação de código da calibração empírica de campo.',
        }}
        variant="bar"
      />

      {/* 2. Cabeçalho e Seletor de Seções */}
      <div className="bg-white dark:bg-slate-900 rounded-xl p-5 border border-slate-200 dark:border-slate-800 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2 py-0.5 rounded-md text-[11px] font-bold uppercase tracking-wider bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20">
                Transparência Científica & Rigor Metodológico
              </span>
            </div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-amber-500" />
              Validações e Protocolo do Piloto Exploratório
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-3xl leading-relaxed">
              O Termômetro das Escolas adota uma política de estrita separação entre verificação matemática de algoritmos de software e comprovação empírica de temperatura interna em salas de aula com sensores de campo.
            </p>
          </div>

          {/* Abas Internas */}
          <div className="flex flex-wrap items-center gap-2 text-xs font-semibold">
            <button
              type="button"
              onClick={() => setActiveSection('separation')}
              className={`px-3 py-2 rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 ${
                activeSection === 'separation'
                  ? 'bg-slate-900 text-white dark:bg-amber-500 dark:text-slate-950 shadow-xs'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>1. Separação das Validações</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveSection('protocol')}
              className={`px-3 py-2 rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 ${
                activeSection === 'protocol'
                  ? 'bg-slate-900 text-white dark:bg-amber-500 dark:text-slate-950 shadow-xs'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              <Compass className="w-3.5 h-3.5" />
              <span>2. Piloto Exploratório em Campo</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveSection('hardware')}
              className={`px-3 py-2 rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 ${
                activeSection === 'hardware'
                  ? 'bg-slate-900 text-white dark:bg-amber-500 dark:text-slate-950 shadow-xs'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              <Cpu className="w-3.5 h-3.5" />
              <span>3. Estratégia de Hardware</span>
            </button>
          </div>
        </div>
      </div>

      {/* SEÇÃO 1: SEPARAÇÃO RIGOROSA DAS VALIDAÇÕES */}
      {activeSection === 'separation' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Bloco Nível 1: Verificação Algorítmica de Software */}
            <div className="bg-white dark:bg-slate-900/80 rounded-lg p-5 border border-emerald-500/30 shadow-xs space-y-4">
              <div className="flex items-start justify-between">
                <div>
                  <span className="px-1.5 py-0.5 rounded-xs text-[10px] font-mono font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-700 dark:text-emerald-400">
                    Nível 1 · Software & Matemática
                  </span>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white mt-1.5 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                    Validação Algorítmica Determinística
                  </h3>
                </div>
                <span className="px-2 py-0.5 rounded-xs text-[10px] font-mono font-bold bg-emerald-500/15 text-emerald-700 dark:text-emerald-300">
                  CALOR, CO2 E REGRAS
                </span>
              </div>

              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                Esta camada verifica se as equações do <strong>NOAA NWS Rothfusz (1990)</strong>, a <strong>Temperatura Aparente de Steadman (1979/1984)</strong>, o balanço de massa de CO2 (ABNT NBR 17037) e as regras do <strong>Decreto Municipal 54.740/2024</strong> foram implementados em TypeScript com rigor numérico.
              </p>

              <div className="bg-slate-50 dark:bg-slate-800/60 rounded-lg p-3 space-y-2 text-xs font-mono">
                <div className="text-[11px] font-bold text-slate-700 dark:text-slate-200 border-b border-slate-200 dark:border-slate-700 pb-1">
                  Resultados da Suíte de Testes Automatizada:
                </div>
                <div className="flex justify-between text-slate-600 dark:text-slate-400">
                  <span>Grade NWS NOAA (80°F a 104°F, 40-100% UR):</span>
                  <strong className="text-emerald-600 dark:text-emerald-400 tabular-nums">54 pontos (Desvio máx: 0,50 ºC)</strong>
                </div>
                <div className="flex justify-between text-slate-600 dark:text-slate-400">
                  <span>Ajustes de alta e baixa umidade de Rothfusz:</span>
                  <strong className="text-emerald-600 dark:text-emerald-400">Ativação exata</strong>
                </div>
                <div className="flex justify-between text-slate-600 dark:text-slate-400">
                  <span>Balanço de massa de CO2 e ABNT NBR 17037:</span>
                  <strong className="text-emerald-600 dark:text-emerald-400">Regime transiente e estacionário</strong>
                </div>
                <div className="flex justify-between text-slate-600 dark:text-slate-400">
                  <span>Tratamento de bordas (NaN, 0% UR e 100% UR):</span>
                  <strong className="text-emerald-600 dark:text-emerald-400">Robusto e seguro</strong>
                </div>
              </div>

              <div className="bg-amber-500/10 rounded-lg p-3 text-xs text-amber-900 dark:text-amber-200 border border-amber-500/30">
                <strong className="block font-bold mb-1 flex items-center gap-1.5 text-amber-950 dark:text-amber-100">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                  Limite Epistemológico do Nível 1:
                </strong>
                <p className="leading-relaxed">
                  Os testes de software comprovam que o código calcula as equações meteorológicas com fidelidade aos relatórios do NWS. <strong>Contudo, eles NÃO comprovam nem medem a temperatura real dentro de nenhuma sala de aula física</strong>.
                </p>
              </div>
            </div>

            {/* Bloco Nível 2: Validação de Campo e Física do Edifício */}
            <div className="bg-white dark:bg-slate-900/80 rounded-lg p-5 border border-amber-500/30 shadow-xs space-y-4">
              <div className="flex items-start justify-between">
                <div>
                  <span className="px-1.5 py-0.5 rounded-xs text-[10px] font-mono font-bold uppercase tracking-wider bg-amber-500/10 text-amber-700 dark:text-amber-400">
                    Nível 2 · Campo & Física do Edifício
                  </span>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white mt-1.5 flex items-center gap-2">
                    <Thermometer className="w-4 h-4 text-amber-500" />
                    Validação de Campo com Sensores Empíricos
                  </h3>
                </div>
                <span className="px-2 py-0.5 rounded-xs text-[10px] font-mono font-bold bg-amber-500/15 text-amber-800 dark:text-amber-300">
                  PILOTO EM PREPARAÇÃO
                </span>
              </div>

              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                A temperatura interna de uma sala de aula sob telha de fibrocimento ou laje de concreto depende de fenômenos complexos de <strong>condução, radiação de ondas longas, ventilação cruzada e calor metabólico dos estudantes (~80-100 W/aluno)</strong>.
              </p>

              <div className="bg-slate-50 dark:bg-slate-800/60 rounded-lg p-3 space-y-2 text-xs">
                <div className="text-[11px] font-bold text-slate-700 dark:text-slate-200 border-b border-slate-200 dark:border-slate-700 pb-1">
                  Exigências para Homologação de Modelos Térmicos Prediais:
                </div>
                <div className="flex items-start gap-2 text-slate-600 dark:text-slate-400">
                  <span className="text-amber-500 font-bold">1.</span>
                  <span><strong>Instrumentação física in situ:</strong> Instalação de termo-higrômetros calibrados e sensor de CO2 por infravermelho (NDIR), com leitura a cada 10 minutos, junto com temperatura e umidade.</span>
                </div>
                <div className="flex items-start gap-2 text-slate-600 dark:text-slate-400">
                  <span className="text-amber-500 font-bold">2.</span>
                  <span><strong>Métricas de campo e registro externo:</strong> Contagem de horas acima de 25 ºC e minutos de aula com CO2 acima de 700 ppm do ar externo. Em cada visita, registrar uma leitura do ar externo, como pede a ABNT NBR 17037.</span>
                </div>
                <div className="flex items-start gap-2 text-slate-600 dark:text-slate-400">
                  <span className="text-amber-500 font-bold">3.</span>
                  <span><strong>Validação cruzada out-of-sample:</strong> O modelo precisa demonstrar acurácia em salas e períodos temporais que não participaram da calibração das trocas de ar.</span>
                </div>
              </div>

              <div className="bg-rose-500/10 rounded-lg p-3 text-xs text-rose-900 dark:text-rose-200 border border-rose-500/30">
                <strong className="block font-bold mb-1 flex items-center gap-1.5 text-rose-950 dark:text-rose-100">
                  <AlertTriangle className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
                  Diretriz Restritiva aos Usuários e Gestores:
                </strong>
                <p className="leading-relaxed">
                  Qualquer temperatura interna simulada exibida no painel tem caráter estritamente de <strong>sensibilidade hipotética</strong>. Não substitui medição física in loco nem pode ser utilizada como atestado pericial ou decisão de encerramento de aulas sem validação da autoridade educacional e sanitária.
                </p>
              </div>
            </div>
          </div>

          {/* Matriz Comparativa Epistêmica */}
          <div className="bg-white dark:bg-slate-900 rounded-xl p-5 border border-slate-200 dark:border-slate-800 shadow-xs space-y-3">
            <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <FileText className="w-4 h-4 text-amber-500" />
              Matriz Epistêmica: O que Cada Módulo do Painel Informa
            </h4>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400">
                    <th className="py-2.5 px-3 font-semibold">Módulo do Sistema</th>
                    <th className="py-2.5 px-3 font-semibold">Fonte Principal</th>
                    <th className="py-2.5 px-3 font-semibold">Natureza dos Dados</th>
                    <th className="py-2.5 px-3 font-semibold">O que é Garantido?</th>
                    <th className="py-2.5 px-3 font-semibold">O que Exige Validação de Campo?</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono text-[11px]">
                  <tr>
                    <td className="py-2.5 px-3 font-bold text-slate-900 dark:text-white">Previsão 72h por Turno</td>
                    <td className="py-2.5 px-3 text-slate-600 dark:text-slate-300">Open-Meteo (ECMWF/DWD)</td>
                    <td className="py-2.5 px-3"><span className="text-sky-600 dark:text-sky-400 font-bold">◆ Previsão Numérica</span></td>
                    <td className="py-2.5 px-3 text-emerald-600 dark:text-emerald-400">Fórmula de IC testada e contínua</td>
                    <td className="py-2.5 px-3 text-slate-500">Incertezas de microclima e brisa local</td>
                  </tr>
                  <tr>
                    <td className="py-2.5 px-3 font-bold text-slate-900 dark:text-white">Estações de Superfície</td>
                    <td className="py-2.5 px-3 text-slate-600 dark:text-slate-300">Alerta Rio & INMET</td>
                    <td className="py-2.5 px-3"><span className="text-emerald-600 dark:text-emerald-400 font-bold">● Observação Real</span></td>
                    <td className="py-2.5 px-3 text-emerald-600 dark:text-emerald-400">Medição física do ar externo</td>
                    <td className="py-2.5 px-3 text-slate-500">Gradiente térmico entre a estação e a escola</td>
                  </tr>
                  <tr>
                    <td className="py-2.5 px-3 font-bold text-slate-900 dark:text-white">Cadastro de Infraestrutura</td>
                    <td className="py-2.5 px-3 text-slate-600 dark:text-slate-300">Censo INEP & Geoportal SME</td>
                    <td className="py-2.5 px-3"><span className="text-emerald-600 dark:text-emerald-400 font-bold">● Observação Cadastral</span></td>
                    <td className="py-2.5 px-3 text-emerald-600 dark:text-emerald-400">Declarações oficiais das escolas</td>
                    <td className="py-2.5 px-3 text-slate-500">Operacionalidade real dos aparelhos de ar</td>
                  </tr>
                  <tr>
                    <td className="py-2.5 px-3 font-bold text-slate-900 dark:text-white">Vistoria Presencial Homologada</td>
                    <td className="py-2.5 px-3 text-slate-600 dark:text-slate-300">Comunidade Escolar / Inspetor</td>
                    <td className="py-2.5 px-3"><span className="text-emerald-600 dark:text-emerald-400 font-bold">● Observação Presencial</span></td>
                    <td className="py-2.5 px-3 text-emerald-600 dark:text-emerald-400">Registro físico de sobrecarga/telhado</td>
                    <td className="py-2.5 px-3 text-slate-500">Periodicidade e re-inspeções após reparos</td>
                  </tr>
                  <tr>
                    <td className="py-2.5 px-3 font-bold text-slate-900 dark:text-white">Simulador de Envoltória</td>
                    <td className="py-2.5 px-3 text-slate-600 dark:text-slate-300">Modelo Teórico de Sensibilidade</td>
                    <td className="py-2.5 px-3"><span className="text-amber-600 dark:text-amber-400 font-bold">▲ Cenário Hipotético</span></td>
                    <td className="py-2.5 px-3 text-emerald-600 dark:text-emerald-400">Diferencial relativo de intervenções</td>
                    <td className="py-2.5 px-3 text-rose-600 dark:text-rose-400 font-bold">Temperatura interna real de salas de aula</td>
                  </tr>
                  <tr>
                    <td className="py-2.5 px-3 font-bold text-slate-900 dark:text-white">CO2 Estimado nas Salas</td>
                    <td className="py-2.5 px-3 text-slate-600 dark:text-slate-300">Censo 2024/2025 + ABNT NBR 17037</td>
                    <td className="py-2.5 px-3"><span className="text-cyan-600 dark:text-cyan-400 font-bold">◇ Estimativa de Modelo</span></td>
                    <td className="py-2.5 px-3 text-emerald-600 dark:text-emerald-400">Tempo até 1.120 ppm e vazão necessária</td>
                    <td className="py-2.5 px-3 text-rose-600 dark:text-rose-400 font-bold">Trocas de ar reais e medições com sensor NDIR</td>
                  </tr>
                  <tr>
                    <td className="py-2.5 px-3 font-bold text-slate-900 dark:text-white">Ar Externo (PM2,5)</td>
                    <td className="py-2.5 px-3 text-slate-600 dark:text-slate-300">CAMS (Copernicus) via Open-Meteo</td>
                    <td className="py-2.5 px-3"><span className="text-sky-600 dark:text-sky-400 font-bold">◆ Previsão Numérica</span></td>
                    <td className="py-2.5 px-3 text-emerald-600 dark:text-emerald-400">Grade regional (~45 km) limpa ou carregada</td>
                    <td className="py-2.5 px-3 text-slate-500">Partículas junto à fachada e rua da escola</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* SEÇÃO 2: PROTOCOLO DO PILOTO EXPLORATÓRIO EM CAMPO */}
      {activeSection === 'protocol' && (
        <div className="space-y-6">
          {/* 1. Visão Geral das Escolas Selecionadas */}
          <div className="bg-white dark:bg-slate-900 rounded-xl p-5 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-amber-500" />
                  Escolas Sentinelas Selecionadas para o Piloto Exploratório
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Quatro unidades públicas com perfis construtivos e climáticos contrastantes para calibração empírica.
                </p>
              </div>

              {/* Seletor de Escola */}
              <div className="flex items-center gap-2 text-xs">
                <span className="text-slate-500 font-medium">Ver detalhes da escola:</span>
                <select
                  value={selectedSchoolId}
                  onChange={(e) => setSelectedSchoolId(e.target.value)}
                  className="bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200 rounded-lg px-2.5 py-1.5 font-bold cursor-pointer focus:ring-1 focus:ring-amber-500"
                >
                  {PILOT_SCHOOLS.map((p) => (
                    <option key={p.schoolId} value={p.schoolId}>
                      {p.schoolName} ({p.borough})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Ficha da Escola Selecionada */}
            <div className="bg-slate-50 dark:bg-slate-800/40 rounded-xl p-4 border border-slate-200 dark:border-slate-800 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 dark:border-slate-700 pb-2">
                <div>
                  <span className="text-xs font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider">
                    {selectedPilot.pilotTier === 'sentinela_critica'
                      ? 'Sentinela Crítica (Alto Risco)'
                      : selectedPilot.pilotTier === 'sentinela_contraste'
                      ? 'Sentinela de Contraste Tipológico'
                      : 'Sentinela de Contraste Microclimático'}
                  </span>
                  <h4 className="text-base font-bold text-slate-900 dark:text-white">
                    {selectedPilot.schoolName}: {selectedPilot.borough} ({selectedPilot.region})
                  </h4>
                </div>

                <div className="flex items-center gap-3 text-xs font-mono">
                  <span>Amostragem: <strong>{selectedPilot.samplingIntervalMinutes} min</strong></span>
                  <span className="text-slate-300 dark:text-slate-700">·</span>
                  <span>Janela: <strong>{selectedPilot.scheduleWindow}</strong></span>
                </div>
              </div>

              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                <strong>Justificativa da Seleção:</strong> {selectedPilot.rationale}
              </p>

              <div className="text-xs text-slate-500 dark:text-slate-400 font-mono flex items-center gap-2">
                <Cpu className="w-3.5 h-3.5 text-slate-400" />
                <span><strong>Equipamento Primário Previsto:</strong> {selectedPilot.primaryDatalogger}</span>
              </div>
            </div>

            {/* Banner de Ressalva das Salas */}
            <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 text-xs text-amber-900 dark:text-amber-200 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
              <span>
                <strong>Aviso de campo:</strong> Ficha de salas preliminar. Nada aqui foi verificado na escola; tudo será confirmado na visita técnica.
              </span>
            </div>

            {/* Salas Mapeadas e Protocolo Out-of-Sample */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                  <Compass className="w-3.5 h-3.5 text-amber-500" />
                  Salas Mapeadas & Validação Cruzada (Amostras de Calibração vs Teste Cego)
                </h4>
              </div>

              {selectedPilot.targetRooms.length === 0 ? (
                <div className="p-6 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-800 text-center text-xs text-slate-500 dark:text-slate-400">
                  Nenhuma sala pré-alocada no momento. As salas serão definidas após o ranking de temperatura de superfície (Earth Engine) e a visita técnica inicial.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {selectedPilot.targetRooms.map((room) => (
                  <div
                    key={room.id}
                    className={`p-3.5 rounded-xl border text-xs space-y-2 transition-colors ${
                      room.isHoldoutValidationSample
                        ? 'bg-sky-50/50 dark:bg-sky-950/20 border-sky-300 dark:border-sky-800'
                        : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <span className="font-bold text-slate-900 dark:text-white">{room.roomName}</span>
                      <span
                        className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-sm ${
                          room.isHoldoutValidationSample
                            ? 'bg-sky-500/20 text-sky-700 dark:text-sky-300'
                            : 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300'
                        }`}
                      >
                        {room.isHoldoutValidationSample ? 'TESTE CEGO (HOLDOUT)' : 'CALIBRAÇÃO'}
                      </span>
                    </div>

                    <div className="space-y-1 font-mono text-[11px] text-slate-600 dark:text-slate-400">
                      <div className="flex justify-between">
                        <span>Pavimento:</span>
                        <strong className="text-slate-800 dark:text-slate-200">
                          {room.floor === 'cobertura_sob_telhado' ? 'Último Andar (Telhado)' : room.floor}
                        </strong>
                      </div>
                      <div className="flex justify-between">
                        <span>Orientação Solar:</span>
                        <span className="uppercase">{room.solarOrientation}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Telhado / Envoltória:</span>
                        <span>{room.roofType}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Ventilação:</span>
                        <span>{room.ventilationCondition}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Lotação de Alunos:</span>
                        <span>{room.averageOccupancy} alunos (~{room.averageOccupancy * 90}W metabólico)</span>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-1 text-[11px] text-slate-500">
                      <div>Posição do Sensor: <strong>{formatNumberPtBr(room.sensorHeightMeters, { decimals: 2 })} m do piso</strong></div>
                      <div>Distância Janela: <strong>≥ {formatNumberPtBr(room.distanceFromWindowMeters, { decimals: 1 })} m (sem sol direto)</strong></div>
                      <div>Distância Climatizador: <strong>≥ {formatNumberPtBr(room.distanceFromAcMeters, { decimals: 1 })} m</strong></div>
                      {room.notes && <div className="italic text-[10px] text-slate-400 mt-1">{room.notes}</div>}
                    </div>
                  </div>
                ))}
              </div>
              )}
            </div>
          </div>

          {/* Diretrizes Técnicas de Instalação dos Sensores */}
          <div className="bg-white dark:bg-slate-900 rounded-xl p-5 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Sliders className="w-4 h-4 text-amber-500" />
              Diretrizes Técnicas de Posicionamento Físico dos Sensores nas Salas
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
              <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-800 space-y-1.5">
                <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 font-bold">
                  <span className="w-5 h-5 rounded-md bg-amber-500/20 flex items-center justify-center text-xs font-mono">1</span>
                  <span>Altura na Zona Ocupada</span>
                </div>
                <p className="text-slate-600 dark:text-slate-400 leading-relaxed text-[11px]">
                  Fixar entre <strong>1,10 m e 1,50 m</strong> do piso acabado. Esta é a altura correspondente à zona de respiração e trocas térmicas dos estudantes sentados.
                </p>
              </div>

              <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-800 space-y-1.5">
                <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 font-bold">
                  <span className="w-5 h-5 rounded-md bg-amber-500/20 flex items-center justify-center text-xs font-mono">2</span>
                  <span>Blindagem Solar Direta</span>
                </div>
                <p className="text-slate-600 dark:text-slate-400 leading-relaxed text-[11px]">
                  O sensor <strong>NUNCA pode receber incidência solar direta</strong> através de janelas. O feixe solar direto sobre o termistor distorce a leitura em até +6 ºC.
                </p>
              </div>

              <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-800 space-y-1.5">
                <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 font-bold">
                  <span className="w-5 h-5 rounded-md bg-amber-500/20 flex items-center justify-center text-xs font-mono">3</span>
                  <span>Leitura do Ar Externo (NBR 17037)</span>
                </div>
                <p className="text-slate-600 dark:text-slate-400 leading-relaxed text-[11px]">
                  Em cada visita, registrar uma leitura do ar externo, como pede a ABNT NBR 17037, para calcular o diferencial exato de CO2 (+700 ppm) e verificar PM2,5 local.
                </p>
              </div>

              <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-800 space-y-1.5">
                <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 font-bold">
                  <span className="w-5 h-5 rounded-md bg-amber-500/20 flex items-center justify-center text-xs font-mono">4</span>
                  <span>Afastamento de Fluxos</span>
                </div>
                <p className="text-slate-600 dark:text-slate-400 leading-relaxed text-[11px]">
                  Manter no mínimo <strong>2,0 m de distância</strong> de saídas diretas de ar-condicionado ou ventiladores para registrar a concentração média de CO2 e a temperatura da sala.
                </p>
              </div>
            </div>

            {/* Metodologia de Validação Cruzada Out-of-Sample */}
            <div className="bg-sky-50 dark:bg-sky-950/30 rounded-xl p-4 border border-sky-200 dark:border-sky-800 text-xs space-y-2">
              <h4 className="font-bold text-sky-900 dark:text-sky-200 flex items-center gap-2 text-sm">
                <ShieldCheck className="w-4 h-4 text-sky-600 dark:text-sky-400" />
                Protocolo de Validação Cruzada (Out-of-Sample / Teste Cego)
              </h4>
              <p className="text-sky-800 dark:text-sky-300 leading-relaxed">
                Para evitar sobreajuste (overfitting) dos coeficientes térmicos da envoltória, os dados coletados são divididos estritamente em duas classes:
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div className="bg-white/80 dark:bg-slate-900/80 p-3 rounded-lg border border-sky-200 dark:border-sky-800/80">
                  <strong className="block text-slate-900 dark:text-white font-mono text-[11px] mb-1">
                    A) Validação Cruzada Espacial (Salas Holdout)
                  </strong>
                  <span className="text-[11px] text-slate-600 dark:text-slate-300">
                    O modelo térmico predial é calibrado com os dados das salas do piso superior (ex: Sala 101) e sua capacidade preditiva é testada cegamente na Sala 102 e no Pátio, sem recalibração dos parâmetros.
                  </span>
                </div>
                <div className="bg-white/80 dark:bg-slate-900/80 p-3 rounded-lg border border-sky-200 dark:border-sky-800/80">
                  <strong className="block text-slate-900 dark:text-white font-mono text-[11px] mb-1">
                    B) Validação Cruzada Temporal (Semanas Independentes)
                  </strong>
                  <span className="text-[11px] text-slate-600 dark:text-slate-300">
                    Os coeficientes ajustados em uma semana padrão de verão são testados cegamente em um evento subsequente de onda de calor extrema ou passagem de frente fria de transição.
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SEÇÃO 3: ESTRATÉGIA DE HARDWARE (PRATELEIRA VS PROPRIETÁRIO) */}
      {activeSection === 'hardware' && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-slate-900 rounded-xl p-5 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
            <div>
              <span className="px-2 py-0.5 rounded-xs text-[10px] font-bold uppercase tracking-wider bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                Diretriz de Equipamentos
              </span>
              <h3 className="text-base font-bold text-slate-900 dark:text-white mt-1 flex items-center gap-2">
                <Cpu className="w-4 h-4 text-amber-500" />
                Decisão Estratégica: Equipamentos Comerciais de Prateleira (Off-the-Shelf)
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-3xl leading-relaxed">
                Priorização de dataloggers comerciais consolidados para a fase piloto exploratória, adiando o desenvolvimento de hardware proprietário (ESP32/LoRaWAN) para etapa posterior, caso surja necessidade concreta não atendida no mercado.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Opção Escolhida para o Piloto: Dataloggers de Prateleira */}
              <div className="p-4 rounded-xl border-2 border-emerald-500/40 bg-emerald-500/5 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider">
                    Opção Adotada no Piloto (Fase Atual)
                  </span>
                  <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-xs bg-emerald-500/20 text-emerald-700 dark:text-emerald-300">
                    PRIORITÁRIO
                  </span>
                </div>

                <h4 className="text-base font-bold text-slate-900 dark:text-white">
                  Dataloggers Calibrados + Sensor de CO2 por infravermelho (NDIR)
                </h4>

                <ul className="text-xs space-y-2 text-slate-600 dark:text-slate-300">
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
                    <span><strong>Calibração e amostragem integrada:</strong> Sensor de CO2 por infravermelho (NDIR), com leitura a cada 10 minutos, junto com temperatura e umidade (±0,3 °C / ±3% UR).</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
                    <span><strong>Autonomia e Segurança:</strong> Memória interna não volátil (não depende do Wi-Fi escolar) e registro comparativo com leitura externa a cada visita técnica (ABNT NBR 17037).</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
                    <span><strong>Métricas de campo conjuntas:</strong> Horas de aula acima de 25 ºC e minutos de aula com CO2 acima de 700 ppm do ar externo.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
                    <span><strong>Aceitação Auditável:</strong> Aparelhos com certificados de calibração aceitos em perícias e pesquisas científicas.</span>
                  </li>
                </ul>
              </div>

              {/* Opção Postergada: Hardware Proprietário */}
              <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/30 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                    Opção Postergada (Etapa Posterior)
                  </span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-xs bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                    ETAPA FUTURA
                  </span>
                </div>

                <h4 className="text-base font-bold text-slate-900 dark:text-white">
                  Hardware Proprietário IoT (ESP32 + Sensor NDIR + LoRaWAN)
                </h4>

                <ul className="text-xs space-y-2 text-slate-500 dark:text-slate-400">
                  <li className="flex items-start gap-2">
                    <span className="text-slate-400">•</span>
                    <span><strong>Precedente nacional de acurácia:</strong> O projeto Sala de Aula Saudável (UVV e UFES) comparou um medidor de baixo custo com ESP32 a um registrador de referência (HOBO MX1102A) numa sala de aula climatizada no Espírito Santo, com erro de cerca de 67 ppm (RMSE).</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-slate-400">•</span>
                    <span><strong>Custo e Tempo de Engenharia:</strong> Exige confecção de PCB, gabinete, homologação Anatel e infraestrutura de rede dedicada em escolas públicas.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-slate-400">•</span>
                    <span><strong>Condição de Acionamento:</strong> Só será projetado caso o piloto comprove inviabilidade da coleta por Bluetooth/USB ou haja financiamento para telemetria contínua em larga escala.</span>
                  </li>
                </ul>
              </div>
            </div>

            <div className="bg-slate-100 dark:bg-slate-800/80 rounded-xl p-4 text-xs text-slate-700 dark:text-slate-300 space-y-1">
              <strong className="block text-slate-900 dark:text-white">
                Critério de Sucesso do Piloto Exploratório:
              </strong>
              <p className="leading-relaxed">
                O piloto será considerado bem-sucedido quando produzir 30 dias contínuos de registros em 10 salas representativas (horas acima de 25 ºC e minutos de aula com CO2 acima de 700 ppm do ar externo), permitindo confrontar as estimativas matemáticas de envoltória e de trocas de ar com as curvas reais, quantificando o Erro Médio Absoluto (MAE) e o índice R² dos modelos.
              </p>
            </div>

            {/* Referências Técnicas e Legais */}
            <div className="bg-slate-50 dark:bg-slate-800/40 rounded-xl p-4 border border-slate-200 dark:border-slate-800 text-xs space-y-2">
              <strong className="block text-slate-900 dark:text-white">
                Referências Científicas e Normativas de Qualidade do Ar Interior:
              </strong>
              <ul className="list-disc pl-5 space-y-1 text-[11px] text-slate-600 dark:text-slate-400">
                <li>Wargocki e colegas, Building and Environment 173 (2020), artigo 106749 (desempenho escolar e concentração de CO2).</li>
                <li>Araújo, Farias e Farias, CONTECC 2018 (UFCG) (medições de CO2 em salas de aula climatizadas com split).</li>
                <li>Carrasco, Molina e Jones (AIVC) (taxas de geração metabólica de CO2 em estudantes por faixa etária).</li>
                <li>Lei 13.589/2018 (obrigatoriedade do Plano de Manutenção, Operação e Controle, PMOC).</li>
                <li>ABNT NBR 17037 (referência técnica brasileira para qualidade do ar interior em ambientes climatizados).</li>
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
