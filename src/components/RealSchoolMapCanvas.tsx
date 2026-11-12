/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  APIProvider,
  APILoadingStatus,
  AdvancedMarker,
  AltitudeMode,
  Circle,
  InfoWindow,
  Map as GoogleMap,
  Pin,
  useAdvancedMarkerRef,
  useApiLoadingStatus,
  useMap,
} from '@vis.gl/react-google-maps';
import {
  GestureHandling,
  Map3D,
  Map3DRef,
  MapMode,
  Marker3D,
  Polygon3D,
  Popover,
} from '@vis.gl/react-google-maps/3d';
import {
  ChevronDown,
  Compass,
  Crosshair,
  Globe,
  Layers,
  Loader2,
  Map as MapIcon,
  Maximize2,
  RotateCw,
  Satellite,
  Square,
  AlertTriangle,
} from 'lucide-react';
import { SchoolRecord, WeatherObservationStation } from '../types';
import { calculateDecoupledRiskEvaluation } from '../utils/thermalMath';
import { priorityToThermalStep, THERMAL_SCALE, ThermalStep } from '../styles/designTokens';
import { formatIntegerPtBr, formatPercentIntPtBr, formatTempPtBr } from '../utils/formatPtBr';

export type MapVisualMode = '3d' | 'hybrid' | 'terrain' | 'roadmap';

export const LAYER_DOT_COLORS = {
  heatIslands: '#c2410c', // THERMAL_SCALE[4]
  greenAreas: '#0f766e',  // THERMAL_SCALE[2]
  stations: '#1d4ed8',    // THERMAL_SCALE[1]
} as const;

export interface SchoolMarkerEvaluation {
  school: SchoolRecord;
  priorityKey: 'muito_alta' | 'alta' | 'moderada' | 'baixa';
  thermalStep: ThermalStep;
}

interface RealSchoolMapCanvasProps {
  schools: SchoolRecord[];
  schoolMarkers?: SchoolMarkerEvaluation[];
  stations: WeatherObservationStation[];
  activeSchool: SchoolRecord | undefined;
  maxForecastHeatIndex: number;
  showHeatIslands: boolean;
  showGreenAreas: boolean;
  showStations: boolean;
  onSelectSchool: (schoolId: string) => void;
  onOpenSchoolDetail: (schoolId: string) => void;
}

const ATTRIBUTION_IDS = ['gmp_mcp_codeassist_v1_aistudio'];
const MAP_LIBRARIES: ('maps3d' | 'marker')[] = ['maps3d', 'marker'];
const DEFAULT_RMRJ_CENTER = { lat: -22.845, lng: -43.39 };

const MIN_ZOOM = 10;
const MAX_ZOOM_BY_MODE: Record<Exclude<MapVisualMode, '3d'>, number> = {
  hybrid: 18,
  terrain: 15,
  roadmap: 19,
};

function checkWebGL2Support(): boolean {
  if (typeof document === 'undefined') return false;
  try {
    const canvas = document.createElement('canvas');
    return Boolean(canvas.getContext('webgl2'));
  } catch {
    return false;
  }
}

function createCirclePolygonPath(
  centerLat: number,
  centerLng: number,
  radiusMeters: number,
  altitude = 4,
  segments = 36
): google.maps.LatLngAltitudeLiteral[] {
  const earthRadiusMeters = 6378137;
  const latRad = (centerLat * Math.PI) / 180;
  const dLatDeg = (radiusMeters / earthRadiusMeters) * (180 / Math.PI);
  const dLngDeg = dLatDeg / Math.max(0.1, Math.cos(latRad));

  const points: google.maps.LatLngAltitudeLiteral[] = [];
  for (let i = 0; i <= segments; i++) {
    const angle = (i / segments) * Math.PI * 2;
    points.push({
      lat: centerLat + dLatDeg * Math.sin(angle),
      lng: centerLng + dLngDeg * Math.cos(angle),
      altitude,
    });
  }
  return points;
}

class Map3DErrorBoundary extends React.Component<
  { onFallback: () => void; children: React.ReactNode },
  { hasError: boolean }
