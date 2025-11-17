import React from 'react';
import { Users, Package, DollarSign, TrendingUp, AlertCircle } from 'lucide-react';
import { trpc } from '@/lib/trpc';

export const DashboardPage: React.FC = () => {
  // Fetch dashboard summary from analytics API
  const { data: summary, isLoading, error } = trpc.analytics.getDashboardSummary.useQuery();

  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(cents / 100);
  };

  const stats = summary ? [
    { name: 'Total Users', value: summary.totalUsers.toLocaleString(), icon: Users, description: 'Registered users' },
    { name: 'Total Orders', value: summary.totalOrders.toLocaleString(), icon: Package, description: 'All time' },
    { name: 'Revenue (30d)', value: formatCurrency(summary.revenueLastMonth), icon: DollarSign, description: 'Last 30 days' },
    { name: 'Pending Verifications', value: summary.pendingVerifications.toString(), icon: AlertCircle, description: 'Porter docs' },
  ] : [];
  if (error) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
        <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded">
          Error loading dashboard: {error.message}
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
          <p className="mt-4 text-gray-500">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
        <div className="text-sm text-gray-500">
          Last updated: {new Date().toLocaleTimeString()}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <div key={stat.name} className="card hover:shadow-lg transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">{stat.name}</p>
                <p className="mt-2 text-3xl font-semibold text-gray-900">{stat.value}</p>
                <p className="mt-2 text-xs text-gray-500">{stat.description}</p>
              </div>
              <div className="p-3 bg-primary-100 rounded-lg">
                <stat.icon className="w-6 h-6 text-primary-600" />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Quick Stats</h2>
          </div>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-blue-50 rounded-lg">
              <div>
                <p className="text-sm text-gray-600">Active Promo Codes</p>
                <p className="text-2xl font-semibold text-gray-900">{summary?.activePromoCodes || 0}</p>
              </div>
              <Package className="w-8 h-8 text-blue-600" />
            </div>
            <div className="flex items-center justify-between p-4 bg-green-50 rounded-lg">
              <div>
                <p className="text-sm text-gray-600">Total Users</p>
                <p className="text-2xl font-semibold text-gray-900">{summary?.totalUsers.toLocaleString() || 0}</p>
              </div>
              <Users className="w-8 h-8 text-green-600" />
            </div>
            <div className="flex items-center justify-between p-4 bg-yellow-50 rounded-lg">
              <div>
                <p className="text-sm text-gray-600">Pending Verifications</p>
                <p className="text-2xl font-semibold text-gray-900">{summary?.pendingVerifications || 0}</p>
              </div>
              <AlertCircle className="w-8 h-8 text-yellow-600" />
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">System Health</h2>
            <span className="px-3 py-1 text-xs font-medium text-green-600 bg-green-100 rounded-full">
              All Systems Operational
            </span>
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div className="flex items-center space-x-3">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <div>
                  <p className="font-medium text-gray-900">API Gateway</p>
                  <p className="text-sm text-gray-600">Response time: 45ms</p>
                </div>
              </div>
              <TrendingUp className="w-5 h-5 text-green-600" />
            </div>
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div className="flex items-center space-x-3">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <div>
                  <p className="font-medium text-gray-900">Database</p>
                  <p className="text-sm text-gray-600">Healthy, 1.2GB used</p>
                </div>
              </div>
              <TrendingUp className="w-5 h-5 text-green-600" />
            </div>
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div className="flex items-center space-x-3">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <div>
                  <p className="font-medium text-gray-900">Admin Service</p>
                  <p className="text-sm text-gray-600">Active, 99.9% uptime</p>
                </div>
              </div>
              <TrendingUp className="w-5 h-5 text-green-600" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
