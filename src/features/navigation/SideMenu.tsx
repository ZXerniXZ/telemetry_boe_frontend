import React from 'react';
import { Drawer, Box, List, ListItemButton, ListItemIcon, ListItemText } from '@mui/material';
import MapIcon from '@mui/icons-material/Map';
import BuoyIcon from '@mui/icons-material/Adjust';
import { Link, useLocation } from 'react-router-dom';

const drawerWidth = 220;

function SideMenu({ open, onClose }: { open: boolean; onClose: () => void }) {
  const location = useLocation();
  return (
    <Drawer anchor="left" open={open} onClose={onClose}>
      <Box sx={{ width: drawerWidth, bgcolor: 'white', color: 'black', p: 2, pt: '64px' }} role="presentation">
        <List>
          <ListItemButton
            component={Link}
            to="/"
            selected={location.pathname === '/'}
            onClick={onClose}
            sx={{ color: 'black' }}
          >
            <ListItemIcon sx={{ color: 'black' }}>
              <MapIcon />
            </ListItemIcon>
            <ListItemText primary="Mappa" sx={{ color: 'black' }} />
          </ListItemButton>
          <ListItemButton
            component={Link}
            to="/boe"
            selected={location.pathname.startsWith('/boe')}
            onClick={onClose}
            sx={{ color: 'black' }}
          >
            <ListItemIcon sx={{ color: 'black' }}>
              <BuoyIcon />
            </ListItemIcon>
            <ListItemText primary="Boe" sx={{ color: 'black' }} />
          </ListItemButton>
        </List>
      </Box>
    </Drawer>
  );
}

export default SideMenu; 