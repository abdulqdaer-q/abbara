import React from 'react';
import { Box, Typography, Paper } from '@mui/material';

export const AnalyticsPage: React.FC = () => {
  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Analytics & Reports
      </Typography>
      <Paper sx={{ p: 3 }}>
        <Typography>Analytics dashboards and reports coming soon...</Typography>
      </Paper>
    </Box>
  );
};
