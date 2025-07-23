import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import React, { useState, useEffect, useRef, useMemo, useCallback, memo, useImperativeHandle, forwardRef } from 'react';
import { Box } from '@mui/material';
import Switch from '@mui/material/Switch';
import FormControlLabel from '@mui/material/FormControlLabel';
import VisibilityIcon from '@mui/icons-material/Visibility';
import EditIcon from '@mui/icons-material/Edit';
import StraightenIcon from '@mui/icons-material/Straighten';
import Button from '@mui/material/Button';
import Tooltip from '@mui/material/Tooltip';
import { MAP_STYLES } from '../config';
import { getCentroid, haversine, parseIpPort } from '../utils';
import RoomIcon from '@mui/icons-material/Room';
import StopIcon from '@mui/icons-material/Stop';
import Snackbar from '@mui/material/Snackbar';
import Alert from '@mui/material/Alert';
import Slide from '@mui/material/Slide';
import ClickAwayListener from '@mui/material/ClickAwayListener';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import { useMapEvent } from 'react-leaflet';
import FiberManualRecordIcon from '@mui/icons-material/FiberManualRecord';
import SignalWifiStatusbar4BarRoundedIcon from '@mui/icons-material/SignalWifiStatusbar4BarRounded';
import GpsFixedRoundedIcon from '@mui/icons-material/GpsFixedRounded';
import BarChartRoundedIcon from '@mui/icons-material/BarChartRounded';
import CellTowerRoundedIcon from '@mui/icons-material/CellTowerRounded';
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded';
import SportsScoreIcon from '@mui/icons-material/SportsScore'; // fallback se non usiamo l'immagine

// Icona personalizzata per le boe, con rotazione dinamica
export function getRotatedIcon(heading: number, isOnline: boolean) {
  return L.divIcon({
    className: '',
    iconSize: [40, 40],
    iconAnchor: [20, 40],
    popupAnchor: [0, -40],
    html: `<img src="/boe/boeIconDefault.png" style="width:40px;height:40px;transform:rotate(${heading}deg);display:block;pointer-events:none;filter:${isOnline ? 'none' : 'grayscale(1) brightness(0.7)'};opacity:${isOnline ? 1 : 0.7};" />`,
  });
}

export interface Vehicle {
  id: string;
  lat: number;
  lon: number;
  isonline?: boolean;
  [key: string]: any; // altri dati associati
}

interface MapViewProps {
  vehicles: Vehicle[];
  centerOn?: [number, number];
  initialZoom?: number;
  actions?: React.ReactNode; // elementi opzionali da mostrare a sinistra del menu stile mappa
  selectedVehicleId: string | null;
  setSelectedVehicleId: (id: string | null) => void;
  onOpenRegattaFields?: () => void;
  giuriaPos?: { lat: number; lon: number } | null;
  onBuoyCountChange?: (count: number) => void;
  initialBuoyCount?: number;
  assignmentLines?: { from: { lat: number; lon: number }, toIndex: number }[];
  confirmedField?: { campoBoe: { lat: number; lon: number }[]; giuria: { lat: number; lon: number } | null } | null;
  windDirection?: number | ''; // direzione del vento in gradi
}

function RecenterOnChange({ center }: { center: [number, number] }) {
  const map = useMap();
  useEffect(() => {
    if (center) {
      map.setView(center);
    }
  }, [center, map]);
  return null;
}

function MapClickHandler({ onMapClick }: { onMapClick: (e: L.LeafletMouseEvent) => void }) {
  useMapEvent('click', onMapClick);
  return null;
}

// Handler click per selezione posizione giuria
function MapClickHandlerCampo({ onMapClick }: { onMapClick: (e: L.LeafletMouseEvent) => void }) {
  useMapEvent('click', onMapClick);
  return null;
}

// Hook per verificare se una posizione è nei bounds della mappa
function useIsInMapBounds(lat: number, lon: number) {
  const map = useMap();
  const [inBounds, setInBounds] = useState(true);
  useEffect(() => {
    if (!map) return;
    const check = () => {
      const bounds = map.getBounds();
      setInBounds(bounds.contains([lat, lon]));
    };
    check();
    map.on('move zoom', check);
    return () => {
      map.off('move zoom', check);
    };
  }, [map, lat, lon]);
  return inBounds;
}

// Componente per le frecce del vento
function WindArrows({ windDirection }: { windDirection: number | '' }) {
  const map = useMap();
  const [arrows, setArrows] = useState<React.ReactNode[]>([]);

  // Funzione per generare le frecce
  const generateArrows = useCallback(() => {
    if (!map || windDirection === '' || typeof windDirection !== 'number') {
      setArrows([]);
      return;
    }

    const bounds = map.getBounds();
    const arrowsList: React.ReactNode[] = [];
    
    // Numero fisso di frecce per riga e colonna (indipendentemente dallo zoom)
    const arrowsPerRow = 8; // 8 frecce per riga
    const arrowsPerCol = 6; // 6 frecce per colonna
    
    // Calcola la spaziatura basata sui bounds e sul numero fisso di frecce
    const latSpacing = (bounds.getNorth() - bounds.getSouth()) / (arrowsPerCol - 1);
    const lonSpacing = (bounds.getEast() - bounds.getWest()) / (arrowsPerRow - 1);
    
    // Genera una griglia fissa di frecce
    for (let row = 0; row < arrowsPerCol; row++) {
      for (let col = 0; col < arrowsPerRow; col++) {
        const lat = bounds.getSouth() + (row * latSpacing);
        const lon = bounds.getWest() + (col * lonSpacing);
        
        const arrowIcon = L.divIcon({
          className: '',
          iconSize: [24, 24],
          iconAnchor: [12, 12],
          html: `
            <div style="
              width: 24px; 
              height: 24px; 
              display: flex; 
              align-items: center; 
              justify-content: center;
              opacity: 0.3;
              transform: rotate(${windDirection}deg);
              animation: windMove 8s linear infinite;
            ">
              <svg width="24" height="24" viewBox="0 0 24 24">
                <path d="M12 22 L12 2 M12 22 L6 16 M12 22 L18 16" 
                      stroke="white" 
                      stroke-width="2.5" 
                      fill="none" 
                      stroke-linecap="round" 
                      stroke-linejoin="round"
                      filter="drop-shadow(0 0 2px rgba(255,255,255,0.8))"/>
              </svg>
            </div>
            <style>
              @keyframes windMove {
                0% {
                  transform: rotate(${windDirection}deg) translateX(0px) translateY(-100px);
                  opacity: 0;
                }
                10% {
                  transform: rotate(${windDirection}deg) translateX(0px) translateY(-80px);
                  opacity: 0.3;
                }
                90% {
                  transform: rotate(${windDirection}deg) translateX(0px) translateY(80px);
                  opacity: 0.3;
                }
                100% {
                  transform: rotate(${windDirection}deg) translateX(0px) translateY(100px);
                  opacity: 0;
                }
              }
            </style>
          `
        });

        arrowsList.push(
          <Marker
            key={`wind-${row}-${col}`}
            position={[lat, lon]}
            icon={arrowIcon}
            interactive={false}
            zIndexOffset={-2000}
          />
        );
      }
    }

    setArrows(arrowsList);
  }, [map, windDirection]);

  useEffect(() => {
    if (!map) return;

    // Genera le frecce iniziali
    generateArrows();

    // Aggiungi event listener per aggiornare le frecce quando la mappa si muove o zooma
    const handleMapChange = () => {
      generateArrows();
    };

    map.on('move', handleMapChange);
    map.on('zoom', handleMapChange);

    // Cleanup degli event listener
    return () => {
      map.off('move', handleMapChange);
      map.off('zoom', handleMapChange);
    };
  }, [map, generateArrows]);

  return <>{arrows}</>;
}

function SelectedHaloMarker({ lat, lon, icon }: { lat: number, lon: number, icon: any }) {
  const map = useMap();
  const [inBounds, setInBounds] = useState(true);
  useEffect(() => {
    if (!map) return;
    const check = () => {
      const bounds = map.getBounds();
      setInBounds(bounds.contains([lat, lon]));
    };
    check();
    map.on('move zoom', check);
    return () => {
      map.off('move zoom', check);
    };
  }, [map, lat, lon]);
  if (!inBounds) return null;
  return (
    <Marker
      position={[lat, lon]}
      icon={icon}
      pane="markerPane"
      interactive={false}
      zIndexOffset={-1000}
    />
  );
}

