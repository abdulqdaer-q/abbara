import React from 'react';

const mockOrders = [
  { id: '1', customer: 'John Doe', porter: 'Jane Smith', status: 'completed', amount: '$45.00' },
  { id: '2', customer: 'Bob Wilson', porter: 'Mike Johnson', status: 'in_progress', amount: '$60.00' },
  { id: '3', customer: 'Alice Brown', porter: 'Unassigned', status: 'pending', amount: '$35.00' },
];

export const OrdersPage: React.FC = () => {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900">Orders</h1>
      </div>

      <div className="card">
        <table className="table">
          <thead>
            <tr>
              <th>Order ID</th>
              <th>Customer</th>
              <th>Porter</th>
              <th>Status</th>
              <th>Amount</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {mockOrders.map((order) => (
              <tr key={order.id}>
                <td className="font-medium">#{order.id}</td>
                <td>{order.customer}</td>
                <td>{order.porter}</td>
                <td>
                  <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                    order.status === 'completed'
                      ? 'bg-green-100 text-green-600'
                      : order.status === 'in_progress'
                      ? 'bg-blue-100 text-blue-600'
                      : 'bg-yellow-100 text-yellow-600'
                  }`}>
                    {order.status.replace('_', ' ')}
                  </span>
                </td>
                <td className="font-semibold">{order.amount}</td>
                <td>
                  <button className="text-primary-600 hover:text-primary-700 font-medium text-sm">
                    View
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
