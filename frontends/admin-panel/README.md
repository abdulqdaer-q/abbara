# MoveNow Admin Panel

The web-based administrative dashboard for the MoveNow porter platform, built with React, TypeScript, and Material-UI.

## Features

### 🔐 Authentication
- ✅ Admin login with email/password
- ✅ Role-based access control (ADMIN only)
- ✅ JWT token authentication
- ⏳ Two-factor authentication

### 👥 User Management
- ⏳ View all users (customers & porters)
- ⏳ Search and filter users
- ⏳ View user details and activity
- ⏳ Suspend/activate user accounts
- ⏳ Update user roles
- ⏳ Audit logs for admin actions

### 🚚 Porter Management
- ⏳ Porter verification queue
- ⏳ Review verification documents
- ⏳ Approve/reject porter applications
- ⏳ View porter ratings and performance
- ⏳ Manage porter status (active/inactive)
- ⏳ Assign/unassign porters to orders

### 📦 Order Management
- ⏳ View all orders with filters
- ⏳ Search orders by ID, customer, porter, or location
- ⏳ Order details view
- ⏳ Reassign porters
- ⏳ Cancel orders on behalf of users
- ⏳ Order analytics and export

### 🚗 Vehicle & Pricing Management
- ⏳ Manage vehicle types
- ⏳ Set base pricing and surge multipliers
- ⏳ Configure distance-based pricing
- ⏳ Peak hours pricing rules

### 🎟️ Promo Code Management
- ⏳ Create/edit/disable promo codes
- ⏳ Set eligibility and usage limits
- ⏳ Track promo code usage
- ⏳ Promo code analytics

### 📊 Analytics & Reporting
- ✅ Dashboard with key metrics
- ⏳ Revenue analytics
- ⏳ Order completion rates
- ⏳ Porter performance metrics
- ⏳ Customer satisfaction scores
- ⏳ Export reports (CSV, PDF)

### 🔔 Notifications & Announcements
- ⏳ Send platform-wide notifications
- ⏳ Targeted notifications (customers/porters)
- ⏳ Notification templates
- ⏳ Schedule notifications

### ⚙️ Platform Settings
- ⏳ System configuration
- ⏳ Loyalty points settings
- ⏳ Commission rates
- ⏳ Cancellation policies
- ⏳ Service area management

## Tech Stack

- **Framework**: React 18
- **Build Tool**: Vite
- **Language**: TypeScript
- **Routing**: React Router 6
- **State Management**: Zustand
- **API Client**: tRPC + React Query
- **UI Library**: Material-UI (MUI) 5
- **Charts**: Recharts
- **Date Handling**: date-fns

## Project Structure

```
admin-panel/
├── index.html                   # HTML entry point
├── vite.config.ts              # Vite configuration
├── package.json                # Dependencies
├── tsconfig.json               # TypeScript config
├── .env.example                # Environment variables example
├── src/
│   ├── main.tsx                # App entry point
│   ├── App.tsx                 # Main app component
│   ├── index.css               # Global styles
│   ├── components/             # Reusable components
│   │   ├── DashboardLayout.tsx # Main layout with sidebar
│   │   └── ...                 # Other components
│   ├── pages/                  # Page components
│   │   ├── LoginPage.tsx       # Login page
│   │   ├── DashboardPage.tsx   # Dashboard/home page
│   │   ├── UsersPage.tsx       # User management
│   │   ├── PortersPage.tsx     # Porter management
│   │   ├── OrdersPage.tsx      # Order management
│   │   └── AnalyticsPage.tsx   # Analytics & reports
│   ├── services/               # External service integrations
│   │   └── trpc.ts             # tRPC client
│   ├── store/                  # Global state management
│   │   └── useAuthStore.ts     # Auth state
│   ├── hooks/                  # Custom React hooks
│   ├── utils/                  # Utility functions
│   └── types/                  # TypeScript type definitions
└── public/                     # Static assets
```

## Installation & Setup

### Prerequisites

- Node.js 20+
- npm or pnpm

### Steps

1. **Install dependencies**:
   ```bash
   cd frontends/admin-panel
   npm install
   ```

2. **Configure environment variables**:
   ```bash
   cp .env.example .env
   ```

   Edit `.env`:
   ```env
   VITE_API_GATEWAY_URL=http://localhost:3000
   VITE_WEBSOCKET_URL=ws://localhost:3007
   VITE_APP_ENV=development
   ```

3. **Start the development server**:
   ```bash
   npm run dev
   ```

