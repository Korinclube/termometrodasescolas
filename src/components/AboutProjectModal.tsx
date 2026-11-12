/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect } from 'react';
import { X, User, Calendar, Mail, Scale } from 'lucide-react';

interface AboutProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenAboutData?: () => void;
}

export const AboutProjectModal: React.FC<AboutProjectModalProps> = ({
  isOpen,
  onClose,
  onOpenAboutData,
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

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-[var(--backdrop-modal)] backdrop-blur-[4px] p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="about-project-title"
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-lg max-h-[90vh] overflow-y-auto bg-[var(--bg-surface)] text-[var(--text-primary)] border border-[var(--border-strong)] rounded-t-[var(--radius-card)] sm:rounded-[var(--radius-card)] shadow-[var(--shadow-modal)] p-6 space-y-5 ui-transition"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b border-[var(--border-subtle)] pb-4">
          <div className="space-y-1">
            <p className="text-xs text-[var(--text-muted)]">
              Termômetro das Escolas RJ
            </p>
            <h2 id="about-project-title" className="text-lg font-semibold text-[var(--text-primary)]">
              Sobre o projeto
            </h2>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar painel sobre o projeto"
            className="min-w-[44px] min-h-[44px] inline-flex items-center justify-center rounded-[var(--radius-control)] border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:bg-[var(--bg-surface-subtle)] ui-transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <dl className="divide-y divide-[var(--border-subtle)] border border-[var(--border-subtle)] rounded-[var(--radius-card)]">
          <div className="p-4 flex items-start gap-3">
            <User className="w-4 h-4 text-[var(--text-secondary)] shrink-0 mt-0.5" />
            <div className="space-y-0.5 min-w-0">
              <dt className="text-xs text-[var(--text-muted)]">Autoria</dt>
              <dd className="text-sm font-semibold text-[var(--text-primary)]">
                Bruno Monteiro Euzebio
              </dd>
            </div>
          </div>

          <div className="p-4 flex items-start gap-3">
            <Calendar className="w-4 h-4 text-[var(--text-secondary)] shrink-0 mt-0.5" />
            <div className="space-y-0.5 min-w-0">
              <dt className="text-xs text-[var(--text-muted)]">Ano de criação</dt>
              <dd className="text-sm font-semibold text-[var(--text-primary)] tabular-nums">
                2026
              </dd>
            </div>
          </div>

          <div className="p-4 flex items-start gap-3">
            <Mail className="w-4 h-4 text-[var(--text-secondary)] shrink-0 mt-0.5" />
            <div className="space-y-0.5 min-w-0">
              <dt className="text-xs text-[var(--text-muted)]">Contato</dt>
              <dd className="text-sm">
                <a
                  href="mailto:brumtro@gmail.com"
                  className="font-semibold text-[var(--text-primary)] underline underline-offset-4 hover:text-[var(--text-secondary)] ui-transition break-all"
                >
                  brumtro@gmail.com
                </a>
              </dd>
            </div>
          </div>
        </dl>

        <div className="p-4 rounded-[var(--radius-card)] bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] flex items-start gap-3">
          <Scale className="w-4 h-4 text-[var(--text-secondary)] shrink-0 mt-0.5" />
          <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
            Código, identidade visual e textos são de autoria do projeto. Os dados públicos pertencem às respectivas fontes.
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
          {onOpenAboutData && (
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenAboutData();
              }}
              className="min-h-[44px] px-4 py-2 rounded-[var(--radius-control)] border border-[var(--border-subtle)] text-xs font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-subtle)] ui-transition cursor-pointer"
            >
              Ver fontes em Sobre os dados
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] px-5 py-2 rounded-[var(--radius-control)] bg-[var(--action-primary)] text-[var(--action-primary-fg)] hover:bg-[var(--action-primary-hover)] text-sm font-semibold ui-transition cursor-pointer"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};
