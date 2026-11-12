/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { Header } from './components/Header';
import { Monitoring72h } from './components/Monitoring72h';
import { SchoolMap } from './components/SchoolMap';
import { SchoolDetail } from './components/SchoolDetail';
import { HeatwaveSimulator } from './components/HeatwaveSimulator';
import { BulletinsAndReports } from './components/BulletinsAndReports';
import { PilotAndValidation } from './components/PilotAndValidation';
import { NotificationSettingsModal } from './components/NotificationSettingsModal';
import { AboutDataModal } from './components/AboutDataModal';
import { AboutProjectModal } from './components/AboutProjectModal';
import { INITIAL_SCHOOLS, REFERENCE_STATIONS } from './data/schoolsData';
import { HEAT_ISLAND_RESULTS } from './data/heatIslandResults';
import { attachHeatIslandData } from './utils/heatIslandImport';
import { enrichStationsWithDistance } from './utils/inmetUtils';
import { generateScenarioHourlyData, aggregateDaysForecast, WeatherScenarioKey } from './data/mockWeatherScenarios';
import {
  SchoolRecord,
  SchoolInspection,
  DayForecastSummary,
  HourlyForecastPoint,
  AppTab,
  WeatherObservationStation,
  InmetStationsStatusSummary,
} from './types';
import {
  subscribeToAllInspections,
  saveInspectionWithRevision,
  subscribeToAuthState,
  loginWithGoogle,
  logoutUser,
  testConnection,
  SyncStatus,
} from './firebase';
import { User } from 'firebase/auth';
import {
  registerServiceWorker,
  loadNotificationSettings,
  evaluateAndTriggerThermalAlert,
  getNotificationSupport,
} from './utils/serviceWorkerManager';

