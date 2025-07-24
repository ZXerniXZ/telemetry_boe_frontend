import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import type { Vehicle, TelemetryState, GlobalPositionData, SystemStatusData } from '../types/index';
import { isVehicle, isGlobalPositionData, isSystemStatusData } from '../types/index';
import { extractMqttData } from '../../utils';

export function useBoas(telemetry: TelemetryState) {
  // Stato boe aggiunte dall'utente
  const [userBoas, setUserBoas] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('userBoas') || '[]');
    } catch {
      return [];
    }
  });
  useEffect(() => {
    localStorage.setItem('userBoas', JSON.stringify(userBoas));
  }, [userBoas]);

  // Memoizza vehicles con type guards migliorati
  const vehicles: Vehicle[] = useMemo(() => {
    const result = Object.entries(telemetry)
      .map(([deviceId, types]) => {
        // Cerca dati di posizione con type guard
        const posMsg = types['GLOBAL_POSITION_INT'];
        if (!posMsg?.data) {
          return null;
        }
        
        // Estrai i dati GPS dalla struttura MQTT
        const gpsData = extractMqttData(posMsg);
        
        // Prova prima con type guard rigoroso
        if (isGlobalPositionData(gpsData)) {
          const posData = gpsData as GlobalPositionData;
          const lat = posData.lat / 1e7;
          const lon = posData.lon / 1e7;
          
          if (isNaN(lat) || isNaN(lon)) {
            return null;
          }
          
          // Verifica stato online
          const isonline = Boolean(types['isonline']?.data);
          
          // Costruisci oggetto Vehicle con dati tipizzati
          const vehicle: Vehicle = {
            id: deviceId,
            lat,
            lon,
            isonline: !!isonline,
            // Dati telemetry tipizzati
            GLOBAL_POSITION_INT: posData,
            SYS_STATUS: isSystemStatusData(extractMqttData(types['SYS_STATUS'])) ? extractMqttData(types['SYS_STATUS']) : undefined,
            ATTITUDE: extractMqttData(types['ATTITUDE']) as any,
            GPS_RAW_INT: extractMqttData(types['GPS_RAW_INT']) as any,
            VFR_HUD: extractMqttData(types['VFR_HUD']) as any,
            HEARTBEAT: extractMqttData(types['HEARTBEAT']) as any,
          };
          
          return vehicle;
        }
        
        // Fallback: cerca dati GPS in formato diverso
        // Prova a estrarre lat/lon da diversi formati possibili
        let lat: number | null = null;
        let lon: number | null = null;
        
        // Formato 1: lat/lon diretti (scalati per 1e7)
        if (typeof gpsData.lat === 'number' && typeof gpsData.lon === 'number') {
          lat = gpsData.lat / 1e7;
          lon = gpsData.lon / 1e7;
        }
        // Formato 2: lat/lon come stringhe
        else if (typeof gpsData.lat === 'string' && typeof gpsData.lon === 'string') {
          lat = parseFloat(gpsData.lat) / 1e7;
          lon = parseFloat(gpsData.lon) / 1e7;
        }
        // Formato 3: coordinate già convertite
        else if (typeof gpsData.latitude === 'number' && typeof gpsData.longitude === 'number') {
          lat = gpsData.latitude;
          lon = gpsData.longitude;
        }
        // Formato 4: coordinate già convertite come stringhe
        else if (typeof gpsData.latitude === 'string' && typeof gpsData.longitude === 'string') {
          lat = parseFloat(gpsData.latitude);
          lon = parseFloat(gpsData.longitude);
        }
        
        if (lat === null || lon === null || isNaN(lat) || isNaN(lon)) {
          return null;
        }
        
        // Verifica stato online
        const isonline = Boolean(types['isonline']?.data);
        
        // Costruisci oggetto Vehicle con dati non tipizzati
        const vehicle: Vehicle = {
          id: deviceId,
          lat,
          lon,
          isonline: !!isonline,
          // Dati telemetry non tipizzati - usa la struttura corretta
          GLOBAL_POSITION_INT: gpsData as any,
          SYS_STATUS: extractMqttData(types['SYS_STATUS']) as any,
          ATTITUDE: extractMqttData(types['ATTITUDE']) as any,
          GPS_RAW_INT: extractMqttData(types['GPS_RAW_INT']) as any,
          VFR_HUD: extractMqttData(types['VFR_HUD']) as any,
          HEARTBEAT: extractMqttData(types['HEARTBEAT']) as any,
        };
        
        return vehicle;
      })
      .filter(isVehicle)
      .filter(v => userBoas.includes(v.id));
    
    return result;
  }, [telemetry, userBoas]);

  // Memoizza connectedIps
  const connectedIps = useMemo(() => vehicles.map(v => v.id.split('_').slice(0, 4).join('.')), [vehicles]);

  // Stato per IP scansionati
  const [scannedIps, setScannedIps] = useState<string[]>([]);
  const [scanning, setScanning] = useState(false);
  const [connectingIps, setConnectingIps] = useState<Set<string>>(new Set());
  const [connectError, setConnectError] = useState<string | null>(null);
  const [autoRetry, setAutoRetry] = useState(false);

  // Memoizza scannedIpsFiltered
  const scannedIpsFiltered = useMemo(() => scannedIps.filter(ip => !connectedIps.includes(ip)), [scannedIps, connectedIps]);

  // Scan boe
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

  // Connessione boa
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
      // Ricava id come fa vehicles
      const id = `${ip.replace(/\./g, '_')}_${port}`;
      
      setUserBoas(prev => {
        const newUserBoas = prev.includes(id) ? prev : [...prev, id];
        return newUserBoas;
      });
      setScannedIps(prev => prev.filter(item => item !== ip));
      setConnectingIps(prev => { const s = new Set(prev); s.delete(ip); return s; });
    } catch (e: any) {
      console.error('Connection error:', e);
      setConnectError(e?.message || 'Errore durante la connessione');
      setConnectingIps(prev => { const s = new Set(prev); s.delete(ip); return s; });
    }
  }, [userBoas]);

  // Rimozione boa
  const handleRemoveBoa = useCallback(async (ip: string, port: number) => {
    const id = `${ip.replace(/\./g, '_')}_${port}`;
    try {
      const url = `http://localhost:8001/rimuoviboa?ip=${encodeURIComponent(ip)}&port=${encodeURIComponent(port)}`;
      const res = await fetch(url, { method: 'DELETE' });
      setUserBoas(prev => prev.filter(bid => bid !== id));
      if (!res.ok) throw new Error('Errore rimozione boa');
    } catch (e) {
      setUserBoas(prev => prev.filter(bid => bid !== id));
    }
  }, []);

  // Gestione errori
  const handleCloseConnectError = useCallback(() => setConnectError(null), []);

  // Auto retry scan
  const scanRef = useRef(handleScan);
  useEffect(() => { scanRef.current = handleScan; }, [handleScan]);
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

  // Stato per il tempo di disconnessione di ogni boa
  const [disconnectedSince, setDisconnectedSince] = useState<{ [id: string]: number }>({});
  useEffect(() => {
    const now = Date.now();
    setDisconnectedSince(prev => {
      const updated = { ...prev };
      vehicles.forEach(v => {
        if (v.isonline === false || v.isonline === undefined) {
          if (!updated[v.id]) updated[v.id] = now;
        } else {
          if (updated[v.id]) delete updated[v.id];
        }
      });
      return updated;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vehicles.map(v => v.id + ':' + v.isonline).join(',')]);

  // Forza il re-render ogni secondo per aggiornare il timer
  const [, forceRerender] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => forceRerender(t => t + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  // Conteggio boe online
  const onlineCount = vehicles.filter(v => v.isonline).length;

  return {
    vehicles,
    userBoas,
    setUserBoas,
    scannedIps: scannedIpsFiltered,
    scanning,
    handleScan,
    handleConnectBoa,
    connectingIps,
    connectError,
    handleCloseConnectError,
    autoRetry,
    setAutoRetry,
    handleRemoveBoa,
    disconnectedSince,
    onlineCount,
  };
} 