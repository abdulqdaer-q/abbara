import { config } from '../config';

export type LogLevel = 'error' | 'warn' | 'info' | 'debug';

interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: string;
  service: string;
  correlationId?: string;
  userId?: string;
  [key: string]: any;
}

const LOG_LEVELS: Record<LogLevel, number> = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3,
};

class Logger {
  private currentLevel: number;

  constructor() {
    this.currentLevel = LOG_LEVELS[config.LOG_LEVEL] || LOG_LEVELS.info;
  }

  private log(level: LogLevel, message: string, meta?: Record<string, any>): void {
    if (LOG_LEVELS[level] > this.currentLevel) {
      return;
    }

    const entry: LogEntry = {
      level,
      message,
      timestamp: new Date().toISOString(),
      service: config.SERVICE_NAME,
      ...meta,
    };

    const output = JSON.stringify(entry);

    if (level === 'error') {
      console.error(output);
    } else if (level === 'warn') {
      console.warn(output);
    } else {
      console.log(output);
    }
  }

  error(message: string, meta?: Record<string, any>): void {
    this.log('error', message, meta);
  }

  warn(message: string, meta?: Record<string, any>): void {
    this.log('warn', message, meta);
  }

  info(message: string, meta?: Record<string, any>): void {
    this.log('info', message, meta);
  }

  debug(message: string, meta?: Record<string, any>): void {
    this.log('debug', message, meta);
  }
}

export const logger = new Logger();
