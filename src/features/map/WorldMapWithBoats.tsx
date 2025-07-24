import React from 'react';
import { Box, Button } from '@mui/material';
import { MapContainer, TileLayer, Marker, useMapEvent } from 'react-leaflet';
import L, { Map as LeafletMap } from 'leaflet';
import { getRotatedIcon } from './MapView';
import type { Vehicle } from '../../shared/types';

function WorldMapWithBoats({ vehicles, onSelectPosition }: { vehicles: Vehicle[]; onSelectPosition: (pos: { lat: number, lon: number }) => void }) {
  const [selectedPos, setSelectedPos] = React.useState<{ lat: number; lon: number } | null>(null);
  const [manualMode, setManualMode] = React.useState(false);
  const mapRef = React.useRef<LeafletMap | null>(null);

  // Calcola centro boe
  const center = vehicles.length > 0
    ? [vehicles.reduce((sum, v) => sum + v.lat, 0) / vehicles.length, vehicles.reduce((sum, v) => sum + v.lon, 0) / vehicles.length]
    : [45, 9];

  // Componente per gestire click sulla mappa
  function ManualSelectHandler() {
    useMapEvent('click', (e: any) => {
      if (manualMode) {
        setSelectedPos({ lat: e.latlng.lat, lon: e.latlng.lng });
        setManualMode(false);
      }
    });
    return null;
  }

  // Prendi posizione GPS attuale
  function handleGps() {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        pos => {
          setSelectedPos({ lat: pos.coords.latitude, lon: pos.coords.longitude });
        },
        err => { alert('Impossibile ottenere la posizione GPS'); }
      );
    } else {
      alert('Geolocalizzazione non supportata');
    }
  }

  // Attiva selezione manuale
  function handleManual() {
    setManualMode(true);
  }

  // Pulsante continua (abilitato solo se selezionato)
  function handleContinue() {
    if (selectedPos) {
      onSelectPosition(selectedPos);
    }
  }

  return (
    <Box sx={{ width: '100vw', height: '100vh', position: 'relative' }}>
      <MapContainer
        center={selectedPos ? [selectedPos.lat, selectedPos.lon] : (center as [number, number])}
        zoom={14}
        style={{ width: '100vw', height: '100vh', zIndex: 1 }}
        scrollWheelZoom={true}
        whenReady={() => {}}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution="&copy; OpenStreetMap contributors"
        />
        {manualMode && <ManualSelectHandler />}
        {vehicles.map(v => {
          let heading = 0;
          if (v.GLOBAL_POSITION_INT && typeof v.GLOBAL_POSITION_INT.hdg === 'number') {
            heading = Math.floor(v.GLOBAL_POSITION_INT.hdg / 100);
          }
          const isOnline = v.isonline === true;
          return (
            <Marker
              key={v.id}
              position={[v.lat, v.lon]}
              icon={getRotatedIcon(heading, isOnline)}
            />
          );
        })}
        {selectedPos && (
          <Marker
            position={[selectedPos.lat, selectedPos.lon]}
            icon={L.divIcon({
              className: '',
              iconSize: [44, 44],
              iconAnchor: [22, 44],
              popupAnchor: [0, -44],
              html: `<div style='width:44px;height:44px;background:#1976d2;border-radius:50%;display:flex;align-items:center;justify-content:center;border:3px solid #fff;box-shadow:0 2px 8px #1976d2;'><span style='color:white;font-weight:700;font-size:18px;'>G</span></div>`
            })}
          />
        )}
      </MapContainer>
      {/* Toolbar pulsanti in basso, stile coerente con le altre toolbar */}
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
        <Button variant="contained" color="primary" onClick={handleGps}>Scegli posizione GPS attuale</Button>
        <Button variant="contained" color={manualMode ? 'secondary' : 'primary'} onClick={handleManual} disabled={manualMode}>
          Seleziona manualmente
        </Button>
        <Button variant="contained" color="success" onClick={handleContinue} disabled={!selectedPos}>
          Continua
        </Button>
      </Box>
    </Box>
  );
}

export default WorldMapWithBoats; 