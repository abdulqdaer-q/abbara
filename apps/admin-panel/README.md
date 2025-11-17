# MoveNow Admin Panel

Web-based admin dashboard for managing the MoveNow platform.

## Features

- **Dashboard**: Overview of key metrics and recent activity
- **User Management**: Manage customers and porters
- **Order Management**: View, filter, and manage orders
- **Vehicle & Pricing**: Configure vehicle types and pricing
- **Promo Codes**: Create and manage promotional codes
- **Analytics**: Platform analytics and reporting
- **Settings**: Configure platform settings

## Tech Stack

- React 18
- TypeScript
- Vite
- TailwindCSS
- Redux Toolkit
- React Router v6
- React Query
- Recharts
- Lucide Icons

## Getting Started

### Prerequisites

- Node.js 18+
- pnpm

### Installation

```bash
# Install dependencies
pnpm install

# Start development server
pnpm dev

# Build for production
pnpm build

# Preview production build
pnpm preview
```

## Project Structure

```
src/
├── components/       # Reusable components
│   ├── layout/      # Layout components (Sidebar, Header)
│   ├── common/      # Common UI components
│   └── ui/          # UI primitives
├── modules/          # Feature modules
│   ├── dashboard/   # Dashboard module
│   ├── users/       # User management
│   ├── orders/      # Order management
│   ├── vehicles/    # Vehicle & pricing
│   ├── promos/      # Promo codes
│   ├── analytics/   # Analytics
│   └── settings/    # Settings
├── services/        # API services
├── store/           # Redux store
├── hooks/           # Custom hooks
├── utils/           # Utility functions
└── types/           # TypeScript types
```

## Available Scripts

- `pnpm dev` - Start development server (port 3001)
- `pnpm build` - Build for production
- `pnpm preview` - Preview production build
- `pnpm test` - Run tests
- `pnpm lint` - Lint code

## Environment Variables

Configure backend API endpoint in `.env`:

```
VITE_API_URL=http://localhost:3000
```
