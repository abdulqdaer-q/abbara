# MoveNow Frontend Sequence Diagrams

## 1. Order Creation Flow (Customer App)

```mermaid
sequenceDiagram
    participant C as Customer App
    participant API as API Gateway
    participant OS as Order Service
    participant NS as Notification Service
    participant Socket as Socket.io Server
    participant P as Porter App

    C->>C: User fills order form
    C->>API: POST /orders/createOrder
    API->>OS: Create order
    OS->>OS: Calculate pricing
    OS->>OS: Find available porters
    OS-->>API: Order created
    API-->>C: Order details + orderId

    C->>C: Update Redux state
    C->>C: Navigate to tracking screen

    OS->>Socket: Emit order.created
    Socket->>P: Send job request
    P->>P: Show notification
    P->>P: Add to job requests list

    OS->>NS: Send notification
    NS->>C: Push notification
```

## 2. Porter Job Acceptance Flow

```mermaid
sequenceDiagram
    participant P as Porter App
    participant API as API Gateway
    participant OS as Order Service
    participant Socket as Socket.io Server
    participant C as Customer App

    P->>P: Porter views job details
    P->>API: POST /orders/acceptJob
    API->>OS: Assign porter to order
    OS->>OS: Update order status
    OS-->>API: Order assigned
    API-->>P: Assignment confirmed

    P->>P: Update Redux state
    P->>P: Set as active job
    P->>P: Navigate to navigation screen

    OS->>Socket: Emit order.assigned
    Socket->>C: Porter assigned event
    C->>C: Update order status
    C->>C: Show porter details
    C->>C: Enable chat button
```

## 3. Real-time Location Tracking

```mermaid
sequenceDiagram
    participant P as Porter App
    participant Socket as Socket.io Server
    participant C as Customer App

    loop Every 10 seconds
        P->>P: Get current location
        P->>Socket: Emit porter.location.updated
        Socket->>C: Forward location update
        C->>C: Update map marker
    end

    Note over P,C: Continues until order completed
```

## 4. In-app Chat Flow

```mermaid
sequenceDiagram
    participant C as Customer App
    participant Socket as Socket.io Server
    participant P as Porter App
    participant DB as Database

    C->>Socket: Send chat message
    Socket->>DB: Store message
    Socket->>P: Forward message
    P->>P: Display message
    P->>P: Show notification (if background)

    P->>Socket: Mark as read
    Socket->>C: Read receipt
    C->>C: Update message status
```

## 5. Order Completion & Rating

```mermaid
sequenceDiagram
    participant P as Porter App
    participant API as API Gateway
    participant OS as Order Service
    participant PS as Payment Service
    participant Socket as Socket.io Server
    participant C as Customer App

    P->>API: POST /orders/completeOrder
    API->>OS: Mark order as completed
    OS->>PS: Process payment
    PS-->>OS: Payment completed
    OS-->>API: Order completed
    API-->>P: Success

    P->>P: Add to completed jobs
    P->>P: Update earnings

    OS->>Socket: Emit order.completed
    Socket->>C: Order completed event
    C->>C: Update order status
    C->>C: Show rating screen

    C->>API: POST /ratings/submitRating
    API->>OS: Store rating
```

## 6. Admin User Management Flow

```mermaid
sequenceDiagram
    participant A as Admin Panel
    participant API as API Gateway
    participant US as Users Service
    participant NS as Notification Service

    A->>API: GET /users/getUsers
    API->>US: Fetch users list
    US-->>API: Users data
    API-->>A: Users list
    A->>A: Display in table

    A->>A: Admin selects user
    A->>API: GET /users/getUserDetails
    API->>US: Fetch user details
    US-->>API: User details
    API-->>A: User data

    A->>A: Admin updates user
    A->>API: PUT /users/updateUser
    API->>US: Update user
    US-->>API: Updated user
    API-->>A: Success

    US->>NS: Send notification to user
    NS->>User: Email/Push notification
```

## 7. Porter Verification Flow

```mermaid
sequenceDiagram
    participant P as Porter App
    participant API as API Gateway
    participant US as Users Service
    participant Storage as File Storage
    participant Socket as Socket.io Server
    participant A as Admin Panel

    P->>P: Porter uploads documents
    P->>API: POST /upload/document
    API->>Storage: Store document
    Storage-->>API: Document URL
    API->>US: Save document reference
    US-->>API: Saved
    API-->>P: Upload success

    P->>API: POST /porters/requestVerification
    API->>US: Create verification request
    US-->>API: Request created
    API-->>P: Request submitted

    US->>Socket: Emit verification.requested
    Socket->>A: New verification request
    A->>A: Show notification

    A->>API: GET /porters/getVerificationRequests
    API->>US: Fetch requests
    US-->>API: Requests list
    API-->>A: Display requests

    A->>API: POST /porters/approveVerification
    API->>US: Approve porter
    US-->>API: Approved
    API-->>A: Success

    US->>Socket: Emit porter.verified
    Socket->>P: Verification approved
    P->>P: Update porter status
    P->>P: Enable online toggle
```

## 8. Vehicle & Pricing Management

```mermaid
sequenceDiagram
    participant A as Admin Panel
    participant API as API Gateway
    participant VS as Vehicle Service

    A->>API: GET /vehicles/getVehicles
    API->>VS: Fetch vehicles
    VS-->>API: Vehicles list
    API-->>A: Display vehicles

    A->>A: Admin creates new vehicle type
    A->>API: POST /vehicles/createVehicle
    API->>VS: Create vehicle
    VS->>VS: Set base price
    VS->>VS: Set per-km price
    VS-->>API: Vehicle created
    API-->>A: Success

    A->>A: Admin updates pricing
    A->>API: PUT /vehicles/updatePricing
    API->>VS: Update vehicle pricing
    VS-->>API: Updated
    API-->>A: Success
```

## 9. Promo Code Creation & Usage

```mermaid
sequenceDiagram
    participant A as Admin Panel
    participant API as API Gateway
    participant PS as Promo Service
    participant C as Customer App
    participant OS as Order Service

    A->>API: POST /promos/createPromo
    API->>PS: Create promo code
    PS->>PS: Set discount rules
    PS->>PS: Set usage limits
    PS-->>API: Promo created
    API-->>A: Success

    Note over C: Later, customer creates order

    C->>C: Enter promo code
    C->>API: POST /promos/validatePromo
    API->>PS: Validate code
    PS->>PS: Check if valid
    PS->>PS: Check usage limit
    PS-->>API: Validation result
    API-->>C: Discount amount

    C->>API: POST /orders/createOrder (with promo)
    API->>OS: Create order
    OS->>PS: Apply discount
    PS->>PS: Increment usage count
    OS->>OS: Calculate final price
    OS-->>API: Order created
    API-->>C: Order details
```

## 10. Analytics Data Flow

```mermaid
sequenceDiagram
    participant A as Admin Panel
    participant API as API Gateway
    participant AS as Analytics Service
    participant OS as Order Service
    participant US as Users Service

    A->>API: GET /analytics/getDashboardStats

    par Fetch multiple metrics
        API->>US: Get user stats
        US-->>API: User counts
    and
        API->>OS: Get order stats
        OS-->>API: Order metrics
    and
        API->>AS: Get revenue stats
        AS-->>API: Revenue data
    end

    API->>AS: Aggregate data
    AS->>AS: Calculate trends
    AS->>AS: Generate charts data
    AS-->>API: Analytics payload
    API-->>A: Dashboard data

    A->>A: Render charts
    A->>A: Display KPIs
```
