import React from 'react';

const mockVehicles = [
  { id: '1', type: 'Sedan', basePrice: 25.00, pricePerKm: 1.50, status: 'Active' },
  { id: '2', type: 'SUV', basePrice: 35.00, pricePerKm: 2.00, status: 'Active' },
  { id: '3', type: 'Van', basePrice: 45.00, pricePerKm: 2.50, status: 'Active' },
  { id: '4', type: 'Truck', basePrice: 60.00, pricePerKm: 3.00, status: 'Active' },
];

export const VehiclesPage: React.FC = () => {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900">Vehicles & Pricing</h1>
        <button className="btn btn-primary">Add Vehicle Type</button>
      </div>

      <div className="card">
        <table className="table">
          <thead>
            <tr>
              <th>Vehicle Type</th>
              <th>Base Price</th>
              <th>Price per KM</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {mockVehicles.map((vehicle) => (
              <tr key={vehicle.id}>
                <td className="font-medium">{vehicle.type}</td>
                <td>${vehicle.basePrice.toFixed(2)}</td>
                <td>${vehicle.pricePerKm.toFixed(2)}</td>
                <td>
                  <span className="px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-600">
                    {vehicle.status}
                  </span>
                </td>
                <td>
                  <button className="text-primary-600 hover:text-primary-700 font-medium text-sm mr-3">
                    Edit
                  </button>
                  <button className="text-red-600 hover:text-red-700 font-medium text-sm">
                    Deactivate
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
