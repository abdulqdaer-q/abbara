import React from 'react';
import { Box, Typography, Paper } from '@mui/material';

export const OrdersPage: React.FC = () => {
  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Order Management
      </Typography>
      <Paper sx={{ p: 3 }}>
        <Typography>Order management features coming soon...</Typography>
      </Paper>
    </Box>
  );
};
