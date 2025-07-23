import React, { useEffect, useState, useRef } from 'react';
import { Box, Typography, Card, CardMedia, CardContent, Button, Paper, IconButton } from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import CloseIcon from '@mui/icons-material/Close';
import type { RegattaField } from './RegattaFieldsPage';
import MapView from './MapView';
import type { Vehicle } from './MapView';
import { Dialog, DialogTitle, DialogContent, DialogActions, CircularProgress, IconButton as MuiIconButton } from '@mui/material';
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded';
import { parseIpPort } from '../utils';

const DEFAULT_SLOTS = [
  { id: 'boa1', label: 'Boa 1' },
  { id: 'boa2', label: 'Boa 2' },
  { id: 'boa3', label: 'Boa 3' },
  { id: 'pin', label: 'Pin' },
  { id: 'giuria', label: 'Barca giuria' },
];

type SlotAssignments = { [slotId: string]: Vehicle | null };

export default function RegattaFieldDetailPage({ field, onBack, onlineBoats, onChooseGiuriaPosition, giuriaPosition, assignments, setAssignments, setPage, setConfirmedField }: {
  field: RegattaField,
  onBack: () => void,
  onlineBoats: Vehicle[],
  onChooseGiuriaPosition: () => void,
  giuriaPosition?: { lat: number, lon: number } | null,
  assignments: { [slotId: string]: Vehicle | null },
  setAssignments: (fn: (prev: { [slotId: string]: Vehicle | null }) => { [slotId: string]: Vehicle | null }) => void,
  setPage: (p: string) => void,
  setConfirmedField: (field: { campoBoe: any[], giuria: { lat: number, lon: number } | null } | null) => void
}) {
  // Blocca lo scroll della pagina quando il componente è montato
  useEffect(() => {
    const original = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = original; };
  }, []);

  // Calcola le boe disponibili (non assegnate)
  const assignedIds = Object.values(assignments).filter(Boolean).map(b => b!.id);
  const availableBoats = onlineBoats.filter(b => !assignedIds.includes(b.id));

  // Drag & drop handlers
  function handleDragStart(e: React.DragEvent, boa: Vehicle) {
    e.dataTransfer.setData('application/boa-id', boa.id);
    e.dataTransfer.effectAllowed = 'move';
  }
  function handleDrop(e: React.DragEvent, slotId: string) {
    e.preventDefault();
    const boaId = e.dataTransfer.getData('application/boa-id');
    const boa = onlineBoats.find(b => b.id === boaId);
    if (boa) {
      setAssignments(prev => ({ ...prev, [slotId]: boa }));
    }
  }
  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }
  function handleRemoveFromSlot(slotId: string) {
    setAssignments(prev => ({ ...prev, [slotId]: null }));
  }

  // Stato per il numero di boe rosse
  const [buoyCount, setBuoyCount] = useState(0);
  // Aggiorna gli slot ogni volta che cambia il numero di boe
  useEffect(() => {
    if (field.id === 'custom' && giuriaPosition) {
      setAssignments(prev => {
        const newSlots: { [slotId: string]: Vehicle | null } = { giuria: prev.giuria || null };
        for (let i = 1; i <= buoyCount; i++) {
          const id = `custom_boa${i}`;
          newSlots[id] = prev[id] || null;
        }
        // Rimuovi slot extra se sono state tolte boe
        return newSlots;
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [buoyCount, giuriaPosition]);

  // Stato per il popup di conferma campo
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [holdProgress, setHoldProgress] = useState(0);
  const [holdActive, setHoldActive] = useState(false);
  const holdTimeout = useRef<NodeJS.Timeout | null>(null);
  const holdInterval = useRef<NodeJS.Timeout | null>(null);
  const holdActiveRef = useRef(false);

  useEffect(() => {
    holdActiveRef.current = holdActive;
  }, [holdActive]);

  // Calcola se tutti gli slot sono completati (giuria + tutte le boe)
  const allSlotsCompleted = field.id === 'custom'
    ? giuriaPosition && buoyCount > 0 && Array.from({ length: buoyCount }, (_, i) => assignments[`custom_boa${i + 1}`]).every(Boolean)
    : DEFAULT_SLOTS.every(slot => assignments[slot.id]);

  // Gestione hold per conferma
  async function sendVaiAForAllBoas() {
    console.log('[CONFIRMA] Invio comandi vai a per tutte le boe...');
    if (!mapViewRef.current?.getCampoBoe) {
      console.log('[CONFIRMA] mapViewRef.current.getCampoBoe non disponibile');
      return;
    }
    const campoBoe = mapViewRef.current.getCampoBoe();
    console.log('[CONFIRMA] campoBoe:', campoBoe);
    const promises = [];
    for (let i = 0; i < buoyCount; i++) {
      const slotId = `custom_boa${i + 1}`;
      const assigned = assignments[slotId];
      if (assigned && typeof assigned.lat === 'number' && typeof assigned.lon === 'number') {
        const target = campoBoe[i];
        if (!target) continue;
        const { ip, port } = parseIpPort(assigned.id);
        console.log(`[CONFIRMA] Invio fetch /vaia per ${assigned.id} verso`, target);
        promises.push(
          fetch('http://localhost:8001/vaia', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ip, port, lat: target.lat, lon: target.lon })
          }).then(r => r.json().then(data => ({ ok: r.ok, data })))
            .catch(e => ({ ok: false, data: e }))
        );
      }
    }
    const results = await Promise.all(promises);
    console.log('[CONFIRMA] Risultati fetch:', results);
    return results;
  }

  function startHold() {
    console.log('[CONFIRMA] startHold chiamato');
    setHoldActive(true);
    setHoldProgress(0);
    let progress = 0;
    holdInterval.current = setInterval(async () => {
      progress += 100 / 30; // 3 secondi, 30 step
      setHoldProgress(progress);
      if (progress >= 100) {
        clearInterval(holdInterval.current!);
        setHoldProgress(100);
        // Conferma solo se il bottone è ancora attivo (premuto)
        if (holdActiveRef.current) {
          console.log('[CONFIRMA] Hold completato, procedo con invio comandi e navigazione');
          setHoldActive(false);
          setTimeout(() => setConfirmOpen(false), 500);
          // INVIO COMANDI VAI A E NAVIGAZIONE
          await sendVaiAForAllBoas();
          // Salva il campo confermato per la mappa principale
          if (mapViewRef.current?.getCampoBoe && setConfirmedField) {
            setConfirmedField({ campoBoe: mapViewRef.current.getCampoBoe(), giuria: giuriaPosition || null });
          }
          console.log('[CONFIRMA] Navigo verso mappa');
          setTimeout(() => setPage('mappa'), 600);
        }
      }
    }, 100);
  }
  function stopHold() {
    setHoldActive(false);
    setHoldProgress(0);
    if (holdInterval.current) clearInterval(holdInterval.current);
  }
  function handleMouseDown() {
    startHold();
  }
  function handleMouseUp() {
    if (holdProgress < 100) stopHold();
  }
  function handleMouseLeave() {
    stopHold();
  }
  function handleTouchStart() {
    startHold();
  }
  function handleTouchEnd() {
    if (holdProgress < 100) stopHold();
  }

  const mapViewRef = useRef<any>(null);

  return (
    <Box sx={{ width: '100vw', height: '100vh', p: 0, m: 0, overflow: 'hidden', position: 'relative', bgcolor: '#f5f5f5' }}>
      {/* Pulsante indietro snello, sopra le colonne */}
      <Box sx={{ position: 'absolute', top: 8, left: 0, width: '100vw', display: 'flex', justifyContent: 'flex-start', zIndex: 20, pointerEvents: 'none' }}>
        <Button onClick={onBack} variant="outlined" size="small" startIcon={<ArrowBackIcon />} sx={{ ml: 1, fontWeight: 500, fontSize: 15, px: 1, py: 0.5, minWidth: 0, pointerEvents: 'auto', boxShadow: 1, background: 'white' }}>
          Indietro
        </Button>
      </Box>
      {/* Tre colonne sotto il pulsante */}
      <Box sx={{ display: 'flex', height: '100vh', width: '100vw', overflow: 'hidden' }}>
        <React.Fragment>
          {/* Colonna sinistra: boe online */}
          <Box sx={{ width: { xs: '28vw', sm: 260 }, minWidth: 120, maxWidth: 320, bgcolor: 'white', p: 2, boxShadow: 4, overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Typography variant="h6" sx={{ mb: 2, textAlign: 'center' }}>Boe online</Typography>
            {availableBoats.length === 0 && (
              <Typography variant="body1" color="text.secondary">Nessuna boa disponibile</Typography>
            )}
            {availableBoats.map(boa => (
              <Card key={boa.id} sx={{ display: 'flex', alignItems: 'center', mb: 1, boxShadow: 2, cursor: 'grab' }} draggable onDragStart={e => handleDragStart(e, boa)}>
                <CardMedia
                  component="img"
                  image={'/boe/boadefault.png'}
                  alt={boa.id}
                  sx={{ width: 48, height: 48, objectFit: 'cover', borderRadius: 2, m: 1 }}
                />
                <CardContent sx={{ flex: 1, p: 1 }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>{boa.id}</Typography>
                  <Typography variant="body2" color="text.secondary">Lat: {boa.lat.toFixed(5)}, Lon: {boa.lon.toFixed(5)}</Typography>
                </CardContent>
              </Card>
            ))}
          </Box>
          {/* Colonna centrale: immagine campo o mappa live */}
          <Box sx={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', bgcolor: '#e3eafc', overflow: 'hidden', height: 'calc(100vh - 64px)' }}>
            {giuriaPosition ? (
              <MapView
                ref={mapViewRef}
                vehicles={onlineBoats}
                centerOn={[giuriaPosition.lat, giuriaPosition.lon]}
                initialZoom={16}
                selectedVehicleId={assignments['giuria']?.id || null}
                setSelectedVehicleId={() => {}}
                giuriaPos={giuriaPosition}
                onBuoyCountChange={setBuoyCount}
                initialBuoyCount={field.id === 'custom' ? 0 : undefined}
                assignmentLines={(() => {
                  // Calcola le linee da ogni boa assegnata alla sua posizione target
                  if (field.id !== 'custom' || !giuriaPosition) return [];
                  const lines = [];
                  for (let i = 0; i < buoyCount; i++) {
                    const slotId = `custom_boa${i + 1}`;
                    const assigned = assignments[slotId];
                    if (assigned && typeof assigned.lat === 'number' && typeof assigned.lon === 'number') {
                      // Prendi la posizione target della boa (dal campo)
                      // La posizione target è la posizione della boa rossa sulla mappa
                      // Serve accedere a CampoRegataDraggable/campoBoe: qui la posizione target è calcolata come offset dalla giuria
                      // Per semplicità, passiamo la posizione target come la posizione della boa rossa (da campo)
                      // Qui non abbiamo accesso diretto, quindi serve che MapView/CampoRegataDraggable esponga le posizioni boe
                      // Per ora, passiamo solo l'indice e MapView si occupa di matchare
                      lines.push({
                        from: { lat: assigned.lat, lon: assigned.lon },
                        toIndex: i // l'indice della boa rossa target
                      });
                    }
                  }
                  return lines;
                })()}
              />
            ) : (
              <img
                src={field.image}
                alt={field.name}
                style={{ width: '100%', height: '100%', objectFit: 'contain', maxWidth: '100%', maxHeight: '100%', background: '#f5f5f5' }}
              />
            )}
          </Box>
          {/* Colonna destra: slot drag & drop */}
          <Box sx={{ width: { xs: '28vw', sm: 260 }, minWidth: 120, maxWidth: 320, bgcolor: 'white', p: 2, boxShadow: 4, overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 2, position: 'relative' }}>
            <Typography variant="h6" sx={{ mb: 2, textAlign: 'center' }}>Slot assegnazione</Typography>
            {field.id === 'custom' ? (
              <>
                {/* Pulsante aggiungi boa sopra la giuria */}
                <Button variant="contained" color="primary" sx={{ mb: 2 }} onClick={() => mapViewRef.current?.addBuoy?.()}>
                  Aggiungi boa
                </Button>
                {/* Giuria slot sempre presente */}
                <Paper key={'giuria'} elevation={giuriaPosition ? 4 : 2} sx={{
                  p: 2, mb: 1, minHeight: 56, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                  border: giuriaPosition ? '2.5px solid #43a047' : '2.5px solid #ff5252',
                  background: giuriaPosition
                    ? 'linear-gradient(135deg, #e8f5e9 0%, #b9f6ca 100%)'
                    : 'linear-gradient(135deg, #fff0f0 0%, #ffd6d6 100%)',
                  borderRadius: 3,
                  boxShadow: giuriaPosition ? '0 4px 16px 0 #b9f6ca55' : '0 2px 8px 0 #ffd6d655',
                  fontWeight: 600, fontSize: 17, color: '#222', position: 'relative',
                  transition: 'background 0.3s, border 0.3s, box-shadow 0.3s',
                  cursor: giuriaPosition ? 'default' : 'pointer',
                  '&:hover': !giuriaPosition ? { boxShadow: '0 4px 24px 0 #ff525255', borderColor: '#ff1744' } : {},
                }}>
                  <Typography variant="subtitle1" sx={{ mb: 1, fontWeight: 600, color: '#1976d2' }}>Barca giuria</Typography>
                  <Button variant="contained" color="primary" onClick={onChooseGiuriaPosition}>Scegli posizione</Button>
                  {giuriaPosition && (
                    <Typography variant="body2" sx={{ mt: 1, color: '#388e3c' }}>
                      Lat: {giuriaPosition.lat.toFixed(5)}, Lon: {giuriaPosition.lon.toFixed(5)}
                    </Typography>
                  )}
                </Paper>
                {/* Slot boe rosse numerate */}
                {giuriaPosition && Array.from({ length: buoyCount }, (_, i) => {
                  const slotId = `custom_boa${i + 1}`;
                  const assigned = assignments[slotId];
                  const isSet = !!assigned;
                  return (
                    <Paper
                      key={slotId}
                      elevation={isSet ? 4 : 2}
                      sx={{
                        p: 2, mb: 1, minHeight: 56, display: 'flex', alignItems: 'center', justifyContent: 'center',
                        border: isSet ? '2.5px solid #43a047' : '2.5px solid #ff5252',
                        background: isSet
                          ? 'linear-gradient(135deg, #e8f5e9 0%, #b9f6ca 100%)'
                          : 'linear-gradient(135deg, #fff0f0 0%, #ffd6d6 100%)',
                        borderRadius: 3,
                        boxShadow: isSet ? '0 4px 16px 0 #b9f6ca55' : '0 2px 8px 0 #ffd6d655',
                        fontWeight: 600, fontSize: 17, color: '#222', position: 'relative',
                        transition: 'background 0.3s, border 0.3s, box-shadow 0.3s',
                        cursor: isSet ? 'default' : 'pointer',
                        '&:hover': !isSet ? { boxShadow: '0 4px 24px 0 #ff525255', borderColor: '#ff1744' } : {},
                      }}
                      onDrop={e => handleDrop(e, slotId)}
                      onDragOver={handleDragOver}
                    >
                      {assigned ? (
                        <Card sx={{ display: 'flex', alignItems: 'center', width: '100%', boxShadow: 0, bgcolor: 'transparent', position: 'relative' }}>
                          <CardMedia
                            component="img"
                            image={'/boe/boadefault.png'}
                            alt={assigned.id}
                            sx={{ width: 40, height: 40, objectFit: 'cover', borderRadius: 2, m: 1 }}
                          />
                          <CardContent sx={{ flex: 1, p: 1 }}>
                            <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>{assigned.id}</Typography>
                            <Typography variant="body2" color="text.secondary">Lat: {assigned.lat.toFixed(5)}, Lon: {assigned.lon.toFixed(5)}</Typography>
                          </CardContent>
                          <IconButton size="small" sx={{ position: 'absolute', top: 2, right: 2 }} onClick={() => handleRemoveFromSlot(slotId)}>
                            <CloseIcon fontSize="small" />
                          </IconButton>
                        </Card>
                      ) : (
                        `Boa ${i + 1}`
                      )}
                    </Paper>
                  );
                })}
                {/* Pulsante conferma campo */}
                <Button
                  variant="contained"
                  color={allSlotsCompleted ? 'success' : 'inherit'}
                  disabled={!allSlotsCompleted}
                  sx={{ mt: 3, fontWeight: 700, fontSize: 18, borderRadius: 3, boxShadow: 2, opacity: allSlotsCompleted ? 1 : 0.6 }}
                  onClick={() => setConfirmOpen(true)}
                  fullWidth
                >
                  Conferma campo
                </Button>
              </>
            ) : (
              // Default: all slots as before
              DEFAULT_SLOTS.map(slot => {
              if (slot.id === 'giuria') {
                const isSet = !!giuriaPosition;
                return (
                  <Paper key={slot.id} elevation={isSet ? 4 : 2} sx={{
                    p: 2, mb: 1, minHeight: 56, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                    border: isSet ? '2.5px solid #43a047' : '2.5px solid #ff5252',
                    background: isSet
                      ? 'linear-gradient(135deg, #e8f5e9 0%, #b9f6ca 100%)'
                      : 'linear-gradient(135deg, #fff0f0 0%, #ffd6d6 100%)',
                    borderRadius: 3,
                    boxShadow: isSet ? '0 4px 16px 0 #b9f6ca55' : '0 2px 8px 0 #ffd6d655',
                    fontWeight: 600, fontSize: 17, color: '#222', position: 'relative',
                    transition: 'background 0.3s, border 0.3s, box-shadow 0.3s',
                    cursor: isSet ? 'default' : 'pointer',
                    '&:hover': !isSet ? { boxShadow: '0 4px 24px 0 #ff525255', borderColor: '#ff1744' } : {},
                  }}>
                    <Typography variant="subtitle1" sx={{ mb: 1, fontWeight: 600, color: '#1976d2' }}>{slot.label}</Typography>
                    <Button variant="contained" color="primary" onClick={onChooseGiuriaPosition}>Scegli posizione</Button>
                    {isSet && (
                      <Typography variant="body2" sx={{ mt: 1, color: '#388e3c' }}>
                        Lat: {giuriaPosition!.lat.toFixed(5)}, Lon: {giuriaPosition!.lon.toFixed(5)}
                      </Typography>
                    )}
                  </Paper>
                );
              }
              const assigned = assignments[slot.id];
              const isSet = !!assigned;
              return (
                <Paper
                  key={slot.id}
                  elevation={isSet ? 4 : 2}
                  sx={{
                    p: 2, mb: 1, minHeight: 56, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    border: isSet ? '2.5px solid #43a047' : '2.5px solid #ff5252',
                    background: isSet
                      ? 'linear-gradient(135deg, #e8f5e9 0%, #b9f6ca 100%)'
                      : 'linear-gradient(135deg, #fff0f0 0%, #ffd6d6 100%)',
                    borderRadius: 3,
                    boxShadow: isSet ? '0 4px 16px 0 #b9f6ca55' : '0 2px 8px 0 #ffd6d655',
                    fontWeight: 600, fontSize: 17, color: '#222', position: 'relative',
                    transition: 'background 0.3s, border 0.3s, box-shadow 0.3s',
                    cursor: isSet ? 'default' : 'pointer',
                    '&:hover': !isSet ? { boxShadow: '0 4px 24px 0 #ff525255', borderColor: '#ff1744' } : {},
                  }}
                  onDrop={slot.id !== 'giuria' ? e => handleDrop(e, slot.id) : undefined}
                  onDragOver={slot.id !== 'giuria' ? handleDragOver : undefined}
                >
                  {assigned ? (
                    <Card sx={{ display: 'flex', alignItems: 'center', width: '100%', boxShadow: 0, bgcolor: 'transparent', position: 'relative' }}>
                      <CardMedia
                        component="img"
                        image={'/boe/boadefault.png'}
                        alt={assigned.id}
                        sx={{ width: 40, height: 40, objectFit: 'cover', borderRadius: 2, m: 1 }}
                      />
                      <CardContent sx={{ flex: 1, p: 1 }}>
                        <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>{assigned.id}</Typography>
                        <Typography variant="body2" color="text.secondary">Lat: {assigned.lat.toFixed(5)}, Lon: {assigned.lon.toFixed(5)}</Typography>
                      </CardContent>
                      <IconButton size="small" sx={{ position: 'absolute', top: 2, right: 2 }} onClick={() => handleRemoveFromSlot(slot.id)}>
                        <CloseIcon fontSize="small" />
                      </IconButton>
                    </Card>
                  ) : (
                    slot.label
                  )}
                </Paper>
              );
              })
            )}
          </Box>
        </React.Fragment>
      </Box>
      {/* Dialog conferma campo */}
      <Dialog open={confirmOpen} onClose={() => setConfirmOpen(false)} maxWidth="xs" fullWidth
        PaperProps={{
          sx: {
            borderRadius: 5,
            boxShadow: '0 8px 40px 0 #0004',
            background: 'rgba(255,255,255,0.85)',
            backdropFilter: 'blur(8px)',
            p: 0,
            overflow: 'visible',
            border: '1.5px solid #e53935',
            position: 'relative',
          }
        }}
        BackdropProps={{ sx: { background: 'rgba(30,34,60,0.25)', backdropFilter: 'blur(2px)' } }}
      >
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', pt: 3, pb: 2, px: 3 }}>
          <WarningAmberRoundedIcon sx={{ color: '#e53935', fontSize: 54, mb: 1, filter: 'drop-shadow(0 2px 8px #e5393555)' }} />
          <DialogTitle sx={{
            fontWeight: 800,
            textAlign: 'center',
            fontSize: 25,
            color: '#e53935',
            letterSpacing: 0.5,
            p: 0,
            mb: 1.5,
            background: 'none',
            width: '100%'
          }}>
            Attenzione
          </DialogTitle>
          <DialogContent sx={{
            textAlign: 'center',
            fontSize: 18,
            color: '#222',
            fontWeight: 500,
            background: 'none',
            p: 0,
            mb: 2,
            width: '100%'
          }}>
            <span style={{ color: '#e53935', fontWeight: 700 }}>Una volta confermato il campo, le boe procederanno alle loro posizioni in linea retta.</span><br />
            <span style={{ color: '#b71c1c', fontWeight: 700 }}>Assicurarsi che non siano un pericolo per l'ambiente circostante.</span>
          </DialogContent>
          <Box sx={{ mt: 2.5, display: 'flex', justifyContent: 'center', width: '100%' }}>
            <MuiIconButton
              sx={{
                width: 160, height: 56, borderRadius: 4,
                background: 'rgba(255,255,255,0.95)',
                border: '2.5px solid #43a047',
                boxShadow: holdActive ? '0 0 0 6px #b9f6ca55, 0 2px 16px #43a04755' : '0 2px 16px #bbb',
                color: '#43a047',
                fontSize: 28, fontWeight: 800,
                transition: 'box-shadow 0.2s',
                zIndex: 2,
                backdropFilter: 'blur(2px)',
                overflow: 'hidden',
                position: 'relative',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                p: 0,
                minWidth: 0,
                '&:after': holdActive ? {
                  content: '""',
                  position: 'absolute',
                  left: -4, top: -4, right: -4, bottom: -4,
                  borderRadius: 6,
                  boxShadow: '0 0 32px 8px #43a04733',
                  pointerEvents: 'none',
                } : {},
              }}
              onMouseDown={handleMouseDown}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseLeave}
              onTouchStart={handleTouchStart}
              onTouchEnd={handleTouchEnd}
              disabled={holdActive && holdProgress >= 100}
            >
              {/* Progress bar orizzontale sopra la scritta */}
              <Box sx={{
                position: 'absolute',
                left: 0,
                top: 0,
                height: '100%',
                width: `${holdProgress}%`,
                background: 'linear-gradient(90deg, #43a047 60%, #b9f6ca 100%)',
                opacity: 0.35,
                borderRadius: 4,
                zIndex: 1,
                transition: holdActive ? 'width 0.1s linear' : 'width 0.2s',
                pointerEvents: 'none',
              }} />
              {/* Scritta OK sempre centrata sopra la barra */}
              <span style={{
                position: 'relative',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 800,
                fontSize: 28,
                letterSpacing: 1,
                color: '#43a047',
                textShadow: holdActive ? '0 2px 8px #388e3c55' : 'none',
                zIndex: 2,
                width: '100%',
                height: '100%',
                userSelect: 'none',
              }}>OK</span>
            </MuiIconButton>
          </Box>
          <Box sx={{ mt: 2.5, color: '#888', fontSize: 16, fontWeight: 500, letterSpacing: 0.2, textAlign: 'center' }}>
            Tieni premuto il pulsante <b>OK</b> per 3 secondi per confermare
          </Box>
          <DialogActions sx={{ justifyContent: 'center', mt: 2, width: '100%' }}>
            <Button onClick={() => setConfirmOpen(false)} color="inherit" sx={{ fontWeight: 700, fontSize: 17, borderRadius: 3, px: 3, py: 1, background: '#f5f5f5', boxShadow: '0 1px 6px #bbb', border: '1.5px solid #eee' }}>Annulla</Button>
          </DialogActions>
        </Box>
      </Dialog>
    </Box>
  );
} 