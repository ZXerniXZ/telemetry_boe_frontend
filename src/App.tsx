import MapView from './components/MapView';
import type { Vehicle } from './components/MapView';
import { MqttProvider } from './mqtt/MqttProvider';
import { useTelemetry } from './mqtt/useTelemetry';
import React, { useState, useMemo, useCallback } from 'react';
import { AppBar, Toolbar, IconButton, Typography, Drawer, List, ListItemButton, ListItemIcon, ListItemText, Box, Badge, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper, Button, Accordion, AccordionSummary, AccordionDetails, Snackbar, Alert } from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import FiberManualRecordIcon from '@mui/icons-material/FiberManualRecord';
import MapIcon from '@mui/icons-material/Map';
import BuoyIcon from '@mui/icons-material/Adjust';
import L from 'leaflet';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { vehicleIconOnline, vehicleIconOffline } from './config';
import { parseIpPort } from './utils';

const drawerWidth = 220;

function TelemetryMap({ vehicles }: { vehicles: Vehicle[] }) {
  // Mostra la mappa solo se c'è almeno una boa connessa
  if (vehicles.length === 0) {
    return <div style={{textAlign: 'center', marginTop: 40, color: '#888'}}>In attesa di coordinate...</div>;
  }
  return (
    <Box sx={{ position: 'relative', width: '100%', height: '100%' }}>
      <MapView
        vehicles={vehicles}
        initialZoom={16}
      />
    </Box>
  );
}

function BoePage({ vehicles, onSelect, scannedIps, onScan, scanning, onConnectBoa, connectingIps, connectError, onCloseError }: { vehicles: Vehicle[]; onSelect: (id: string) => void; scannedIps: string[]; onScan: () => void; scanning: boolean; onConnectBoa: (ip: string) => void; connectingIps: Set<string>; connectError: string | null; onCloseError: () => void }) {
  const [openConnected, setOpenConnected] = useState(true);
  const [openScanned, setOpenScanned] = useState(true);
  return (
    <Box sx={{ p: 3 }}>
      <Accordion expanded={openConnected} onChange={() => setOpenConnected(o => !o)}>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography variant="h6">Boe connesse</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
            {vehicles.length === 0 && (
              <Typography variant="body1" color="text.secondary">Nessuna boa connessa</Typography>
            )}
            {vehicles.map((v) => {
              const isOnline = v.isonline === true;
              return (
                <Box key={v.id} sx={{ width: 260, position: 'relative' }}>
                  <Paper
                    elevation={2}
                    sx={{
                      p: 0,
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      aspectRatio: '1 / 1',
                      justifyContent: 'center',
                      overflow: 'hidden',
                      cursor: 'pointer',
                      position: 'relative',
                      transition: 'box-shadow 0.2s',
                      '&:hover': { boxShadow: 8, outline: '2px solid #1976d2' },
                      filter: isOnline ? 'none' : 'grayscale(1) brightness(0.7)',
                      opacity: isOnline ? 1 : 0.7,
                    }}
                    onClick={() => onSelect(v.id)}
                  >
                    <img
                      src={'/boe/boadefault.png'}
                      alt={v.id}
                      style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                        borderRadius: 12,
                        background: '#eee',
                        display: 'block',
                        pointerEvents: 'none',
                        filter: isOnline ? 'none' : 'grayscale(1) brightness(0.7)',
                        opacity: isOnline ? 1 : 0.7,
                      }}
                    />
                    {/* Overlay trasparente per garantire il click */}
                    <Box
                      sx={{
                        position: 'absolute',
                        top: 0, left: 0, right: 0, bottom: 0,
                        zIndex: 1,
                        cursor: 'pointer'
                      }}
                    />
                  </Paper>
                </Box>
              );
            })}
          </Box>
        </AccordionDetails>
      </Accordion>
      <Accordion expanded={openScanned} onChange={() => setOpenScanned(o => !o)} sx={{ mt: 3 }}>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography variant="h6">Boe trovate in rete</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
            <Button variant="contained" onClick={onScan} disabled={scanning}>{scanning ? 'Scansione...' : 'Scan'}</Button>
          </Box>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
            {scannedIps.length === 0 && <Typography variant="body2" color="text.secondary">Nessuna boa individuata</Typography>}
            {scannedIps.map((ip) => {
              const isConnecting = connectingIps.has(ip);
              return (
                <Box key={ip} sx={{ width: 260, position: 'relative' }}>
                  <Paper
                    elevation={2}
                    sx={{
                      p: 0,
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      aspectRatio: '1 / 1',
                      justifyContent: 'center',
                      overflow: 'hidden',
                      position: 'relative',
                      transition: 'box-shadow 0.2s',
                      filter: isConnecting ? 'grayscale(1) brightness(0.7)' : 'none',
                      opacity: isConnecting ? 0.7 : 1,
                    }}
                  >
                    <img
                      src={'/boe/boadefault.png'}
                      alt={ip}
                      style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                        borderRadius: 12,
                        background: '#eee',
                        display: 'block',
                        pointerEvents: 'none',
                        filter: isConnecting ? 'grayscale(1) brightness(0.7)' : 'none',
                        opacity: isConnecting ? 0.7 : 1,
                      }}
                    />
                    {/* Overlay info IP e pulsante */}
                    <Box
                      sx={{
                        position: 'absolute',
                        bottom: 0,
                        left: 0,
                        right: 0,
                        bgcolor: 'rgba(255,255,255,0.92)',
                        p: 1,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        borderBottomLeftRadius: 12,
                        borderBottomRightRadius: 12,
                      }}
                    >
                      <Typography variant="body1" sx={{ fontWeight: 500 }}>{ip}</Typography>
                      <Button variant="outlined" size="small" sx={{ mt: 1 }} onClick={() => onConnectBoa(ip)} disabled={isConnecting}>{isConnecting ? 'Connessione...' : 'Connetti'}</Button>
                    </Box>
                  </Paper>
                </Box>
              );
            })}
          </Box>
        </AccordionDetails>
      </Accordion>
      <Snackbar open={!!connectError} autoHideDuration={6000} onClose={onCloseError} anchorOrigin={{ vertical: 'top', horizontal: 'center' }}>
        <Alert onClose={onCloseError} severity="error" sx={{ width: '100%' }}>
          {connectError}
        </Alert>
      </Snackbar>
    </Box>
  );
}

