import React from 'react';
import { Box, Typography, Paper } from '@mui/material';

export const PortersPage: React.FC = () => {
  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Porter Management
      </Typography>
      <Paper sx={{ p: 3 }}>
        <Typography>Porter verification and management features coming soon...</Typography>
      </Paper>
    </Box>
  );
};
