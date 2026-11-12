/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';

interface ToggleChipProps {
  label: string;
  active: boolean;
  onClick: () => void;
  dotColor?: string;
  title?: string;
}

export const ToggleChip: React.FC<ToggleChipProps> = ({
  label,
  active,
  onClick,
  dotColor,
  title,
}) => {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      title={title}
      className={`min-h-[44px] inline-flex items-center gap-1.5 px-2.5 text-xs rounded-[var(--radius-control)] border ui-transition cursor-pointer whitespace-nowrap shrink-0 ${
        active
          ? 'bg-[var(--action-primary)] text-[var(--action-primary-fg)] border-[var(--action-primary)] font-semibold'
          : 'bg-[var(--bg-surface)] text-[var(--text-secondary)] border-[var(--border-subtle)] hover:bg-[var(--bg-surface-subtle)] hover:text-[var(--text-primary)]'
      }`}
    >
      {dotColor && (
        <span
          aria-hidden="true"
          className={`w-2.5 h-2.5 rounded-full shrink-0 ${
            active ? 'ring-1 ring-white/60 dark:ring-black/40' : 'opacity-50'
          }`}
          style={{ backgroundColor: dotColor }}
        />
      )}
      <span>{label}</span>
    </button>
  );
};