function TopBar({ boaCount, onMenuClick }: { boaCount: number; onMenuClick: () => void }) {
  const now = new Date();
  const timeStr = now.toLocaleTimeString();
  const connected = boaCount > 0;
  return (
    <AppBar position="fixed" color="default" elevation={1} sx={{ bgcolor: 'white', color: 'black', zIndex: 1201 }}>
      <Toolbar sx={{ justifyContent: 'space-between' }}>
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          <IconButton edge="start" color="inherit" aria-label="menu" onClick={onMenuClick}>
            <MenuIcon />
          </IconButton>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Typography variant="h6" sx={{ fontWeight: 500, flex: 1, textAlign: 'center', minWidth: 120 }}>
            {timeStr}
          </Typography>
          <Badge
            color={connected ? 'success' : 'error'}
            badgeContent={connected ? boaCount : 'Nessuna'}
            anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
            sx={{ mr: 2 }}
          >
            <FiberManualRecordIcon sx={{ color: connected ? 'green' : 'red' }} />
          </Badge>
        </Box>
      </Toolbar>
    </AppBar>
  );
}

function SideMenu({ open, onClose, currentPage, setPage }: { open: boolean; onClose: () => void; currentPage: string; setPage: (p: string) => void }) {
  return (
    <Drawer anchor="left" open={open} onClose={onClose}>
      <Box sx={{ width: drawerWidth, bgcolor: 'white', color: 'black', p: 2, pt: '64px' }} role="presentation">
        <List>
          <ListItemButton
            selected={currentPage === 'mappa'}
            onClick={() => {
              setPage('mappa');
              onClose();
            }}
            sx={{ color: 'black' }}
          >
            <ListItemIcon sx={{ color: 'black' }}>
              <MapIcon />
            </ListItemIcon>
            <ListItemText primary="Mappa" sx={{ color: 'black' }} />
          </ListItemButton>
          <ListItemButton
            selected={currentPage === 'boe'}
            onClick={() => {
              setPage('boe');
              onClose();
            }}
            sx={{ color: 'black' }}
          >
            <ListItemIcon sx={{ color: 'black' }}>
              <BuoyIcon />
            </ListItemIcon>
            <ListItemText primary="Boe" sx={{ color: 'black' }} />
          </ListItemButton>
        </List>
      </Box>
    </Drawer>
  );
}

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

