import { useEffect, useState } from 'react';
import { useMqtt } from './MqttProvider';
import { extractDeviceId, extractType } from '../utils';

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
        // RIMOSSO: console.log('[MQTT PAYLOAD]', ...)
        if (!deviceId || !type) return;
        let msg;
        try {
          msg = JSON.parse(payload.toString());
        } catch {
          msg = payload.toString();
        }
        setTelemetry((prev) => ({
          ...prev,
          [deviceId]: {
            ...prev[deviceId],
            [type]: msg,
          },
        }));
      } catch (e) {
        // Ignora messaggi non validi
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
