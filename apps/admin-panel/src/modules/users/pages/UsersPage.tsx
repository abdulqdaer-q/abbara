import React, { useState } from 'react';
import { Search, Filter } from 'lucide-react';

const mockUsers = [
  { id: '1', name: 'John Doe', email: 'john@example.com', role: 'CUSTOMER', status: 'Active' },
  { id: '2', name: 'Jane Smith', email: 'jane@example.com', role: 'PORTER', status: 'Active' },
  { id: '3', name: 'Bob Wilson', email: 'bob@example.com', role: 'CUSTOMER', status: 'Inactive' },
];

export const UsersPage: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900">Users</h1>
        <button className="btn btn-primary">Add User</button>
      </div>

      <div className="card">
        <div className="flex items-center space-x-4 mb-6">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Search users..."
              className="input pl-10"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <button className="btn btn-secondary flex items-center">
            <Filter className="w-4 h-4 mr-2" />
            Filters
          </button>
        </div>

        <table className="table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Role</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {mockUsers.map((user) => (
              <tr key={user.id}>
                <td className="font-medium">{user.name}</td>
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
                    user.status === 'Active' ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-600'
                  }`}>
                    {user.status}
                  </span>
                </td>
                <td>
                  <button className="text-primary-600 hover:text-primary-700 font-medium text-sm">
                    View Details
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
