import { MapContainer, TileLayer, Marker, Popup, useMap, Polyline } from 'react-leaflet';
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
import { getCentroid, haversine } from '../utils';

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
          return (
            <Marker key={v.id} position={[v.lat, v.lon]} icon={getRotatedIcon(heading)}>
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
                }}
              >
                {v.lat.toFixed(5)}, {v.lon.toFixed(5)}
              </div>
            </Marker>
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
        {/* Tool misura distanza */}
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
          sx={{ minWidth: 0, p: 1, borderRadius: 2 }}
        >
          <StraightenIcon color={measureMode ? 'inherit' : 'action'} />
        </Button>
      </Box>
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
    </Box>
  );
};

export default MapView;
