# MoveNow Notification & Messaging Service

Centralized service for managing all notifications and messaging for the MoveNow platform, including real-time order updates, push notifications, in-app messages, and chat between customers and porters.

## Features

- **Multi-Channel Notifications**: Push (FCM/APNs), Email (SMTP), SMS (Twilio), In-App
- **Real-Time Chat**: Customer-Porter messaging with persistence and read receipts
- **Event-Driven Architecture**: Consumes events from RabbitMQ for order, bid, payment, and porter updates
- **Delivery Guarantees**: Automatic retries with exponential backoff
- **Deduplication**: Idempotency keys prevent duplicate notifications
- **Rate Limiting**: Per-user, per-channel rate limits
- **User Preferences**: Granular control over notification channels and types
- **Broadcast Messaging**: Admin platform-wide announcements
- **Audit Trail**: Complete delivery tracking and logs

## Architecture

```
┌─────────────┐     Events      ┌───────────────────────┐
│   Orders    │────────────────▶│                       │
│   Service   │                 │   RabbitMQ/Kafka      │
└─────────────┘                 │   Event Bus           │
                                │                       │
┌─────────────┐     Events      └──────────┬────────────┘
│   Bidding   │────────────────▶           │
│   Service   │                            │ Consume
└─────────────┘                            │ Events
                                           │
┌─────────────┐     Events                 ▼
│   Payment   │────────────────▶  ┌────────────────────┐
│   Service   │                   │   Notification     │
└─────────────┘                   │   Service          │
                                  │                    │
       tRPC Calls                 │  ┌──────────────┐  │
┌─────────────┐                   │  │   Event      │  │
│API Gateway  │◀─────────────────▶│  │   Consumer   │  │
└─────────────┘                   │  └──────────────┘  │
                                  │                    │
                                  │  ┌──────────────┐  │
                                  │  │  Delivery    │  │
                                  │  │  Service     │  │
                                  │  └──────────────┘  │
                                  │         │          │
                                  └─────────┼──────────┘
                                            │
                    ┌───────────────────────┼───────────────────────┐
                    │                       │                       │
                    ▼                       ▼                       ▼
            ┌──────────────┐       ┌──────────────┐       ┌──────────────┐
            │   Firebase   │       │     SMTP     │       │    Twilio    │
            │     FCM      │       │    Email     │       │     SMS      │
            └──────────────┘       └──────────────┘       └──────────────┘

Storage:
┌──────────────┐       ┌──────────────┐
│  PostgreSQL  │       │    Redis     │
│  (Messages)  │       │  (Cache &    │
│              │       │   Dedup)     │
└──────────────┘       └──────────────┘
```

## Tech Stack

- **Runtime**: Node.js 18+ with TypeScript
- **API**: tRPC for type-safe internal communication
- **Database**: PostgreSQL with Prisma ORM
- **Cache**: Redis for deduplication and rate limiting
- **Message Queue**: RabbitMQ for event consumption
- **Push Notifications**: Firebase Cloud Messaging (FCM)
- **Email**: Nodemailer with SMTP
- **SMS**: Twilio
- **Testing**: Jest
- **Deployment**: Docker + Kubernetes

## Getting Started

### Prerequisites

- Node.js 18+
- pnpm 8+
- PostgreSQL 15+
- Redis 7+
- RabbitMQ 3+
- (Optional) Firebase account for push notifications
- (Optional) SMTP server for email
- (Optional) Twilio account for SMS

### Installation

1. **Clone the repository and navigate to the service directory**:
   ```bash
   cd services/notification-service
   ```

2. **Install dependencies**:
   ```bash
   pnpm install
   ```

3. **Set up environment variables**:
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

4. **Generate Prisma client**:
   ```bash
   pnpm prisma:generate
   ```

5. **Run database migrations**:
   ```bash
   pnpm prisma:migrate
   ```

### Development

**Run with Docker Compose** (recommended):
```bash
pnpm docker:run
```

This starts PostgreSQL, Redis, RabbitMQ, and the notification service.

**Run locally**:
```bash
pnpm dev
```

