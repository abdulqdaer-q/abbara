import {
  UserCreatedEvent,
  UserUpdatedEvent,
  PorterVerificationRequestedEvent,
  PorterVerifiedEvent,
  EventType,
  UserRole,
  VerificationStatus,
} from '@movenow/common';

/**
 * Create UserCreated event
 */
export function createUserCreatedEvent(params: {
  userId: string;
  email?: string;
  phone?: string;
  role: UserRole;
  createdAt: Date;
  correlationId: string;
}): UserCreatedEvent {
  return {
    type: EventType.USER_CREATED,
    userId: params.userId,
    email: params.email,
    phone: params.phone,
    role: params.role,
    createdAt: params.createdAt,
    timestamp: new Date(),
    correlationId: params.correlationId,
  };
}

/**
 * Create UserUpdated event
 */
export function createUserUpdatedEvent(params: {
  userId: string;
  updatedFields: string[];
  updatedAt: Date;
  correlationId: string;
}): UserUpdatedEvent {
  return {
    type: EventType.USER_UPDATED,
    userId: params.userId,
    updatedFields: params.updatedFields,
    updatedAt: params.updatedAt,
    timestamp: new Date(),
    correlationId: params.correlationId,
  };
}

/**
 * Create PorterVerificationRequested event
 */
export function createPorterVerificationRequestedEvent(params: {
  userId: string;
  porterId: string;
  correlationId: string;
}): PorterVerificationRequestedEvent {
  return {
    type: EventType.PORTER_VERIFICATION_REQUESTED,
    userId: params.userId,
    porterId: params.porterId,
    timestamp: new Date(),
    correlationId: params.correlationId,
  };
}

/**
 * Create PorterVerified event
 */
export function createPorterVerifiedEvent(params: {
  userId: string;
  porterId: string;
  verifiedBy: string;
  correlationId: string;
}): PorterVerifiedEvent {
  return {
    type: EventType.PORTER_VERIFIED,
    userId: params.userId,
    porterId: params.porterId,
    verifiedBy: params.verifiedBy,
    timestamp: new Date(),
    correlationId: params.correlationId,
  };
}
