import React from 'react';
import { AppBar, Toolbar, IconButton, Typography, Box, Badge } from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import FiberManualRecordIcon from '@mui/icons-material/FiberManualRecord';
import SatelliteAltRoundedIcon from '@mui/icons-material/SatelliteAltRounded';
import SignalCellular0BarRoundedIcon from '@mui/icons-material/SignalCellular0BarRounded';
import SignalCellular1BarRoundedIcon from '@mui/icons-material/SignalCellular1BarRounded';
import SignalCellular2BarRoundedIcon from '@mui/icons-material/SignalCellular2BarRounded';
import SignalCellular3BarRoundedIcon from '@mui/icons-material/SignalCellular3BarRounded';
import SignalCellular4BarRoundedIcon from '@mui/icons-material/SignalCellular4BarRounded';
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded';

function TopBar({ boaCount, onMenuClick, selectedVehicle }: { boaCount: number; onMenuClick: () => void; selectedVehicle: any | null }) {
  const now = new Date();
  const timeStr = now.toLocaleTimeString();
  const connected = boaCount > 0;
  // Calcolo link quality
  let linkQuality: number | null = null;
  if (selectedVehicle && selectedVehicle.SYS_STATUS && typeof selectedVehicle.SYS_STATUS.drop_rate_comm === 'number') {
    linkQuality = 100 - selectedVehicle.SYS_STATUS.drop_rate_comm / 100.0;
  }
  let SignalIcon = SignalCellular0BarRoundedIcon;
  if (linkQuality !== null) {
    if (linkQuality >= 75) SignalIcon = SignalCellular4BarRoundedIcon;
    else if (linkQuality >= 50) SignalIcon = SignalCellular3BarRoundedIcon;
    else if (linkQuality >= 25) SignalIcon = SignalCellular2BarRoundedIcon;
    else if (linkQuality >= 1) SignalIcon = SignalCellular1BarRoundedIcon;
    else SignalIcon = SignalCellular0BarRoundedIcon;
  }
  // Determina se la boa è offline
  const isOffline = selectedVehicle && selectedVehicle.isonline !== true;
  const isNoBoa = !selectedVehicle || isOffline;
  const iconStyle = isNoBoa ? { color: '#bbb', opacity: 0.5, filter: 'grayscale(1) brightness(1.2)' } : {};
  return (
    <AppBar position="fixed" color="default" elevation={1} sx={{ bgcolor: 'white', color: 'black', zIndex: 1201 }}>
      <Toolbar sx={{ justifyContent: 'space-between' }}>
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          <IconButton edge="start" color="inherit" aria-label="menu" onClick={onMenuClick}>
            <MenuIcon />
          </IconButton>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          {/* Icone stato connessione e satelliti */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <SignalIcon
              fontSize="medium"
              sx={{ ...iconStyle }}
            />
            <Box sx={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
              <SatelliteAltRoundedIcon
                fontSize="medium"
                sx={{ ...iconStyle }}
              />
              {/* Mostra badge satelliti solo se c'è una boa online selezionata */}
              {selectedVehicle && selectedVehicle.isonline === true && typeof selectedVehicle.GPS_RAW_INT?.satellites_visible === 'number' && (
                <Box sx={{
                  position: 'absolute',
                  top: -6,
                  right: -10,
                  bgcolor: '#1976d2',
                  color: 'white',
                  borderRadius: '50%',
                  fontSize: 11,
                  fontWeight: 700,
                  px: 0.7,
                  py: 0.1,
                  minWidth: 18,
                  textAlign: 'center',
                  boxShadow: '0 1px 4px rgba(0,0,0,0.15)',
                }}>
                  {selectedVehicle.GPS_RAW_INT.satellites_visible}
                </Box>
              )}
            </Box>
            {/* Simbolo attenzione rosso se offline */}
            {selectedVehicle && selectedVehicle.isonline !== true && (
              <WarningAmberRoundedIcon sx={{ color: 'red', fontSize: 28, ml: 1 }} />
            )}
          </Box>
          <Typography variant="h6" sx={{ fontWeight: 500, flex: 1, textAlign: 'center', minWidth: 120 }}>
            {timeStr}
          </Typography>
          <Badge
            color={connected ? 'success' : 'error'}
            badgeContent={connected ? boaCount : 'Nessuna'}
            anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
            sx={{ mr: 2 }}
          >
            <FiberManualRecordIcon sx={{ color: connected ? 'green' : 'red' }} />
          </Badge>
        </Box>
      </Toolbar>
    </AppBar>
  );
}

export default TopBar; 