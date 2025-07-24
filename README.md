# Telemetry Boe Frontend

Un'applicazione React moderna per la gestione e il monitoraggio di boe intelligenti per regate veliche. L'applicazione fornisce un'interfaccia web per controllare boe autonome, visualizzare dati telemetry in tempo reale e gestire campi da regata.

## 🚀 Caratteristiche Principali

### 📡 **Monitoraggio Telemetry in Tempo Reale**
- Connessione MQTT per dati telemetry live
- Visualizzazione posizione GPS delle boe
- Monitoraggio stato batteria e connessione
- Dati di velocità, direzione e orientamento

### 🗺️ **Mappa Interattiva**
- Visualizzazione boe su mappa Leaflet
- Controllo remoto delle boe (comando "Vai a")
- Gestione campi da regata personalizzati
- Posizionamento boe per percorsi di gara

### 🚤 **Gestione Boe**
- Scansione automatica di boe nella rete
- Connessione/disconnessione remota
- Monitoraggio stato di salute
- Configurazione parametri di navigazione

### 🏁 **Campi da Regata**
- Template predefiniti (Bastone, Custom)
- Creazione percorsi personalizzati
- Assegnazione boe ai punti di controllo
- Simulazione percorsi di gara

## 🏗️ Architettura del Progetto

### Struttura Feature-Based
```
src/
├── features/                    # Funzionalità organizzate per dominio
│   ├── map/                    # Tutto relativo alla mappa
│   │   ├── MapView.tsx         # Mappa principale con boe
│   │   └── WorldMapWithBoats.tsx # Mappa per selezione posizioni
│   ├── boats/                  # Gestione boe
│   │   ├── BoePage.tsx         # Lista e gestione boe
│   │   └── BoaDetailPage.tsx   # Dettagli singola boa
│   ├── regatta/               # Campi regata
│   │   ├── RegattaFieldsPage.tsx # Selezione tipo campo
│   │   └── RegattaFieldDetailPage.tsx # Configurazione campo
│   └── navigation/            # Menu e routing
│       ├── TopBar.tsx         # Barra superiore
│       └── SideMenu.tsx       # Menu laterale
├── shared/                     # Componenti e logica condivisa
│   ├── hooks/                 # Custom hooks
│   │   ├── MqttProvider.tsx   # Provider MQTT
│   │   ├── useBoas.ts         # Gestione stato boe
│   │   └── useTelemetry.ts    # Gestione telemetry
│   └── types/                 # Definizioni TypeScript
│       └── index.ts           # Tipi centralizzati
├── config.ts                  # Configurazione globale
├── utils.ts                   # Utility condivise
└── App.tsx                    # Componente principale
```

### Tecnologie Utilizzate
- **React 18** - Framework UI
- **TypeScript** - Type safety
- **Material-UI** - Componenti UI
- **React Router** - Navigazione
- **Leaflet** - Mappe interattive
- **MQTT** - Comunicazione real-time
- **Vite** - Build tool

## 🛠️ Installazione e Setup

### Prerequisiti
- Node.js 18+ 
- npm o yarn
- Backend API (porta 8001)
- Broker MQTT

### Installazione
```bash
# Clona il repository
git clone <repository-url>
cd telemetry_boe_frontend

# Installa dipendenze
npm install

# Avvia server di sviluppo
npm run dev
```

### Configurazione
Crea un file `.env` nella root del progetto:
```env
VITE_MQTT_URL=ws://localhost:9001
VITE_API_URL=http://localhost:8001
```

## 📖 Guida all'Uso

### 1. **Connessione Boe**
1. Vai alla pagina "Boe" dal menu laterale
2. Clicca "Scansiona" per trovare boe nella rete
3. Seleziona una boa dalla lista e clicca "Connetti"
4. La boa apparirà sulla mappa principale

### 2. **Controllo Remoto**
1. Seleziona una boa sulla mappa
2. Clicca il pulsante "Vai a" 
3. Clicca sulla mappa per selezionare la destinazione
4. La boa si muoverà automaticamente verso il punto

### 3. **Gestione Campi Regata**
1. Vai alla pagina "Campi" dal menu
2. Scegli un template (Bastone o Custom)
3. Posiziona la barca giuria sulla mappa
4. Aggiungi boe per definire il percorso
5. Assegna le boe fisiche ai punti virtuali
6. Conferma il campo per iniziare la regata

### 4. **Monitoraggio Telemetry**
- **Posizione**: Visualizzata sulla mappa in tempo reale
- **Batteria**: Indicatore nella barra superiore
- **Satelliti GPS**: Numero di satelliti visibili
- **Velocità**: Velocità di crociera in m/s
- **Direzione**: Heading in gradi

