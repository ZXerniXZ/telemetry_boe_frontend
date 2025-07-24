import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import type { Vehicle } from '../types';

export function useBoas(telemetry: Record<string, any>) {
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

  // Memoizza vehicles
  const vehicles: Vehicle[] = useMemo(() => Object.entries(telemetry)
    .map(([deviceId, types]) => {
      const posMsg = types['GLOBAL_POSITION_INT'] || Object.values(types).find(m => typeof m === 'object' && m !== null && 'data' in m && typeof (m as any).data.lat === 'number' && typeof (m as any).data.lon === 'number');
      if (!posMsg || typeof posMsg !== 'object' || !('data' in posMsg) || !posMsg.data) return null;
      const lat = posMsg.data.lat / 1e7;
      const lon = posMsg.data.lon / 1e7;
      if (isNaN(lat) || isNaN(lon)) return null;
      const isonline = (types['isonline'] as any) === true;
      return {
        id: deviceId,
        lat,
        lon,
        ...Object.fromEntries(Object.entries(types).map(([type, msg]) => [type, (typeof msg === 'object' && msg !== null && 'data' in msg) ? (msg as any).data : undefined])),
        isonline: !!isonline,
      } as Vehicle;
    })
    .filter((v): v is Vehicle => v !== null && typeof v === 'object' && 'id' in v && 'lat' in v && 'lon' in v && typeof v.isonline === 'boolean')
    .filter(v => userBoas.includes(v.id)), [telemetry, userBoas]);

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
      setUserBoas(prev => prev.includes(id) ? prev : [...prev, id]);
      setScannedIps(prev => prev.filter(item => item !== ip));
      setConnectingIps(prev => { const s = new Set(prev); s.delete(ip); return s; });
    } catch (e: any) {
      setConnectError(e?.message || 'Errore durante la connessione');
      setConnectingIps(prev => { const s = new Set(prev); s.delete(ip); return s; });
    }
  }, []);

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