// Nuovo componente per marker veicolo
function VehicleMarker({
  v,
  isSelected,
  vaiaActive,
  vaiaTarget,
  handleMarkerClick,
  selectedVehicleId
}: {
  v: Vehicle,
  isSelected: boolean,
  vaiaActive: { [id: string]: boolean },
  vaiaTarget: { [id: string]: { lat: number, lon: number } | null },
  handleMarkerClick: (id: string) => void,
  selectedVehicleId: string | null
}) {
  // Ricava heading da GLOBAL_POSITION_INT.hdg se presente
  let heading = 0;
  if (v.GLOBAL_POSITION_INT && typeof v.GLOBAL_POSITION_INT.hdg === 'number') {
    heading = Math.floor(v.GLOBAL_POSITION_INT.hdg / 100);
  }
  const isOnline = v.isonline === true;
  // Linea verde e marker destinazione se vaia attivo per questa boa
  const tgt = vaiaTarget[v.id];
  const vaiaTgt = vaiaActive[v.id] && tgt && typeof tgt.lat === 'number' && typeof tgt.lon === 'number';
  // Icona evidenziata custom SVG animata via CSS
  const [haloAppear, setHaloAppear] = React.useState<string | null>(null);
  React.useEffect(() => {
    if (isSelected) {
      setHaloAppear('buoy-halo-appear');
      const t = setTimeout(() => setHaloAppear(null), 600);
      return () => clearTimeout(t);
    }
  }, [isSelected]);
  const selectedHaloIcon = L.divIcon({
    className: '',
    iconSize: [70, 70],
    iconAnchor: [34, 50],
    html: `
      <svg width='70' height='70' style='overflow:visible;'>
        <circle cx='35' cy='35' r='28' fill='none' stroke='#1976d2' stroke-width='5'/>
        <circle cx='35' cy='35' r='32' fill='none' stroke='#90caf9' stroke-width='7' stroke-opacity='0.7'/>
      </svg>`
  });
  // Icona warning per marker offline
  const warningIcon = L.divIcon({
    className: '',
    iconSize: [32, 32],
    iconAnchor: [16, 32],
    html: `<div style="display:flex;align-items:center;justify-content:center;width:32px;height:32px;">
      <svg width='32' height='32' viewBox='0 0 24 24' fill='red'><path d='M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z'/></svg>
    </div>`
  });
  return (
    <React.Fragment key={v.id}>
      {/* Marker warning sopra se offline */}
      {!isOnline && (
        <Marker
          position={[v.lat, v.lon]}
          icon={warningIcon}
          interactive={false}
          zIndexOffset={1000}
        />
      )}
      {/* Cerchio animato sopra la mappa per la boa selezionata */}
      {isSelected && (
        <SelectedHaloMarker lat={v.lat} lon={v.lon} icon={selectedHaloIcon} />
      )}
      <Marker key={v.id} position={[v.lat, v.lon]} icon={getRotatedIcon(heading, isOnline)}
        eventHandlers={{ click: () => handleMarkerClick(v.id) }}
      >
        {/* Simbolo attenzione rosso se offline */}
        {!isOnline && (
          <div
            style={{
              position: 'absolute',
              left: '50%',
              top: '50%',
              transform: 'translate(-50%, -120%)',
              zIndex: 30,
              pointerEvents: 'none',
              background: 'rgba(255,255,255,0.85)',
              borderRadius: '50%',
              padding: 2,
              boxShadow: '0 2px 8px rgba(0,0,0,0.10)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <WarningAmberRoundedIcon sx={{ color: 'red', fontSize: 32 }} />
          </div>
        )}
        {/* Evidenzia marker selezionato con un bordo/alone */}
        {isSelected && (
          <div
            style={{
              position: 'absolute',
              left: '50%',
              top: '50%',
              transform: 'translate(-50%, -50%)',
              width: 56,
              height: 56,
              borderRadius: '50%',
              border: '3px solid #1976d2',
              boxShadow: '0 0 32px 8px #90caf9',
              background: 'rgba(255,255,255,0.5)',
              zIndex: 20,
              pointerEvents: 'none',
            }}
          />
        )}
        {/* Overlay grigio per boe offline */}
        {/* (rimosso: ora il filtro è direttamente sull'icona) */}
        <Popup>
          <div>
            <strong>IP:</strong> {v.id.split('_').slice(0, 4).join('.')}
          </div>
        </Popup>
        {/* Debug: mostra la posizione accanto al marker */}
        <div
          style={{
            position: 'absolute',
            left: '30px',
            top: '-10px',
            background: 'rgba(255,255,255,0.8)',
            padding: '2px 4px',
            borderRadius: '4px',
            fontSize: '12px',
            pointerEvents: 'none',
            transform: 'translate(-50%, -100%)',
            fontWeight: selectedVehicleId === v.id ? 700 : 400,
            color: selectedVehicleId === v.id ? '#1976d2' : '#333',
            border: selectedVehicleId === v.id ? '2px solid #1976d2' : 'none',
          }}
        >
          {v.lat.toFixed(5)}, {v.lon.toFixed(5)}
        </div>
      </Marker>
      {/* Linea verde e marker destinazione se vaia attivo */}
      {vaiaTgt && (
        <>
          <Polyline
            positions={[[v.lat, v.lon], [tgt.lat, tgt.lon]]}
            pathOptions={{ color: 'green', weight: 5, dashArray: '6 8', opacity: 0.9 }}
          />
          <Marker
            position={[tgt.lat, tgt.lon]}
            icon={L.divIcon({
              className: '',
              html: `<div style=\"display:inline-flex;align-items:center;justify-content:center;background:rgba(0,200,0,0.95);border-radius:999px;padding:6px 1em;font-size:15px;color:white;border:2.5px solid green;box-shadow:0 2px 12px rgba(0,0,0,0.15);font-weight:900;white-space:nowrap;box-sizing:border-box;\">Arrivo</div>`
            })}
            interactive={false}
          />
        </>
      )}
    </React.Fragment>
  );
}

// Funzione per calcolare il punto medio tra due coordinate lat/lon
function midpoint(a: { lat: number; lon: number }, b: { lat: number; lon: number }) {
  return {
    lat: (a.lat + b.lat) / 2,
    lon: (a.lon + b.lon) / 2,
  };
}

// Funzione per generare l'icona numerata per una boa
function getBoaIconWithNumber(num: number) {
  return L.divIcon({
    className: '',
    iconSize: [36, 36],
    iconAnchor: [18, 36],
    html: `
      <div style="position:relative;display:inline-block;width:36px;height:36px;">
        <svg width='36' height='36' viewBox='0 0 36 36'>
          <circle cx='18' cy='18' r='15' fill='#e53935' stroke='white' stroke-width='3'/>
        </svg>
        <div style="position:absolute;top:0;left:0;width:36px;height:36px;display:flex;align-items:center;justify-content:center;font-weight:900;font-size:18px;color:white;text-shadow:0 1px 4px #b71c1c;">${num}</div>
      </div>
    `
  });
}

// Funzione aggiornata per generare campo a bastone con 4 boe e barca giuria
function generaCampoBastone(giuria: { lat: number; lon: number }) {
  // Parametri per la disposizione (in gradi decimali, da adattare a scala reale)
  const dx = 0.0005; // spostamento longitudinale (est-ovest)
  const dy = 0.0006; // spostamento latitudinale (nord-sud)
  // Barca giuria: in basso a destra (giuria.lat, giuria.lon)
  // Boa 4 (partenza): in basso a sinistra
  const boa4 = { lat: giuria.lat, lon: giuria.lon - 2 * dx };
  // Gate centrale
  const boa2 = { lat: giuria.lat - dy, lon: giuria.lon - dx }; // gate sinistra
  const boa3 = { lat: giuria.lat - dy, lon: giuria.lon + dx }; // gate destra
  // Boa 1 (bolina): in alto centro
  const boa1 = { lat: giuria.lat - 2 * dy, lon: giuria.lon };
  // Ordine: boa1 (bolina), boa2 (gate sx), boa3 (gate dx), boa4 (partenza)
  return [boa1, boa2, boa3, boa4];
}

function isSameGiuria(a: { lat: number; lon: number } | null | undefined, b: { lat: number; lon: number } | null | undefined) {
  return a && b && a.lat === b.lat && a.lon === b.lon;
}

// Componente memoizzato per il campo da regata con boe draggabili
function CampoRegataDraggable(props: { giuriaPos: { lat: number; lon: number }, mapRef: React.RefObject<L.Map | null>, onBuoyCountChange?: (count: number) => void, initialBuoyCount?: number, setCampoBoe?: (boe: { lat: number; lon: number }[]) => void, windDirection?: number | '' }, ref: React.Ref<any>) {
  const { giuriaPos, mapRef, onBuoyCountChange, initialBuoyCount, setCampoBoe } = props;
  // Genera campo a bastone o nessuna boa se initialBuoyCount === 0
  const [campoBoe, setCampoBoeState] = React.useState<{ lat: number; lon: number }[]>(() => {
    if (typeof initialBuoyCount === 'number') {
      if (initialBuoyCount === 0) return [];
      // Se >0, genera quel numero di boe (usando la logica bastone per le prime 4)
      return generaCampoBastone(giuriaPos).slice(0, initialBuoyCount);
    }
    return generaCampoBastone(giuriaPos);
  });
  // Aggiorna il campo boe anche nel parent (MapView) per le linee
  useEffect(() => {
    if (setCampoBoe) setCampoBoe(campoBoe);
  }, [campoBoe, setCampoBoe]);
  const prevGiuriaRef = React.useRef<{ lat: number; lon: number } | null>(giuriaPos);

  // Indici: 0=giuria, 1=boa1 (bolina), 2=boa2 (gate sx), 3=boa3 (gate dx), 4=boa4 (partenza)
  // points: [giuria, boa1, boa2, boa3, boa4]
  const [segments, setSegments] = React.useState<[number, number][]>([
    [1, 2], // boa1 (bolina) - boa2 (gate sx)
    [1, 3], // boa1 (bolina) - boa3 (gate dx)
    [2, 3], // boa2 (gate sx) - boa3 (gate dx)
    [2, 4], // boa2 (gate sx) - boa4 (partenza)
    [3, 0], // boa3 (gate dx) - giuria
    [4, 0]  // boa4 (partenza) - giuria
  ]);
  const [addLinePoints, setAddLinePoints] = React.useState<number[]>([]);
  const [addLinePopupPos, setAddLinePopupPos] = React.useState<{x: number, y: number} | null>(null);
  const [deleteLineIdx, setDeleteLineIdx] = React.useState<{iA: number, iB: number, pos: {x: number, y: number}}|null>(null);
  const [boaActionPopup, setBoaActionPopup] = React.useState<{ idx: number, pos: { x: number, y: number } } | null>(null);

  // Aggiorna boe e segmenti se cambia la posizione della giuria
  React.useEffect(() => {
    if (!isSameGiuria(giuriaPos, prevGiuriaRef.current)) {
      setCampoBoeState(generaCampoBastone(giuriaPos));
      prevGiuriaRef.current = giuriaPos;
      setSegments([
        [1, 2], [1, 3], [2, 3], [2, 4], [3, 0], [4, 0]
      ]);
    }
  }, [giuriaPos]);

  // Notifica il parent ogni volta che cambia il numero di boe
  React.useEffect(() => {
    if (onBuoyCountChange) onBuoyCountChange(campoBoe.length);
  }, [campoBoe.length, onBuoyCountChange]);

  // Lista dei punti: 0=giuria, 1=boa1 (bolina), 2=boa2 (gate sx), 3=boa3 (gate dx), 4=boa4 (partenza)
  const points = [giuriaPos, ...campoBoe];

  // Handler per click su marker per aggiunta linea
  function handleMarkerClickAddLine(idx: number, e?: any) {
    if (addLinePoints.length === 0) {
      // Calcola posizione popup vicino al marker cliccato
      if (e && e.target && e.target._map && e.latlng) {
        const map = e.target._map;
        const latlng = e.latlng;
        const point = map.latLngToContainerPoint(latlng);
        setAddLinePopupPos({ x: point.x, y: point.y });
      } else {
        setAddLinePopupPos(null);
      }
      setAddLinePoints([idx]);
    } else if (addLinePoints.length === 1 && addLinePoints[0] !== idx) {
      const newSeg: [number, number] = [addLinePoints[0], idx];
      // Evita duplicati (in entrambi i versi)
      const exists = segments.some(([a, b]) => (a === newSeg[0] && b === newSeg[1]) || (a === newSeg[1] && b === newSeg[0]));
      if (!exists) setSegments([...segments, newSeg]);
      setAddLinePoints([]);
      setAddLinePopupPos(null);
    }
  }

  // Handler per click su Polyline per eliminazione
  function handleLineClick(iA: number, iB: number, e: any) {
    if (e && e.originalEvent) {
      const map = e.target._map;
      if (map) {
        const latlng = e.latlng;
        const point = map.latLngToContainerPoint(latlng);
        setDeleteLineIdx({iA, iB, pos: {x: point.x, y: point.y}});
      }
    }
  }

  // Handler per eliminare una linea
  function handleDeleteSegment(idxA: number, idxB: number) {
    setSegments(segments => segments.filter(([a, b]) => !(a === idxA && b === idxB) && !(a === idxB && b === idxA)));
    setDeleteLineIdx(null);
  }

  // Handler per annullare eliminazione
  function handleCancelDelete() {
    setDeleteLineIdx(null);
  }

  // Handler per aggiungere una nuova boa
  function handleAddBuoy() {
    // Aggiunge una nuova boa vicino alla giuria (offset crescente)
    const offset = 0.0003 + 0.0002 * campoBoe.length;
    const angle = Math.PI / 2 + (campoBoe.length * Math.PI / 6); // distribuisce le nuove boe a ventaglio
    const newBoa = {
      lat: giuriaPos.lat + offset * Math.cos(angle),
      lon: giuriaPos.lon + offset * Math.sin(angle) / Math.cos(giuriaPos.lat * Math.PI / 180),
    };
    setCampoBoeState(prev => [...prev, newBoa]);
  }

  // Handler per click su marker boa
  function handleBoaMarkerClick(idx: number, e: any) {
    if (idx === 0) return; // giuria esclusa
    if (addLinePoints.length === 1) {
      // Se già in modalità aggiunta linea, completa la linea
      handleMarkerClickAddLine(idx, e);
      return;
    }
    // Mostra popup azioni vicino alla boa
    if (e && e.target && e.target._map && e.latlng) {
      const map = e.target._map;
      const latlng = e.latlng;
      const point = map.latLngToContainerPoint(latlng);
      setBoaActionPopup({ idx, pos: { x: point.x, y: point.y } });
    }
  }

  // Handler per "Aggiungi linea" dal popup
  function handleAddLineFromPopup() {
    if (boaActionPopup) {
      setAddLinePoints([boaActionPopup.idx]);
      setAddLinePopupPos(boaActionPopup.pos);
      setBoaActionPopup(null);
    }
  }

  // Handler per eliminare una boa
  function handleDeleteBuoy(idx: number) {
    setCampoBoeState(prev => prev.filter((_, i) => i !== idx - 1));
    // Aggiorna i segmenti rimuovendo quelli che coinvolgono la boa eliminata
    setSegments(segs => segs.filter(([a, b]) => a !== idx && b !== idx));
    setBoaActionPopup(null);
  }

  // Chiudi popup azioni boa, popup elimina linea e popup aggiungi linea su pan/zoom mappa
  React.useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const closeAllPopups = () => {
      setBoaActionPopup(null);
      setDeleteLineIdx(null);
      setAddLinePoints([]);
      setAddLinePopupPos(null);
    };
    map.on('movestart', closeAllPopups);
    map.on('zoomstart', closeAllPopups);
    return () => {
      map.off('movestart', closeAllPopups);
      map.off('zoomstart', closeAllPopups);
    };
  }, [mapRef]);

  useImperativeHandle(ref, () => ({
    addBuoy: handleAddBuoy,
    getCampoBoe: () => campoBoe
  }));

  return (
    <>
      {/* Popup azioni boa */}
      {boaActionPopup && (
        <div style={{
          position: 'absolute',
          left: boaActionPopup.pos.x,
          top: boaActionPopup.pos.y,
          zIndex: 2100,
          background: '#fff',
          border: '2px solid #1976d2',
          borderRadius: 8,
          padding: '10px 18px',
          boxShadow: '0 2px 12px #1976d233',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          minWidth: 120
        }}>
          <div style={{ fontWeight: 700, color: '#1976d2', marginBottom: 8 }}>{`Boa ${boaActionPopup.idx}`}</div>
          <div style={{ display: 'flex', gap: 12 }}>
            <Button color="primary" variant="contained" size="small" onClick={handleAddLineFromPopup}>
              Aggiungi linea
            </Button>
            <Button color="error" variant="contained" size="small" onClick={() => handleDeleteBuoy(boaActionPopup.idx)}>
              Elimina boa
            </Button>
          </div>
        </div>
      )}
      {/* Popup aggiunta linea vicino al marker selezionato */}
      {addLinePoints.length === 1 && addLinePopupPos && (
        <div style={{ position: 'absolute', left: addLinePopupPos.x, top: addLinePopupPos.y, zIndex: 2000, background: '#fffbe7', border: '1.5px solid #ffc107', borderRadius: 8, padding: '8px 18px', fontWeight: 600, color: '#b26a00', boxShadow: '0 2px 8px #ffc10733', minWidth: 180 }}>
          Seleziona il secondo punto da collegare
        </div>
      )}
      {/* Polyline e distanze solo per i segmenti definiti */}
      {segments.map(([iA, iB], idx) => {
        const p1 = points[iA];
        const p2 = points[iB];
        if (!p1 || !p2) return null;
        const dist = haversine([p1.lat, p1.lon], [p2.lat, p2.lon]);
        const mid = midpoint(p1, p2);
        return (
          <React.Fragment key={`segment-${iA}-${iB}`}>
            {/* Polyline shadow trasparente per click facile */}
            <Polyline
              positions={[[p1.lat, p1.lon], [p2.lat, p2.lon]]}
              pathOptions={{ color: 'red', weight: 18, opacity: 0, interactive: true }}
              eventHandlers={{ click: (e) => handleLineClick(iA, iB, e) }}
            />
            {/* Polyline visiva */}
            <Polyline
              positions={[[p1.lat, p1.lon], [p2.lat, p2.lon]]}
              pathOptions={{ color: 'red', weight: 4, dashArray: '6 8', opacity: 0.7 }}
            />
            <Marker
              position={[mid.lat, mid.lon]}
              icon={L.divIcon({
                className: '',
                html: `<div style=\"display:inline-flex;align-items:center;justify-content:center;background:rgba(255,255,255,0.95);border-radius:999px;padding:2px 0.8em;font-size:13px;color:red;border:2.5px solid red;box-shadow:0 2px 12px rgba(0,0,0,0.15);font-weight:900;white-space:nowrap;box-sizing:border-box;\">${dist.toFixed(1)} m</div>`
              })}
              interactive={false}
            />
          </React.Fragment>
        );
      })}
      {/* Marker draggabili per le boe e la giuria */}
      {points.map((p, i) => (
        <Marker
          key={i}
          position={[p.lat, p.lon]}
          draggable={i !== 0}
          eventHandlers={{
            dragend: (e) => {
              const marker = e.target;
              const { lat, lng } = marker.getLatLng();
              if (i === 0) return; // giuria non draggabile qui
              setCampoBoeState(prev => prev.map((boa, idx) => idx === i - 1 ? { lat, lon: lng } : boa));
            },
            click: (e) => {
              if (i === 0) {
                handleMarkerClickAddLine(i, e);
              } else {
                handleBoaMarkerClick(i, e);
              }
            }
          }}
          icon={i === 0 ? L.divIcon({
            className: '',
            iconSize: [44, 44],
            iconAnchor: [22, 36],
            html: `
              <svg width='44' height='44' viewBox='0 0 44 44' style='display:block;transform:rotate(${props.windDirection ? props.windDirection : 0}deg);'>
                <ellipse cx='22' cy='28' rx='10' ry='16' fill='#1565c0' stroke='#0d47a1' stroke-width='2'/>
                <polygon points='22,6 28,28 16,28' fill='#1565c0' stroke='#0d47a1' stroke-width='2'/>
              </svg>
            `
          }) : getBoaIconWithNumber(i)}
        >
          <Popup>{i === 0 ? 'Barca giuria' : `Boa ${i}`}</Popup>
        </Marker>
      ))}
      {/* Popup elimina linea */}
      {deleteLineIdx && (
        <div style={{
          position: 'absolute',
          left: deleteLineIdx.pos.x,
          top: deleteLineIdx.pos.y,
          zIndex: 2000,
          background: '#fff',
          border: '2px solid #b71c1c',
          borderRadius: 8,
          padding: '10px 18px',
          boxShadow: '0 2px 12px #b71c1c33',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          minWidth: 120
        }}>
          <div style={{ fontWeight: 700, color: '#b71c1c', marginBottom: 8 }}>Eliminare questa linea?</div>
          <div style={{ display: 'flex', gap: 12 }}>
            <Button color="error" variant="contained" size="small" onClick={() => handleDeleteSegment(deleteLineIdx.iA, deleteLineIdx.iB)}>
              Elimina
            </Button>
            <Button size="small" onClick={handleCancelDelete}>
              Annulla
            </Button>
          </div>
        </div>
      )}
    </>
  );
}
const MemoCampoRegataDraggable = React.memo(forwardRef(CampoRegataDraggable));

