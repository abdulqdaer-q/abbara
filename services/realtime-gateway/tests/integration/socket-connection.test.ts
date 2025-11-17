import { io as ioClient, Socket } from 'socket.io-client';
import { authService } from '../../src/services/auth.service';
import { SocketEvent } from '@movenow/common';

describe('Socket Connection Integration', () => {
  let clientSocket: Socket;
  const serverUrl = 'http://localhost:3002';

  afterEach(() => {
    if (clientSocket && clientSocket.connected) {
      clientSocket.disconnect();
    }
  });

  describe('Authentication', () => {
    it('should reject connection without token', (done) => {
      clientSocket = ioClient(`${serverUrl}/client`);

      clientSocket.on('connect_error', (error) => {
        expect(error.message).toContain('Authentication');
        done();
      });
    });

    it('should reject connection with invalid token', (done) => {
      clientSocket = ioClient(`${serverUrl}/client`, {
        auth: {
          token: 'invalid.token.here',
        },
      });

      clientSocket.on('connect_error', (error) => {
        expect(error.message).toContain('Invalid token');
        done();
      });
    });

    it('should accept connection with valid token', (done) => {
      const token = authService.generateSocketToken('test-user-123', 'CUSTOMER');

      clientSocket = ioClient(`${serverUrl}/client`, {
        auth: { token },
      });

      clientSocket.on(SocketEvent.AUTHENTICATED, (response) => {
        expect(response.success).toBe(true);
        expect(response.userId).toBe('test-user-123');
        expect(response.role).toBe('CUSTOMER');
        done();
      });
    });
  });

  describe('Heartbeat', () => {
    it('should respond to heartbeat', (done) => {
      const token = authService.generateSocketToken('test-user-456', 'CUSTOMER');

      clientSocket = ioClient(`${serverUrl}/client`, {
        auth: { token },
      });

      clientSocket.on('connect', () => {
        clientSocket.emit(SocketEvent.HEARTBEAT, {
          timestamp: Date.now(),
        });

        clientSocket.on(SocketEvent.HEARTBEAT, (response) => {
          expect(response.timestamp).toBeDefined();
          done();
        });
      });
    });
  });

  describe('Porter namespace', () => {
    it('should allow porter to connect to porter namespace', (done) => {
      const token = authService.generateSocketToken('porter-123', 'PORTER');

      clientSocket = ioClient(`${serverUrl}/porter`, {
        auth: { token },
      });

      clientSocket.on(SocketEvent.AUTHENTICATED, (response) => {
        expect(response.success).toBe(true);
        expect(response.role).toBe('PORTER');
        done();
      });
    });
  });

  describe('Disconnection', () => {
    it('should handle graceful disconnection', (done) => {
      const token = authService.generateSocketToken('test-user-789', 'CUSTOMER');

      clientSocket = ioClient(`${serverUrl}/client`, {
        auth: { token },
      });

      clientSocket.on('connect', () => {
        clientSocket.disconnect();
      });

      clientSocket.on('disconnect', (reason) => {
        expect(reason).toBeDefined();
        done();
      });
    });
  });
});

// Note: These tests require the server to be running
// Run with: NODE_ENV=test npm run dev (in one terminal)
// Then: npm test (in another terminal)
