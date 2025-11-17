import React, { useState } from 'react';
import { Save, RefreshCw } from 'lucide-react';
import { trpc } from '@/lib/trpc';

export const SettingsPage: React.FC = () => {
  const { data: settings, isLoading, error, refetch } = trpc.settings.list.useQuery();
  const updateSettingMutation = trpc.settings.update.useMutation({
    onSuccess: () => {
      refetch();
    },
  });

  const [editValues, setEditValues] = useState<Record<string, string>>({});

  const handleUpdate = async (key: string, description?: string) => {
    const value = editValues[key];
    if (value !== undefined) {
      await updateSettingMutation.mutateAsync({
        settingKey: key,
        value,
        description,
      });
      // Clear the edit value after successful update
      setEditValues((prev) => {
        const newValues = { ...prev };
        delete newValues[key];
        return newValues;
      });
    }
  };

  const getSettingValue = (key: string) => {
    return editValues[key] !== undefined
      ? editValues[key]
      : settings?.find((s: any) => s.key === key)?.value || '';
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Platform Settings</h1>
          <p className="text-gray-600 mt-1">Configure system-wide settings</p>
        </div>
        <button
          onClick={() => refetch()}
          className="btn btn-secondary flex items-center"
          disabled={isLoading}
        >
          <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded">
          Error loading settings: {error.message}
        </div>
      )}

      {isLoading ? (
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
          <p className="mt-4 text-gray-500">Loading settings...</p>
        </div>
      ) : (
        <>
          <div className="card">
            <h2 className="text-xl font-semibold mb-4">Core Settings</h2>
            <div className="space-y-6">
              {settings && settings.length > 0 ? (
                settings.map((setting: any) => (
                  <div key={setting.id} className="border-b border-gray-200 pb-4 last:border-b-0">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          {setting.key.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())}
                        </label>
                        {setting.description && (
                          <p className="text-xs text-gray-500 mb-2">{setting.description}</p>
                        )}
                        <div className="flex items-center space-x-3">
                          <input
                            type="text"
                            className="input w-96"
                            value={getSettingValue(setting.key)}
                            onChange={(e) => setEditValues((prev) => ({ ...prev, [setting.key]: e.target.value }))}
                          />
                          {editValues[setting.key] !== undefined && (
                            <button
                              onClick={() => handleUpdate(setting.key, setting.description)}
                              className="btn btn-primary flex items-center"
                              disabled={updateSettingMutation.isLoading}
                            >
                              <Save className="w-4 h-4 mr-1" />
                              Save
                            </button>
                          )}
                        </div>
                        <div className="mt-1 text-xs text-gray-500">
                          Version: {setting.version} | Last updated: {new Date(setting.updatedAt).toLocaleString()}
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-8 text-gray-500">
                  No settings configured yet.
                </div>
              )}
            </div>
          </div>

          <div className="card">
            <h2 className="text-xl font-semibold mb-4">About Admin Panel</h2>
            <div className="space-y-2 text-sm text-gray-600">
              <div className="flex items-center justify-between py-2 border-b">
                <span className="font-medium">Version:</span>
                <span>1.0.0</span>
              </div>
              <div className="flex items-center justify-between py-2 border-b">
                <span className="font-medium">Environment:</span>
                <span className="px-2 py-1 bg-green-100 text-green-800 rounded text-xs font-medium">
                  {import.meta.env.MODE || 'development'}
                </span>
              </div>
              <div className="flex items-center justify-between py-2">
                <span className="font-medium">API URL:</span>
                <span className="font-mono text-xs">{import.meta.env.VITE_ADMIN_API_URL || 'http://localhost:4000'}</span>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
