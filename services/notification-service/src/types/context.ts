import { PrismaClient } from '@prisma/client';
import { Logger } from 'winston';

export interface User {
  id: string;
  email: string;
  role: string;
}

export interface Context {
  user: User | null;
  correlationId: string;
  logger: Logger;
  db: PrismaClient;
}
