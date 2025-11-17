import React from 'react';
import { Users, Package, DollarSign, TrendingUp } from 'lucide-react';

const stats = [
  { name: 'Total Users', value: '2,543', icon: Users, change: '+12%', changeType: 'positive' },
  { name: 'Active Orders', value: '147', icon: Package, change: '+8%', changeType: 'positive' },
  { name: 'Revenue', value: '$54,239', icon: DollarSign, change: '+23%', changeType: 'positive' },
  { name: 'Growth', value: '18.2%', icon: TrendingUp, change: '+4.5%', changeType: 'positive' },
];

export const DashboardPage: React.FC = () => {
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <div key={stat.name} className="card">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">{stat.name}</p>
                <p className="mt-2 text-3xl font-semibold text-gray-900">{stat.value}</p>
                <p className={`mt-2 text-sm ${stat.changeType === 'positive' ? 'text-green-600' : 'text-red-600'}`}>
                  {stat.change} from last month
                </p>
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
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Recent Orders</h2>
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div>
                  <p className="font-medium text-gray-900">Order #{1000 + i}</p>
                  <p className="text-sm text-gray-600">Customer {i}</p>
                </div>
                <span className="px-3 py-1 text-xs font-medium text-green-600 bg-green-100 rounded-full">
                  Completed
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Top Porters</h2>
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div>
                  <p className="font-medium text-gray-900">Porter {i}</p>
                  <p className="text-sm text-gray-600">{20 + i} orders completed</p>
                </div>
                <span className="text-sm font-medium text-gray-900">
                  {(4.5 + i * 0.1).toFixed(1)} ⭐
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
