/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect } from 'react';
import { X, Info, Database, CloudSun, Satellite, Wind, ShieldAlert, Radio } from 'lucide-react';
import { WEATHER_SCENARIOS, WeatherScenarioKey } from '../data/mockWeatherScenarios';
import { SyncStatus } from '../firebase';
import { InmetStationsStatusSummary } from '../types';

interface AboutDataModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedScenario: WeatherScenarioKey;
  onSelectScenario: (scenario: WeatherScenarioKey) => void;
  syncStatus: SyncStatus;
  inmetStatus?: InmetStationsStatusSummary;
}

export const AboutDataModal: React.FC<AboutDataModalProps> = ({
  isOpen,
  onClose,
  selectedScenario,
  onSelectScenario,
  syncStatus,
  inmetStatus,
}) => {
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const syncLabel =
    syncStatus === 'synced'
      ? 'Sincronizado com Firestore'
      : syncStatus === 'connecting'
      ? 'Conectando ao Firestore...'
      : syncStatus === 'permission_denied'
      ? 'Acesso restrito (somente leitura pública)'
      : 'Modo offline';

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-[var(--backdrop-modal)] backdrop-blur-[4px] p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="about-data-title"
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-2xl max-h-[90vh] overflow-y-auto bg-[var(--bg-surface)] text-[var(--text-primary)] border border-[var(--border-strong)] rounded-t-[var(--radius-card)] sm:rounded-[var(--radius-card)] shadow-[var(--shadow-modal)] p-6 space-y-6 ui-transition"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b border-[var(--border-subtle)] pb-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
              <Info className="w-4 h-4 shrink-0" />
              <span>Transparência metodológica e origem dos dados</span>
            </div>
            <h2 id="about-data-title" className="text-lg font-semibold text-[var(--text-primary)]">
              Sobre os dados e cenários
            </h2>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar painel sobre os dados"
            className="min-w-[44px] min-h-[44px] inline-flex items-center justify-center rounded-[var(--radius-control)] border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:bg-[var(--bg-surface-subtle)] ui-transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Seleção de Cenário Meteorológico */}
        <section className="space-y-2">
          <label
            htmlFor="about-scenario-select"
            className="block text-sm font-semibold text-[var(--text-primary)]"
          >
            Cenário meteorológico exibido no painel
          </label>
          <select
            id="about-scenario-select"
            value={selectedScenario}
            onChange={(e) => onSelectScenario(e.target.value as WeatherScenarioKey)}
            className="w-full min-h-[44px] px-3 py-2 text-sm bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] rounded-[var(--radius-control)] text-[var(--text-primary)] cursor-pointer"
          >
            {WEATHER_SCENARIOS.map((sc) => (
              <option key={sc.key} value={sc.key}>
                {sc.label}
              </option>
            ))}
          </select>
          <p className="text-xs text-[var(--text-muted)]">
            {WEATHER_SCENARIOS.find((s) => s.key === selectedScenario)?.description}
          </p>
        </section>

        {/* Classificação das Fontes */}
        <section className="space-y-3">
          <h3 className="text-sm font-semibold text-[var(--text-primary)]">
            Procedência por tipo de dado
          </h3>

          <div className="divide-y divide-[var(--border-subtle)] border border-[var(--border-subtle)] rounded-[var(--radius-card)]">
            <div className="p-4 flex items-start gap-3">
              <Database className="w-4 h-4 text-[var(--text-secondary)] shrink-0 mt-0.5" />
              <div className="space-y-1 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold">Cadastro das escolas</span>
                  <span className="px-2 py-0.5 text-xs font-semibold rounded-[var(--radius-control)] bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] text-[var(--text-secondary)]">
                    Dado oficial
                  </span>
                </div>
                <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                  Censo Escolar 2024 e 2025 (Inep), tabela escola via Base dos Dados, e endereços/coordenadas do Catálogo de Escolas do Inep.
                </p>
              </div>
            </div>

            <div className="p-4 flex items-start gap-3">
              <Satellite className="w-4 h-4 text-[var(--text-secondary)] shrink-0 mt-0.5" />
              <div className="space-y-1 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold">Ilha de calor e cobertura arbórea</span>
                  <span className="px-2 py-0.5 text-xs font-semibold rounded-[var(--radius-control)] bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] text-[var(--text-secondary)]">
                    Dado oficial
                  </span>
                </div>
                <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                  Temperatura de superfície (LST) observada por Landsat 8/9 (USGS), verões de 2021/22 a 2025/26, e cobertura arbórea num raio de 200 m (ESA WorldCover), processados via Google Earth Engine.
                </p>
              </div>
            </div>

            <div className="p-4 flex items-start gap-3">
              <CloudSun className="w-4 h-4 text-[var(--text-secondary)] shrink-0 mt-0.5" />
              <div className="space-y-1 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold">Previsão do tempo e ar externo</span>
                  <span className="px-2 py-0.5 text-xs font-semibold rounded-[var(--radius-control)] bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] text-[var(--text-secondary)]">
                    Previsão
                  </span>
                </div>
                <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                  Previsão horária via Open-Meteo Forecast (ECMWF/DWD) e material particulado externo via CAMS (Copernicus) via Open-Meteo Air Quality API, em grade regional de cerca de 45 km (atualização a cada 12h e cache local de 3h).
                </p>
                <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                  A previsão de partículas representa o ar da região, não o ar dentro da sala nem o da rua imediata da escola, servindo para indicar se o dia está limpo ou carregado. O valor de 25 µg/m³ é o limite de PM2,5 da ABNT NBR 17037 para ar interior e funciona aqui como régua para o ar que entraria pela janela.
                </p>
              </div>
            </div>

            <div className="p-4 flex items-start gap-3">
              <Radio className="w-4 h-4 text-[var(--text-secondary)] shrink-0 mt-0.5" />
              <div className="space-y-1 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold">Estações automáticas em superfície (INMET RJ)</span>
                  <span className="px-2 py-0.5 text-xs font-semibold rounded-[var(--radius-control)] bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] text-[var(--text-secondary)]">
                    {inmetStatus?.tokenConfigured ? 'Observação oficial' : 'Cadastro ativo'}
                  </span>
                </div>
                <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                  Situação das estações:{' '}
                  <strong className="font-semibold text-[var(--text-primary)]">
                    {inmetStatus?.summaryMessage ||
                      'Lista de estações ativa, leituras horárias aguardando token.'}
                  </strong>
                </p>
                <p className="text-xs text-[var(--text-muted)] leading-relaxed">
                  As 7 estações automáticas reais no RJ (A621, A603, A601, A627, A636, A652 e A602) nunca exibem leituras inventadas. Leituras simuladas aparecem apenas nos itens marcados como Exemplo fictício.
                </p>
              </div>
            </div>

            <div className="p-4 flex items-start gap-3">
              <Wind className="w-4 h-4 text-[var(--text-secondary)] shrink-0 mt-0.5" />
              <div className="space-y-1 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold">Ar dentro da sala, vistorias e sensores</span>
                  <span className="px-2 py-0.5 text-xs font-semibold rounded-[var(--radius-control)] bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] text-[var(--text-secondary)]">
                    Estimativa / Simulado
                  </span>
                </div>
                <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                  Ar dentro da sala: estimativa por modelo físico de balanço de massa (sem sensor físico), referenciada na ABNT NBR 17037, Lei 13.589/2018, Wargocki e colegas (2020), Araújo, Farias e Farias (2018) e Carrasco, Molina e Jones (AIVC). Vistorias e sensores internos marcados como Exemplo fictício são ilustrativos, salvo vistorias registradas pela equipe autenticada.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Validação algorítmica e calibração de campo */}
        <section className="p-4 rounded-[var(--radius-card)] bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] space-y-2">
          <p className="text-xs font-semibold text-[var(--text-primary)]">
            Validação algorítmica e calibração em campo
          </p>
          <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
            As fórmulas NOAA/NWS Rothfusz, Steadman e o balanço de massa de CO2 são verificadas por testes determinísticos automatizados. Contudo, a temperatura real e a concentração de CO2 dentro das salas de aula exigem calibração empírica presencial, descrita no Protocolo do Piloto Exploratório.
          </p>
        </section>

        {/* Ressalva Institucional */}
        <section className="p-4 rounded-[var(--radius-card)] bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] flex items-start gap-3">
          <ShieldAlert className="w-4 h-4 text-[var(--text-secondary)] shrink-0 mt-0.5" />
          <div className="space-y-1 text-xs text-[var(--text-secondary)] leading-relaxed">
            <p className="font-semibold text-[var(--text-primary)]">Ressalva operacional</p>
            <p>
              Os indicadores e classificações gerados por esta plataforma têm caráter preventivo e pedagógico, seguindo como referência os níveis de calor da SMS-Rio (Decreto 54.740/2024). Não substituem determinações operacionais do Centro de Operações e Resiliência (COR) nem laudos periciais de engenharia de segurança ou medicina do trabalho.
            </p>
            <p className="text-[var(--text-muted)] pt-1">
              Estado de sincronização: {syncLabel}.
            </p>
          </div>
        </section>

        <div className="flex justify-end pt-2">
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] px-5 py-2 rounded-[var(--radius-control)] bg-[var(--action-primary)] text-[var(--action-primary-fg)] hover:bg-[var(--action-primary-hover)] text-sm font-semibold ui-transition cursor-pointer"
          >
            Entendi
          </button>
        </div>
      </div>
    </div>
  );
};
