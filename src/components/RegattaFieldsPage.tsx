import React from 'react';
import { Box, Card, CardActionArea, CardContent, Typography, CardMedia } from '@mui/material';

export interface RegattaField {
  id: string;
  name: string;
  image: string;
  description?: string;
}

const FIELDS: RegattaField[] = [
  {
    id: 'bastone',
    name: 'Campo Bastone',
    image: '/campi/bastone_no_bg.png',
    description: 'Campo da regata tipo bastone',
  },
  {
    id: 'custom',
    name: 'Crea il tuo campo',
    image: '/campi/campiIcona.png', // Usa un'icona esistente o sostituisci con una appropriata
    description: 'Crea un campo personalizzato: solo barca giuria, aggiungi le boe manualmente',
  },
];

export default function RegattaFieldsPage({ onSelect }: { onSelect: (field: RegattaField) => void }) {
  return (
    <Box sx={{ maxWidth: 480, mx: 'auto', py: 4 }}>
      <Typography variant="h4" sx={{ mb: 3, textAlign: 'center' }}>Campi da regata</Typography>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        {FIELDS.map(field => (
          <Card key={field.id} sx={{ display: 'flex', alignItems: 'center', minHeight: 120 }}>
            <CardActionArea sx={{ display: 'flex', alignItems: 'center' }} onClick={() => onSelect(field)}>
              <CardMedia
                component="img"
                image={field.image}
                alt={field.name}
                sx={{ width: 100, height: 100, objectFit: 'contain', p: 1 }}
              />
              <CardContent>
                <Typography variant="h6">{field.name}</Typography>
                <Typography variant="body2" color="text.secondary">{field.description}</Typography>
              </CardContent>
            </CardActionArea>
          </Card>
        ))}
      </Box>
    </Box>
  );
} 