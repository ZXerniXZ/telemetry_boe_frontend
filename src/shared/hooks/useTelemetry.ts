import { useEffect, useState } from 'react';
import { useMqtt } from './MqttProvider';
import { extractDeviceId, extractType } from '../../utils';
import type { TelemetryMessage, TelemetryState } from '../types';

export function useTelemetry() {
  const { client, connected } = useMqtt();
  const [telemetry, setTelemetry] = useState<TelemetryState>({});

  useEffect(() => {
    if (!client || !connected) return;
    // Sottoscrivi a tutti i messaggi per ogni boa e tipo
    const topic = 'mavlink/+/json/#';
    client.subscribe(topic);
    const onMessage = (topic: string, payload: Buffer) => {
      try {
        const deviceId = extractDeviceId(topic);
        const type = extractType(topic);
        
        if (!deviceId || !type) {
          return;
        }
        
        let msg: TelemetryMessage['data'];
        try {
          msg = JSON.parse(payload.toString());
        } catch {
          msg = { raw: payload.toString() };
        }
        
        const telemetryMessage: TelemetryMessage = {
          timestamp: Date.now(),
          type,
          data: msg,
        };
        
        setTelemetry((prev) => {
          const newState = {
            ...prev,
            [deviceId]: {
              ...prev[deviceId],
              [type]: telemetryMessage,
            },
          };
          return newState;
        });
      } catch (e) {
        // Ignora messaggi non validi
        console.warn('Invalid telemetry message:', e);
      }
    };
    client.on('message', onMessage);
    return () => {
      client.unsubscribe(topic);
      client.off('message', onMessage);
    };
  }, [client, connected]);

  return { telemetry, connected };
}