const MapView = forwardRef(function MapView(props: MapViewProps, ref) {
  // Centro della mappa: se c'è centerOn, altrimenti primo veicolo, altrimenti mondo
  const defaultCenter: [number, number] = (props.vehicles.length > 0 ? [props.vehicles[0].lat, props.vehicles[0].lon] : [0, 0]);
  const defaultZoom = typeof props.initialZoom === 'number' ? props.initialZoom : (props.vehicles.length > 0 ? 8 : 2);
  const [mapCenter, setMapCenter] = useState<[number, number]>(defaultCenter);
  const [mapZoom, setMapZoom] = useState<number>(defaultZoom);
  const [mapStyle, setMapStyle] = useState(MAP_STYLES[0].value);
  // Memoizza selectedStyle
  const selectedStyle = useMemo(() => MAP_STYLES.find(s => s.value === mapStyle) || MAP_STYLES[0], [mapStyle]);

  // Stato per la modalità: false = visualizzazione, true = modifica campo
  const [editMode, setEditMode] = useState(false);

  // Stato per tool misura distanza
  const [measureMode, setMeasureMode] = useState(false);
  const [measurePoints, setMeasurePoints] = useState<[number, number][]>([]); // max 2 punti
  const [measureLines, setMeasureLines] = useState<{ id: string, points: [number, number][], distance: number }[]>([]);
  const [selectedLineId, setSelectedLineId] = useState<string | null>(null);

  // Stato per tool "vai a"
  const [gotoMode, setGotoMode] = useState(false);
  const [gotoTarget, setGotoTarget] = useState<{lat: number, lon: number, alt?: number} | null>(null);
  const [gotoLoading, setGotoLoading] = useState(false);
  const [gotoError, setGotoError] = useState<string | null>(null);
  const [gotoSuccess, setGotoSuccess] = useState<string | null>(null);
  const [gotoCheckingStatus, setGotoCheckingStatus] = useState(false);

  // Stato per ogni boa: vaia attivo e target
  const [vaiaActive, setVaiaActive] = useState<{[id: string]: boolean}>({});
  const [vaiaTarget, setVaiaTarget] = useState<{[id: string]: {lat: number, lon: number} | null}>({});

  // Stato per tool manual
  const [manualMode, setManualMode] = useState(false);
  const [manualLoading, setManualLoading] = useState(false);
  const [manualError, setManualError] = useState<string | null>(null);
  const [manualSuccess, setManualSuccess] = useState<string | null>(null);
  const [manualState, setManualState] = useState<'hold' | 'loiter' | ''>('');

  // Stato per popup selezione boa
  const [selectVehiclePopup, setSelectVehiclePopup] = useState(false);

  // Stato per le boe del campo (draggabili)
  const [campoBoe, setCampoBoe] = useState<{ lat: number; lon: number }[]>([]);

  // Rigenera il campo solo se la posizione della giuria cambia davvero
  const prevGiuriaRef = useRef<{ lat: number; lon: number } | null>(null);
  useEffect(() => {
    if (props.giuriaPos && !isSameGiuria(props.giuriaPos, prevGiuriaRef.current)) {
      setCampoBoe(generaCampoBastone(props.giuriaPos));
      prevGiuriaRef.current = props.giuriaPos;
    }
    // Non azzerare mai campoBoe se giuriaPos resta la stessa!
  }, [props.giuriaPos]);

  // Ref per accedere alla mappa leaflet
  const mapRef = useRef<L.Map | null>(null);

  // selectedVehicle globale per tutto il componente
  const selectedVehicle = props.vehicles.find(v => v.id === props.selectedVehicleId) || null;

  // useEffect per aggiungere handler click alla mappa
  useEffect(() => {
    if (mapRef.current) {
      mapRef.current.on('click', handleMapClick);
    }
    // cleanup
    return () => {
      if (mapRef.current) {
        mapRef.current.off('click', handleMapClick);
      }
    };
  }, [measureMode]);

  // useEffect per click su etichetta misura (non più necessario con Popup di Leaflet)

  // Handler per il pulsante centra boe
  // Memoizza handleCenterBoe
  const handleCenterBoe = useCallback(() => {
    if (mapRef.current && props.vehicles.length > 0) {
      const map = mapRef.current;
      const centroid = getCentroid(props.vehicles);
      map.flyTo(centroid, map.getZoom());
    }
  }, [props.vehicles]);

  // Gestione click sulla mappa in modalità misura
  function handleMapClick(e: L.LeafletMouseEvent) {
    if (!measureMode) return;
    setMeasurePoints(prev => {
      if (prev.length === 0) {
        return [[e.latlng.lat, e.latlng.lng]];
      } else if (prev.length === 1) {
        const p1 = prev[0];
        const p2: [number, number] = [e.latlng.lat, e.latlng.lng];
        const dist = haversine(p1, p2);
        setMeasureLines(lines => {
          // Controllo se esiste già una linea con gli stessi punti (in qualsiasi ordine)
          const exists = lines.some(l => (
            (l.points[0][0] === p1[0] && l.points[0][1] === p1[1] && l.points[1][0] === p2[0] && l.points[1][1] === p2[1]) ||
            (l.points[0][0] === p2[0] && l.points[0][1] === p2[1] && l.points[1][0] === p1[0] && l.points[1][1] === p1[1])
          ));
          if (!exists) {
            return [
              ...lines,
              { id: `${Date.now()}_${Math.random()}`, points: [p1, p2], distance: dist }
            ];
          } else {
            return lines;
          }
        });
        // Azzero sempre punti e modalità dopo la creazione
        setMeasureMode(false);
        setMeasurePoints([]);
        return [];
      }
      return prev;
    });
  }

  // Handler click per Polyline: mostra menu elimina vicino al punto cliccato
  const [menuPosition, setMenuPosition] = useState<{ x: number; y: number } | null>(null);
  // Memoizza makeLineClickHandler
  const makeLineClickHandler = useCallback((lineId: string) => {
    return function(e: L.LeafletMouseEvent) {
      setSelectedLineId(lineId);
      if (mapRef.current) {
        const point = mapRef.current.latLngToContainerPoint(e.latlng);
        setMenuPosition({ x: point.x, y: point.y });
      }
      if (e.originalEvent) {
        e.originalEvent.preventDefault();
        e.originalEvent.stopPropagation();
      }
    }
  }, []);

  // Elimina la linea selezionata
  function handleDeleteLine(lineId: string | null) {
    setSelectedLineId(null);
    setMenuPosition(null);
    if (lineId) {
      setMeasureLines(lines => lines.filter(l => l.id !== lineId));
    }
  }

  // Aggiungi/gestisci handler click mappa per GOTO
  useEffect(() => {
    if (!mapRef.current) return;
    if (gotoMode) {
      mapRef.current.on('click', handleGotoMapClick);
    } else {
      mapRef.current.off('click', handleGotoMapClick);
    }
    return () => {
      if (mapRef.current) mapRef.current.off('click', handleGotoMapClick);
    };
  }, [gotoMode]);

  // Handler click sulla mappa in modalità GOTO
  function handleGotoMapClick(e: L.LeafletMouseEvent) {
    if (!gotoMode) return;
    if (!gotoSuccess) {
      setGotoTarget({ lat: e.latlng.lat, lon: e.latlng.lng });
    }
  }

  // Handler click marker boa
  function handleMarkerClick(vehicleId: string) {
    props.setSelectedVehicleId(vehicleId);
  }

  // Handler click sulla mappa (fuori marker)
  function handleMapBackgroundClick(e: L.LeafletMouseEvent) {
    // Se in gotoMode, gestisci solo la selezione destinazione
    if (gotoMode) {
      handleGotoMapClick(e);
      // NON azzerare selectedVehicleId!
      return;
    }
    props.setSelectedVehicleId(null);
  }

  // Funzione per controllare lo stato del vai a attraverso l'endpoint isgoing
  async function checkVaiaStatus(vehicleId: string): Promise<boolean> {
    try {
      const { ip, port } = parseIpPort(vehicleId);
      console.log('[CHECK VAIA STATUS] Chiamando endpoint per:', ip, port);
      
      const res = await fetch(`http://localhost:8001/isgoing/${ip}/${port}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });
      
      console.log('[CHECK VAIA STATUS] Status response:', res.status);
      
      if (!res.ok) {
        console.warn('[CHECK VAIA STATUS] Errore nel controllo stato vai a:', res.status);
        return false;
      }
      
      const data = await res.json();
      console.log('[CHECK VAIA STATUS] Data response:', data);
      console.log('[CHECK VAIA STATUS] Data.isgoing:', data.isgoing);
      return data.isgoing === true;
    } catch (error) {
      console.error('[CHECK VAIA STATUS] Errore nella chiamata isgoing:', error);
      return false;
    }
  }

  // Funzione per inviare comando vai a
  async function handleSendGoto() {
    if (!selectedVehicle || !gotoTarget) return;
    setGotoTarget(gotoTarget); // blocca la selezione punto dopo invio
    setGotoLoading(true);
    setGotoError(null);
    setGotoSuccess(null);
    const { ip, port } = parseIpPort(selectedVehicle.id);
    try {
      const res = await fetch('http://localhost:8001/vaia', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ip,
          port,
          lat: gotoTarget.lat,
          lon: gotoTarget.lon,
          ...(gotoTarget.alt ? { alt: gotoTarget.alt } : {}),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.detail || data.message || 'Errore invio comando');
      setGotoSuccess('Comando inviato!');
      setVaiaActive(prev => ({ ...prev, [selectedVehicle.id]: true }));
      setVaiaTarget(prev => ({ ...prev, [selectedVehicle.id]: { lat: gotoTarget.lat, lon: gotoTarget.lon } }));
    } catch (e: any) {
      setGotoError(e?.message || 'Errore invio comando');
    } finally {
      setGotoLoading(false);
    }
  }

  // Funzione per inviare stop_vaia
  async function handleStopGoto() {
    if (!selectedVehicle) return;
    setGotoLoading(true);
    setGotoError(null);
    setGotoSuccess(null);
    const { ip, port } = parseIpPort(selectedVehicle.id);
    try {
      const res = await fetch('http://localhost:8001/stop_vaia', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ip, port }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.detail || data.message || 'Errore stop');
      setVaiaActive(prev => ({ ...prev, [selectedVehicle.id]: false }));
      setVaiaTarget(prev => ({ ...prev, [selectedVehicle.id]: null }));
      // Reset degli stati del pannello dopo stop riuscito
      setGotoMode(false);
      setGotoTarget(null);
      setGotoSuccess(null);
      setGotoError(null);
    } catch (e: any) {
      setGotoError(e?.message || 'Errore stop');
    } finally {
      setGotoLoading(false);
    }
  }

  // Funzione per inviare comando cambia_stato
  async function handleSendManual() {
    if (!selectedVehicle) return;
    setManualLoading(true);
    setManualError(null);
    setManualSuccess(null);
    const { ip, port } = parseIpPort(selectedVehicle.id);
    try {
      const res = await fetch('http://localhost:8001/cambia_stato', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ip,
          port,
          stato: manualState,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.detail || data.message || 'Errore invio comando');
      setManualSuccess('Stato impostato!');
    } catch (e: any) {
      setManualError(e?.message || 'Errore invio comando');
    } finally {
      setManualLoading(false);
    }
  }

  // Quando cambio boa selezionata, resetta schermata Vai a se necessario
  useEffect(() => {
    setGotoMode(false);
    setGotoTarget(null);
    setGotoSuccess(null);
    setGotoError(null);
  }, [props.selectedVehicleId]);

  // Quando cambio boa selezionata, resetta schermata Manual se necessario
  useEffect(() => {
    setManualMode(false);
    setManualState('');
    setManualSuccess(null);
    setManualError(null);
  }, [props.selectedVehicleId]);

  // Controllo periodico dello stato del vai a per mantenere sincronizzazione
  useEffect(() => {
    if (!selectedVehicle) return;
    
    const checkStatus = async () => {
      try {
        console.log('[CONTROLLO PERIODICO] Controllo stato per:', selectedVehicle.id);
        const isActive = await checkVaiaStatus(selectedVehicle.id);
        console.log('[CONTROLLO PERIODICO] Nuovo stato:', isActive);
        setVaiaActive(prev => {
          const newState = { ...prev, [selectedVehicle.id]: isActive };
          console.log('[CONTROLLO PERIODICO] Stato aggiornato:', newState);
          return newState;
        });
      } catch (error) {
        console.error('[CONTROLLO PERIODICO] Errore nel controllo periodico stato vai a:', error);
      }
    };
    
    // Controlla immediatamente
    checkStatus();
    
    // Controlla ogni 5 secondi
    const interval = setInterval(checkStatus, 5000);
    
    return () => clearInterval(interval);
  }, [selectedVehicle?.id]);

  // Log per tracciare quando il pannello vai a viene aperto/chiuso
  useEffect(() => {
    if (gotoMode) {
      console.log('[PANNELLO STATO] Pannello aperto - gotoSuccess:', gotoSuccess, 'gotoTarget:', gotoTarget);
    } else {
      console.log('[PANNELLO STATO] Pannello chiuso');
    }
  }, [gotoMode, gotoSuccess, gotoTarget]);

  // useEffect per aggiungere handler di pan/zoom per chiudere il menu elimina e aggiornare center/zoom
  useEffect(() => {
    if (!mapRef.current) return;
    const map = mapRef.current;
    const handleMoveEnd = () => {
      const c = map.getCenter();
      setMapCenter([c.lat, c.lng]);
    };
    const handleZoomEnd = () => {
      setMapZoom(map.getZoom());
    };
    const handleCloseMenu = () => {
      setSelectedLineId(null);
      setMenuPosition(null);
    };
    map.on('moveend', handleMoveEnd);
    map.on('zoomend', handleZoomEnd);
    map.on('movestart', handleCloseMenu);
    map.on('zoomstart', handleCloseMenu);
    return () => {
      map.off('moveend', handleMoveEnd);
      map.off('zoomend', handleZoomEnd);
      map.off('movestart', handleCloseMenu);
      map.off('zoomstart', handleCloseMenu);
    };
  }, [mapRef.current]);

  // Forza il cursore direttamente sul .leaflet-container via JS
  useEffect(() => {
    const container = document.querySelector('.leaflet-container') as HTMLElement | null;
    if (container) {
      if (measureMode) {
        container.style.cursor = "url('data:image/svg+xml;utf8,<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"32\" height=\"32\" viewBox=\"0 0 32 32\"><polygon points=\"2,30 8,28 28,8 24,4 4,24 2,30\" fill=\"#ffc107\" stroke=\"#333\" stroke-width=\"2\"/><rect x=\"24\" y=\"4\" width=\"4\" height=\"4\" fill=\"#333\" transform=\"rotate(45 26 6)\"/></svg>') 0 32, crosshair";
      } else {
        container.style.cursor = '';
      }
    }
  }, [measureMode]);

  // Mostra campo confermato se presente (solo in pagina mappa principale)
  const showConfirmedField = !!props.confirmedField && !props.giuriaPos;

  return (
    <Box
      sx={{ position: 'relative', width: '100%', height: '100%' }}
      className={measureMode ? 'measure-cursor' : ''}
    >
      {/* Switch modalità sovrapposto centrato in alto */}
      {/* RIMOSSO: la box assoluta in alto con lo switch */}
      {/* Barra in alto a destra con eventuali azioni e select stile mappa */}
      <Box sx={{ position: 'absolute', top: 16, right: 16, zIndex: 1200, display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 2 }}>
        {/* Pulsante centra boe */}
        <button onClick={handleCenterBoe} style={{ fontSize: 14, padding: '2px 8px', borderRadius: 4, cursor: 'pointer' }}>
          Centra boe
        </button>
        {props.actions}
        <label htmlFor="map-style-select" style={{ fontSize: 14, marginRight: 8 }}>Stile mappa:</label>
        <select
          id="map-style-select"
          value={mapStyle}
          onChange={e => setMapStyle(e.target.value)}
          style={{ fontSize: 14, padding: '2px 8px', borderRadius: 4 }}
        >
          {MAP_STYLES.map(s => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>
      </Box>
      <MapContainer
        center={mapCenter}
        zoom={mapZoom}
        style={{ height: '100%', width: '100%' }}
        maxZoom={selectedStyle.maxZoom}
        ref={mapRef}
        className={measureMode ? 'measure-cursor' : ''}
      >
        <MapClickHandler onMapClick={handleMapBackgroundClick} />
        <TileLayer
          url={selectedStyle.url}
          attribution={selectedStyle.attribution}
          maxZoom={selectedStyle.maxZoom}
        />
        {/* Frecce del vento */}
        <WindArrows windDirection={props.windDirection || ''} />
        {/* Visualizza marker giuria e campo solo se la prop giuriaPos è presente */}
        {props.giuriaPos && (
          <>
            <Marker position={[props.giuriaPos.lat, props.giuriaPos.lon]} icon={L.divIcon({
              className: '',
              iconSize: [44, 44],
              iconAnchor: [22, 36],
                                html: `
                    <svg width='44' height='44' viewBox='0 0 44 44' style='display:block;transform:rotate(${props.windDirection ? props.windDirection : 0}deg);'>
                      <ellipse cx='22' cy='28' rx='10' ry='16' fill='#1565c0' stroke='#0d47a1' stroke-width='2'/>
                      <polygon points='22,6 28,28 16,28' fill='#1565c0' stroke='#0d47a1' stroke-width='2'/>
                    </svg>
                  `,
            })}>
              <Popup>Barca giuria</Popup>
            </Marker>
            {/* Linee assegnamento boe: da posizione attuale a target campo */}
            {(props.assignmentLines || []).map((line, idx) => {
              const to = campoBoe[line.toIndex];
              if (!to) return null;
              return (
                <Polyline
                  key={`assign-line-${idx}`}
                  positions={[[line.from.lat, line.from.lon], [to.lat, to.lon]]}
                  pathOptions={{ color: '#43a047', weight: 4, dashArray: '8 10', opacity: 0.85 }}
                />
              );
            })}
            <MemoCampoRegataDraggable
              ref={ref}
              giuriaPos={props.giuriaPos}
              mapRef={mapRef}
              onBuoyCountChange={props.onBuoyCountChange}
              initialBuoyCount={props.initialBuoyCount}
              setCampoBoe={setCampoBoe}
              windDirection={props.windDirection}
            />
          </>
        )}
        {/* Mostra campo confermato sulla mappa principale */}
        {showConfirmedField && props.confirmedField && (
          <>
            {/* Marker giuria blu */}
            {props.confirmedField.giuria && (
              <Marker
                position={[props.confirmedField.giuria.lat, props.confirmedField.giuria.lon]}
                icon={L.divIcon({
                  className: '',
                  iconSize: [44, 44],
                  iconAnchor: [22, 36],
                  html: `
                    <svg width='44' height='44' viewBox='0 0 44 44' style='display:block;transform:rotate(${props.windDirection ? props.windDirection : 0}deg);'>
                      <ellipse cx='22' cy='28' rx='10' ry='16' fill='#1565c0' stroke='#0d47a1' stroke-width='2'/>
                      <polygon points='22,6 28,28 16,28' fill='#1565c0' stroke='#0d47a1' stroke-width='2'/>
                    </svg>
                  `
                })}
              >
                <Popup>Barca giuria (campo confermato)</Popup>
              </Marker>
            )}
            {/* Marker boe rosse numerate */}
            {props.confirmedField.campoBoe.map((b, i) => (
              <Marker
                key={`confirmed-boe-${i}`}
                position={[b.lat, b.lon]}
                icon={getBoaIconWithNumber(i + 1)}
              >
                <Popup>{`Boa ${i + 1} (campo confermato)`}</Popup>
              </Marker>
            ))}
          </>
        )}
        {/* Linee misura distanza multiple */}
        {measureLines.map(line => (
          <React.Fragment key={line.id}>
            {/* Polyline shadow trasparente per click facile */}
            <Polyline
              positions={line.points}
              pathOptions={{ color: 'red', weight: 18, opacity: 0, interactive: true }}
              eventHandlers={{ click: makeLineClickHandler(line.id) }}
            />
            {/* Polyline visiva */}
            <Polyline
              positions={line.points}
              pathOptions={{ color: 'red', dashArray: '6 8', weight: 5, opacity: 0.9, interactive: false }}
            />
            {/* Testo distanza al centro, solo visuale */}
            <Marker
              key={line.id + '_label'}
              position={[
                (line.points[0][0] + line.points[1][0]) / 2,
                (line.points[0][1] + line.points[1][1]) / 2
              ]}
              icon={L.divIcon({
                className: '',
                html: `<div style=\"display:inline-flex;align-items:center;justify-content:center;background:rgba(255,255,255,0.95);border-radius:999px;padding:2px 0.8em;font-size:13px;color:red;border:2.5px solid red;box-shadow:0 2px 12px rgba(0,0,0,0.15);font-weight:900;white-space:nowrap;box-sizing:border-box;\">${line.distance.toFixed(1)} m</div>`
              })}
              interactive={false}
            />
          </React.Fragment>
        ))}
        {props.vehicles.map((v) => (
          <VehicleMarker
            key={v.id}
            v={v}
            isSelected={props.selectedVehicleId === v.id}
            vaiaActive={vaiaActive}
            vaiaTarget={vaiaTarget}
            handleMarkerClick={handleMarkerClick}
            selectedVehicleId={props.selectedVehicleId}
          />
        ))}
      </MapContainer>
      {/* Toolbar dock infondo alla pagina: visibile solo se giuriaPos non è presente (cioè nella mappa principale) */}
      {!props.giuriaPos && (
        <Box
          sx={{
            position: 'absolute',
            left: '50%',
            bottom: 24,
            transform: 'translateX(-50%)',
            zIndex: 1200,
            bgcolor: 'background.paper',
            borderRadius: 4,
            boxShadow: 4,
            px: 3,
            py: 1.5,
            minWidth: 240,
            minHeight: 56,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-start',
            gap: 4,
          }}
        >
          {/* Switch modalità in verticale a sinistra dei tool */}
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', mr: 2 }}>
            <VisibilityIcon fontSize="small" color={editMode ? 'disabled' : 'primary'} />
            <Switch
              checked={editMode}
              onChange={(_, checked) => setEditMode(checked)}
              color="primary"
              size="small"
              sx={{ mx: 0, my: 0.5 }}
            />
            <EditIcon fontSize="small" color={editMode ? 'primary' : 'disabled'} />
          </Box>
          {editMode ? (
            <>
              {/* Tool Vai a */}
              <Tooltip 
                title={
                  vaiaActive[selectedVehicle?.id || ''] 
                    ? "Boa in navigazione - Clicca per fermare" 
                    : "Vai a - Clicca per navigare verso un punto"
                }
                arrow
              >
                <span>
                  <Button
                variant={gotoMode ? 'contained' : 'text'}
                color={gotoMode ? 'primary' : 'inherit'}
                onClick={async () => {
                  console.log('[VAI A CLICK] Inizio click handler');
                  if (!selectedVehicle) {
                    console.log('[VAI A CLICK] Nessuna boa selezionata, mostra popup');
                    setSelectVehiclePopup(true);
                    return;
                  }
                  
                  console.log('[VAI A CLICK] Boa selezionata:', selectedVehicle.id);
                  console.log('[VAI A CLICK] Stato locale vaiaActive:', vaiaActive[selectedVehicle.id]);
                  
                  setGotoCheckingStatus(true);
                  try {
                    // Controlla SEMPRE lo stato del vai a attraverso l'endpoint isgoing
                    // indipendentemente dallo stato locale
                    console.log('[VAI A CLICK] Chiamando endpoint isgoing...');
                    const isVaiaActive = await checkVaiaStatus(selectedVehicle.id);
                    console.log('[VAI A CLICK] Risposta endpoint isgoing:', isVaiaActive);
                    
                    // Aggiorna sempre lo stato locale con la risposta del server
                    setVaiaActive(prev => ({ ...prev, [selectedVehicle.id]: isVaiaActive }));
                    
                    if (isVaiaActive) {
                      console.log('[VAI A CLICK] Vai a attivo, mostro STOP');
                      // Se la boa ha già un vai a attivo, mostra direttamente il pulsante STOP
                      setGotoMode(true);
                      setGotoTarget({ lat: 0, lon: 0 }); // dummy, per mostrare STOP
                      setGotoSuccess('Comando inviato!');
                      setVaiaTarget(prev => ({ ...prev, [selectedVehicle.id]: null }));
                    } else {
                      console.log('[VAI A CLICK] Vai a non attivo, mostro selezione punto');
                      // Se la boa non ha un vai a attivo, procedi con la sequenza classica
                      setGotoMode(true);
                      setGotoTarget(null);
                      setGotoError(null);
                      setGotoSuccess(null);
                    }
                  } catch (error) {
                    console.error('[VAI A CLICK] Errore nel controllo stato vai a:', error);
                    // In caso di errore, procedi con la sequenza classica
                    setGotoMode(true);
                    setGotoTarget(null);
                    setGotoError(null);
                    setGotoSuccess(null);
                    setVaiaActive(prev => ({ ...prev, [selectedVehicle.id]: false }));
                  } finally {
                    setGotoCheckingStatus(false);
                    console.log('[VAI A CLICK] Fine click handler');
                  }
                }}
                sx={{
                  minWidth: 0,
                  width: 44,
                  height: 44,
                  p: 0,
                  borderRadius: 2,
                  border: '1.5px solid #222',
                  boxShadow: !selectedVehicle ? '0 0 0 4px #bbb' : '0 2px 8px rgba(0,0,0,0.10)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  filter: !selectedVehicle ? 'grayscale(1) brightness(1.2)' : undefined,
                }}
                disabled={!selectedVehicle || gotoCheckingStatus}
              >
                <RoomIcon sx={{ 
                  color: gotoCheckingStatus ? '#999' : (
                    vaiaActive[selectedVehicle?.id || ''] ? '#d32f2f' : (gotoMode ? '#1565c0' : '#1976d2')
                  ), 
                  fontSize: 28,
                  animation: gotoCheckingStatus ? 'spin 1s linear infinite' : 'none'
                }} />
              </Button>
                </span>
              </Tooltip>
              {/* Tool Manual */}
              <Button
                variant={manualMode ? 'contained' : 'text'}
                color={manualMode ? 'primary' : 'inherit'}
                onClick={() => {
                  if (!selectedVehicle) {
                    setSelectVehiclePopup(true);
                    return;
                  }
                  setManualMode(true);
                  setManualState('');
                  setManualError(null);
                  setManualSuccess(null);
                }}
                sx={{
                  minWidth: 0,
                  width: 44,
                  height: 44,
                  p: 0,
                  borderRadius: 2,
                  border: '1.5px solid #222',
                  boxShadow: !selectedVehicle ? '0 0 0 4px #bbb' : '0 2px 8px rgba(0,0,0,0.10)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  filter: !selectedVehicle ? 'grayscale(1) brightness(1.2)' : undefined,
                }}
                disabled={!selectedVehicle}
              >
                <FiberManualRecordIcon sx={{ color: manualMode ? '#1565c0' : '#1976d2', fontSize: 28 }} />
              </Button>
              {/* Tool Campo da regata */}
              <Button
                variant="text"
                onClick={props.onOpenRegattaFields}
                sx={{
                  minWidth: 0,
                  width: 44,
                  height: 44,
                  p: 0,
                  borderRadius: 2,
                  border: '1.5px solid #222',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.10)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: '#fff',
                }}
              >
                <img src="/campi/campiIcona.png" alt="Campo da regata" style={{ width: 28, height: 28, objectFit: 'contain' }} />
              </Button>
            </>
          ) : (
            // Tool set VISUALIZZAZIONE (occhio)
            <Button
              variant={measureMode ? 'contained' : 'text'}
              color={measureMode ? 'primary' : 'inherit'}
              onClick={() => {
                setMeasureMode(m => {
                  const next = !m;
                  if (next) {
                    setMeasurePoints([]);
                  }
                  return next;
                });
              }}
              sx={{
                minWidth: 0,
                width: 44,
                height: 44,
                p: 0,
                borderRadius: 2,
                border: '1.5px solid #222',
                boxShadow: '0 2px 8px rgba(0,0,0,0.10)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <StraightenIcon color={measureMode ? 'inherit' : 'action'} />
            </Button>
          )}
        </Box>
      )}
      {/* Snackbar per selezione boa obbligatoria */}
      <Snackbar
        open={selectVehiclePopup}
        autoHideDuration={2500}
        onClose={() => setSelectVehiclePopup(false)}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      >
        <Alert onClose={() => setSelectVehiclePopup(false)} severity="warning" sx={{ width: '100%' }}>
          Seleziona una boa
        </Alert>
      </Snackbar>
      {/* Pannello Vai a animato dal basso */}
      <Slide direction="up" in={gotoMode} mountOnEnter unmountOnExit>
        <div style={{
          position: 'fixed',
          left: 0,
          right: 0,
          bottom: 24,
          zIndex: 2000,
          background: 'rgba(255,255,255,0.92)',
          boxShadow: '0 -4px 24px rgba(0,0,0,0.18)',
          borderTopLeftRadius: 28,
          borderTopRightRadius: 28,
          borderBottomLeftRadius: 28,
          borderBottomRightRadius: 28,
          minHeight: 220,
          maxWidth: 420,
          margin: '0 auto',
          padding: 0,
          display: 'flex',
          flexDirection: 'column',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
        }}>
          <ClickAwayListener onClickAway={() => { 
            if (gotoSuccess) { 
              console.log('[PANNELLO CHIUSURA] Chiusura tramite click away (gotoSuccess = true)');
              setGotoMode(false); 
              setGotoTarget(null); 
              setGotoSuccess(null);
              setGotoError(null);
            } else {
              console.log('[PANNELLO CHIUSURA] Click away ignorato (gotoSuccess = false/null)');
            }
          }}>
            <div style={{ position: 'relative', width: '100%', height: '100%', padding: 0 }}>
              {/* X chiusura sempre cliccabile */}
              <Button onClick={() => { 
                console.log('[PANNELLO CHIUSURA] Chiusura tramite X');
                setGotoMode(false); 
                setGotoTarget(null); 
                setGotoSuccess(null);
                setGotoError(null);
              }} sx={{ position: 'absolute', top: 8, right: 8, minWidth: 0, p: 0.5, zIndex: 10 }}>
                <span style={{ fontSize: 22, fontWeight: 700, color: '#888' }}>×</span>
              </Button>
              <div style={{ padding: '32px 24px 24px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center', minHeight: 180 }}>
                {/* Stato: dopo invio comando mostra solo STOP */}
                {gotoSuccess ? (
                  <Button
                    variant="contained"
                    color="error"
                    onClick={handleStopGoto}
                    disabled={gotoLoading || !selectedVehicle}
                    sx={{ mt: 2, width: '100%', fontWeight: 700, fontSize: 18 }}
                  >STOP</Button>
                ) : (
                  <>
                    <div style={{ fontWeight: 600, fontSize: 18, color: '#222', marginBottom: 12, textAlign: 'center' }}>
                      Tocca il punto dove vuoi far andare la boa
                    </div>
                    {gotoTarget ? (
                      <>
                        <div style={{ color: '#222', marginBottom: 8, fontSize: 15 }}>
                          Lat: {gotoTarget.lat.toFixed(6)}<br/>Lon: {gotoTarget.lon.toFixed(6)}
                        </div>
                        <input
                          type="number"
                          placeholder="Altitudine (opzionale, m)"
                          value={gotoTarget.alt ?? ''}
                          onChange={e => setGotoTarget(gt => gt ? { ...gt, alt: e.target.value ? parseFloat(e.target.value) : undefined } : null)}
                          style={{ marginTop: 8, padding: 6, borderRadius: 6, border: '1px solid #ccc', width: '100%', color: '#222', background: '#fff', fontSize: 15 }}
                          min={-100}
                          max={10000}
                          step={0.1}
                        />
                        <Button
                          variant="contained"
                          color="success"
                          onClick={handleSendGoto}
                          disabled={gotoLoading}
                          sx={{ mt: 2, width: '100%', fontWeight: 700, fontSize: 18 }}
                        >Vai a</Button>
                      </>
                    ) : null}
                  </>
                )}
              </div>
            </div>
          </ClickAwayListener>
        </div>
      </Slide>
      {/* Overlay per bloccare interazione mappa sotto il pannello Vai a */}
      {gotoMode && (gotoTarget || gotoSuccess) && (
        <div style={{
          position: 'fixed',
          left: 0,
          top: 0,
          width: '100vw',
          height: '100vh',
          zIndex: 1999,
          background: 'rgba(0,0,0,0.04)',
        }} />
      )}
      {/* Menu elimina custom vicino al punto cliccato */}
      {selectedLineId && menuPosition && (
        <Box
          sx={{
            position: 'absolute',
            left: menuPosition.x,
            top: menuPosition.y,
            zIndex: 2000,
            bgcolor: 'background.paper',
            borderRadius: 2,
            boxShadow: 4,
            px: 2,
            py: 1,
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            border: '1px solid #eee',
            transform: 'translate(-50%, -100%)',
          }}
        >
          <Button color="error" variant="contained" size="small" onClick={() => handleDeleteLine(selectedLineId)}>
            Elimina
          </Button>
          <Button size="small" onClick={() => { setSelectedLineId(null); setMenuPosition(null); }}>
            Annulla
          </Button>
        </Box>
      )}
      
      {/* Stile CSS per animazione rotazione */}
      <style>
        {`
          @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
        `}
      </style>
      
      {/* Snackbar per errori/successi Vai a */}
      <Snackbar
        open={!!gotoError || !!gotoSuccess}
        autoHideDuration={5000}
        onClose={() => { setGotoError(null); setGotoSuccess(null); }}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      >
        {gotoError ? (
          <Alert onClose={() => setGotoError(null)} severity="error" sx={{ width: '100%' }}>
            {gotoError}
          </Alert>
        ) : gotoSuccess ? (
          <Alert onClose={() => setGotoSuccess(null)} severity="success" sx={{ width: '100%' }}>
            {gotoSuccess}
          </Alert>
        ) : <span />}
      </Snackbar>
      {/* Pannello Manual animato dal basso */}
      <Slide direction="up" in={manualMode} mountOnEnter unmountOnExit>
        <div style={{
          position: 'fixed',
          left: 0,
          right: 0,
          bottom: 24,
          zIndex: 2000,
          background: 'rgba(255,255,255,0.92)',
          boxShadow: '0 -4px 24px rgba(0,0,0,0.18)',
          borderTopLeftRadius: 28,
          borderTopRightRadius: 28,
          borderBottomLeftRadius: 28,
          borderBottomRightRadius: 28,
          minHeight: 220,
          maxWidth: 420,
          margin: '0 auto',
          padding: 0,
          display: 'flex',
          flexDirection: 'column',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
        }}>
          <ClickAwayListener onClickAway={() => { setManualMode(false); setManualState(''); }}>
            <div style={{ position: 'relative', width: '100%', height: '100%', padding: 0 }}>
              {/* X chiusura sempre cliccabile */}
              <Button onClick={() => { setManualMode(false); setManualState(''); }} sx={{ position: 'absolute', top: 8, right: 8, minWidth: 0, p: 0.5, zIndex: 10 }}>
                <span style={{ fontSize: 22, fontWeight: 700, color: '#888' }}>×</span>
              </Button>
              <div style={{ padding: '32px 24px 24px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center', minHeight: 180 }}>
                <div style={{ fontWeight: 600, fontSize: 18, color: '#222', marginBottom: 12, textAlign: 'center' }}>
                  Seleziona lo stato operativo della boa
                </div>
                <select
                  value={manualState}
                  onChange={e => setManualState(e.target.value as 'hold' | 'loiter' | '')}
                  style={{ fontSize: 16, padding: '8px 12px', borderRadius: 8, border: '1px solid #ccc', width: '100%', marginBottom: 16 }}
                  disabled={manualLoading}
                >
                  <option value="">Seleziona stato...</option>
                  <option value="hold">HOLD</option>
                  <option value="loiter">LOITER</option>
                </select>
                <Button
                  variant="contained"
                  color="success"
                  onClick={handleSendManual}
                  disabled={manualLoading || !manualState}
                  sx={{ mt: 2, width: '100%', fontWeight: 700, fontSize: 18 }}
                >Imposta stato</Button>
              </div>
            </div>
          </ClickAwayListener>
        </div>
      </Slide>
      {/* Overlay per bloccare interazione mappa sotto il pannello Manual */}
      {manualMode && (
        <div style={{
          position: 'fixed',
          left: 0,
          top: 0,
          width: '100vw',
          height: '100vh',
          zIndex: 1999,
          background: 'rgba(0,0,0,0.04)',
        }} />
      )}
      {/* Snackbar per errori/successi Manual */}
      <Snackbar
        open={!!manualError || !!manualSuccess}
        autoHideDuration={5000}
        onClose={() => { setManualError(null); setManualSuccess(null); }}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      >
        {manualError ? (
          <Alert onClose={() => setManualError(null)} severity="error" sx={{ width: '100%' }}>
            {manualError}
          </Alert>
        ) : manualSuccess ? (
          <Alert onClose={() => setManualSuccess(null)} severity="success" sx={{ width: '100%' }}>
            {manualSuccess}
          </Alert>
        ) : <span />}
      </Snackbar>
    </Box>
  );
});

export { MapView };
export default MapView;