## 🔧 Sviluppo e Debug

### Script Disponibili
```bash
npm run dev          # Server di sviluppo
npm run build        # Build di produzione
npm run preview      # Preview build
npm run lint         # Linting TypeScript
```

### Debug MQTT
Per abilitare i log MQTT, modifica `src/shared/hooks/useTelemetry.ts`:
```typescript
// Aggiungi questa riga per debug
console.log('[MQTT]', topic, payload.toString());
```

### Debug Telemetry
I dati telemetry sono disponibili nel browser console:
```javascript
// Nel browser console
window.telemetryData // Dati telemetry correnti
```

### Struttura Dati Telemetry
```typescript
interface TelemetryData {
  GLOBAL_POSITION_INT: {
    lat: number;      // Latitudine (gradi * 1e7)
    lon: number;      // Longitudine (gradi * 1e7)
    alt: number;      // Altitudine (metri)
    speed: number;    // Velocità (m/s)
    heading: number;  // Direzione (gradi)
  };
  SYS_STATUS: {
    voltage_battery: number;     // Tensione batteria (V)
    battery_remaining: number;   // Batteria rimanente (%)
    drop_rate_comm: number;      // Tasso perdita comunicazione
  };
  ATTITUDE: {
    roll: number;    // Rollio (radianti)
    pitch: number;   // Beccheggio (radianti)
    yaw: number;     // Imbardata (radianti)
  };
}
```

## 🐛 Risoluzione Problemi

### Problemi Comuni

#### 1. **Boa non si connette**
- Verifica che il backend sia attivo sulla porta 8001
- Controlla che la boa sia nella stessa rete
- Verifica i log del backend per errori

#### 2. **Dati telemetry non aggiornati**
- Controlla la connessione MQTT
- Verifica che il broker MQTT sia attivo
- Controlla i topic MQTT nel browser console

#### 3. **Mappa non carica**
- Verifica la connessione internet
- Controlla che Leaflet sia caricato correttamente
- Verifica i permessi di geolocalizzazione

#### 4. **Performance lente**
- Riduci il numero di boe visualizzate
- Disabilita aggiornamenti frequenti
- Verifica l'uso di memoria nel browser

### Log di Debug
```bash
# Abilita log dettagliati
DEBUG=* npm run dev

# Log specifici
DEBUG=mqtt:* npm run dev
DEBUG=telemetry:* npm run dev
```

## 🔄 Aggiornamenti e Manutenzione

### Aggiornamento Dipendenze
```bash
# Aggiorna tutte le dipendenze
npm update

# Aggiorna dipendenze di sicurezza
npm audit fix
```

### Backup Configurazione
```bash
# Backup configurazione boe
cp src/shared/hooks/useBoas.ts backup/
cp .env backup/
```

### Migrazione Dati
Per migrare dati tra versioni:
1. Esporta configurazione boe dal localStorage
2. Aggiorna l'applicazione
3. Importa la configurazione aggiornata

## 📝 Note di Sviluppo

### Convenzioni di Codice
- **TypeScript strict mode** abilitato
- **ESLint** per linting
- **Prettier** per formattazione
- **Feature-based** organizzazione cartelle

### Performance
- **React.memo** per componenti pesanti
- **useMemo/useCallback** per calcoli costosi
- **Lazy loading** per componenti grandi
- **Virtualizzazione** per liste lunghe

### Sicurezza
- **Type guards** per validazione dati
- **Sanitizzazione** input utente
- **CORS** configurato correttamente
- **HTTPS** in produzione

## 🤝 Contribuire

### Setup Sviluppo
1. Fork del repository
2. Crea branch feature: `git checkout -b feature/nuova-funzionalita`
3. Commit changes: `git commit -m 'Aggiungi nuova funzionalità'`
4. Push branch: `git push origin feature/nuova-funzionalita`
5. Crea Pull Request

### Guidelines
- Segui le convenzioni TypeScript
- Aggiungi test per nuove funzionalità
- Aggiorna la documentazione
- Verifica che tutto funzioni

## 📄 Licenza

Questo progetto è sotto licenza MIT. Vedi il file `LICENSE` per dettagli.

## 📞 Supporto

Per supporto tecnico o domande:
- Apri una issue su GitHub
- Contatta il team di sviluppo
- Consulta la documentazione API

---

**Versione**: 1.0.0  
**Ultimo aggiornamento**: Gennaio 2025  
**Autori**: Team Sviluppo Telemetry Boe