4. **Access the app**:
   Open [http://localhost:5173](http://localhost:5173)

## Development

### Running the app

```bash
# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

### Type checking

```bash
npm run type-check
```

### Linting

```bash
npm run lint
```

## Admin Authentication

Only users with the `ADMIN` role can access the admin panel. Attempting to login with a customer or porter account will be rejected.

### Creating an Admin User

Use the backend API to create an admin user:

```bash
# Via tRPC or direct database insert
# See backend documentation for details
```

## API Integration

The admin panel uses tRPC for type-safe API communication with the backend.

### Available Admin Routes

**User Management**:
- `admin.getUser` - Get user details
- `admin.listUsers` - List all users with filters
- `admin.updateUserRole` - Update user role
- `admin.suspendUser` - Suspend user account
- `admin.activateUser` - Activate user account

**Porter Management**:
- `porters.listByStatus` - Get porters by verification status
- `porters.updateVerificationStatus` - Approve/reject porter
- `admin.assignPorter` - Assign porter to order

**Order Management**:
- `admin.listOrders` - Get all orders with filters
- `admin.getOrderDetails` - Get order details
- `admin.cancelOrder` - Cancel order
- `admin.reassignPorter` - Reassign porter to order

**Analytics**:
- `admin.getSystemStats` - Get system statistics
- `admin.getRevenueStats` - Get revenue analytics
- `admin.getPorterPerformance` - Get porter metrics

**Configuration**:
- `admin.updatePricing` - Update pricing rules
- `admin.managePro moCode` - Manage promo codes
- `admin.updateSettings` - Update system settings

### Example Usage

```tsx
import { trpc } from './services/trpc';

function UsersPage() {
  const { data: users, isLoading } = trpc.admin.listUsers.useQuery({
    role: 'CUSTOMER',
    page: 1,
    limit: 20,
  });

  return (
    <div>
      {isLoading ? 'Loading...' : users?.map(user => (
        <div key={user.id}>{user.displayName}</div>
      ))}
    </div>
  );
}
```

## State Management

### Auth Store (`useAuthStore`)

```typescript
const {
  user,              // Current admin user
  isAuthenticated,   // Auth status
  isLoading,         // Loading state
  setUser,           // Set user
  logout,            // Logout function
} = useAuthStore();
```

## Dashboard Features

### Statistics Cards

The dashboard displays key metrics:
- Total users (customers)
- Active porters
- Total orders
- Platform revenue

### Charts & Analytics

- Order trends (line chart)
- Revenue by period (bar chart)
- Porter performance (table)
- Customer satisfaction (metrics)

## Building for Production

```bash
# Build
npm run build

# The build output will be in the `dist` folder

# Preview the production build locally
npm run preview
```

## Deployment

The admin panel is a static site that can be deployed to:

- **Vercel**: `vercel --prod`
- **Netlify**: `netlify deploy --prod`
- **AWS S3 + CloudFront**: Upload `dist` folder
- **Custom server**: Serve `dist` folder with nginx/apache

### Nginx Configuration Example

```nginx
server {
    listen 80;
    server_name admin.movenow.com;
    root /var/www/admin-panel/dist;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location /trpc {
        proxy_pass http://localhost:3000/trpc;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

## Environment Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `VITE_API_GATEWAY_URL` | Backend API Gateway URL | `http://localhost:3000` |
| `VITE_WEBSOCKET_URL` | WebSocket server URL | `ws://localhost:3007` |
| `VITE_APP_ENV` | App environment | `development` |

## Security Considerations

1. **Role-Based Access**: Only ADMIN users can access
2. **Token Expiration**: Automatic logout on token expiry
3. **HTTPS**: Use HTTPS in production
4. **CORS**: Configure CORS on backend
5. **CSP**: Configure Content Security Policy
6. **Rate Limiting**: API rate limiting on backend

## Future Enhancements

- [ ] Advanced user search and filters
- [ ] Bulk operations (suspend multiple users)
- [ ] Real-time notifications for admins
- [ ] Audit log viewer
- [ ] Data export (CSV, PDF)
- [ ] Custom report builder
- [ ] Heat maps for order density
- [ ] Porter ranking system
- [ ] Automated fraud detection
- [ ] A/B testing dashboard
- [ ] Email campaign management
- [ ] SMS notification management
- [ ] Multi-language support
- [ ] Dark mode
- [ ] Mobile responsive improvements

## Troubleshooting

### Common Issues

1. **Cannot login**:
   - Ensure user has ADMIN role
   - Check API Gateway is running
   - Verify VITE_API_GATEWAY_URL is correct

2. **CORS errors**:
   - Configure CORS on API Gateway
   - Add admin panel URL to CORS_ORIGIN

3. **Build fails**:
   ```bash
   rm -rf node_modules dist
   npm install
   npm run build
   ```

## Contributing

1. Follow the existing code structure
2. Use TypeScript for all files
3. Follow Material-UI best practices
4. Write tests for new features
5. Update documentation

## License

Proprietary - MoveNow Platform
