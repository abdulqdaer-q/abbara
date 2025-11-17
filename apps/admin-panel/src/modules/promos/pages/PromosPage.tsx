import React from 'react';

const mockPromos = [
  { id: '1', code: 'WELCOME20', discount: '20%', used: 45, limit: 100, status: 'Active' },
  { id: '2', code: 'SUMMER10', discount: '10%', used: 120, limit: 200, status: 'Active' },
  { id: '3', code: 'EXPIRED50', discount: '50%', used: 50, limit: 50, status: 'Expired' },
];

export const PromosPage: React.FC = () => {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900">Promo Codes</h1>
        <button className="btn btn-primary">Create Promo Code</button>
      </div>

      <div className="card">
        <table className="table">
          <thead>
            <tr>
              <th>Code</th>
              <th>Discount</th>
              <th>Used / Limit</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {mockPromos.map((promo) => (
              <tr key={promo.id}>
                <td className="font-mono font-bold">{promo.code}</td>
                <td>{promo.discount}</td>
                <td>{promo.used} / {promo.limit}</td>
                <td>
                  <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                    promo.status === 'Active'
                      ? 'bg-green-100 text-green-600'
                      : 'bg-gray-100 text-gray-600'
                  }`}>
                    {promo.status}
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
