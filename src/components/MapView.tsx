import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Box } from '@mui/material';
import Switch from '@mui/material/Switch';
import FormControlLabel from '@mui/material/FormControlLabel';
import VisibilityIcon from '@mui/icons-material/Visibility';
import EditIcon from '@mui/icons-material/Edit';
import StraightenIcon from '@mui/icons-material/Straighten';
import Button from '@mui/material/Button';
import { useRef as useReactRef } from 'react';
import * as React from 'react';
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

// Icona personalizzata per le boe, con rotazione dinamica
function getRotatedIcon(heading: number) {
  return L.divIcon({
    className: '',
    iconSize: [40, 40],
    iconAnchor: [20, 40],
    popupAnchor: [0, -40],
    html: `<img src="/boe/boeIconDefault.png" style="width:40px;height:40px;transform:rotate(${heading}deg);display:block;pointer-events:none;" />`,
  });
}

export interface Vehicle {
  id: string;
  lat: number;
  lon: number;
  [key: string]: any; // altri dati associati
}

interface MapViewProps {
  vehicles: Vehicle[];
  centerOn?: [number, number];
  initialZoom?: number;
  actions?: React.ReactNode; // elementi opzionali da mostrare a sinistra del menu stile mappa
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

const MapView = ({ vehicles, centerOn, initialZoom, actions }: MapViewProps) => {
  // Centro della mappa: se c'è centerOn, altrimenti primo veicolo, altrimenti mondo
  const defaultCenter: [number, number] = (vehicles.length > 0 ? [vehicles[0].lat, vehicles[0].lon] : [0, 0]);
  const defaultZoom = typeof initialZoom === 'number' ? initialZoom : (vehicles.length > 0 ? 8 : 2);
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

  // Stato per selezione boa
  const [selectedVehicleId, setSelectedVehicleId] = useState<string | null>(null);
  const selectedVehicle = vehicles.find(v => v.id === selectedVehicleId) || null;

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

  // Ref per accedere alla mappa leaflet
  const mapRef = useRef<L.Map | null>(null);

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
    if (mapRef.current && vehicles.length > 0) {
      const map = mapRef.current;
      const centroid = getCentroid(vehicles);
      map.flyTo(centroid, map.getZoom());
    }
  }, [vehicles]);

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
    if (!gotoSuccess) setGotoTarget({ lat: e.latlng.lat, lon: e.latlng.lng });
  }

  // Handler click marker boa
  function handleMarkerClick(vehicleId: string) {
    setSelectedVehicleId(vehicleId);
  }

  // Handler click sulla mappa (fuori marker)
  function handleMapBackgroundClick(e: L.LeafletMouseEvent) {
    setSelectedVehicleId(null);
    // Se in gotoMode, gestisci anche la selezione destinazione
    if (gotoMode) handleGotoMapClick(e);
  }

  // Funzione per inviare comando vai a
  async function handleSendGoto() {
    if (!gotoTarget || !selectedVehicle) return;
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
      // Non chiudere il pannello, mostra solo STOP
    } catch (e: any) {
      setGotoError(e?.message || 'Errore invio comando');
    } finally {
      setGotoLoading(false);
    }
  }

  // Funzione per inviare stop_vaia
  async function handleStopGoto() {
    if (!selectedVehicle) return;
    // Chiudi subito tutte le schermate Vai a
    setGotoMode(false);
    setGotoTarget(null);
    setGotoSuccess(null);
    setGotoError(null);
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
    } catch (e: any) {
      setGotoError(e?.message || 'Errore stop');
    } finally {
      setGotoLoading(false);
    }
  }

  // Funzione per inviare comando cambia_stato
  async function handleSendManual() {
    if (!selectedVehicle || !manualState) return;
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
  }, [selectedVehicleId]);

  // Quando cambio boa selezionata, resetta schermata Manual se necessario
  useEffect(() => {
    setManualMode(false);
    setManualState('');
    setManualSuccess(null);
    setManualError(null);
  }, [selectedVehicleId]);

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

  return (
    <Box
      sx={{ position: 'relative', width: '100%', height: '100%' }}
      className={measureMode ? 'measure-cursor' : ''}
    >
      {/* Switch modalità sovrapposto centrato in alto */}
      <Box
        sx={{
          position: 'absolute',
          top: 16,
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 1200,
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          bgcolor: 'background.paper',
          borderRadius: 2,
          boxShadow: 2,
          px: 1.5,
          py: 0.5,
        }}
      >
        <VisibilityIcon fontSize="small" color={editMode ? 'disabled' : 'primary'} />
        <Switch
          checked={editMode}
          onChange={(_, checked) => setEditMode(checked)}
          color="primary"
          size="small"
        />
        <EditIcon fontSize="small" color={editMode ? 'primary' : 'disabled'} />
      </Box>
      {/* Barra in alto a destra con eventuali azioni e select stile mappa */}
      <Box sx={{ position: 'absolute', top: 16, right: 16, zIndex: 1200, display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 2 }}>
        {/* Pulsante centra boe */}
        <button onClick={handleCenterBoe} style={{ fontSize: 14, padding: '2px 8px', borderRadius: 4, cursor: 'pointer' }}>
          Centra boe
        </button>
        {actions}
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
        {vehicles.map((v) => {
          // Ricava heading da GLOBAL_POSITION_INT.hdg se presente
          let heading = 0;
          if (v.GLOBAL_POSITION_INT && typeof v.GLOBAL_POSITION_INT.hdg === 'number') {
            heading = Math.floor(v.GLOBAL_POSITION_INT.hdg / 100);
          }
          // Linea verde e marker destinazione se vaia attivo per questa boa
          const tgt = vaiaTarget[v.id];
          const vaiaTgt = vaiaActive[v.id] && tgt && typeof tgt.lat === 'number' && typeof tgt.lon === 'number';
          const isSelected = selectedVehicleId === v.id;
          // Icona evidenziata custom SVG animata via CSS
          const [haloAppear, setHaloAppear] = useState<string | null>(null);
          useEffect(() => {
            if (isSelected) {
              setHaloAppear('buoy-halo-appear');
              const t = setTimeout(() => setHaloAppear(null), 600);
              return () => clearTimeout(t);
            }
          }, [isSelected]);
          const haloClass = `buoy-halo-breath${haloAppear ? ' ' + haloAppear : ''}`;
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
          return (
            <React.Fragment key={v.id}>
              {/* Cerchio animato sopra la mappa per la boa selezionata */}
              {isSelected && (
                <SelectedHaloMarker lat={v.lat} lon={v.lon} icon={selectedHaloIcon} />
              )}
              <Marker key={v.id} position={[v.lat, v.lon]} icon={getRotatedIcon(heading)}
                eventHandlers={{ click: () => handleMarkerClick(v.id) }}
              >
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
        })}
      </MapContainer>
      {/* Toolbar dock infondo alla pagina */}
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
          justifyContent: 'center',
          gap: 3,
        }}
      >
        {editMode ? (
          <>
            {/* Tool Vai a */}
            <Button
              variant={gotoMode ? 'contained' : 'text'}
              color={gotoMode ? 'primary' : 'inherit'}
              onClick={() => {
                if (!selectedVehicle) {
                  setSelectVehiclePopup(true);
                  return;
                }
                if (vaiaActive[selectedVehicle.id]) {
                  setGotoMode(true);
                  setGotoTarget({ lat: 0, lon: 0 }); // dummy, per mostrare STOP
                  setGotoSuccess('Comando inviato!');
                } else {
                  setGotoMode(true);
                  setGotoTarget(null);
                  setGotoError(null);
                  setGotoSuccess(null);
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
              disabled={!selectedVehicle}
            >
              <RoomIcon sx={{ color: gotoMode ? '#1565c0' : '#1976d2', fontSize: 28 }} />
            </Button>
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
          <ClickAwayListener onClickAway={() => { if (gotoSuccess) { setGotoMode(false); setGotoTarget(null); } }}>
            <div style={{ position: 'relative', width: '100%', height: '100%', padding: 0 }}>
              {/* X chiusura sempre cliccabile */}
              <Button onClick={() => { setGotoMode(false); setGotoTarget(null); }} sx={{ position: 'absolute', top: 8, right: 8, minWidth: 0, p: 0.5, zIndex: 10 }}>
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
};

export default MapView;
