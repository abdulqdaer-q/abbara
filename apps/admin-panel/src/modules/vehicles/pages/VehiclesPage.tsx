import React from 'react';
import { Edit, Trash } from 'lucide-react';
import { trpc } from '@/lib/trpc';

export const VehiclesPage: React.FC = () => {
  const { data: vehicleTypes, isLoading, error } = trpc.vehicleTypes.list.useQuery();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900">Vehicle Types & Pricing</h1>
        <button className="btn btn-primary">Add Vehicle Type</button>
      </div>

      <div className="card">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded mb-4">
            Error loading vehicle types: {error.message}
          </div>
        )}

        {isLoading ? (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
            <p className="mt-4 text-gray-500">Loading vehicle types...</p>
          </div>
        ) : vehicleTypes?.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            No vehicle types configured yet.
          </div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Vehicle Type</th>
                <th>Description</th>
                <th>Max Load (kg)</th>
                <th>Pricing Multiplier</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {vehicleTypes?.map((vehicle: any) => (
                <tr key={vehicle.id}>
                  <td className="font-medium">{vehicle.name}</td>
                  <td className="text-gray-600">{vehicle.description || 'N/A'}</td>
                  <td>{vehicle.maxLoadKg} kg</td>
                  <td>×{vehicle.pricingMultiplier}</td>
                  <td>
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                      vehicle.status === 'ACTIVE'
                        ? 'bg-green-100 text-green-600'
                        : 'bg-gray-100 text-gray-600'
                    }`}>
                      {vehicle.status}
                    </span>
                  </td>
                  <td>
                    <div className="flex items-center space-x-2">
                      <button
                        className="text-blue-600 hover:text-blue-700 p-1"
                        title="Edit"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        className="text-red-600 hover:text-red-700 p-1"
                        title="Delete"
                      >
                        <Trash className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};
