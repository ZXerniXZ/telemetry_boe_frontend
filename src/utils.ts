// Funzioni di utilità centralizzate

// Calcola il centroide di una lista di veicoli
export function getCentroid(vehicles: { lat: number; lon: number }[]): [number, number] {
  if (vehicles.length === 0) return [0, 0];
  const latSum = vehicles.reduce((sum, v) => sum + v.lat, 0);
  const lonSum = vehicles.reduce((sum, v) => sum + v.lon, 0);
  return [latSum / vehicles.length, lonSum / vehicles.length];
}

// Calcola la distanza in metri tra due coordinate [lat, lon]
export function haversine([lat1, lon1]: [number, number], [lat2, lon2]: [number, number]) {
  const R = 6371000;
  const toRad = (deg: number) => deg * Math.PI / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat/2)**2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon/2)**2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

// Estrae deviceId da un topic MQTT
export function extractDeviceId(topic: string): string | null {
  const parts = topic.split('/');
  return parts.length > 2 ? parts[1] : null;
}

// Estrae il tipo di messaggio da un topic MQTT
export function extractType(topic: string): string | null {
  const parts = topic.split('/');
  return parts.length > 3 ? parts[3] : null;
}

// Estrae IP e porta da un id tipo 10_8_0_53_14550
export function parseIpPort(id: string): { ip: string; port: number } {
  const idParts = id.split('_');
  return {
    ip: idParts.slice(0, 4).join('.'),
    port: parseInt(idParts[4], 10),
  };
} 