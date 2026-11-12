/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect } from 'react';
import { X, Compass, Thermometer, FileCheck2 } from 'lucide-react';
import { THERMAL_SCALE, ThermalStep } from '../styles/designTokens';

interface HowToReadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenAboutData: () => void;
}

export const HowToReadModal: React.FC<HowToReadModalProps> = ({
  isOpen,
  onClose,
  onOpenAboutData,
}) => {
  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const steps: ThermalStep[] = [1, 2, 3, 4, 5];

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-[var(--backdrop-modal)] backdrop-blur-[4px] p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="how-to-read-title"
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-xl max-h-[90vh] overflow-y-auto bg-[var(--bg-surface)] text-[var(--text-primary)] border border-[var(--border-strong)] rounded-t-[var(--radius-card)] sm:rounded-[var(--radius-card)] shadow-[var(--shadow-modal)] p-6 space-y-5 ui-transition"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b border-[var(--border-subtle)] pb-4">
          <div className="space-y-1">
            <span className="text-xs text-[var(--text-muted)]">Guia rápido</span>
            <h2 id="how-to-read-title" className="text-lg font-semibold text-[var(--text-primary)]">
              Como ler este painel
            </h2>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar guia"
            className="min-w-[44px] min-h-[44px] inline-flex items-center justify-center rounded-[var(--radius-control)] border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:bg-[var(--bg-surface-subtle)] ui-transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-4 text-sm text-[var(--text-secondary)] leading-relaxed">
          <div className="flex items-start gap-3">
            <Thermometer className="w-4 h-4 text-[var(--text-primary)] shrink-0 mt-1" />
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-[var(--text-primary)]">
                1. A escala térmica de 5 passos
              </h3>
              <p className="text-xs">
                Todos os marcadores no mapa, índices e selos de prioridade seguem a mesma escala, do azul frio (menor risco) ao vermelho quente (prioridade muito alta).
              </p>
              <div className="grid grid-cols-5 gap-1.5 pt-1">
                {steps.map((s) => {
                  const entry = THERMAL_SCALE[s];
                  return (
                    <div
                      key={s}
                      className="rounded-[var(--radius-control)] border px-2 py-1.5 text-center"
                      style={{
                        backgroundColor: entry.bgVar,
                        borderColor: entry.borderVar,
                        color: entry.textVar,
                      }}
                    >
                      <span
                        className="block w-2.5 h-2.5 rounded-full mx-auto mb-1"
                        style={{ backgroundColor: entry.solidVar }}
                      />
                      <span className="text-[11px] font-semibold block truncate">
                        {entry.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="flex items-start gap-3 pt-2 border-t border-[var(--border-subtle)]">
            <Compass className="w-4 h-4 text-[var(--text-primary)] shrink-0 mt-1" />
            <div className="space-y-1">
              <h3 className="text-sm font-semibold text-[var(--text-primary)]">
                2. O que é dado oficial e o que é estimativa
              </h3>
              <p className="text-xs">
                O cadastro escolar (Inep), a ilha de calor (satélite Landsat) e as árvores no entorno (ESA WorldCover) são dados oficiais. A previsão do tempo vem do Open-Meteo/CAMS. A qualidade do ar dentro da sala é uma estimativa matemática sem sensor físico, e as vistorias exibidas nesta fase piloto são exemplos simulados até a equipe local registrar dados reais.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3 pt-2 border-t border-[var(--border-subtle)]">
            <FileCheck2 className="w-4 h-4 text-[var(--text-primary)] shrink-0 mt-1" />
            <div className="space-y-1">
              <h3 className="text-sm font-semibold text-[var(--text-primary)]">
                3. Como explorar uma escola
              </h3>
              <p className="text-xs">
                Busque pelo nome, bairro ou código INEP, toque em um marcador no mapa e abra a Ficha Técnica para conferir a situação das salas ou atualizar a vistoria de campo.
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-[var(--border-subtle)]">
          <button
            type="button"
            onClick={() => {
              onClose();
              onOpenAboutData();
            }}
            className="min-h-[44px] px-3 py-2 text-xs font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] underline underline-offset-4 ui-transition cursor-pointer"
          >
            Ver fontes completas e ressalva
          </button>

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
