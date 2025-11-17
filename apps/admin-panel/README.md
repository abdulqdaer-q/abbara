# MoveNow Admin Panel

A comprehensive, production-ready admin dashboard for the MoveNow platform. Built with React, TypeScript, Redux, TailwindCSS, and tRPC.

## Features

### 📊 **Dashboard**
- Real-time analytics and system health monitoring
- Key metrics: total users, orders, revenue, and pending verifications
- Quick stats overview with visual indicators
- System health status for all services

### 👥 **User Management**
- List all users with advanced filtering (role, status, search)
- View detailed user information
- Update user status (activate, suspend)
- Pagination support for large datasets

### 📦 **Orders Management**
- View all orders with status filtering
- Track order lifecycle from pending to completed
- Admin intervention capabilities
- Pagination and search functionality

### 🚚 **Porter Verification**
- Review pending porter documents
- Approve or reject verification requests
- Document type tracking
- Review notes and audit trail

### 🚗 **Vehicle Types**
- Manage vehicle type configurations
- Set pricing multipliers and max load capacity
- Full CRUD operations

### 🎟️ **Promo Codes**
- Create and manage promotional codes
- Track usage and limits
- Set validity periods
- Support for percentage and fixed discounts

### ⚙️ **Platform Settings**
- Configure system-wide settings
- Real-time updates with versioning
- Audit trail for all changes

## Tech Stack

- React 18 + TypeScript
- Redux Toolkit for state management
- tRPC + React Query for API
- TailwindCSS for styling
- Vite for build tooling

## Getting Started

```bash
cd apps/admin-panel
npm install
npm run dev
```

Login with any email containing "admin" (e.g., admin@movenow.com)

## License

MIT
