/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useId } from 'react';

interface BrandMarkProps {
  className?: string;
}

export const BrandMark: React.FC<BrandMarkProps> = ({ className = 'h-8 w-8 shrink-0' }) => {
  const maskId = useId();

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 96 96"
      height={32}
      width={32}
      role="img"
      aria-label="Termômetro das Escolas RJ"
      className={className}
    >
      <defs>
        <mask id={maskId}>
          <rect width="96" height="96" fill="#fff" />
          <rect x="41.5" y="36" width="13" height="36" rx="6.5" fill="#000" />
          <circle cx="48" cy="71" r="10.5" fill="#000" />
          <rect x="12" y="64" width="9" height="10" rx="2" fill="#000" />
          <rect x="75" y="64" width="9" height="10" rx="2" fill="#000" />
        </mask>
      </defs>
      <g fill="currentColor" mask={`url(#${maskId})`}>
        <rect x="46.5" y="4" width="3" height="22" rx="1.5" />
        <path d="M49.5 5.5 62 10 49.5 14.5Z" />
        <rect x="6" y="55" width="84" height="34" rx="5" />
        <path d="M26 89V42.6a4 4 0 0 1 1.3-3L45.3 23.4a4 4 0 0 1 5.4 0l18 16.2a4 4 0 0 1 1.3 3V89Z" />
      </g>
      <rect x="45.5" y="48" width="5" height="24" rx="2.5" fill="#F97316" />
      <circle cx="48" cy="71" r="6.5" fill="#F97316" />
    </svg>
  );
};
