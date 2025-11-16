import React from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { LogOut, Bell } from 'lucide-react';
import { RootState } from '@/store';
import { logout } from '@/store/slices/authSlice';

export const Header: React.FC = () => {
  const dispatch = useDispatch();
  const user = useSelector((state: RootState) => state.auth.user);

  const handleLogout = () => {
    dispatch(logout());
  };

  return (
    <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-6">
      <div className="text-xl font-semibold text-gray-800">Admin Panel</div>
      <div className="flex items-center space-x-4">
        <button className="p-2 hover:bg-gray-100 rounded-lg">
          <Bell className="w-5 h-5 text-gray-600" />
        </button>
        <div className="flex items-center space-x-3">
          <div className="text-right">
            <p className="text-sm font-medium text-gray-900">{user?.name}</p>
            <p className="text-xs text-gray-500">{user?.role}</p>
          </div>
          <button
            onClick={handleLogout}
            className="p-2 hover:bg-gray-100 rounded-lg text-red-600"
            title="Logout"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </div>
    </header>
  );
};
