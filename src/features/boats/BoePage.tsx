import React, { useState, useEffect, useRef } from 'react';
import { Box, Accordion, AccordionSummary, AccordionDetails, Typography, Paper, Button, Snackbar, Alert } from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import type { Vehicle } from '../../shared/types';

function BoePage({ vehicles, onSelect, scannedIps, onScan, scanning, onConnectBoa, connectingIps, connectError, onCloseError, autoRetry, setAutoRetry, disconnectedSince }: { vehicles: Vehicle[]; onSelect: (id: string) => void; scannedIps: string[]; onScan: () => void; scanning: boolean; onConnectBoa: (ip: string) => void; connectingIps: Set<string>; connectError: string | null; onCloseError: () => void; autoRetry: boolean; setAutoRetry: (v: boolean) => void; disconnectedSince: { [id: string]: number } }) {
  const [openConnected, setOpenConnected] = useState(true);
  const [openScanned, setOpenScanned] = useState(true);
  // Funzione per formattare il tempo trascorso
  function formatDuration(ms: number) {
    const s = Math.floor(ms / 1000);
    const m = Math.floor(s / 60);
    const h = Math.floor(m / 60);
    if (h > 0) return `${h}h ${m % 60}m ${s % 60}s`;
    if (m > 0) return `${m}m ${s % 60}s`;
    return `${s}s`;
  }
  const scanRef = useRef(onScan);
  useEffect(() => { scanRef.current = onScan; }, [onScan]);
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (autoRetry) {
      interval = setInterval(() => {
        scanRef.current();
      }, 5000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [autoRetry]);
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
                    {/* Scritta rossa disconnesso da ... */}
                    {!isOnline && disconnectedSince[v.id] && (
                      <Box sx={{
                        position: 'absolute',
                        bottom: 8,
                        left: 0,
                        right: 0,
                        textAlign: 'center',
                        color: 'red',
                        fontWeight: 700,
                        fontSize: 16,
                        textShadow: '0 1px 4px #fff',
                        zIndex: 2,
                      }}>
                        Disconnesso da: {formatDuration(Date.now() - disconnectedSince[v.id])}
                      </Box>
                    )}
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
            <label style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <input type="checkbox" checked={autoRetry} onChange={e => setAutoRetry(e.target.checked)} />
              Auto retry
              {autoRetry && <span style={{ color: '#1976d2', fontWeight: 600, marginLeft: 6 }}>(attivo)</span>}
            </label>
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

export default BoePage; 