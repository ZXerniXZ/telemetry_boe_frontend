// Tipi centralizzati per l'applicazione

// ===== TIPI BASE =====
export interface Vehicle {
  id: string;
  lat: number;
  lon: number;
  isonline?: boolean;
  // Dati telemetry specifici
  GLOBAL_POSITION_INT?: GlobalPositionData;
  SYS_STATUS?: SystemStatusData;
  ATTITUDE?: AttitudeData;
  GPS_RAW_INT?: GpsRawData;
  VFR_HUD?: VfrHudData;
  HEARTBEAT?: HeartbeatData;
  [key: string]: any; // per altri dati non tipizzati
}

export interface RegattaField {
  id: string;
  name: string;
  image: string;
  description?: string;
}

// ===== DATI TELEMETRY SPECIFICI =====
export interface GlobalPositionData {
  lat: number;
  lon: number;
  alt: number;
  relative_alt: number;
  vx: number;
  vy: number;
  vz: number;
  hdg: number;
  speed?: number;
  heading?: number;
}

export interface SystemStatusData {
  voltage_battery: number;
  current_battery: number;
  battery_remaining: number;
  drop_rate_comm: number;
  errors_comm: number;
  errors_count1: number;
  errors_count2: number;
  errors_count3: number;
  errors_count4: number;
}

export interface AttitudeData {
  time_boot_ms: number;
  roll: number;
  pitch: number;
  yaw: number;
  rollspeed: number;
  pitchspeed: number;
  yawspeed: number;
}

export interface GpsRawData {
  time_usec: number;
  fix_type: number;
  lat: number;
  lon: number;
  alt: number;
  eph: number;
  epv: number;
  vel: number;
  cog: number;
  satellites_visible: number;
}

export interface VfrHudData {
  airspeed: number;
  groundspeed: number;
  heading: number;
  throttle: number;
  alt: number;
  climb: number;
}

export interface HeartbeatData {
  type: number;
  autopilot: number;
  base_mode: number;
  custom_mode: number;
  system_status: number;
  mavlink_version: number;
}

// ===== STATI E CONNESSIONI =====
export type VehicleStatus = 'online' | 'offline' | 'connecting' | 'error';
export type ConnectionState = 'idle' | 'scanning' | 'connecting' | 'connected' | 'error';
export type ScanState = 'idle' | 'scanning' | 'complete' | 'error';

export interface ConnectionInfo {
  ip: string;
  port: number;
  status: ConnectionState;
  lastSeen?: number;
  error?: string;
}

// ===== INTERAZIONI MAPPA =====
export type MapInteractionType = 'select' | 'goto' | 'delete' | 'add_buoy' | 'remove_buoy';

export interface MapInteraction {
  type: MapInteractionType;
  target: { lat: number; lon: number };
  vehicleId?: string;
  timestamp: number;
}

export interface GotoTarget {
  lat: number;
  lon: number;
  vehicleId: string;
  active: boolean;
}

// ===== CAMPI REGATA =====
export interface RegattaBuoy {
  id: string;
  lat: number;
  lon: number;
  type: 'start' | 'mark' | 'finish' | 'gate';
  order?: number;
}

export interface RegattaFieldConfig {
  id: string;
  name: string;
  buoys: RegattaBuoy[];
  juryPosition?: { lat: number; lon: number };
  windDirection?: number;
}

export interface FieldAssignment {
  boa1: Vehicle | null;
  boa2: Vehicle | null;
  boa3: Vehicle | null;
  pin: Vehicle | null;
  giuria: Vehicle | null;
}

// ===== MESSAGGI TELEMETRY =====
export interface TelemetryMessage {
  timestamp: number;
  type: string;
  data: { [k: string]: any };
}

export type TelemetryState = {
  [deviceId: string]: {
    [type: string]: TelemetryMessage;
  };
};

// ===== UTILITY TYPES =====
export type Coordinates = { lat: number; lon: number };
export type MapBounds = { north: number; south: number; east: number; west: number };

// ===== TYPE GUARDS =====
export function isVehicle(obj: any): obj is Vehicle {
  return obj && 
    typeof obj.id === 'string' && 
    typeof obj.lat === 'number' && 
    typeof obj.lon === 'number';
}

export function isOnlineVehicle(vehicle: Vehicle): boolean {
  return vehicle.isonline === true;
}

export function hasValidPosition(vehicle: Vehicle): boolean {
  return vehicle.lat !== 0 && vehicle.lon !== 0;
}

export function isGlobalPositionData(data: any): data is GlobalPositionData {
  return data && 
    typeof data.lat === 'number' && 
    typeof data.lon === 'number' &&
    typeof data.alt === 'number';
}

export function isSystemStatusData(data: any): data is SystemStatusData {
  return data && 
    typeof data.voltage_battery === 'number' &&
    typeof data.battery_remaining === 'number';
} 