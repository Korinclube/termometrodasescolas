/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from 'react';
import { HelpCircle, X } from 'lucide-react';

interface TermTooltipProps {
  term: string;
  explanation: string;
  align?: 'left' | 'right';
}

export const TermTooltip: React.FC<TermTooltipProps> = ({
  term,
  explanation,
  align = 'right',
}) => {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', handleOutside);
    window.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      window.removeEventListener('keydown', handleKey);
    };
  }, [open]);

  return (
    <div ref={containerRef} className="relative inline-flex items-center">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((prev) => !prev);
        }}
        aria-label={`Explicação sobre ${term}`}
        aria-expanded={open}
        title={explanation}
        className="w-6 h-6 inline-flex items-center justify-center rounded-full text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-subtle)] ui-transition cursor-pointer"
      >
        <HelpCircle className="w-3.5 h-3.5" />
      </button>

      {open && (
        <div
          role="dialog"
          aria-label={term}
          onClick={(e) => e.stopPropagation()}
          className={`absolute top-full mt-1.5 z-40 w-64 max-w-[calc(100vw-2rem)] p-3 bg-[var(--bg-surface)] text-[var(--text-secondary)] border border-[var(--border-subtle)] rounded-[var(--radius-card)] shadow-[var(--shadow-overlay)] text-xs leading-relaxed ${
            align === 'right' ? 'right-0' : 'left-0'
          }`}
        >
          <div className="flex items-center justify-between gap-2 mb-1">
            <span className="font-semibold text-[var(--text-primary)]">{term}</span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Fechar explicação"
              className="p-1 rounded text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          <p>{explanation}</p>
        </div>
      )}
    </div>
  );
};
