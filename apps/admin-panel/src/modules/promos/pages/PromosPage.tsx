import React, { useState } from 'react';
import { Edit, Trash, Plus } from 'lucide-react';
import { trpc } from '@/lib/trpc';

export const PromosPage: React.FC = () => {
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<string>('');

  const { data, isLoading, error } = trpc.promoCodes.list.useQuery({
    page,
    limit: 10,
    status: statusFilter || undefined,
  });

  const formatDiscount = (discountType: string, discountValue: number) => {
    if (discountType === 'PERCENTAGE') {
      return `${discountValue}%`;
    } else {
      return `$${(discountValue / 100).toFixed(2)}`;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900">Promo Codes</h1>
        <button className="btn btn-primary flex items-center">
          <Plus className="w-4 h-4 mr-2" />
          Create Promo Code
        </button>
      </div>

      <div className="card">
        <div className="flex items-center space-x-4 mb-6">
          <select
            className="input"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="">All Status</option>
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Inactive</option>
            <option value="EXPIRED">Expired</option>
          </select>
          <div className="text-sm text-gray-500">
            {data?.pagination && `${data.pagination.totalItems} total promo codes`}
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded mb-4">
            Error loading promo codes: {error.message}
          </div>
        )}

        {isLoading ? (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
            <p className="mt-4 text-gray-500">Loading promo codes...</p>
          </div>
        ) : data?.promoCodes.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            No promo codes found.
          </div>
        ) : (
          <>
            <table className="table">
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Discount</th>
                  <th>Usage</th>
                  <th>Valid Period</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {data?.promoCodes.map((promo: any) => (
                  <tr key={promo.id}>
                    <td className="font-mono font-bold text-primary-600">{promo.code}</td>
                    <td>{formatDiscount(promo.discountType, promo.discountValue)}</td>
                    <td>
                      <div className="text-sm">
                        <span className="font-semibold">{promo.usageCount}</span>
                        {promo.maxUsageLimit && (
                          <span className="text-gray-500"> / {promo.maxUsageLimit}</span>
                        )}
                      </div>
                    </td>
                    <td className="text-sm text-gray-600">
                      {promo.validFrom && new Date(promo.validFrom).toLocaleDateString()}
                      {' - '}
                      {promo.validUntil && new Date(promo.validUntil).toLocaleDateString()}
                    </td>
                    <td>
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                        promo.status === 'ACTIVE'
                          ? 'bg-green-100 text-green-600'
                          : promo.status === 'EXPIRED'
                          ? 'bg-red-100 text-red-600'
                          : 'bg-gray-100 text-gray-600'
                      }`}>
                        {promo.status}
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
