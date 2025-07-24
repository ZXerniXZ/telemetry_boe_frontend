import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, useNavigate, useParams, Navigate, useLocation } from 'react-router-dom';
import { Box, Button } from '@mui/material';
import { MqttProvider } from './shared/hooks/MqttProvider';
import { useBoas } from './shared/hooks/useBoas';
import { useTelemetry } from './shared/hooks/useTelemetry';
import type { Vehicle, RegattaField } from './shared/types';
import { FIELDS } from './features/regatta/RegattaFieldsPage';
import TopBar from './features/navigation/TopBar';
import SideMenu from './features/navigation/SideMenu';
import MapView from './features/map/MapView';
import BoePage from './features/boats/BoePage';
import BoaDetailPage from './features/boats/BoaDetailPage';
import RegattaFieldsPage from './features/regatta/RegattaFieldsPage';
import RegattaFieldDetailPage from './features/regatta/RegattaFieldDetailPage';
import WorldMapWithBoats from './features/map/WorldMapWithBoats';

const drawerWidth = 220;

function AppContent() {
  const { telemetry } = useTelemetry();
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  // Leggi id veicolo e campo dalla route
  const { id: vehicleId } = useParams<'id'>();
  const { id: fieldId } = useParams<'id'>();
  // selectedVehicleId e selectedField sono ora sincronizzati con la route
  const selectedVehicleId = location.pathname.startsWith('/boe/') ? vehicleId || null : null;
  const selectedFieldId = location.pathname.startsWith('/campo/') ? fieldId || null : null;
  // --- useBoas centralizza tutta la logica boe ---
  const {
    vehicles,
    scannedIps,
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
  } = useBoas(telemetry);
  // --- fine useBoas ---
  // Memoizza selectedVehicle
  const selectedVehicle = React.useMemo(() => vehicles.find(v => v.id === selectedVehicleId) || null, [vehicles, selectedVehicleId]);
  // Stato per il campo confermato
  const [confirmedField, setConfirmedField] = useState<{ campoBoe: { lat: number; lon: number }[]; giuria: { lat: number; lon: number } | null } | null>(null);
  const [giuriaPosition, setGiuriaPosition] = useState<{ lat: number; lon: number } | null>(null);
  const [assignments, setAssignments] = useState<{ [slotId: string]: Vehicle | null }>(() => ({ boa1: null, boa2: null, boa3: null, pin: null, giuria: null }));

          useEffect(() => {
          if (
            location.pathname === '/' ||
            location.pathname.startsWith('/campi') ||
            location.pathname.startsWith('/boe')
          ) {
            setGiuriaPosition(null);
            setAssignments({ boa1: null, boa2: null, boa3: null, pin: null, giuria: null });
          }
          setMenuOpen(false);
        }, [location.pathname]);

  // --- Route helpers ---
  function handleSelectVehicle(id: string) {
    navigate(`/boe/${id}`);
  }
  function handleBackToBoe() {
    navigate('/boe');
  }
  function handleSelectField(field: RegattaField) {
    navigate(`/campo/${field.id}`);
  }
  function handleBackToCampi() {
    setGiuriaPosition(null);
    setAssignments({ boa1: null, boa2: null, boa3: null, pin: null, giuria: null });
    navigate('/campi');
  }

  return (
    <Box sx={{ height: '100vh', bgcolor: 'white' }}>
      <TopBar boaCount={onlineCount} onMenuClick={() => setMenuOpen((open) => !open)} selectedVehicle={selectedVehicle} />
      <SideMenu open={menuOpen} onClose={() => setMenuOpen(false)} />
      <Box
        sx={{
          pt: 8,
          height: 'calc(100vh - 64px)',
          width: '100vw',
          position: 'relative',
          transition: 'margin-left 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          marginLeft: menuOpen ? `${drawerWidth}px` : 0,
        }}
      >
        <Routes>
          <Route path="/" element={
          <MapView
            vehicles={vehicles}
            initialZoom={16}
            selectedVehicleId={selectedVehicleId}
              setSelectedVehicleId={() => {}}
              onOpenRegattaFields={() => navigate('/campi')}
            confirmedField={confirmedField}
          />
          } />
          <Route path="/mappa" element={<Navigate to="/" replace />} />
          <Route path="/boe" element={
            <BoePage
              vehicles={vehicles}
              onSelect={handleSelectVehicle}
              scannedIps={scannedIps}
              onScan={handleScan}
              scanning={scanning}
              onConnectBoa={handleConnectBoa}
              connectingIps={connectingIps}
              connectError={connectError}
              onCloseError={handleCloseConnectError}
              autoRetry={autoRetry}
              setAutoRetry={setAutoRetry}
              disconnectedSince={disconnectedSince}
            />
          } />
          <Route path="/boe/:id" element={<BoaDetailPageWrapper vehicles={vehicles} onBack={handleBackToBoe} onRemove={handleRemoveBoa} />} />
          <Route path="/campi" element={<RegattaFieldsPage onSelect={handleSelectField} />} />
          <Route path="/campo/:id" element={<RegattaFieldDetailPageWrapper
            vehicles={vehicles}
            onBack={handleBackToCampi}
            giuriaPosition={giuriaPosition}
            setGiuriaPosition={setGiuriaPosition}
            assignments={assignments}
            setAssignments={setAssignments}
            setConfirmedField={setConfirmedField}
            navigate={navigate}
          />} />
          <Route path="/giuria-map" element={
          <Box sx={{ width: '100vw', height: '100vh', p: 0, m: 0, bgcolor: '#e3eafc', position: 'fixed', top: 0, left: 0, zIndex: 2000 }}>
              <Button onClick={() => navigate(-1)} variant="outlined" size="small" sx={{ position: 'absolute', top: 16, left: 16, zIndex: 10, fontWeight: 500, fontSize: 15, px: 1.5, py: 0.5, minWidth: 0, boxShadow: 1, background: 'white' }}>Indietro</Button>
            <WorldMapWithBoats
              vehicles={vehicles.filter((v): v is Vehicle => Boolean(v) && typeof v === 'object' && v.isonline === true)}
                onSelectPosition={pos => { setGiuriaPosition(pos); navigate(-1); }}
            />
          </Box>
          } />
          <Route path="*" element={<Box p={4}><h2>404 - Pagina non trovata</h2></Box>} />
        </Routes>
      </Box>
    </Box>
  );
}

