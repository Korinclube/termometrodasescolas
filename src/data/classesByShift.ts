/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { ClassShiftRecord } from '../types';

export const CLASSES_BY_SHIFT_SOURCE =
  'Censo Escolar 2024 (Inep), tabela de turmas, via Base dos Dados. Turmas sem etapa de ensino (atividade complementar e AEE) ficaram de fora. 2024 é o ano mais recente dessa tabela.';

export const CLASSES_BY_SHIFT: Record<string, ClassShiftRecord[]> = {
  "33058610": [
    { "shift": "manha", "classes": 7, "enrollment": 227, "avgClassSize": 32.4, "maxClassSize": 37, "startTime": "07:00", "durationMinutesMin": 315, "durationMinutesMax": 575 },
    { "shift": "tarde", "classes": 2, "enrollment": 70, "avgClassSize": 35.0, "maxClassSize": 37, "startTime": "12:50", "durationMinutesMin": 315, "durationMinutesMax": 315 },
    { "shift": "noite", "classes": 6, "enrollment": 140, "avgClassSize": 23.3, "maxClassSize": 30, "startTime": "18:10", "durationMinutesMin": 265, "durationMinutesMax": 265 }
  ],
  "33062110": [
    { "shift": "manha", "classes": 20, "enrollment": 577, "avgClassSize": 28.9, "maxClassSize": 35, "startTime": "07:30", "durationMinutesMin": 240, "durationMinutesMax": 240 },
    { "shift": "tarde", "classes": 20, "enrollment": 705, "avgClassSize": 35.2, "maxClassSize": 44, "startTime": "12:40", "durationMinutesMin": 320, "durationMinutesMax": 320 },
    { "shift": "noite", "classes": 5, "enrollment": 133, "avgClassSize": 26.6, "maxClassSize": 42, "startTime": "18:00", "durationMinutesMin": 240, "durationMinutesMax": 240 }
  ],
  "33063397": [
    { "shift": "manha", "classes": 24, "enrollment": 803, "avgClassSize": 33.5, "maxClassSize": 39, "startTime": "07:20", "durationMinutesMin": 315, "durationMinutesMax": 325 },
    { "shift": "tarde", "classes": 19, "enrollment": 406, "avgClassSize": 21.4, "maxClassSize": 34, "startTime": "13:00", "durationMinutesMin": 315, "durationMinutesMax": 315 },
    { "shift": "noite", "classes": 11, "enrollment": 265, "avgClassSize": 24.1, "maxClassSize": 36, "startTime": "18:20", "durationMinutesMin": 250, "durationMinutesMax": 270 }
  ],
  "33069131": [
    { "shift": "manha", "classes": 17, "enrollment": 633, "avgClassSize": 37.2, "maxClassSize": 44, "startTime": "07:30", "durationMinutesMin": 250, "durationMinutesMax": 420 }
  ],
  "33072965": [
    { "shift": "manha", "classes": 15, "enrollment": 539, "avgClassSize": 35.9, "maxClassSize": 43, "startTime": "07:30", "durationMinutesMin": 260, "durationMinutesMax": 420 }
  ],
  "33074313": [
    { "shift": "manha", "classes": 10, "enrollment": 239, "avgClassSize": 23.9, "maxClassSize": 31, "startTime": "07:30", "durationMinutesMin": 270, "durationMinutesMax": 420 },
    { "shift": "tarde", "classes": 4, "enrollment": 85, "avgClassSize": 21.3, "maxClassSize": 25, "startTime": "13:00", "durationMinutesMin": 270, "durationMinutesMax": 270 }
  ],
  "33074615": [
    { "shift": "manha", "classes": 18, "enrollment": 490, "avgClassSize": 27.2, "maxClassSize": 33, "startTime": "07:30", "durationMinutesMin": 270, "durationMinutesMax": 270 },
    { "shift": "tarde", "classes": 15, "enrollment": 426, "avgClassSize": 28.4, "maxClassSize": 33, "startTime": "13:00", "durationMinutesMin": 270, "durationMinutesMax": 270 }
  ],
  "33076464": [
    { "shift": "manha", "classes": 9, "enrollment": 264, "avgClassSize": 29.3, "maxClassSize": 34, "startTime": "07:30", "durationMinutesMin": 420, "durationMinutesMax": 420 },
    { "shift": "noite", "classes": 4, "enrollment": 53, "avgClassSize": 13.3, "maxClassSize": 18, "startTime": "18:00", "durationMinutesMin": 240, "durationMinutesMax": 240 }
  ],
  "33077746": [
    { "shift": "manha", "classes": 13, "enrollment": 415, "avgClassSize": 31.9, "maxClassSize": 37, "startTime": "07:30", "durationMinutesMin": 240, "durationMinutesMax": 270 },
    { "shift": "tarde", "classes": 10, "enrollment": 294, "avgClassSize": 29.4, "maxClassSize": 37, "startTime": "13:00", "durationMinutesMin": 240, "durationMinutesMax": 270 }
  ],
  "33086206": [
    { "shift": "manha", "classes": 11, "enrollment": 329, "avgClassSize": 29.9, "maxClassSize": 40, "startTime": "07:30", "durationMinutesMin": 420, "durationMinutesMax": 420 }
  ],
  "33104379": [
    { "shift": "manha", "classes": 18, "enrollment": 585, "avgClassSize": 32.5, "maxClassSize": 45, "startTime": "07:00", "durationMinutesMin": 315, "durationMinutesMax": 315 },
    { "shift": "tarde", "classes": 18, "enrollment": 645, "avgClassSize": 35.8, "maxClassSize": 42, "startTime": "12:45", "durationMinutesMin": 315, "durationMinutesMax": 315 },
    { "shift": "noite", "classes": 8, "enrollment": 236, "avgClassSize": 29.5, "maxClassSize": 40, "startTime": "18:50", "durationMinutesMin": 250, "durationMinutesMax": 250 }
  ],
  "33144591": [
    { "shift": "manha", "classes": 6, "enrollment": 151, "avgClassSize": 25.2, "maxClassSize": 27, "startTime": "07:30", "durationMinutesMin": 480, "durationMinutesMax": 480 }
  ]
};
