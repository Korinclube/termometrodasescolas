/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type EducationStage = 'infantil' | 'fundamental_1' | 'fundamental_2' | 'medio' | 'eja';

export type SchoolNetwork = 'municipal' | 'estadual';

export type ClimatizationDeclaredStatus = 'total' | 'parcial' | 'nenhuma' | 'desconhecida';

export type RealAcStatus = 'operante' | 'parcial_inoperante' | 'inoperante_eletrica' | 'desconhecido';

export type RoofType = 'fibrocimento' | 'laje_concreto' | 'telha_metalica' | 'termoacustica' | 'outro_desconhecido';

export type VentilationType = 'cruzada_adequada' | 'unilateral_parcial' | 'bloqueada_ou_fechada' | 'desconhecido';

export type WaterAccessType = 'adequado_resfriado' | 'parcial' | 'critico' | 'desconhecido';

export type PriorityLevel = 'muito_alta' | 'alta' | 'moderada' | 'baixa';

export type AppTab = 'monitoring' | 'map' | 'school' | 'simulator' | 'bulletins' | 'pilot';

export type DataNature = 'observacao' | 'previsao' | 'cenario_hipotetico' | 'demonstracao' | 'estimativa';

export interface DataProvenance {
  source: string; // Ex: "INMET Estação Vila Militar", "Open-Meteo ECMWF", "Censo Escolar INEP 2023"
  timestamp: string; // Ex: "Medição 14:00 BRT", "Previsão Horária D+0 a D+2", "Ano-base 2023"
  location: string; // Ex: "São Cristóvão / Irajá", "Coordenadas Geográficas Oficiais"
  nature: DataNature; // 'observacao' | 'previsao' | 'cenario_hipotetico' | 'demonstracao'
  natureDescription?: string;
}

export interface TargetRoomProfile {
  id: string;
  roomName: string;
  floor: 'terreo' | 'intermediario' | 'cobertura_sob_telhado';
  solarOrientation: 'norte' | 'sul' | 'leste' | 'oeste';
  roofType: RoofType;
  ventilationCondition: VentilationType;
  averageOccupancy: number;
  sensorDeviceModel: string;
  sensorHeightMeters: number; // 1.1m a 1.5m (zona ocupada)
  distanceFromWindowMeters: number; // >= 1.5m
  distanceFromAcMeters: number; // >= 2.0m
  isHoldoutValidationSample: boolean; // Amostra cega out-of-sample para validação cruzada
  notes?: string;
}

export interface PilotSchoolProfile {
  schoolId: string;
  schoolName: string;
  borough: string;
  region: string;
  pilotTier: 'sentinela_critica' | 'sentinela_contraste' | 'sentinela_verde';
  rationale: string;
  samplingIntervalMinutes: number; // 5 ou 10 min
  scheduleWindow: string; // "07:00 às 17:30 (dias letivos)"
  targetRooms: TargetRoomProfile[];
  primaryDatalogger: string;
  secondaryVerificationDevice?: string;
  status: 'preparacao' | 'em_campo' | 'analise_dados';
}

export type InspectionStatus = 'nao_vistoriada' | 'rascunho' | 'pendente_aprovacao' | 'aprovada' | 'desatualizada';

export interface InfrastructureVulnerabilityResult {
  score: number; // 0 a 100
  level: 'adequada' | 'atencao' | 'critica' | 'colapso';
  label: string;
  factors: string[];
  isAudited: boolean;
  auditDate?: string;
  confidenceMultiplier: number;
  gapDescription?: string;
}

export interface HeatIslandRecord {
  lstC: number | null;
  anomalyMetroC: number | null;
  refMetroC: number | null;
  anomalyMunicipalC: number | null;
  refMunicipalC: number | null;
  nObs: number | null;
  treeCover200mPct: number | null;
  quality: 'ok' | 'poucas_observacoes';
  period: string;
  method: string;
  source: string;
  importedAt: string;
}

export interface ThermalExposureResult {
  score: number; // 0 a 100
  level: 'baixa' | 'moderada' | 'alta' | 'extrema';
  label: string;
  factors: string[];
  maxPossibleScore?: number;
  isPartial?: boolean;
}

export interface DecoupledRiskEvaluation {
  exposure: ThermalExposureResult;
  infrastructure: InfrastructureVulnerabilityResult;
  combinedPriority: PriorityLevel;
  combinedScore: number;
  operationalGuideline: string;
  rationales: string[];
}

export interface ClassShiftRecord {
  shift: 'manha' | 'tarde' | 'noite';
  classes: number;            // número de turmas que começam nesse turno
  enrollment: number;         // matrículas somadas dessas turmas
  avgClassSize: number;       // média de alunos por turma
  maxClassSize: number;       // maior turma
  startTime: string;          // horário de início declarado (HH:MM)
  durationMinutesMin: number; // menor duração diária declarada
  durationMinutesMax: number; // maior duração diária declarada
}

