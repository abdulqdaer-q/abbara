import React from 'react';
import { Box, Typography, Paper } from '@mui/material';

export const UsersPage: React.FC = () => {
  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        User Management
      </Typography>
      <Paper sx={{ p: 3 }}>
        <Typography>User list and management features coming soon...</Typography>
      </Paper>
    </Box>
  );
};
