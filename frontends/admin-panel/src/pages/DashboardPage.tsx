import React from 'react';
import { Grid, Card, CardContent, Typography, Box } from '@mui/material';
import { People, LocalShipping, ShoppingCart, AttachMoney } from '@mui/icons-material';

const StatCard: React.FC<{ title: string; value: string | number; icon: React.ReactNode; color: string }> = ({ title, value, icon, color }) => (
  <Card>
    <CardContent>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box>
          <Typography color="text.secondary" gutterBottom>
            {title}
          </Typography>
          <Typography variant="h4">{value}</Typography>
        </Box>
        <Box sx={{ color, fontSize: 48 }}>{icon}</Box>
      </Box>
    </CardContent>
  </Card>
);

export const DashboardPage: React.FC = () => {
  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Dashboard
      </Typography>
      <Grid container spacing={3}>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard title="Total Users" value="1,234" icon={<People />} color="#007AFF" />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard title="Active Porters" value="567" icon={<LocalShipping />} color="#34C759" />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard title="Total Orders" value="8,901" icon={<ShoppingCart />} color="#FF9500" />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard title="Revenue" value="$45,678" icon={<AttachMoney />} color="#5856D6" />
        </Grid>
      </Grid>
    </Box>
  );
};