export interface SchoolRecord {
  id: string;
  inepCode: string;
  name: string;
  officialName: string;
  network: SchoolNetwork;
  municipality: string;
  municipalityIbgeCode: string;
  borough: string;
  region: 'Zona Norte' | 'Zona Oeste' | 'Centro/Sul' | 'Baixada Fluminense';
  address: string;
  latitude: number;
  longitude: number;
  coordinatesSource: string;
  totalStudents: number;
  enrollmentByStage: {
    infantil: number;
    fundamental_1: number;
    fundamental_2: number;
    medio: number;
    eja: number;
  };
  nightEnrollment: number;
  stages: EducationStage[];
  shifts: ('manha' | 'tarde' | 'integral')[];
  shiftsInformed: boolean;
  classesByShift?: ClassShiftRecord[];
  classesByShiftSource?: string;
  totalRooms: number;
  declaredClimatizedRooms: number;
  declaredClimatizationStatus: ClimatizationDeclaredStatus;
  climatizationHistory: { year: number; roomsInUse: number; climatizedRooms: number }[];
  dataSource: string;
  dataReferenceYear: number;
  dataQuality: 'alta' | 'media' | 'parcial';
  isSentinel: boolean;
  isDemo?: boolean;
  heatIslandFactorLST: number | null; // Anomalia da temperatura de superfície em °C (Landsat 8/9, verões, método do Termômetro). null = pendente.
  greenCoveragePercent: number | null; // Cobertura arbórea num raio de 200 m (ESA WorldCover). null = pendente.
  heatIsland?: HeatIslandRecord;
  inspection?: SchoolInspection;
  sentinelSensors?: SentinelReading[];
}

export interface SchoolInspection {
  inspectedAt: string;
  inspectorName: string;
  inspectorRole: 'direcao' | 'professor' | 'gremio' | 'comunidade' | 'tecnico_externo';
  realAcStatus: RealAcStatus;
  acNotes?: string;
  roofType: RoofType;
  ventilationType: VentilationType;
  waterAccess: WaterAccessType;
  electricalOverloadReported: boolean;
  cableTheftReported: boolean;
  // Campos de qualidade do ar e ventilação (Parte 6)
  acType?: 'split' | 'janela' | 'central_com_renovacao' | 'ventilador' | 'nenhum' | 'desconhecido';
  windowsOperable?: 'todas_abrem' | 'algumas' | 'nenhuma' | 'desconhecido';
  windowsClosedWhenAcOn?: 'sempre' | 'as_vezes' | 'nunca' | 'desconhecido';
  pmocStatus?: 'visto_documento' | 'informado_sem_documento' | 'nao_tem' | 'desconhecido';
  lastFilterCleaning?: string; // YYYY-MM
  moldOrDampSigns?: boolean;
  nearbyPollutionSource?: 'via_movimentada' | 'obra' | 'queima_de_lixo' | 'industria' | 'nenhuma' | 'desconhecido';
  roomDimensions?: { lengthM: number; widthM: number; heightM: number };
  notes?: string;
  version?: number;
  status?: 'published' | 'draft';
  source?: string;
  approvedAt?: string;
  currentRevisionId?: string;
  legacySchoolId?: string;
}

export interface InspectionRevisionRecord {
  revisionId: string;
  schoolId: string;
  version?: number;
  inspectedAt: string;
  inspectorRole: 'direcao' | 'professor' | 'gremio' | 'comunidade' | 'tecnico_externo';
  realAcStatus: RealAcStatus;
  roofType?: RoofType;
  ventilationType?: VentilationType;
  waterAccess?: WaterAccessType;
  acType?: 'split' | 'janela' | 'central_com_renovacao' | 'ventilador' | 'nenhum' | 'desconhecido';
  windowsOperable?: 'todas_abrem' | 'algumas' | 'nenhuma' | 'desconhecido';
  windowsClosedWhenAcOn?: 'sempre' | 'as_vezes' | 'nunca' | 'desconhecido';
  pmocStatus?: 'visto_documento' | 'informado_sem_documento' | 'nao_tem' | 'desconhecido';
  lastFilterCleaning?: string;
  moldOrDampSigns?: boolean;
  nearbyPollutionSource?: 'via_movimentada' | 'obra' | 'queima_de_lixo' | 'industria' | 'nenhuma' | 'desconhecido';
  roomDimensions?: { lengthM: number; widthM: number; heightM: number };
  acNotes?: string;
  notes?: string;
  createdAt: string;
}

export interface InspectionDraft {
  draftId: string;
  schoolId: string;
  authorUid: string;
  authorEmail: string;
  status: 'draft' | 'submitted_for_review';
  inspectionData: Partial<SchoolInspection>;
  updatedAt: string;
}

export interface InspectorProfile {
  uid: string;
  displayName: string;
  email: string;
  role: 'inspector' | 'reviewer' | 'admin';
  assignedSchools?: string[];
  createdAt: string;
}

