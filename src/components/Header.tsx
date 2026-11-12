/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import {
  Thermometer,
  Map,
  FileText,
  Cpu,
  Sliders,
  Moon,
  Sun,
  LogIn,
  LogOut,
  ShieldCheck,
  Bell,
  BellRing,
  Info,
} from 'lucide-react';
import { WeatherScenarioKey } from '../data/mockWeatherScenarios';
import { SyncStatus } from '../firebase';
import { User } from 'firebase/auth';
import { AppTab } from '../types';
import { BrandMark } from './BrandMark';

interface HeaderProps {
  activeTab: AppTab;
  setActiveTab: (tab: AppTab) => void;
  selectedScenario: WeatherScenarioKey;
  setSelectedScenario: (scenario: WeatherScenarioKey) => void;
  isDarkMode: boolean;
  setIsDarkMode: (val: boolean) => void;
  isRealTimeActive: boolean;
  syncStatus: SyncStatus;
  currentUser: User | null;
  onLogin: () => void;
  onLogout: () => void;
  onOpenNotificationSettings: () => void;
  notificationsActive: boolean;
  onOpenAboutData: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  selectedScenario,
  isDarkMode,
  setIsDarkMode,
  currentUser,
  onLogin,
  onLogout,
  onOpenNotificationSettings,
  notificationsActive,
  onOpenAboutData,
}) => {
  const navItems: { id: AppTab; label: string; mobileLabel: string; icon: React.ReactNode }[] = [
    { id: 'map', label: 'Mapa', mobileLabel: 'Mapa', icon: <Map className="w-4 h-4" /> },
    { id: 'monitoring', label: 'Previsão 72h', mobileLabel: '72h', icon: <Thermometer className="w-4 h-4" /> },
    { id: 'school', label: 'Ficha Técnica', mobileLabel: 'Ficha', icon: <FileText className="w-4 h-4" /> },
    { id: 'simulator', label: 'Simulador', mobileLabel: 'Simular', icon: <Sliders className="w-4 h-4" /> },
    { id: 'bulletins', label: 'Boletins & IA', mobileLabel: 'Boletins', icon: <Cpu className="w-4 h-4" /> },
    { id: 'pilot', label: 'Piloto & Validação', mobileLabel: 'Piloto', icon: <ShieldCheck className="w-4 h-4" /> },
  ];

  const isCustomScenario = selectedScenario !== 'live_open_meteo';

  return (
    <>
      <header className="sticky top-0 z-40 bg-[var(--bg-surface)]/95 backdrop-blur-md border-b border-[var(--border-subtle)] ui-transition">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 gap-2 sm:gap-4">
            {/* Zona 1: Logo inline (herda cor do texto, laranja fixo no termômetro) + Nome */}
            <button
              type="button"
              onClick={() => setActiveTab('map')}
              className="flex items-center gap-2.5 min-w-0 shrink sm:shrink-0 cursor-pointer text-left rounded-[var(--radius-control)] py-1 pr-1 text-[var(--text-primary)]"
            >
              <BrandMark className="h-8 w-8 shrink-0" />
              <span className="text-sm sm:text-base font-semibold text-[var(--text-primary)] tracking-tight truncate sm:whitespace-nowrap">
                Termômetro das Escolas RJ
              </span>
            </button>

            {/* Zona 2: Abas no Desktop (a partir de xl = 1280px para nunca sobrepor logo nem cortar controles) */}
            <nav aria-label="Navegação principal" className="hidden xl:flex items-center gap-0.5 2xl:gap-1 text-xs 2xl:text-sm min-w-0">
              {navItems.map((item) => {
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setActiveTab(item.id)}
                    aria-current={isActive ? 'page' : undefined}
                    className={`min-h-[44px] inline-flex items-center gap-1.5 px-2.5 2xl:px-3 rounded-[var(--radius-control)] ui-transition whitespace-nowrap shrink-0 cursor-pointer ${
                      isActive
                        ? 'bg-[var(--action-primary)] text-[var(--action-primary-fg)] font-semibold'
                        : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-subtle)]'
                    }`}
                  >
                    {item.icon}
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </nav>

            {/* Zona 3: Sobre os dados, Entrar, Alertas e Tema */}
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={onOpenAboutData}
                title="Sobre os dados, fontes e seleção de cenário"
                aria-label="Sobre os dados"
                className={`min-h-[44px] min-w-[44px] inline-flex items-center justify-center gap-1.5 px-2.5 rounded-[var(--radius-control)] border text-xs font-semibold ui-transition cursor-pointer whitespace-nowrap ${
                  isCustomScenario
                    ? 'border-[var(--border-strong)] bg-[var(--bg-surface-subtle)] text-[var(--text-primary)]'
                    : 'border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-subtle)]'
                }`}
              >
                <Info className="w-4 h-4 shrink-0" />
                <span className="hidden sm:inline">Sobre os dados</span>
              </button>

              {currentUser ? (
                <div className="min-h-[44px] inline-flex items-center gap-1.5 bg-[var(--bg-surface-subtle)] rounded-[var(--radius-control)] px-2.5 border border-[var(--border-subtle)]">
                  <span
                    className="text-xs font-semibold text-[var(--text-primary)] max-w-[72px] sm:max-w-[96px] truncate"
                    title={currentUser.email || currentUser.displayName || 'Editor'}
                  >
                    {currentUser.displayName?.split(' ')[0] || currentUser.email?.split('@')[0] || 'Editor'}
                  </span>
                  <button
                    type="button"
                    onClick={onLogout}
                    title="Sair da conta"
                    aria-label="Sair da conta"
                    className="min-w-[32px] min-h-[32px] inline-flex items-center justify-center rounded text-[var(--text-muted)] hover:text-[var(--text-primary)] ui-transition cursor-pointer"
                  >
                    <LogOut className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={onLogin}
                  className="min-h-[44px] inline-flex items-center gap-1.5 px-3 text-xs sm:text-sm font-semibold rounded-[var(--radius-control)] bg-[var(--action-primary)] text-[var(--action-primary-fg)] hover:bg-[var(--action-primary-hover)] ui-transition cursor-pointer whitespace-nowrap shrink-0"
                >
                  <LogIn className="w-4 h-4 shrink-0" />
                  <span>Entrar</span>
                </button>
              )}

              <button
                type="button"
                onClick={onOpenNotificationSettings}
                title={notificationsActive ? 'Alertas ativos' : 'Configurar alertas'}
                aria-label="Configurar alertas"
                className="relative min-w-[44px] min-h-[44px] inline-flex items-center justify-center rounded-[var(--radius-control)] border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-subtle)] ui-transition cursor-pointer shrink-0"
              >
                {notificationsActive ? (
                  <>
                    <BellRing className="w-4 h-4 text-[var(--text-primary)]" />
                    <span
                      className="absolute top-2 right-2 w-2 h-2 rounded-full ring-2 ring-[var(--bg-surface)]"
                      style={{ backgroundColor: 'var(--thermal-2-solid)' }}
                    />
                  </>
                ) : (
                  <Bell className="w-4 h-4" />
                )}
              </button>

              <button
                type="button"
                onClick={() => setIsDarkMode(!isDarkMode)}
                title={isDarkMode ? 'Alternar para tema claro' : 'Alternar para tema escuro'}
                aria-label={isDarkMode ? 'Alternar para tema claro' : 'Alternar para tema escuro'}
                className="min-w-[44px] min-h-[44px] inline-flex items-center justify-center rounded-[var(--radius-control)] border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-subtle)] ui-transition cursor-pointer shrink-0"
              >
                {isDarkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Barra Inferior (< 1280px) com ícone e rótulo curto, zero rolagem horizontal */}
      <nav
        aria-label="Navegação inferior"
        className="xl:hidden fixed bottom-0 inset-x-0 z-40 bg-[var(--bg-surface)]/95 backdrop-blur-md border-t border-[var(--border-subtle)] grid grid-cols-6 pb-[env(safe-area-inset-bottom)]"
      >
        {navItems.map((item) => {
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setActiveTab(item.id)}
              aria-current={isActive ? 'page' : undefined}
              className={`relative min-h-[56px] flex flex-col items-center justify-center gap-1 px-1 py-1.5 text-xs ui-transition cursor-pointer min-w-0 ${
                isActive
                  ? 'text-[var(--text-primary)] font-semibold'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
              }`}
            >
              {isActive && (
                <span
                  aria-hidden="true"
                  className="absolute top-0 inset-x-3 h-0.5 rounded-full bg-[var(--action-primary)]"
                />
              )}
              <span className="shrink-0">{item.icon}</span>
              <span className="truncate max-w-full text-[11px] leading-none">
                {item.mobileLabel}
              </span>
            </button>
          );
        })}
      </nav>
    </>
  );
};