> {
  constructor(props: { onFallback: () => void; children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch() {
    this.props.onFallback();
  }

  render() {
    if (this.state.hasError) {
      return null;
    }
    return this.props.children;
  }
}

interface SchoolMarker2DProps {
  school: SchoolRecord;
  isSelected: boolean;
  thermalStep: ThermalStep;
  onClickMarker: (school: SchoolRecord, marker: google.maps.marker.AdvancedMarkerElement | null) => void;
}

const SchoolMarker2D = React.memo<SchoolMarker2DProps>(
  ({ school, isSelected, thermalStep, onClickMarker }) => {
    const [markerRef, marker] = useAdvancedMarkerRef();
    const scaleEntry = THERMAL_SCALE[thermalStep];
    const shortName = school.name.replace('E.M. ', '').replace('C.E. ', '').replace('CIEP ', '');

    const handleClick = useCallback(() => {
      onClickMarker(school, marker);
    }, [onClickMarker, school, marker]);

    return (
      <AdvancedMarker
        ref={markerRef}
        position={{ lat: school.latitude, lng: school.longitude }}
        zIndex={isSelected ? 1000 : school.isSentinel ? 500 : 100}
        title={`${school.name} (INEP ${school.inepCode}) · Prioridade ${scaleEntry.label}`}
        onClick={handleClick}
      >
        <div className="flex flex-col items-center cursor-pointer group">
          <div
            className={`rounded-full flex items-center justify-center font-semibold ui-transition ${
              isSelected
                ? 'w-9 h-9 border-[3px] border-white ring-2 ring-[#181a1d] shadow-lg scale-105 text-xs'
                : 'w-6 h-6 border-2 border-white shadow-md group-hover:scale-110 text-[10px]'
            }`}
            style={{
              backgroundColor: scaleEntry.hexSolid,
              color: scaleEntry.markerGlyphColor,
            }}
          >
            {school.isSentinel ? <span aria-hidden="true">★</span> : null}
          </div>

          {isSelected && (
            <div className="mt-1 px-2 py-0.5 rounded-[var(--radius-control)] bg-[#181a1d] text-white border border-white/25 text-xs font-semibold shadow-md whitespace-nowrap max-w-[180px] truncate">
              {shortName}
            </div>
          )}
        </div>
      </AdvancedMarker>
    );
  }
);
SchoolMarker2D.displayName = 'SchoolMarker2D';

interface SchoolMarkers2DLayerProps {
  markers: SchoolMarkerEvaluation[];
  activeSchoolId: string | null;
  onClickMarker: (school: SchoolRecord, marker: google.maps.marker.AdvancedMarkerElement | null) => void;
}

const SchoolMarkers2DLayer = React.memo<SchoolMarkers2DLayerProps>(
  ({ markers, activeSchoolId, onClickMarker }) => (
    <>
      {markers.map(({ school, thermalStep }) => (
        <SchoolMarker2D
          key={`school-2d-${school.id}`}
          school={school}
          isSelected={school.id === activeSchoolId}
          thermalStep={thermalStep}
          onClickMarker={onClickMarker}
        />
      ))}
    </>
  )
);
SchoolMarkers2DLayer.displayName = 'SchoolMarkers2DLayer';

type Marker3DNode =
  | google.maps.maps3d.Marker3DElement
  | google.maps.maps3d.Marker3DInteractiveElement
  | null;

interface SchoolMarker3DProps {
  school: SchoolRecord;
  isSelected: boolean;
  thermalStep: ThermalStep;
  onRegisterRef: (schoolId: string, node: Marker3DNode) => void;
  onClickMarker: (school: SchoolRecord) => void;
}

const SchoolMarker3D = React.memo<SchoolMarker3DProps>(
  ({ school, isSelected, thermalStep, onRegisterRef, onClickMarker }) => {
    const scaleEntry = THERMAL_SCALE[thermalStep];
    const shortName = school.name.replace('E.M. ', '').replace('C.E. ', '').replace('CIEP ', '');

    const handleRef = useCallback(
      (node: Marker3DNode) => {
        onRegisterRef(school.id, node);
      },
      [onRegisterRef, school.id]
    );

    const handleClick = useCallback(() => {
      onClickMarker(school);
    }, [onClickMarker, school]);

    return (
      <Marker3D
        ref={handleRef}
        position={{
          lat: school.latitude,
          lng: school.longitude,
          altitude: isSelected ? 48 : 30,
        }}
        altitudeMode={AltitudeMode.RELATIVE_TO_GROUND}
        extruded
        sizePreserved
        label={shortName}
        title={`${school.name} (INEP ${school.inepCode})`}
        onClick={handleClick}
      >
        <Pin
          background={scaleEntry.hexSolid}
          borderColor={isSelected ? '#181a1d' : '#ffffff'}
          glyphColor={scaleEntry.markerGlyphColor}
          glyphText={school.isSentinel ? '★' : undefined}
          scale={isSelected ? 1.35 : 0.9}
        />
      </Marker3D>
    );
  }
);
SchoolMarker3D.displayName = 'SchoolMarker3D';

interface SchoolMarkers3DLayerProps {
  markers: SchoolMarkerEvaluation[];
  activeSchoolId: string | null;
  onRegisterRef: (schoolId: string, node: Marker3DNode) => void;
  onClickMarker: (school: SchoolRecord) => void;
}

const SchoolMarkers3DLayer = React.memo<SchoolMarkers3DLayerProps>(
  ({ markers, activeSchoolId, onRegisterRef, onClickMarker }) => (
    <>
      {markers.map(({ school, thermalStep }) => (
        <SchoolMarker3D
          key={`school-3d-${school.id}`}
          school={school}
          isSelected={school.id === activeSchoolId}
          thermalStep={thermalStep}
          onRegisterRef={onRegisterRef}
          onClickMarker={onClickMarker}
        />
      ))}
    </>
  )
);
SchoolMarkers3DLayer.displayName = 'SchoolMarkers3DLayer';

const GreenAreas2DLayer = React.memo<{
  schools: SchoolRecord[];
  activeSchoolId: string | null;
}>(({ schools, activeSchoolId }) => (
  <>
    {schools.map((school) => {
      if (school.greenCoveragePercent === null || school.greenCoveragePercent === undefined) {
        return null;
      }
      const isSelected = school.id === activeSchoolId;
      return (
        <Circle
          key={`green-circle-${school.id}`}
          center={{ lat: school.latitude, lng: school.longitude }}
          radius={200}
          strokeColor={LAYER_DOT_COLORS.greenAreas}
          strokeOpacity={isSelected ? 0.9 : 0.55}
          strokeWeight={isSelected ? 2.5 : 1.5}
          fillColor={LAYER_DOT_COLORS.greenAreas}
          fillOpacity={isSelected ? 0.16 : 0.08}
          clickable={false}
        />
      );
    })}
  </>
));
GreenAreas2DLayer.displayName = 'GreenAreas2DLayer';

const HeatIslands2DLayer = React.memo<{ schools: SchoolRecord[] }>(({ schools }) => (
  <>
    {schools.map((school) => {
      const anom = school.heatIslandFactorLST;
      if (anom === null || anom === undefined) return null;
      const radius = 280 + Math.min(240, Math.abs(anom) * 70);
      const isHot = anom >= 0;
      const color = isHot ? LAYER_DOT_COLORS.heatIslands : THERMAL_SCALE[1].hexSolid;
      return (
        <Circle
          key={`lst-circle-${school.id}`}
          center={{ lat: school.latitude, lng: school.longitude }}
          radius={radius}
          strokeColor={color}
          strokeOpacity={0.45}
          strokeWeight={1.5}
          fillColor={color}
          fillOpacity={0.18}
          clickable={false}
        />
      );
    })}
  </>
));
HeatIslands2DLayer.displayName = 'HeatIslands2DLayer';

const formatStationMapLabel = (station: WeatherObservationStation) =>
  station.name.replace(/^Estação\s+/i, '');

const StationMarkers2DLayer = React.memo<{ stations: WeatherObservationStation[] }>(
  ({ stations }) => (
    <>
      {stations.map((station) => {
        const isPane = station.status === 'manutencao';
        const label = formatStationMapLabel(station);
        return (
          <AdvancedMarker
            key={`station-${station.id}`}
            position={{ lat: station.latitude, lng: station.longitude }}
            title={`${station.name} · ${isPane ? 'Estação em pane' : 'INMET'}`}
            zIndex={200}
          >
            <div
              className="px-2 py-0.5 rounded-[var(--radius-control)] text-white border border-white shadow-sm text-[11px] font-semibold flex items-center gap-1 whitespace-nowrap"
              style={{
                backgroundColor: isPane
                  ? THERMAL_SCALE[5].hexSolid
                  : LAYER_DOT_COLORS.stations,
              }}
            >
              <span aria-hidden="true">▲</span>
              <span>{label}</span>
            </div>
          </AdvancedMarker>
        );
      })}
    </>
  )
);
StationMarkers2DLayer.displayName = 'StationMarkers2DLayer';

const StationMarkers3DLayer = React.memo<{ stations: WeatherObservationStation[] }>(
  ({ stations }) => (
    <>
      {stations.map((station) => {
        const isPane = station.status === 'manutencao';
        return (
          <Marker3D
            key={`st-3d-${station.id}`}
            position={{
              lat: station.latitude,
              lng: station.longitude,
              altitude: 35,
            }}
            altitudeMode={AltitudeMode.RELATIVE_TO_GROUND}
            extruded
            label={formatStationMapLabel(station)}
          >
            <Pin
              background={
                isPane ? THERMAL_SCALE[5].hexSolid : LAYER_DOT_COLORS.stations
              }
              borderColor="#ffffff"
              glyphColor="#ffffff"
              glyphText="E"
              scale={0.85}
            />
          </Marker3D>
        );
      })}
    </>
  )
);
StationMarkers3DLayer.displayName = 'StationMarkers3DLayer';

interface Map2DCameraControllerProps {
  activeSchool: SchoolRecord | undefined;
  schools: SchoolRecord[];
  viewMode: Exclude<MapVisualMode, '3d'>;
  focusTrigger: number;
  overviewTrigger: number;
}

const Map2DCameraController: React.FC<Map2DCameraControllerProps> = ({
  activeSchool,
  schools,
  viewMode,
  focusTrigger,
  overviewTrigger,
}) => {
  const map = useMap();

  useEffect(() => {
    if (!map) return;
    const maxZoom = MAX_ZOOM_BY_MODE[viewMode];
    map.setMapTypeId(viewMode);
    map.setTilt(viewMode === 'hybrid' ? 45 : 0);
    map.setOptions({ minZoom: MIN_ZOOM, maxZoom });
    const currentZoom = map.getZoom();
    if (typeof currentZoom === 'number' && currentZoom > maxZoom) {
      map.setZoom(maxZoom);
    }
  }, [map, viewMode]);

  useEffect(() => {
    if (!map || !activeSchool) return;
    const maxZoom = MAX_ZOOM_BY_MODE[viewMode];
    map.panTo({ lat: activeSchool.latitude, lng: activeSchool.longitude });
    const currentZoom = map.getZoom() ?? 12;
    if (focusTrigger > 0 || currentZoom < 14) {
      map.setZoom(Math.min(16, maxZoom));
    }
  }, [map, activeSchool?.id, focusTrigger, viewMode]);

  useEffect(() => {
    if (!map || overviewTrigger === 0 || schools.length === 0) return;
    if (typeof google === 'undefined' || !google.maps?.LatLngBounds) return;
    const bounds = new google.maps.LatLngBounds();
    schools.forEach((s) => bounds.extend({ lat: s.latitude, lng: s.longitude }));
    map.fitBounds(bounds, 56);
  }, [map, overviewTrigger, schools]);

  return null;
};

interface ApiLoadingOverlayProps {
  onAuthOrLoadError: () => void;
}

const ApiLoadingOverlay: React.FC<ApiLoadingOverlayProps> = ({ onAuthOrLoadError }) => {
  const status = useApiLoadingStatus();

  useEffect(() => {
    if (status === APILoadingStatus.FAILED || status === APILoadingStatus.AUTH_FAILURE) {
      onAuthOrLoadError();
    }
  }, [status, onAuthOrLoadError]);

  if (status === APILoadingStatus.LOADED) {
    return null;
  }

  if (status === APILoadingStatus.FAILED || status === APILoadingStatus.AUTH_FAILURE) {
    return (
      <div className="absolute inset-0 z-20 bg-black/75 backdrop-blur-xs flex items-center justify-center p-6 text-center">
        <div className="max-w-md bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-[var(--radius-card)] p-5 shadow-[var(--shadow-overlay)] space-y-2">
          <AlertTriangle
            className="w-6 h-6 mx-auto"
            style={{ color: 'var(--thermal-5-solid)' }}
          />
          <p className="text-sm font-semibold text-[var(--text-primary)]">
            Não foi possível carregar o Google Maps neste momento
          </p>
          <p className="text-xs text-[var(--text-secondary)]">
            Verifique a conexão ou as configurações da chave da API. A lista e os dados das escolas continuam disponíveis abaixo.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="pointer-events-none absolute inset-0 z-10 bg-black/30 backdrop-blur-[1px] flex items-center justify-center">
      <div className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-[var(--radius-control)] px-4 py-2.5 shadow-[var(--shadow-overlay)] text-xs font-semibold text-[var(--text-primary)] flex items-center gap-2">
        <Loader2 className="w-4 h-4 animate-spin text-[var(--text-secondary)]" />
        <span>Carregando mapa...</span>
      </div>
    </div>
  );
};

export const RealSchoolMapCanvas = React.memo<RealSchoolMapCanvasProps>(({
  schools,
  schoolMarkers,
  stations,
  activeSchool,
  maxForecastHeatIndex,
  showHeatIslands,
  showGreenAreas,
  showStations,
  onSelectSchool,
  onOpenSchoolDetail,
}) => {
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';
  const webGL2Supported = useMemo(() => checkWebGL2Support(), []);

  const [viewMode, setViewMode] = useState<MapVisualMode>('hybrid');
  const [mobileModeMenuOpen, setMobileModeMenuOpen] = useState(false);
  const [map3dFallbackNote, setMap3dFallbackNote] = useState<string | null>(null);
  const [isOrbiting, setIsOrbiting] = useState(false);
  const [focusTrigger, setFocusTrigger] = useState(0);
  const [overviewTrigger, setOverviewTrigger] = useState(0);
  const [apiFailed, setApiFailed] = useState(false);

  const [infoWindowSchool, setInfoWindowSchool] = useState<SchoolRecord | null>(null);
  const [infoWindowAnchor, setInfoWindowAnchor] =
    useState<google.maps.marker.AdvancedMarkerElement | null>(null);
  const [popover3DSchool, setPopover3DSchool] = useState<SchoolRecord | null>(null);
  const [popover3DAnchor, setPopover3DAnchor] =
    useState<google.maps.maps3d.Marker3DInteractiveElement | null>(null);

  const map3dRef = useRef<Map3DRef | null>(null);
  const mobileModeMenuRef = useRef<HTMLDivElement>(null);
  const marker3DElementsRef = useRef<Record<string, google.maps.maps3d.Marker3DInteractiveElement | null>>({});
  const lastFlownSchoolIdRef = useRef<string | null>(activeSchool?.id ?? null);

  useEffect(() => {
    if (!mobileModeMenuOpen) return;
    const handleOutside = (e: MouseEvent) => {
      if (mobileModeMenuRef.current && !mobileModeMenuRef.current.contains(e.target as Node)) {
        setMobileModeMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [mobileModeMenuOpen]);

  const handleMap3DFallback = useCallback(() => {
    setIsOrbiting(false);
    setViewMode('hybrid');
    setMap3dFallbackNote(
      'Modo 3D fotorrealístico indisponível neste dispositivo; exibindo Satélite Híbrido.'
    );
  }, []);

  const handleAuthOrLoadError = useCallback(() => {
    setApiFailed(true);
  }, []);

  const registerMarker3DRef = useCallback((schoolId: string, node: Marker3DNode) => {
    if (
      node &&
      typeof google !== 'undefined' &&
      google.maps?.maps3d?.Marker3DInteractiveElement &&
      node instanceof google.maps.maps3d.Marker3DInteractiveElement
    ) {
      marker3DElementsRef.current[schoolId] = node;
    } else if (!node) {
      marker3DElementsRef.current[schoolId] = null;
    }
  }, []);

  // Voo suave da câmera 3D quando a escola selecionada muda
  useEffect(() => {
    if (viewMode !== '3d' || !activeSchool || !map3dRef.current) return;
    if (lastFlownSchoolIdRef.current === activeSchool.id) return;
    lastFlownSchoolIdRef.current = activeSchool.id;
    setIsOrbiting(false);

    try {
      map3dRef.current.flyCameraTo({
        endCamera: {
          center: {
            lat: activeSchool.latitude,
            lng: activeSchool.longitude,
            altitude: 22,
          },
          range: 920,
          tilt: 62,
          heading: 20,
          roll: 0,
        },
        durationMillis: 1350,
      });
    } catch {
      // Ignora se a instância 3D ainda estiver inicializando
    }
  }, [activeSchool, viewMode]);

  const handleSelectViewMode = (mode: MapVisualMode) => {
    setMobileModeMenuOpen(false);
    if (mode === '3d') {
      if (!webGL2Supported) return;
      setPopover3DSchool(null);
      setViewMode('3d');
      return;
    }
    setInfoWindowSchool(null);
    setIsOrbiting(false);
    setViewMode(mode);
  };

  const handleFocusActiveSchool = () => {
    if (!activeSchool) return;
    if (viewMode === '3d' && map3dRef.current) {
      setIsOrbiting(false);
      map3dRef.current.flyCameraTo({
        endCamera: {
          center: {
            lat: activeSchool.latitude,
            lng: activeSchool.longitude,
            altitude: 20,
          },
          range: 780,
          tilt: 64,
          heading: 22,
          roll: 0,
        },
        durationMillis: 1200,
      });
    } else {
      setFocusTrigger((prev) => prev + 1);
    }
  };

  const handleOverviewAll = () => {
    if (viewMode === '3d' && map3dRef.current) {
      setIsOrbiting(false);
      setPopover3DSchool(null);
      const count = schools.length;
      const avgLat =
        count > 0
          ? schools.reduce((acc, s) => acc + s.latitude, 0) / count
          : DEFAULT_RMRJ_CENTER.lat;
      const avgLng =
        count > 0
          ? schools.reduce((acc, s) => acc + s.longitude, 0) / count
          : DEFAULT_RMRJ_CENTER.lng;
      map3dRef.current.flyCameraTo({
        endCamera: {
          center: { lat: avgLat, lng: avgLng, altitude: 120 },
          range: 34000,
          tilt: 48,
          heading: 0,
          roll: 0,
        },
        durationMillis: 1500,
      });
    } else {
      setOverviewTrigger((prev) => prev + 1);
    }
  };

  const handleToggleOrbit = () => {
    if (viewMode !== '3d' || !map3dRef.current || !activeSchool) return;
    if (isOrbiting) {
      map3dRef.current.stopCameraAnimation();
      setIsOrbiting(false);
      return;
    }
    setIsOrbiting(true);
    map3dRef.current.flyCameraAround({
      camera: {
        center: {
          lat: activeSchool.latitude,
          lng: activeSchool.longitude,
          altitude: 22,
        },
        range: 720,
        tilt: 64,
        heading: 18,
        roll: 0,
      },
      durationMillis: 18000,
      rounds: 1,
    });
  };

  const handleClickMarker2D = useCallback(
    (school: SchoolRecord, marker: google.maps.marker.AdvancedMarkerElement | null) => {
      onSelectSchool(school.id);
      setInfoWindowSchool(school);
      setInfoWindowAnchor(marker);
    },
    [onSelectSchool]
  );

  const handleClickMarker3D = useCallback(
    (school: SchoolRecord) => {
      onSelectSchool(school.id);
      setPopover3DSchool(school);
      setPopover3DAnchor(marker3DElementsRef.current[school.id] ?? null);
    },
    [onSelectSchool]
  );

  const activeSchoolId = activeSchool?.id ?? null;
  const initialLat = activeSchool ? activeSchool.latitude : DEFAULT_RMRJ_CENTER.lat;
  const initialLon = activeSchool ? activeSchool.longitude : DEFAULT_RMRJ_CENTER.lng;

  const schoolEvaluations = useMemo<SchoolMarkerEvaluation[]>(() => {
    if (schoolMarkers) return schoolMarkers;
    return schools.map((school) => {
      const evalRes = calculateDecoupledRiskEvaluation(
        school,
        maxForecastHeatIndex,
        school.inspection
      );
      return {
        school,
        priorityKey: evalRes.combinedPriority,
        thermalStep: priorityToThermalStep(evalRes.combinedPriority),
      };
    });
  }, [schoolMarkers, schools, maxForecastHeatIndex]);

  const activeGreenPath3D = useMemo(() => {
    if (!activeSchool || !showGreenAreas) return null;
    return createCirclePolygonPath(activeSchool.latitude, activeSchool.longitude, 200, 6);
  }, [activeSchool, showGreenAreas]);

  const heatHalos3D = useMemo(() => {
    if (!showHeatIslands) return [];
    return schools
      .filter((s) => s.heatIslandFactorLST !== null && s.heatIslandFactorLST !== undefined)
      .map((s) => {
        const anom = s.heatIslandFactorLST as number;
        const radius = 260 + Math.min(220, Math.abs(anom) * 65);
        return {
          id: s.id,
          isHot: anom >= 0,
          path: createCirclePolygonPath(s.latitude, s.longitude, radius, 4, 28),
        };
      });
  }, [schools, showHeatIslands]);

  const modeOptions: {
    id: MapVisualMode;
    label: string;
    shortLabel: string;
    icon: React.ReactNode;
    disabled?: boolean;
    title?: string;
  }[] = [
    {
      id: 'hybrid',
      label: 'Satélite Híbrido',
      shortLabel: 'Satélite',
      icon: <Satellite className="w-4 h-4 shrink-0" />,
    },
    {
      id: '3d',
      label: '3D',
      shortLabel: '3D',
      icon: <Globe className="w-4 h-4 shrink-0" />,
      disabled: !webGL2Supported,
      title: webGL2Supported
        ? 'Explorar entorno da escola em 3D fotorrealístico'
        : 'Modo 3D indisponível neste navegador (requer WebGL2)',
    },
    {
      id: 'terrain',
      label: 'Relevo',
      shortLabel: 'Relevo',
      icon: <Layers className="w-4 h-4 shrink-0" />,
    },
    {
      id: 'roadmap',
      label: 'Mapa Urbano',
      shortLabel: 'Urbano',
      icon: <MapIcon className="w-4 h-4 shrink-0" />,
    },
  ];

  const activeModeMeta = modeOptions.find((m) => m.id === viewMode) || modeOptions[0];
  const thermalSteps: ThermalStep[] = [1, 2, 3, 4, 5];

  if (!apiKey) {
    return (
      <div className="w-full h-[62svh] min-h-[380px] sm:h-[540px] lg:h-[620px] rounded-[var(--radius-card)] bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] flex flex-col items-center justify-center p-6 text-center space-y-2">
        <MapIcon className="w-8 h-8 text-[var(--text-secondary)]" />
        <p className="text-sm font-semibold text-[var(--text-primary)]">
          Chave do Google Maps não configurada neste ambiente
        </p>
        <p className="text-xs text-[var(--text-secondary)] max-w-md">
          Defina <code className="font-code">VITE_GOOGLE_MAPS_API_KEY</code> no ambiente para exibir o mapa interativo. A tabela e os dados das escolas continuam disponíveis abaixo.
        </p>
      </div>
    );
  }

  const effective2DMode: Exclude<MapVisualMode, '3d'> = viewMode === '3d' ? 'hybrid' : viewMode;

  return (
    <div className="space-y-2">
      {map3dFallbackNote && (
        <div className="text-xs text-[var(--text-secondary)] bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] rounded-[var(--radius-control)] px-3 py-2 flex items-center gap-2">
          <Compass className="w-4 h-4 shrink-0" />
          <span>{map3dFallbackNote}</span>
        </div>
      )}

      {/* Viewport do Mapa (Altura protagonista: >=60svh no celular para caber na primeira dobra) */}
      <div className="relative w-full h-[62svh] min-h-[380px] sm:h-[540px] lg:h-[620px] rounded-[var(--radius-card)] overflow-hidden border border-[var(--border-subtle)] bg-[#0f1114]">
        <APIProvider
          apiKey={apiKey}
          language="pt-BR"
          region="BR"
          libraries={MAP_LIBRARIES}
        >
          <ApiLoadingOverlay onAuthOrLoadError={handleAuthOrLoadError} />

          {!apiFailed && viewMode === '3d' && webGL2Supported ? (
            <Map3DErrorBoundary onFallback={handleMap3DFallback}>
              <Map3D
                ref={map3dRef}
                id="school-map-3d"
                mode={MapMode.HYBRID}
                defaultCenter={{ lat: initialLat, lng: initialLon, altitude: 22 }}
                defaultRange={950}
                defaultTilt={62}
                defaultHeading={20}
                defaultRoll={0}
                minAltitude={120}
                maxAltitude={45000}
                minTilt={15}
                maxTilt={75}
                gestureHandling={GestureHandling.GREEDY}
                internalUsageAttributionIds={ATTRIBUTION_IDS}
                onError={handleMap3DFallback}
                onAnimationEnd={() => setIsOrbiting(false)}
                style={{ width: '100%', height: '100%', display: 'block' }}
              >
                {/* Halos de Ilha de Calor (Landsat LST) */}
                {heatHalos3D.map((halo) => (
                  <Polygon3D
                    key={`halo-3d-${halo.id}`}
                    path={halo.path}
                    altitudeMode={AltitudeMode.CLAMP_TO_GROUND}
                    fillColor={
                      halo.isHot ? 'rgba(194, 65, 12, 0.18)' : 'rgba(29, 78, 216, 0.18)'
                    }
                    strokeColor={
                      halo.isHot ? 'rgba(194, 65, 12, 0.65)' : 'rgba(29, 78, 216, 0.65)'
                    }
                    strokeWidth={2}
                  />
                ))}

                {/* Anel de 200 m de cobertura arbórea ao redor da escola em foco */}
                {activeGreenPath3D && (
                  <Polygon3D
                    path={activeGreenPath3D}
                    altitudeMode={AltitudeMode.CLAMP_TO_GROUND}
                    fillColor="rgba(15, 118, 110, 0.16)"
                    strokeColor={LAYER_DOT_COLORS.greenAreas}
                    strokeWidth={3}
                  />
                )}

                {/* Estações meteorológicas de referência (memoizadas) */}
                {showStations && <StationMarkers3DLayer stations={stations} />}

                {/* Marcadores 3D das Escolas (memoizados) */}
                <SchoolMarkers3DLayer
                  markers={schoolEvaluations}
                  activeSchoolId={activeSchoolId}
                  onRegisterRef={registerMarker3DRef}
                  onClickMarker={handleClickMarker3D}
                />

                {popover3DSchool && popover3DAnchor && (
                  <Popover
                    open
                    anchor={popover3DAnchor}
                    onClose={() => setPopover3DSchool(null)}
                  >
                    <div className="p-3 max-w-[260px] text-[#181a1d] space-y-1.5">
                      <div className="text-xs font-semibold leading-snug">
                        {popover3DSchool.name}
                      </div>
                      <div className="text-xs text-[#5d636c]">
                        <span className="font-code">INEP {popover3DSchool.inepCode}</span> ·{' '}
                        {popover3DSchool.borough}
                      </div>
                      <div className="flex flex-wrap items-center gap-2 text-xs tabular-nums pt-0.5">
                        {popover3DSchool.heatIslandFactorLST !== null && (
                          <span className="font-semibold">
                            Ilha{' '}
                            {formatTempPtBr(popover3DSchool.heatIslandFactorLST, { signed: true })}
                          </span>
                        )}
                        {popover3DSchool.greenCoveragePercent !== null && (
                          <span>
                            Árvores {formatPercentIntPtBr(popover3DSchool.greenCoveragePercent)}
                          </span>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => onOpenSchoolDetail(popover3DSchool.id)}
                        className="mt-1.5 w-full min-h-[40px] py-1.5 px-3 rounded-[var(--radius-control)] bg-[#181a1d] text-white text-xs font-semibold hover:bg-[#2d3137] cursor-pointer"
                      >
                        Abrir Ficha Técnica
                      </button>
                    </div>
                  </Popover>
                )}
              </Map3D>
            </Map3DErrorBoundary>
          ) : !apiFailed ? (
            <GoogleMap
              mapId="DEMO_MAP_ID"
              mapTypeId={effective2DMode}
              defaultCenter={{ lat: initialLat, lng: initialLon }}
              defaultZoom={15}
              minZoom={MIN_ZOOM}
              maxZoom={MAX_ZOOM_BY_MODE[effective2DMode]}
              defaultTilt={45}
              gestureHandling="greedy"
              mapTypeControl={false}
              streetViewControl={false}
              fullscreenControl={false}
              internalUsageAttributionIds={ATTRIBUTION_IDS}
              className="w-full h-full"
            >
              <Map2DCameraController
                activeSchool={activeSchool}
                schools={schools}
                viewMode={effective2DMode}
                focusTrigger={focusTrigger}
                overviewTrigger={overviewTrigger}
              />

              {/* Camada de Cobertura Arbórea: Raio real de 200 m (ESA WorldCover, memoizada) */}
              {showGreenAreas && (
                <GreenAreas2DLayer schools={schools} activeSchoolId={activeSchoolId} />
              )}

              {/* Camada de Ilha de Calor de Superfície (Landsat 8/9, memoizada) */}
              {showHeatIslands && <HeatIslands2DLayer schools={schools} />}

              {/* Estações Meteorológicas de Referência (memoizadas) */}
              {showStations && <StationMarkers2DLayer stations={stations} />}

              {/* Marcadores das Escolas (memoizados) */}
              <SchoolMarkers2DLayer
                markers={schoolEvaluations}
                activeSchoolId={activeSchoolId}
                onClickMarker={handleClickMarker2D}
              />

              {/* Janela de Detalhes Rápidos no Mapa 2D */}
              {infoWindowSchool && infoWindowAnchor && (
                <InfoWindow
                  anchor={infoWindowAnchor}
                  onCloseClick={() => setInfoWindowSchool(null)}
                >
                  <div className="p-1 max-w-[240px] text-[#181a1d] space-y-1">
                    <div className="text-xs font-semibold leading-snug">
                      {infoWindowSchool.name}
                    </div>
                    <div className="text-xs text-[#5d636c]">
                      <span className="font-code">INEP {infoWindowSchool.inepCode}</span> ·{' '}
                      {infoWindowSchool.borough}
                    </div>
                    <div className="text-xs text-[#434850] tabular-nums">
                      {infoWindowSchool.declaredClimatizedRooms}/{infoWindowSchool.totalRooms}{' '}
                      salas climatizadas · {formatIntegerPtBr(infoWindowSchool.totalStudents)} matrículas
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-xs tabular-nums pt-0.5">
                      {infoWindowSchool.heatIslandFactorLST !== null && (
                        <span className="font-semibold">
                          Ilha{' '}
                          {formatTempPtBr(infoWindowSchool.heatIslandFactorLST, { signed: true })}
                        </span>
                      )}
                      {infoWindowSchool.greenCoveragePercent !== null && (
                        <span>
                          Árvores {formatPercentIntPtBr(infoWindowSchool.greenCoveragePercent)}
                        </span>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => onOpenSchoolDetail(infoWindowSchool.id)}
                      className="mt-1.5 w-full min-h-[40px] py-1.5 px-3 rounded-[var(--radius-control)] bg-[#181a1d] text-white text-xs font-semibold hover:bg-[#2d3137] cursor-pointer"
                    >
                      Abrir Ficha Técnica
                    </button>
                  </div>
                </InfoWindow>
              )}
            </GoogleMap>
          ) : null}
        </APIProvider>

        {/* Seletor Único Flutuante de Modo (Desktop: barra segmentada; Mobile: botão com lista) */}
        <div
          ref={mobileModeMenuRef}
          className="absolute top-3 left-3 z-20"
        >
          {/* Desktop */}
          <div
            role="group"
            aria-label="Modo de visualização do mapa"
            className="hidden sm:inline-flex items-center gap-1 bg-[var(--bg-surface)]/95 backdrop-blur-md p-1 rounded-[var(--radius-control)] border border-[var(--border-subtle)] shadow-[var(--shadow-overlay)]"
          >
            {modeOptions.map((mode) => {
              const isActive = viewMode === mode.id;
              return (
                <button
                  key={mode.id}
                  type="button"
                  disabled={mode.disabled}
                  title={mode.title}
                  onClick={() => handleSelectViewMode(mode.id)}
                  className={`min-h-[36px] px-2.5 py-1.5 rounded-[calc(var(--radius-control)-2px)] text-xs flex items-center gap-1.5 ui-transition whitespace-nowrap ${
                    mode.disabled
                      ? 'opacity-45 cursor-not-allowed text-[var(--text-muted)]'
                      : isActive
                      ? 'bg-[var(--action-primary)] text-[var(--action-primary-fg)] font-semibold cursor-pointer'
                      : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-subtle)] cursor-pointer'
                  }`}
                >
                  {mode.icon}
                  <span>{mode.label}</span>
                </button>
              );
            })}
          </div>

          {/* Mobile: Botão que abre a lista */}
          <div className="sm:hidden relative">
            <button
              type="button"
              onClick={() => setMobileModeMenuOpen((prev) => !prev)}
              aria-expanded={mobileModeMenuOpen}
              aria-label="Escolher modo de visualização do mapa"
              className="min-h-[44px] px-3 py-2 rounded-[var(--radius-control)] bg-[var(--bg-surface)]/95 backdrop-blur-md border border-[var(--border-subtle)] shadow-[var(--shadow-overlay)] text-xs font-semibold text-[var(--text-primary)] inline-flex items-center gap-2 cursor-pointer"
            >
              {activeModeMeta.icon}
              <span>{activeModeMeta.label}</span>
              <ChevronDown
                className={`w-4 h-4 text-[var(--text-muted)] ui-transition ${
                  mobileModeMenuOpen ? 'rotate-180' : ''
                }`}
              />
            </button>

            {mobileModeMenuOpen && (
              <div
                role="menu"
                className="absolute left-0 top-full mt-1.5 w-48 bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-[var(--radius-card)] shadow-[var(--shadow-overlay)] p-1 space-y-0.5"
              >
                {modeOptions.map((mode) => {
                  const isActive = viewMode === mode.id;
                  return (
                    <button
                      key={mode.id}
                      type="button"
                      role="menuitemradio"
                      aria-checked={isActive}
                      disabled={mode.disabled}
                      onClick={() => handleSelectViewMode(mode.id)}
                      className={`w-full min-h-[44px] px-3 py-2 rounded-[var(--radius-control)] text-xs flex items-center gap-2 text-left ui-transition ${
                        mode.disabled
                          ? 'opacity-45 cursor-not-allowed text-[var(--text-muted)]'
                          : isActive
                          ? 'bg-[var(--action-primary)] text-[var(--action-primary-fg)] font-semibold cursor-pointer'
                          : 'text-[var(--text-secondary)] hover:bg-[var(--bg-surface-subtle)] cursor-pointer'
                      }`}
                    >
                      {mode.icon}
                      <span>{mode.label}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Botões de Ícone no Canto Superior Direito (com Tooltip) */}
        <div className="absolute top-3 right-3 z-20 flex items-center gap-1.5">
          {activeSchool && (
            <button
              type="button"
              onClick={handleFocusActiveSchool}
              title="Sobrevoar escola selecionada"
              aria-label="Sobrevoar escola"
              className="w-11 h-11 inline-flex items-center justify-center rounded-[var(--radius-control)] bg-[var(--bg-surface)]/95 backdrop-blur-md border border-[var(--border-subtle)] shadow-[var(--shadow-overlay)] text-[var(--text-primary)] hover:bg-[var(--bg-surface-subtle)] ui-transition cursor-pointer"
            >
              <Crosshair className="w-4 h-4" />
            </button>
          )}

          {viewMode === '3d' && activeSchool && (
            <button
              type="button"
              onClick={handleToggleOrbit}
              title={isOrbiting ? 'Parar órbita 360°' : 'Girar em órbita 360°'}
              aria-label={isOrbiting ? 'Parar órbita' : 'Órbita 360°'}
              aria-pressed={isOrbiting}
              className={`w-11 h-11 inline-flex items-center justify-center rounded-[var(--radius-control)] border shadow-[var(--shadow-overlay)] ui-transition cursor-pointer ${
                isOrbiting
                  ? 'bg-[var(--action-primary)] text-[var(--action-primary-fg)] border-[var(--action-primary)]'
                  : 'bg-[var(--bg-surface)]/95 backdrop-blur-md text-[var(--text-primary)] border-[var(--border-subtle)] hover:bg-[var(--bg-surface-subtle)]'
              }`}
            >
              {isOrbiting ? <Square className="w-4 h-4" /> : <RotateCw className="w-4 h-4" />}
            </button>
          )}

          <button
            type="button"
            onClick={handleOverviewAll}
            title={`Visão geral (${schools.length} escolas)`}
            aria-label="Visão geral"
            className="w-11 h-11 inline-flex items-center justify-center rounded-[var(--radius-control)] bg-[var(--bg-surface)]/95 backdrop-blur-md border border-[var(--border-subtle)] shadow-[var(--shadow-overlay)] text-[var(--text-primary)] hover:bg-[var(--bg-surface-subtle)] ui-transition cursor-pointer"
          >
            <Maximize2 className="w-4 h-4" />
          </button>
        </div>

        {/* Legenda da Escala Térmica no Canto Inferior Esquerdo (acima da marca Google) */}
        <div
          aria-label="Legenda da escala térmica"
          className="absolute bottom-7 left-3 z-20 bg-[var(--bg-surface)]/95 backdrop-blur-md border border-[var(--border-subtle)] rounded-[var(--radius-control)] shadow-[var(--shadow-overlay)] px-2.5 py-2 max-w-[calc(100%-4.5rem)]"
        >
          <div className="text-[11px] font-semibold text-[var(--text-primary)] mb-1">
            Prioridade térmica
          </div>
          <div className="flex items-center gap-1 sm:gap-1.5">
            {thermalSteps.map((step) => {
              const entry = THERMAL_SCALE[step];
              return (
                <div key={step} className="flex items-center gap-1" title={entry.label}>
                  <span
                    className="w-3.5 h-2.5 rounded-xs shrink-0"
                    style={{ backgroundColor: entry.solidVar }}
                  />
                  <span className="hidden md:inline text-[11px] text-[var(--text-secondary)] whitespace-nowrap">
                    {entry.label}
                  </span>
                </div>
              );
            })}
          </div>
          <div className="flex md:hidden items-center justify-between text-[11px] text-[var(--text-muted)] mt-1 gap-4">
            <span>Baixa</span>
            <span>Muito Alta</span>
          </div>
        </div>
      </div>
    </div>
  );
});
RealSchoolMapCanvas.displayName = 'RealSchoolMapCanvas';