export interface EnvelopeSimulationParameters {
  roofType: RoofType;
  ventilationType: VentilationType;
  solarOrientation: 'oeste' | 'norte' | 'leste' | 'sul';
  shadingFactor: number; // 0 a 1 (0 = sem sombra, 1 = sombra total)
  studentOccupancy: number; // 15, 30, 45 alunos
  powerGridStatus: 'normal' | 'blackout' | 'sobrecarga';
}

export interface SentinelReading {
  sensorId: string;
  environment: 'sala_aula' | 'patio_sombreado' | 'cozinha';
  temperatureC: number;
  relativeHumidity: number;
  co2Ppm?: number; // Medição NDIR de CO2 em ppm (kit sentinela piloto)
  recordedAt: string;
  deviceModel: string;
  isCalibrated: boolean;
  notes?: string;
}

export interface HourlyForecastPoint {
  time: string; // ISO string
  temperatureC: number;
  relativeHumidity: number;
  shortwaveRadiationWm2: number;
  windSpeedKmh: number;
  heatIndexC: number;
  apparentTemperatureC?: number;
  heatLevelRio: 'NC1' | 'NC2' | 'NC3' | 'NC4' | 'NC5';
  riskBand: 'normal' | 'atencao' | 'alerta' | 'perigo';
  pm2_5?: number | null; // CAMS Copernicus (µg/m³)
  pm10?: number | null; // CAMS Copernicus (µg/m³)
  ozone?: number | null; // CAMS Copernicus (µg/m³)
}

export interface ShiftExposureSummary {
  shift: 'manha' | 'tarde' | 'integral';
  label: string;
  hours36Plus: number;
  hours40Plus: number;
  hours44Plus: number;
  maxHeatIndexC: number;
  peakHour: string;
  riskBand: 'normal' | 'atencao' | 'alerta' | 'perigo';
}

export interface DayForecastSummary {
  date: string; // YYYY-MM-DD
  dayLabel: string;
  maxTemperatureC: number;
  minTemperatureC: number;
  maxHeatIndexC: number;
  overallRioLevel: 'NC1' | 'NC2' | 'NC3' | 'NC4' | 'NC5';
  shifts: {
    manha: ShiftExposureSummary;
    tarde: ShiftExposureSummary;
    integral: ShiftExposureSummary;
  };
  hourly: HourlyForecastPoint[];
}

export type InmetObservationState =
  | 'aguardando_token'
  | 'leitura'
  | 'dado_atrasado'
  | 'estacao_em_pane'
  | 'inmet_indisponivel';

export interface InmetHourlyObservation {
  dateBrt: string;
  hourBrt: string;
  isoBrt: string;
  utcDate: string;
  utcHour: string;
  temperatureC: number | null;
  tempMaxC: number | null;
  tempMinC: number | null;
  humidityPercent: number | null;
  heatIndexC: number | null;
}

export interface InmetStationsStatusSummary {
  stationListActive: boolean;
  tokenConfigured: boolean;
  inmetAvailable: boolean;
  fetchedAt: string;
  summaryMessage: string;
  lastError: string | null;
}

export interface WeatherObservationStation {
  id: string;
  stationCode?: string;
  name: string;
  network: 'Alerta Rio' | 'INMET' | 'REDMET';
  latitude: number;
  longitude: number;
  lastUpdated: string | null;
  temperatureC?: number | null;
  tempMaxC?: number | null;
  tempMinC?: number | null;
  humidityPercent?: number | null;
  heatIndexC?: number | null;
  status: 'operante' | 'manutencao' | 'intermitente';
  observationState?: InmetObservationState;
  observedAtBrt?: string | null;
  observedTimeLabel?: string | null;
  hourlyObservations?: InmetHourlyObservation[];
  distanceKm?: number;
  isNearest?: boolean;
  maintenanceNotice?: string;
}

export interface PreventiveBulletin {
  id: string;
  schoolId?: string;
  schoolName?: string;
  title: string;
  generatedAt: string;
  forecastWindow: string;
  status: 'rascunho' | 'aprovado' | 'distribuido';
  approvedBy?: string;
  approvalDate?: string;
  summaryText: string;
  whatsappMessage: string;
  recommendedActions: string[];
  clinicalSignAlerts: string[];
  limitationsDisclaimer: string;
}

export interface GeminiStructuredEvaluation {
  schoolId: string;
  schoolName: string;
  evaluationTimestamp: string;
  sourcesUsed: string[];
  dataFreshness: string;
  maxForecastedHeatIndexC: number;
  hoursExposureByBand: {
    above36C: number;
    above40C: number;
    above44C: number;
  };
  confirmedVulnerabilities: string[];
  missingOrUnverifiedInformation: string[];
  experimentalPriorityClassification: PriorityLevel;
  officialCorHeatLevelIfAvailable: string;
  indoorTemperatureStatus: string;
  indoorAirStatus: string; // Avaliação da renovação de ar / CO2 e condições externas
  dataQualityAndLimitations: string;
  recommendedPreventiveActions: string[];
}
