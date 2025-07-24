import React from 'react';
import { Box, Button, Typography } from '@mui/material';
import { parseIpPort } from '../../utils';
import type { Vehicle } from '../../shared/types';

function BoaDetailPage({ vehicle, onBack, onRemove }: { vehicle: Vehicle; onBack: () => void; onRemove: (ip: string, port: number) => void }) {
  // Ricavo i dati richiesti dalle chiavi note
  const speed = vehicle.GLOBAL_POSITION_INT?.speed || vehicle.VFR_HUD?.groundspeed || null;
  const heading = vehicle.GLOBAL_POSITION_INT?.heading || vehicle.GLOBAL_POSITION_INT?.hdg || null;
  const mode = vehicle.HEARTBEAT?.custom_mode || null;
  const voltage = vehicle.SYS_STATUS?.voltage_battery || null;
  const batteryPct = vehicle.SYS_STATUS?.battery_remaining || null;
  const pitch = vehicle.ATTITUDE?.pitch ?? null;
  const roll = vehicle.ATTITUDE?.roll ?? null;
  const pitchDeg = pitch !== null ? (pitch * 180 / Math.PI).toFixed(1) : null;
  const rollDeg = roll !== null ? (roll * 180 / Math.PI).toFixed(1) : null;
  // Ricava ip e port dall'id (es: 10_8_0_53_14550)
  const { ip, port } = parseIpPort(vehicle.id);
  // Numero satelliti visibili da GPS_RAW_INT
  const satellites = vehicle.GPS_RAW_INT?.satellites_visible ?? null;
  return (
    <Box sx={{ p: 3, maxWidth: 500, mx: 'auto' }}>
      <Box sx={{ mb: 2 }}>
        <Button variant="outlined" onClick={onBack}>&larr; Indietro</Button>
        <Typography variant="h5" sx={{ display: 'inline', ml: 2 }}>{vehicle.id}</Typography>
      </Box>
      <Box sx={{ display: 'flex', justifyContent: 'center', mb: 2 }}>
        <img
          src={'/boe/boadefault.png'}
          alt={vehicle.id}
          style={{ width: 220, height: 220, objectFit: 'cover', borderRadius: 12, background: '#eee' }}
        />
      </Box>
      <Box sx={{ fontSize: 16, color: '#333', mb: 2 }}>
        <strong>Posizione:</strong> {vehicle.lat}, {vehicle.lon}<br />
        <strong>Velocità:</strong> {speed !== null ? speed + ' m/s' : 'N/A'}<br />
        <strong>Direzione:</strong> {heading !== null ? heading + '°' : 'N/A'}<br />
        <strong>Stato:</strong> {mode !== null ? String(mode) : 'N/A'}<br />
        <strong>Batteria:</strong> {voltage !== null ? voltage + ' V' : 'N/A'} ({batteryPct !== null ? batteryPct + '%' : 'N/A'})<br />
        <strong>Pitch:</strong> {pitch !== null ? `${pitch.toFixed(3)} rad (${pitchDeg}°)` : 'N/A'}<br />
        <strong>Roll:</strong> {roll !== null ? `${roll.toFixed(3)} rad (${rollDeg}°)` : 'N/A'}<br />
        <strong>Satelliti visibili:</strong> {satellites !== null ? satellites : 'N/A'}
      </Box>
      <Button variant="contained" color="error" onClick={() => onRemove(ip, port)} sx={{ mt: 2 }}>Rimuovi boa</Button>
    </Box>
  );
}

export default BoaDetailPage; 