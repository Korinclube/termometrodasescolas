/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export const LEGACY_SCHOOL_ID_MAP: Record<string, string> = {
  'esc-33075210': 'esc-33074313', // E.M. Alfredo de Paula Freitas
  'esc-33075228': 'esc-33144591', // Creche Municipal Jécia de Freitas Ferreira
  'esc-33075341': 'esc-33074615', // E.M. Olegário Mariano
  'esc-33074094': 'esc-33076464', // E.M. Waldemar Falcão
  'esc-33074159': 'esc-33072965', // E.M. Manoel Bomfim
  'esc-33068990': 'esc-33069131', // E.M. Bahia
  'esc-33069123': 'esc-33086206', // E.M. Tenente Antônio João
  'esc-33011005': 'esc-33063397', // C.E. Amaro Cavalcanti
  'esc-33035012': 'esc-33058610', // C.E. Dom Walmor
  'esc-33041520': 'esc-33062110', // E.M. Prof. Scintilla Exel
  'esc-33067145': 'esc-33104379', // CIEP 175 José Lins do Rego (piloto)
  'esc-33081946': 'esc-33077746', // E.M. Barão da Taquara (piloto)
};

// IDs antigos sem escola real correspondente (órfãos): não apagar, só listar na auditoria.
export const ORPHAN_LEGACY_SCHOOL_IDS = [
  'esc-33074124', // "E.M. Carlos Gomes" (a escola real com esse nome é uma creche, outro código)
  'esc-33020011', // "C.E. Cascadura"
  'esc-33051001', // "E.M. Bangu"
  'esc-33051099', // "C.E. Professor Diniz Neves"
  'esc-33017045', // "C.E. Visconde de Abaeté"
  'esc-33062836', // "E.M. Bangu" do piloto
];
