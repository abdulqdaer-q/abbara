import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useSelector } from 'react-redux';

import { RootState } from './store';
import { Layout } from './components/layout/Layout';
import { LoginPage } from './modules/auth/pages/LoginPage';
import { DashboardPage } from './modules/dashboard/pages/DashboardPage';
import { UsersPage } from './modules/users/pages/UsersPage';
import { OrdersPage } from './modules/orders/pages/OrdersPage';
import { VehiclesPage } from './modules/vehicles/pages/VehiclesPage';
import { PromosPage } from './modules/promos/pages/PromosPage';
import { AnalyticsPage } from './modules/analytics/pages/AnalyticsPage';
import { SettingsPage } from './modules/settings/pages/SettingsPage';

function App() {
  const isAuthenticated = useSelector((state: RootState) => state.auth.isAuthenticated);

  if (!isAuthenticated) {
    return <LoginPage />;
  }

  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/users" element={<UsersPage />} />
        <Route path="/orders" element={<OrdersPage />} />
        <Route path="/vehicles" element={<VehiclesPage />} />
        <Route path="/promos" element={<PromosPage />} />
        <Route path="/analytics" element={<AnalyticsPage />} />
        <Route path="/settings" element={<SettingsPage />} />
      </Routes>
    </Layout>
  );
}

export default App;
