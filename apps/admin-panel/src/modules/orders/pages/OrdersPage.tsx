import React, { useState } from 'react';
import { Eye } from 'lucide-react';
import { trpc } from '@/lib/trpc';

export const OrdersPage: React.FC = () => {
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<string>('');

  const { data, isLoading, error } = trpc.orders.list.useQuery({
    page,
    limit: 10,
    status: statusFilter || undefined,
  });

  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(cents / 100);
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      PENDING: 'bg-yellow-100 text-yellow-600',
      ACCEPTED: 'bg-blue-100 text-blue-600',
      IN_PROGRESS: 'bg-blue-100 text-blue-600',
      PICKED_UP: 'bg-purple-100 text-purple-600',
      IN_TRANSIT: 'bg-indigo-100 text-indigo-600',
      DELIVERED: 'bg-green-100 text-green-600',
      COMPLETED: 'bg-green-100 text-green-600',
      CANCELLED: 'bg-red-100 text-red-600',
    };
    return colors[status] || 'bg-gray-100 text-gray-600';
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900">Orders</h1>
        <div className="text-sm text-gray-500">
          {data?.pagination && `${data.pagination.totalItems} total orders`}
        </div>
      </div>

      <div className="card">
        <div className="flex items-center space-x-4 mb-6">
          <select
            className="input"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="">All Status</option>
            <option value="PENDING">Pending</option>
            <option value="ACCEPTED">Accepted</option>
            <option value="IN_PROGRESS">In Progress</option>
            <option value="DELIVERED">Delivered</option>
            <option value="COMPLETED">Completed</option>
            <option value="CANCELLED">Cancelled</option>
          </select>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded mb-4">
            Error loading orders: {error.message}
          </div>
        )}

        {isLoading ? (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
            <p className="mt-4 text-gray-500">Loading orders...</p>
          </div>
        ) : data?.orders.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            No orders found.
          </div>
        ) : (
          <>
            <table className="table">
              <thead>
                <tr>
                  <th>Order ID</th>
                  <th>Customer</th>
                  <th>Pickup</th>
                  <th>Dropoff</th>
                  <th>Status</th>
                  <th>Amount</th>
                  <th>Created</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {data?.orders.map((order: any) => (
                  <tr key={order.id}>
                    <td className="font-medium">#{order.id.slice(0, 8)}</td>
                    <td className="text-gray-600">{order.userId.slice(0, 8)}...</td>
                    <td className="text-sm text-gray-600">
                      {order.pickupAddress?.substring(0, 20)}...
                    </td>
                    <td className="text-sm text-gray-600">
                      {order.dropoffAddress?.substring(0, 20)}...
                    </td>
                    <td>
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(order.status)}`}>
                        {order.status.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="font-semibold">{formatCurrency(order.priceCents || 0)}</td>
                    <td className="text-sm text-gray-600">
                      {new Date(order.createdAt).toLocaleDateString()}
                    </td>
                    <td>
                      <button
                        className="text-blue-600 hover:text-blue-700 p-1"
                        title="View Details"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {data?.pagination && data.pagination.totalPages > 1 && (
              <div className="flex items-center justify-between mt-6 pt-4 border-t">
                <div className="text-sm text-gray-500">
                  Page {data.pagination.currentPage} of {data.pagination.totalPages}
                </div>
                <div className="flex space-x-2">
                  <button
                    className="btn btn-secondary"
                    disabled={page === 1}
                    onClick={() => setPage(page - 1)}
                  >
                    Previous
                  </button>
                  <button
                    className="btn btn-secondary"
                    disabled={page === data.pagination.totalPages}
                    onClick={() => setPage(page + 1)}
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};
