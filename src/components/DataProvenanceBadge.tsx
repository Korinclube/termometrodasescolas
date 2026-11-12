/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { DataNature, DataProvenance } from '../types';
import { HelpCircle, Clock, MapPin, Database, X } from 'lucide-react';

interface DataProvenanceBadgeProps {
  provenance: DataProvenance;
  variant?: 'inline' | 'compact' | 'card' | 'bar';
  className?: string;
}

export const NATURE_CONFIG: Record<
  DataNature,
  {
    label: string;
    shortLabel: string;
    symbol: string;
    colorClasses: string;
    bgClasses: string;
    borderClasses: string;
    description: string;
  }
> = {
  observacao: {
    label: 'Dado oficial',
    shortLabel: 'Dado oficial',
    symbol: '●',
    colorClasses: 'text-[var(--text-secondary)]',
    bgClasses: 'bg-[var(--bg-surface-subtle)]',
    borderClasses: 'border-[var(--border-subtle)]',
    description: 'Medição física in loco, satélite homologado ou registro oficial (ex.: Censo Escolar Inep, Landsat 8/9, ESA WorldCover).',
  },
  previsao: {
    label: 'Previsão numérica',
    shortLabel: 'Previsão',
    symbol: '◆',
    colorClasses: 'text-[var(--text-secondary)]',
    bgClasses: 'bg-[var(--bg-surface-subtle)]',
    borderClasses: 'border-[var(--border-subtle)]',
    description: 'Projeção meteorológica ou atmosférica gerada por modelos numéricos (Open-Meteo / CAMS Copernicus).',
  },
  cenario_hipotetico: {
    label: 'Simulado',
    shortLabel: 'Simulado',
    symbol: '▲',
    colorClasses: 'text-[var(--text-secondary)]',
    bgClasses: 'bg-[var(--bg-surface-subtle)]',
    borderClasses: 'border-[var(--border-subtle)]',
    description: 'Simulação interativa para análise de sensibilidade e planejamento. Não constitui medição física de campo nem laudo de engenharia.',
  },
  demonstracao: {
    label: 'Simulado',
    shortLabel: 'Simulado',
    symbol: '■',
    colorClasses: 'text-[var(--text-secondary)]',
    bgClasses: 'bg-[var(--bg-surface-subtle)]',
    borderClasses: 'border-[var(--border-subtle)]',
    description: 'Exemplo simulado para demonstração e validação da plataforma piloto.',
  },
  estimativa: {
    label: 'Estimativa',
    shortLabel: 'Estimativa',
    symbol: '◇',
    colorClasses: 'text-[var(--text-secondary)]',
    bgClasses: 'bg-[var(--bg-surface-subtle)]',
    borderClasses: 'border-[var(--border-subtle)]',
    description: 'Calculado por modelo físico a partir de dados públicos. Não é medição por sensor.',
  },
};

export const DataProvenanceBadge: React.FC<DataProvenanceBadgeProps> = ({
  provenance,
  variant = 'compact',
  className = '',
}) => {
  const [showTooltip, setShowTooltip] = useState(false);
  const config = NATURE_CONFIG[provenance.nature] || NATURE_CONFIG.demonstracao;

  if (variant === 'inline') {
    return (
      <span
        className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-[var(--radius-control)] text-xs border ${config.bgClasses} ${config.borderClasses} ${config.colorClasses} ${className}`}
        title={`${config.label}: ${provenance.source} · ${provenance.timestamp} · ${provenance.location}`}
      >
        <span className="font-semibold">{config.shortLabel}</span>
        <span aria-hidden="true" className="opacity-50">·</span>
        <span className="truncate max-w-[160px] text-[var(--text-muted)]">{provenance.source}</span>
      </span>
    );
  }

  if (variant === 'compact') {
    return (
      <div
        className={`relative inline-flex items-center gap-2 px-2.5 py-1 rounded-[var(--radius-control)] text-xs border ${config.bgClasses} ${config.borderClasses} ${className}`}
      >
        <span className={`font-semibold ${config.colorClasses}`}>
          {config.shortLabel}
        </span>
        <span aria-hidden="true" className="text-[var(--border-strong)]">·</span>
        <span className="text-[var(--text-muted)] truncate max-w-[160px]">
          {provenance.source}
        </span>

        <button
          type="button"
          onClick={() => setShowTooltip(!showTooltip)}
          className="text-[var(--text-muted)] hover:text-[var(--text-primary)] ui-transition p-1 cursor-pointer"
          aria-label="Ver detalhes da fonte de dados"
          title="Ver procedência completa"
        >
          <HelpCircle className="w-3.5 h-3.5" />
        </button>

        {showTooltip && (
          <div className="absolute right-0 top-full mt-2 z-50 w-72 p-4 bg-[var(--bg-surface)] rounded-[var(--radius-card)] shadow-[var(--shadow-overlay)] border border-[var(--border-subtle)] text-xs text-[var(--text-secondary)] space-y-2">
            <div className="flex items-center justify-between pb-2 border-b border-[var(--border-subtle)]">
              <span className="font-semibold text-[var(--text-primary)]">
                {config.label}
              </span>
              <button
                type="button"
                onClick={() => setShowTooltip(false)}
                aria-label="Fechar detalhes da fonte"
                className="text-[var(--text-muted)] hover:text-[var(--text-primary)] p-1 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            <p className="leading-relaxed text-[var(--text-secondary)]">
              {provenance.natureDescription || config.description}
            </p>
            <div className="space-y-1.5 pt-1 text-xs">
              <div className="flex items-start gap-2">
                <Database className="w-3.5 h-3.5 text-[var(--text-muted)] shrink-0 mt-0.5" />
                <span>
                  <strong className="font-semibold">Fonte:</strong> {provenance.source}
                </span>
              </div>
              <div className="flex items-start gap-2">
                <Clock className="w-3.5 h-3.5 text-[var(--text-muted)] shrink-0 mt-0.5" />
                <span>
                  <strong className="font-semibold">Referência:</strong> {provenance.timestamp}
                </span>
              </div>
              <div className="flex items-start gap-2">
                <MapPin className="w-3.5 h-3.5 text-[var(--text-muted)] shrink-0 mt-0.5" />
                <span>
                  <strong className="font-semibold">Local:</strong> {provenance.location}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      className={`rounded-[var(--radius-card)] p-3 border flex flex-wrap items-center justify-between gap-3 text-xs ${config.bgClasses} ${config.borderClasses} ${className}`}
    >
      <div className="flex flex-wrap items-center gap-2 sm:gap-3">
        <span
          className={`inline-flex items-center px-2 py-0.5 rounded-[var(--radius-control)] font-semibold ${config.colorClasses} bg-[var(--bg-surface)] border ${config.borderClasses}`}
        >
          {config.shortLabel}
        </span>

        <span className="text-[var(--text-secondary)]">
          <strong className="font-semibold text-[var(--text-primary)]">Fonte:</strong> {provenance.source}
        </span>

        <span aria-hidden="true" className="text-[var(--border-strong)] hidden sm:inline">·</span>

        <span className="text-[var(--text-muted)] hidden sm:inline">
          {provenance.timestamp}
        </span>
      </div>

      <div className="text-xs text-[var(--text-muted)]">
        {provenance.natureDescription || config.description}
      </div>
    </div>
  );
};
