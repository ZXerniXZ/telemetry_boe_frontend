import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import mqtt from 'mqtt';

interface MqttContextType {
  client: ReturnType<typeof mqtt.connect> | null;
  connected: boolean;
}

const MqttContext = createContext<MqttContextType>({ client: null, connected: false });

export function useMqtt() {
  return useContext(MqttContext);
}

export const MqttProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [connected, setConnected] = useState(false);
  const clientRef = useRef<ReturnType<typeof mqtt.connect> | null>(null);

  const url = import.meta.env.VITE_MQTT_URL;
  const username = import.meta.env.VITE_MQTT_USERNAME;
  const password = import.meta.env.VITE_MQTT_PASSWORD;

  useEffect(() => {
    if (!url) {
      console.error('VITE_MQTT_URL non definito');
      return;
    }
    const client = mqtt.connect(url, {
      username,
      password,
      reconnectPeriod: 2000,
      connectTimeout: 10_000,
      clean: true,
    });
    clientRef.current = client;
    client.on('connect', () => {
      setConnected(true);
      // console.log('MQTT connesso');
    });
    client.on('reconnect', () => {
      setConnected(false);
      // console.warn('MQTT riconnessione...');
    });
    client.on('close', () => {
      setConnected(false);
      // console.warn('MQTT disconnesso');
    });
    client.on('error', (err) => {
      // console.error('MQTT errore:', err);
    });
    return () => {
      client.end(true);
    };
  }, [url, username, password]);

  const value = useMemo(() => ({ client: clientRef.current, connected }), [connected]);

  return <MqttContext.Provider value={value}>{children}</MqttContext.Provider>;
};
