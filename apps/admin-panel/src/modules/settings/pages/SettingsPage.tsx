import React from 'react';

export const SettingsPage: React.FC = () => {
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-gray-900">Settings</h1>

      <div className="card">
        <h2 className="text-xl font-semibold mb-4">Platform Settings</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Surge Multiplier
            </label>
            <input type="number" className="input w-64" defaultValue="1.5" step="0.1" />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Default Porter Radius (km)
            </label>
            <input type="number" className="input w-64" defaultValue="10" />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Loyalty Points per Dollar
            </label>
            <input type="number" className="input w-64" defaultValue="10" />
          </div>
        </div>

        <div className="mt-6">
          <button className="btn btn-primary">Save Settings</button>
        </div>
      </div>

      <div className="card">
        <h2 className="text-xl font-semibold mb-4">Notifications</h2>
        <div className="space-y-3">
          <label className="flex items-center">
            <input type="checkbox" className="mr-3" defaultChecked />
            <span className="text-gray-700">Email notifications for new orders</span>
          </label>
          <label className="flex items-center">
            <input type="checkbox" className="mr-3" defaultChecked />
            <span className="text-gray-700">Email notifications for porter verification</span>
          </label>
          <label className="flex items-center">
            <input type="checkbox" className="mr-3" />
            <span className="text-gray-700">Daily analytics report</span>
          </label>
        </div>
      </div>
    </div>
  );
};