// Wrapper per BoaDetailPage per leggere l'id dalla route
function BoaDetailPageWrapper({ vehicles, onBack, onRemove }: { vehicles: Vehicle[]; onBack: () => void; onRemove: (ip: string, port: number) => void }) {
  const { id } = useParams();
  const vehicle = vehicles.find(v => v.id === id) || null;
  if (!vehicle) return <Box p={3}>Boa non trovata</Box>;
  return <BoaDetailPage vehicle={vehicle} onBack={onBack} onRemove={onRemove} />;
}
// Wrapper per RegattaFieldDetailPage per leggere l'id dalla route
function RegattaFieldDetailPageWrapper({ vehicles, onBack, giuriaPosition, setGiuriaPosition, assignments, setAssignments, setConfirmedField, navigate }: {
  vehicles: Vehicle[];
  onBack: () => void;
  giuriaPosition: { lat: number; lon: number } | null;
  setGiuriaPosition: (pos: { lat: number; lon: number } | null) => void;
  assignments: { [slotId: string]: Vehicle | null };
  setAssignments: (fn: (prev: { [slotId: string]: Vehicle | null }) => { [slotId: string]: Vehicle | null }) => void;
  setConfirmedField: (field: { campoBoe: any[], giuria: { lat: number, lon: number } | null } | null) => void;
  navigate: any;
}) {
  const { id } = useParams();
  const selectedField = FIELDS.find(f => f.id === id) || null;
  if (!selectedField) return <Box p={3}>Campo non trovato</Box>;
  return <RegattaFieldDetailPage
    field={selectedField}
    onBack={onBack}
    onlineBoats={vehicles.filter((v): v is Vehicle => Boolean(v) && typeof v === 'object' && v.isonline === true)}
    onChooseGiuriaPosition={() => navigate('/giuria-map')}
    giuriaPosition={giuriaPosition}
    assignments={assignments}
    setAssignments={setAssignments}
    setPage={() => {}}
    setConfirmedField={setConfirmedField}
  />;
}

function App() {
  return (
    <MqttProvider>
      <Router>
      <AppContent />
      </Router>
    </MqttProvider>
  );
}

export default App;