function AppContent() {
  const { telemetry } = useTelemetry();
  const [menuOpen, setMenuOpen] = useState(false);
  const [page, setPage] = useState<'mappa' | 'boe' | 'boa-detail'>('mappa');
  const [selectedBoa, setSelectedBoa] = useState<string | null>(null);
  const [scannedIps, setScannedIps] = useState<string[]>([]);
  const [scanning, setScanning] = useState(false);
  const [connectingIps, setConnectingIps] = useState<Set<string>>(new Set());
  const [connectError, setConnectError] = useState<string | null>(null);
  // Memoizza vehicles
  const vehicles: Vehicle[] = useMemo(() => Object.entries(telemetry)
    .map(([deviceId, types]) => {
      const posMsg = types['GLOBAL_POSITION_INT'] || Object.values(types).find(m => m.data && typeof m.data.lat === 'number' && typeof m.data.lon === 'number');
      if (!posMsg || !posMsg.data) return null;
      const lat = posMsg.data.lat / 1e7;
      const lon = posMsg.data.lon / 1e7;
      if (isNaN(lat) || isNaN(lon)) return null;
      const isonline = (types['isonline'] as any) === true;
      if (!isonline) return null;
      return {
        id: deviceId,
        lat,
        lon,
        ...Object.fromEntries(Object.entries(types).map(([type, msg]) => [type, msg.data])),
        isonline,
      };
    })
    .filter(Boolean) as Vehicle[], [telemetry]);
  // Memoizza connectedIps
  const connectedIps = useMemo(() => vehicles.map(v => v.id.split('_').slice(0, 4).join('.')), [vehicles]);
  // Memoizza scannedIpsFiltered
  const scannedIpsFiltered = useMemo(() => scannedIps.filter(ip => !connectedIps.includes(ip)), [scannedIps, connectedIps]);
  // Memoizza selectedVehicle
  const selectedVehicle = useMemo(() => vehicles.find(v => v.id === selectedBoa) || null, [vehicles, selectedBoa]);
  // Memoizza handleScan
  const handleScan = useCallback(async () => {
    setScanning(true);
    try {
      const res = await fetch('http://localhost:8001/scan');
      if (!res.ok) throw new Error('Errore scansione');
      const data = await res.json();
      let found: string[] = [];
      if (Array.isArray(data)) {
        found = data;
      } else if (Array.isArray(data.ips)) {
        found = data.ips;
      } else if (Array.isArray(data.found)) {
        found = data.found;
      }
      setScannedIps(found.filter(ip => !connectedIps.includes(ip)));
    } catch (e) {
      setScannedIps([]);
    } finally {
      setScanning(false);
    }
  }, [connectedIps]);
  // Memoizza handleConnectBoa
  const handleConnectBoa = useCallback(async (ip: string) => {
    setConnectingIps(prev => new Set(prev).add(ip));
    setConnectError(null);
    const port = 14550;
    try {
      const res = await fetch('http://localhost:8001/aggiungiboa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ip, port }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setConnectError(data.detail || data.message || 'Errore durante la connessione');
        setConnectingIps(prev => { const s = new Set(prev); s.delete(ip); return s; });
        return;
      }
      setScannedIps(prev => prev.filter(item => item !== ip));
      setConnectingIps(prev => { const s = new Set(prev); s.delete(ip); return s; });
    } catch (e: any) {
      setConnectError(e?.message || 'Errore durante la connessione');
      setConnectingIps(prev => { const s = new Set(prev); s.delete(ip); return s; });
    }
  }, []);
  // Memoizza handleRemoveBoa
  const handleRemoveBoa = useCallback(async (ip: string, port: number) => {
    try {
      const url = `http://localhost:8001/rimuoviboa?ip=${encodeURIComponent(ip)}&port=${encodeURIComponent(port)}`;
      const res = await fetch(url, { method: 'DELETE' });
      if (!res.ok) throw new Error('Errore rimozione boa');
      setPage('boe');
      setSelectedBoa(null);
    } catch (e) {
      // Opzionale: feedback errore
    }
  }, []);
  // Memoizza handleCloseConnectError
  const handleCloseConnectError = useCallback(() => setConnectError(null), []);

  const onlineCount = vehicles.filter(v => v.isonline).length;

  return (
    <Box sx={{ height: '100vh', bgcolor: 'white' }}>
      <TopBar boaCount={onlineCount} onMenuClick={() => setMenuOpen((open) => !open)} />
      <SideMenu open={menuOpen} onClose={() => setMenuOpen(false)} currentPage={page} setPage={p => { setPage(p as 'mappa' | 'boe'); setSelectedBoa(null); }} />
      <Box
        sx={{
          pt: 8,
          height: 'calc(100vh - 64px)',
          width: '100vw',
          position: 'relative',
          transition: 'margin-left 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          marginLeft: menuOpen ? `${drawerWidth}px` : 0,
        }}
      >
        {page === 'mappa' && <TelemetryMap vehicles={vehicles} />}
        {page === 'boe' && <BoePage vehicles={vehicles} onSelect={id => { setSelectedBoa(id); setPage('boa-detail'); }} scannedIps={scannedIpsFiltered} onScan={handleScan} scanning={scanning} onConnectBoa={handleConnectBoa} connectingIps={connectingIps} connectError={connectError} onCloseError={handleCloseConnectError} />}
        {page === 'boa-detail' && selectedVehicle && <BoaDetailPage vehicle={selectedVehicle} onBack={() => setPage('boe')} onRemove={handleRemoveBoa} />}
      </Box>
    </Box>
  );
}

function App() {
  return (
    <MqttProvider>
      <AppContent />
    </MqttProvider>
  );
}

export default App;