The service will be available at `http://localhost:3005`.

### Testing

```bash
# Run all tests
pnpm test

# Watch mode
pnpm test:watch

# Coverage report
pnpm test:coverage
```

## Environment Variables

See `.env.example` for all available configuration options.

### Required Variables

```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/notification_service
REDIS_URL=redis://localhost:6379
RABBITMQ_URL=amqp://guest:guest@localhost:5672
EVENT_QUEUE_NAME=movenow.events
```

### Optional Integrations

**Firebase Cloud Messaging (Push Notifications)**:
```env
FCM_PROJECT_ID=your-project-id
FCM_CLIENT_EMAIL=your-service-account@project.iam.gserviceaccount.com
FCM_PRIVATE_KEY=your-private-key
```

**Email (SMTP)**:
```env
EMAIL_ENABLED=true
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
EMAIL_FROM=notifications@movenow.com
```

**SMS (Twilio)**:
```env
SMS_ENABLED=true
TWILIO_ACCOUNT_SID=your-account-sid
TWILIO_AUTH_TOKEN=your-auth-token
TWILIO_PHONE_NUMBER=+1234567890
```

## API Documentation

The service exposes a tRPC API at `/trpc` with the following routers:

### Notification Router

**`notification.send`** - Send notification to users
```typescript
input: {
  recipientId?: string;
  recipientIds?: string[];
  channels: ('push' | 'email' | 'sms')[];
  messageType: string;
  payload: object;
  priority?: 'low' | 'normal' | 'high' | 'urgent';
  idempotencyKey?: string;
}
output: {
  success: boolean;
  notifications: Array<{ notificationId: string; status: string }>;
}
```

**`notification.getHistory`** - Get notification history
```typescript
input: {
  userId: string;
  messageType?: string;
  status?: string;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
}
output: {
  notifications: Notification[];
  total: number;
}
```

**`notification.markAsRead`** - Mark notifications as read
```typescript
input: {
  notificationIds: string[];
}
output: {
  success: boolean;
  updatedCount: number;
}
```

### Messaging Router

**`messaging.sendMessage`** - Send in-app message
```typescript
input: {
  recipientId: string;
  content: string;
  messageType?: 'text' | 'image' | 'location' | 'system';
  relatedOrderId?: string;
}
output: {
  success: boolean;
  message: InAppMessage;
  conversationId: string;
}
```

**`messaging.getChatHistory`** - Get chat messages
```typescript
input: {
  conversationId?: string;
  otherUserId?: string;
  limit?: number;
  offset?: number;
}
output: {
  messages: InAppMessage[];
  total: number;
  conversationId: string;
}
```

**`messaging.markAsRead`** - Mark messages as read
```typescript
input: {
  conversationId?: string;
  messageIds?: string[];
}
output: {
  success: boolean;
  updatedCount: number;
}
```

### Preferences Router

**`preferences.get`** - Get user preferences
```typescript
output: UserPreferences
```

**`preferences.update`** - Update user preferences
```typescript
input: {
  pushEnabled?: boolean;
  emailEnabled?: boolean;
  smsEnabled?: boolean;
  orderUpdatesEnabled?: boolean;
  bidUpdatesEnabled?: boolean;
  chatMessagesEnabled?: boolean;
  quietHoursEnabled?: boolean;
  quietHoursStart?: string; // HH:mm
  quietHoursEnd?: string;   // HH:mm
}
output: {
  success: boolean;
  preferences: UserPreferences;
}
```

**`preferences.registerDeviceToken`** - Register device for push notifications
```typescript
input: {
  token: string;
  platform: 'ios' | 'android' | 'web';
  deviceInfo?: object;
}
output: {
  success: boolean;
  deviceToken: DeviceToken;
}
```

### Broadcast Router (Admin Only)

**`broadcast.send`** - Send platform-wide announcement
```typescript
input: {
  filters?: {
    roles?: string[];
    locations?: string[];
    userIds?: string[];
  };
  messageContent: {
    title: string;
    body: string;
  };
  channels: string[];
  priority?: string;
}
output: {
  success: boolean;
  recipientCount: number;
  notifications: Array<{ notificationId: string; status: string }>;
}
```

