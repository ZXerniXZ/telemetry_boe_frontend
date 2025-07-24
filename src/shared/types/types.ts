// Tipi centralizzati per l'applicazione

export interface Vehicle {
  id: string;
  lat: number;
  lon: number;
  isonline?: boolean;
  [key: string]: any; // altri dati associati
}

export interface RegattaField {
  id: string;
  name: string;
  image: string;
  description?: string;
} 