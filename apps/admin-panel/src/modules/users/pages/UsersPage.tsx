import React, { useState } from 'react';
import { Search, Filter, Eye, Ban, CheckCircle } from 'lucide-react';
import { trpc } from '@/lib/trpc';

export const UsersPage: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(1);
  const [roleFilter, setRoleFilter] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('');

  // Fetch users with tRPC
  const { data, isLoading, error, refetch } = trpc.users.list.useQuery({
    page,
    limit: 10,
    searchQuery: searchTerm || undefined,
    role: roleFilter || undefined,
    status: statusFilter || undefined,
  });

  const updateStatusMutation = trpc.users.updateStatus.useMutation({
    onSuccess: () => {
      refetch();
    },
  });

  const handleStatusUpdate = async (userId: string, newStatus: string) => {
    if (confirm(`Are you sure you want to ${newStatus.toLowerCase()} this user?`)) {
      await updateStatusMutation.mutateAsync({
        userId,
        newStatus: newStatus as any,
        reason: `Admin action: ${newStatus}`,
      });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900">Users</h1>
        <div className="text-sm text-gray-500">
          {data?.pagination && `${data.pagination.totalItems} total users`}
        </div>
      </div>

      <div className="card">
        <div className="flex items-center space-x-4 mb-6">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Search users by name or email..."
              className="input pl-10"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <select
            className="input"
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
          >
            <option value="">All Roles</option>
            <option value="CUSTOMER">Customer</option>
            <option value="PORTER">Porter</option>
          </select>
          <select
            className="input"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="">All Status</option>
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Inactive</option>
            <option value="SUSPENDED">Suspended</option>
          </select>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded mb-4">
            Error loading users: {error.message}
          </div>
        )}

        {isLoading ? (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
            <p className="mt-4 text-gray-500">Loading users...</p>
          </div>
        ) : data?.users.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            No users found. Try adjusting your filters.
          </div>
        ) : (
          <>
            <table className="table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th>Created</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {data?.users.map((user) => (
                  <tr key={user.id}>
                    <td className="font-medium">{user.name || 'N/A'}</td>
                    <td className="text-gray-600">{user.email}</td>
                    <td>
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                        user.role === 'PORTER' ? 'bg-green-100 text-green-600' : 'bg-blue-100 text-blue-600'
                      }`}>
                        {user.role}
                      </span>
                    </td>
                    <td>
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                        user.status === 'ACTIVE' ? 'bg-green-100 text-green-600' :
                        user.status === 'SUSPENDED' ? 'bg-red-100 text-red-600' :
                        'bg-gray-100 text-gray-600'
                      }`}>
                        {user.status}
                      </span>
                    </td>
                    <td className="text-gray-600 text-sm">
                      {new Date(user.createdAt).toLocaleDateString()}
                    </td>
                    <td>
                      <div className="flex items-center space-x-2">
                        <button
                          className="text-blue-600 hover:text-blue-700 p-1"
                          title="View Details"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        {user.status === 'ACTIVE' && (
                          <button
                            className="text-red-600 hover:text-red-700 p-1"
                            title="Suspend User"
                            onClick={() => handleStatusUpdate(user.id, 'SUSPENDED')}
                          >
                            <Ban className="w-4 h-4" />
                          </button>
                        )}
                        {user.status === 'SUSPENDED' && (
                          <button
                            className="text-green-600 hover:text-green-700 p-1"
                            title="Activate User"
                            onClick={() => handleStatusUpdate(user.id, 'ACTIVE')}
                          >
                            <CheckCircle className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Pagination */}
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