## Event Handling

The service consumes events from RabbitMQ and automatically sends notifications:

### Order Events
- `ORDER_CREATED` → Notify customer
- `ORDER_CONFIRMED` → Notify customer
- `ORDER_ASSIGNED` → Notify customer & porter
- `ORDER_STARTED` → Notify customer
- `ORDER_COMPLETED` → Notify customer & porter
- `ORDER_CANCELLED` → Notify customer & porter

### Bid Events
- `BID_RECEIVED` → Notify customer
- `BID_ACCEPTED` → Notify porter
- `BID_REJECTED` → Notify porter

### Payment Events
- `PAYMENT_COMPLETED` → Notify customer
- `PAYMENT_FAILED` → Notify customer

### Porter Events
- `PORTER_VERIFIED` → Notify porter
- `PORTER_ARRIVED` → Notify customer

## Database Schema

### Core Tables

- **Notification** - All notification records
- **InAppMessage** - Chat messages between users
- **Conversation** - Chat conversations
- **UserPreferences** - User notification preferences
- **DeviceToken** - Device tokens for push notifications
- **DeliveryAudit** - Delivery attempt logs
- **NotificationTemplate** - Reusable notification templates

See `prisma/schema.prisma` for full schema details.

## Deployment

### Docker

Build and run with Docker:
```bash
pnpm docker:build
pnpm docker:run
```

### Kubernetes

Deploy to Kubernetes:
```bash
# Create secrets (copy from template and fill in values)
cp k8s/secrets.yaml.template k8s/secrets.yaml
# Edit k8s/secrets.yaml with actual values
kubectl apply -f k8s/secrets.yaml

# Deploy service
kubectl apply -f k8s/configmap.yaml
kubectl apply -f k8s/deployment.yaml
kubectl apply -f k8s/service.yaml
kubectl apply -f k8s/hpa.yaml
```

## Monitoring & Observability

### Health Checks

- **Health endpoint**: `GET /health` - Basic service health
- **Readiness endpoint**: `GET /ready` - Database and Redis connectivity

### Metrics

The service emits the following metrics (compatible with Prometheus):

- `notifications_sent_total` - Total notifications sent
- `notifications_failed_total` - Total failed notifications
- `notification_delivery_duration_seconds` - Notification delivery latency
- `messages_sent_total` - Total in-app messages sent
- `active_conversations_total` - Number of active conversations
- `event_processing_duration_seconds` - Event processing latency

### Logs

Structured JSON logs include:
- `correlationId` - Request tracing ID
- `userId` - User ID for user-specific operations
- `notificationId` - Notification ID
- `messageType` - Type of notification/message
- `channel` - Delivery channel
- `status` - Operation status

## Development Guidelines

### Code Style

- Use TypeScript strict mode
- Follow ESLint rules
- Write tests for all business logic
- Use Zod schemas for input validation

### Adding New Notification Types

1. Add message type to `src/types/zodSchemas.ts`
2. Update templates in push/email/SMS services
3. Add event handler in `src/events/handlers/`
4. Write tests for new functionality

### Database Migrations

```bash
# Create a new migration
pnpm prisma migrate dev --name description-of-change

# Apply migrations in production
pnpm prisma migrate deploy
```

## Troubleshooting

### RabbitMQ Connection Issues

- Verify `RABBITMQ_URL` is correct
- Check RabbitMQ is running: `docker ps | grep rabbitmq`
- View RabbitMQ Management UI: `http://localhost:15672`

### Push Notifications Not Sending

- Verify Firebase credentials are set correctly
- Check device tokens are registered: `preferences.listDeviceTokens`
- Review logs for FCM errors

### Database Connection Errors

- Verify `DATABASE_URL` is correct
- Check PostgreSQL is running
- Run migrations: `pnpm prisma:migrate`

## License

MIT

## Contributing

1. Create a feature branch
2. Make your changes
3. Write tests
4. Submit a pull request

## Support

For issues or questions, please open an issue on GitHub.