export default function App() {
  const [activeTab, setActiveTab] = useState<AppTab>('map');
  const [selectedScenario, setSelectedScenario] = useState<WeatherScenarioKey>('live_open_meteo');
  const [isDarkMode, setIsDarkMode] = useState<boolean>(false);
  const [gmpQuotaExceeded, setGmpQuotaExceeded] = useState<boolean>(false);
  const [isAboutDataOpen, setIsAboutDataOpen] = useState<boolean>(false);
  const [isAboutProjectOpen, setIsAboutProjectOpen] = useState<boolean>(false);

  // Estado das Notificações Push do Service Worker
  const [isNotificationModalOpen, setIsNotificationModalOpen] = useState(false);
  const [notificationsActive, setNotificationsActive] = useState(() => {
    const settings = loadNotificationSettings();
    const support = getNotificationSupport();
    return settings.enabled && support.permission === 'granted';
  });

  // Estado de sincronização e autenticação do Firestore
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('connecting');
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  // Escolas com persistência sincronizada no Firestore e anomalias de LST/verde importadas
  const [schools, setSchools] = useState<SchoolRecord[]>(() =>
    attachHeatIslandData(INITIAL_SCHOOLS, HEAT_ISLAND_RESULTS)
  );
  const [selectedSchoolId, setSelectedSchoolId] = useState<string>('esc-33074313'); // E.M. Alfredo de Paula Freitas (Irajá) por padrão

  // Previsão meteorológica horária e agrupamento por dias
  const [hourlyForecast, setHourlyForecast] = useState<HourlyForecastPoint[]>(() =>
    generateScenarioHourlyData('live_open_meteo', new Date(), 0)
  );

  // Estado da previsão meteorológica e qualidade do ar externo (CAMS / Open-Meteo)
  const [isForecastLoading, setIsForecastLoading] = useState<boolean>(true);
  const [airQualityStatus, setAirQualityStatus] = useState<'loading' | 'disponivel' | 'indisponivel'>('loading');

  const [sourceMeta, setSourceMeta] = useState({
    source: 'Open-Meteo Forecast API',
    model: 'DWD ICON / ECMWF',
    fetchedAt: new Date().toISOString(),
    isRealTime: true,
    isFallback: false,
    isCached: false,
  });

  // Estações automáticas reais do INMET (RJ)
  const [rawStations, setRawStations] = useState<WeatherObservationStation[]>(REFERENCE_STATIONS);
  const [inmetStatus, setInmetStatus] = useState<InmetStationsStatusSummary>({
    stationListActive: false,
    tokenConfigured: false,
    inmetAvailable: true,
    fetchedAt: new Date().toISOString(),
    summaryMessage: 'Carregando situação das estações automáticas do INMET...',
    lastError: null,
  });

  // Efeito do modo escuro
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);

  // Escuta de erro de cota da API do Google Maps
  useEffect(() => {
    const handleQuotaExceeded = () => setGmpQuotaExceeded(true);
    window.addEventListener('gmp-quota-exceeded', handleQuotaExceeded);
    return () => {
      window.removeEventListener('gmp-quota-exceeded', handleQuotaExceeded);
    };
  }, []);

  // 1. Registro do Service Worker e escuta de eventos de notificação
  useEffect(() => {
    registerServiceWorker();

    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      const handleSwMessage = (event: MessageEvent) => {
        if (event.data && event.data.type === 'NOTIFICATION_OPEN_SCHOOL') {
          if (event.data.schoolId) {
            setSelectedSchoolId(event.data.schoolId);
            setActiveTab('school');
          }
        }
      };

      navigator.serviceWorker.addEventListener('message', handleSwMessage);
      return () => {
        navigator.serviceWorker.removeEventListener('message', handleSwMessage);
      };
    }
  }, []);

  // 2. Atualização periódica do status de ativação de notificações
  useEffect(() => {
    const settings = loadNotificationSettings();
    const support = getNotificationSupport();
    setNotificationsActive(settings.enabled && support.permission === 'granted');
  }, [isNotificationModalOpen]);

  // Ouvinte de autenticação Firebase Auth
  useEffect(() => {
    const unsubAuth = subscribeToAuthState((user) => {
      setCurrentUser(user);
    });
    return () => unsubAuth();
  }, []);

  // Sincronização em tempo real das vistorias via Firebase Firestore com tratamento de erros
  useEffect(() => {
    let mounted = true;

    // Prova ativa de conexão com o banco nomeado do Firestore
    testConnection().then((ok) => {
      if (ok && mounted) {
        setSyncStatus('synced');
      }
    });

    const unsubscribe = subscribeToAllInspections(
      (inspectionsMap) => {
        if (!mounted) return;
        setSchools((prev) =>
          prev.map((school) => {
            if (inspectionsMap[school.id]) {
              return {
                ...school,
                inspection: inspectionsMap[school.id],
              };
            }
            return school;
          })
        );
      },
      (status) => {
        if (mounted) setSyncStatus(status);
      },
      (error) => {
        console.warn('Alerta na conexão do Firestore:', error);
      }
    );

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, []);

  const currentActiveSchool = schools.find((s) => s.id === selectedSchoolId) || schools[0];
  const activeLat = currentActiveSchool ? currentActiveSchool.latitude : -22.8465;
  const activeLon = currentActiveSchool ? currentActiveSchool.longitude : -43.3482;

  // Busca não bloqueante das estações reais do INMET (RJ) no servidor
  useEffect(() => {
    let isCancelled = false;

    fetch('/api/inmet/stations')
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data) => {
        if (isCancelled) return;
        if (Array.isArray(data?.stations) && data.stations.length > 0) {
          setRawStations(data.stations);
        }
        if (data?.status) {
          setInmetStatus(data.status);
        }
      })
      .catch(() => {
        if (isCancelled) return;
        setRawStations(
          REFERENCE_STATIONS.map((s) => ({
            ...s,
            observationState: 'inmet_indisponivel',
          }))
        );
        setInmetStatus({
          stationListActive: false,
          tokenConfigured: false,
          inmetAvailable: false,
          fetchedAt: new Date().toISOString(),
          summaryMessage: 'INMET indisponível agora; exibindo coordenadas de referência sem leituras.',
          lastError: 'Falha ao consultar /api/inmet/stations.',
        });
      });

    return () => {
      isCancelled = true;
    };
  }, []);

  const enrichedStations = useMemo(
    () => enrichStationsWithDistance(rawStations, activeLat, activeLon),
    [rawStations, activeLat, activeLon]
  );
  const nearestStation = enrichedStations.find((s) => s.isNearest) ?? enrichedStations[0];

  // Busca de previsão meteorológica e qualidade do ar CAMS quando o cenário ou coordenadas mudam
  useEffect(() => {
    let isCancelled = false;

    async function fetchWeatherAndAir() {
      setIsForecastLoading(true);
      setAirQualityStatus('loading');

      const forecastPromise = fetch(
        `/api/forecast?lat=${activeLat}&lon=${activeLon}&scenario=${selectedScenario}`
      )
        .then(async (res) => {
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          return res.json();
        })
        .catch((err) => {
          console.warn('[Fetch Forecast fallback]:', err);
          return {
            source: 'Simulação local (Open-Meteo indisponível)',
            model: 'Simulação experimental determinística',
            fetchedAt: new Date().toISOString(),
            isRealTime: false,
            isFallback: true,
            isCached: false,
            points: generateScenarioHourlyData(selectedScenario, new Date(), 0),
          };
        });

      const airPromise = fetch(`/api/air-quality?lat=${activeLat}&lon=${activeLon}`)
        .then(async (res) => {
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          return res.json();
        })
        .catch((err) => {
          console.warn('[Fetch Air Quality indisponível]:', err);
          return { status: 'indisponivel', points: [] };
        });

      const [forecastData, airData] = await Promise.all([forecastPromise, airPromise]);
      if (isCancelled) return;

      const airAvailable =
        airData &&
        airData.status === 'disponivel' &&
        Array.isArray(airData.points) &&
        airData.points.length > 0;

      setAirQualityStatus(airAvailable ? 'disponivel' : 'indisponivel');

      const airByTime = new Map<string, { pm2_5: number | null; pm10: number | null; ozone: number | null }>();
      const airByHourBucket = new Map<number, { pm2_5: number | null; pm10: number | null; ozone: number | null }>();

      if (airAvailable) {
        for (const ap of airData.points) {
          const vals = {
            pm2_5: ap.pm2_5 ?? null,
            pm10: ap.pm10 ?? null,
            ozone: ap.ozone ?? null,
          };
          airByTime.set(ap.time, vals);
          const ms = new Date(ap.time).getTime();
          if (!Number.isNaN(ms)) {
            airByHourBucket.set(Math.floor(ms / 3600000), vals);
          }
        }
      }

      const rawPoints: HourlyForecastPoint[] =
        forecastData.points && forecastData.points.length > 0
          ? forecastData.points
          : generateScenarioHourlyData(selectedScenario, new Date(), 0);

      const mergedPoints: HourlyForecastPoint[] = rawPoints.map((pt) => {
        if (!airAvailable) {
          return { ...pt, pm2_5: null, pm10: null, ozone: null };
        }
        const exactMatch = airByTime.get(pt.time);
        if (exactMatch) {
          return { ...pt, ...exactMatch };
        }
        const ms = new Date(pt.time).getTime();
        const bucketMatch = !Number.isNaN(ms) ? airByHourBucket.get(Math.floor(ms / 3600000)) : undefined;
        return {
          ...pt,
          pm2_5: bucketMatch ? bucketMatch.pm2_5 : null,
          pm10: bucketMatch ? bucketMatch.pm10 : null,
          ozone: bucketMatch ? bucketMatch.ozone : null,
        };
      });

      setHourlyForecast(mergedPoints);
      setSourceMeta({
        source: forecastData.source,
        model: forecastData.model,
        fetchedAt: forecastData.fetchedAt || new Date().toISOString(),
        isRealTime: Boolean(forecastData.isRealTime),
        isFallback: Boolean(forecastData.isFallback),
        isCached: Boolean(forecastData.isCached),
      });
      setIsForecastLoading(false);
    }

    fetchWeatherAndAir();

    return () => {
      isCancelled = true;
    };
  }, [selectedScenario, activeLat, activeLon]);

  // Atualização atômica da vistoria física com Split Collection e histórico no Firestore
  const handleUpdateInspection = async (
    schoolId: string,
    technicalData: SchoolInspection,
    personalData: { fullName: string; email: string },
    previousVersion: number = 0
  ) => {
    // 1. Atualização otimista imediata na interface
    setSchools((prev) =>
      prev.map((sc) => (sc.id === schoolId ? { ...sc, inspection: technicalData } : sc))
    );

    // 2. Gravação atômica em lote no Firestore
    await saveInspectionWithRevision(schoolId, technicalData, personalData, previousVersion);
  };

  const handleLogin = async () => {
    try {
      await loginWithGoogle();
    } catch (err: any) {
      console.warn('Login com Google cancelado ou com restrição:', err);
    }
  };

  const handleLogout = async () => {
    try {
      await logoutUser();
    } catch (err) {
      console.error('Erro ao sair:', err);
    }
  };

  const daysSummary = aggregateDaysForecast(hourlyForecast);
  const maxForecastHeatIndex = daysSummary[0]?.maxHeatIndexC ?? 39;

  // 3. Avaliação contínua de estresse térmico para disparo do Service Worker
  useEffect(() => {
    const settings = loadNotificationSettings();
    if (!settings.enabled) return;

    const afternoonShift = daysSummary[0]?.shifts.tarde;
    const maxHI = afternoonShift ? afternoonShift.maxHeatIndexC : (daysSummary[0]?.maxHeatIndexC ?? 39);
    const peakHour = afternoonShift ? afternoonShift.peakHour : '14:00';
    const rioLevel = `Nível ${daysSummary[0]?.overallRioLevel ?? 3}`;

    const targetSchool = settings.monitoredSchoolId
      ? schools.find((s) => s.id === settings.monitoredSchoolId) || currentActiveSchool
      : currentActiveSchool;

    evaluateAndTriggerThermalAlert({
      school: targetSchool,
      maxForecastHeatIndex: maxHI,
      peakHour,
      rioLevel,
      currentSettings: settings,
    });
  }, [hourlyForecast, selectedSchoolId, selectedScenario, schools]);

  return (
    <div className="min-h-screen bg-[var(--bg-canvas)] text-[var(--text-primary)] flex flex-col ui-transition overflow-x-clip">
      {gmpQuotaExceeded && (
        <div
          role="alert"
          className="sticky top-0 z-50 px-4 py-2 text-center text-xs font-semibold flex items-center justify-center gap-2 text-white"
          style={{ backgroundColor: 'var(--thermal-5-solid)' }}
        >
          <span>
            Cota da API do Google Maps excedida. Consulte o{' '}
            <a
              href="https://developers.google.com/maps/ai/ai-studio?utm_campaign=gmp_mcp_codeassist_v1_aistudio#quota_exceeded_errors"
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:opacity-90"
            >
              site para desenvolvedores do Google Maps
            </a>{' '}
            para detalhes.
          </span>
          <button
            type="button"
            onClick={() => setGmpQuotaExceeded(false)}
            className="ml-2 px-2 py-1 rounded-[var(--radius-control)] bg-black/25 hover:bg-black/40 text-xs cursor-pointer"
          >
            Fechar
          </button>
        </div>
      )}

      {/* 1. Cabeçalho Fixo e Compacto + Navegação Inferior Mobile */}
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        selectedScenario={selectedScenario}
        setSelectedScenario={setSelectedScenario}
        isDarkMode={isDarkMode}
        setIsDarkMode={setIsDarkMode}
        isRealTimeActive={sourceMeta.isRealTime}
        syncStatus={syncStatus}
        currentUser={currentUser}
        onLogin={handleLogin}
        onLogout={handleLogout}
        onOpenNotificationSettings={() => setIsNotificationModalOpen(true)}
        notificationsActive={notificationsActive}
        onOpenAboutData={() => setIsAboutDataOpen(true)}
      />

      {/* 2. Conteúdo Central */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {activeTab === 'map' && (
          <SchoolMap
            schools={schools}
            stations={enrichedStations}
            selectedSchoolId={selectedSchoolId}
            onSelectSchool={(id) => setSelectedSchoolId(id)}
            onOpenSchoolDetail={(id) => {
              setSelectedSchoolId(id);
              setActiveTab('school');
            }}
            onOpenMonitoring={() => setActiveTab('monitoring')}
            onOpenAboutData={() => setIsAboutDataOpen(true)}
            maxForecastHeatIndex={maxForecastHeatIndex}
            daysSummary={daysSummary}
            airQualityStatus={airQualityStatus}
            isForecastLoading={isForecastLoading}
          />
        )}

        {activeTab === 'monitoring' && (
          <Monitoring72h
            daysSummary={daysSummary}
            hourlyForecast={hourlyForecast}
            stations={enrichedStations}
            sourceMeta={sourceMeta}
            airQualityStatus={airQualityStatus}
            activeSchool={currentActiveSchool}
            onSelectSchoolNavigate={() => setActiveTab('map')}
            onOpenNotificationSettings={() => setIsNotificationModalOpen(true)}
            onOpenAboutData={() => setIsAboutDataOpen(true)}
          />
        )}

        {activeTab === 'school' && (
          <SchoolDetail
            school={currentActiveSchool}
            nearestStation={nearestStation}
            onUpdateInspection={handleUpdateInspection}
            maxForecastHeatIndex={maxForecastHeatIndex}
            onNavigateToBulletins={() => setActiveTab('bulletins')}
            onNavigateToMonitoring={() => setActiveTab('monitoring')}
            currentUser={currentUser}
            onLogin={handleLogin}
          />
        )}

        {activeTab === 'simulator' && <HeatwaveSimulator schools={schools} />}

        {activeTab === 'bulletins' && (
          <BulletinsAndReports
            schools={schools}
            activeSchool={currentActiveSchool}
            daysSummary={daysSummary}
            airQualityStatus={airQualityStatus}
            onSelectSchool={(id) => setSelectedSchoolId(id)}
          />
        )}

        {activeTab === 'pilot' && <PilotAndValidation />}
      </main>

      {/* 3. Rodapé discreto em todas as telas (acima da barra inferior no celular) */}
      <footer className="border-t border-[var(--border-subtle)] bg-[var(--bg-surface)]/80 py-3.5 pb-[calc(4.75rem+env(safe-area-inset-bottom))] xl:pb-3.5 mt-8 text-xs text-[var(--text-muted)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
          <p>© 2026 Bruno Monteiro Euzebio. Termômetro das Escolas RJ.</p>

          <button
            type="button"
            onClick={() => setIsAboutProjectOpen(true)}
            className="min-h-[44px] xl:min-h-0 inline-flex items-center text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] underline underline-offset-4 ui-transition cursor-pointer"
          >
            Sobre o projeto
          </button>
        </div>
      </footer>

      {/* 4. Painel Unificado "Sobre os dados" */}
      <AboutDataModal
        isOpen={isAboutDataOpen}
        onClose={() => setIsAboutDataOpen(false)}
        selectedScenario={selectedScenario}
        onSelectScenario={setSelectedScenario}
        syncStatus={syncStatus}
        inmetStatus={inmetStatus}
      />

      {/* 5. Painel "Sobre o projeto" */}
      <AboutProjectModal
        isOpen={isAboutProjectOpen}
        onClose={() => setIsAboutProjectOpen(false)}
        onOpenAboutData={() => setIsAboutDataOpen(true)}
      />

      {/* 5. Modal de Configuração de Notificações Push do Service Worker */}
      <NotificationSettingsModal
        isOpen={isNotificationModalOpen}
        onClose={() => {
          setIsNotificationModalOpen(false);
          const s = loadNotificationSettings();
          const sup = getNotificationSupport();
          setNotificationsActive(s.enabled && sup.permission === 'granted');
        }}
        schools={schools}
        activeSchool={currentActiveSchool}
        onSelectSchool={(id) => setSelectedSchoolId(id)}
      />
    </div>
  );
}
