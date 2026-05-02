import {
  WebSocketGateway,
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import Redis from 'ioredis';
import * as winston from 'winston';
import { configuration } from '../config/configuration';
import { validateWebSocketMessage } from './message-validator';

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json(),
  ),
  defaultMeta: { serviceName: 'api-gateway' },
  transports: [new winston.transports.Console()],
});

/**
 * NestJS WebSocket gateway that manages client connections and session state.
 *
 * Session storage strategy:
 *   1. Primary: Redis — sessions stored as `session:{clientId}` with configurable TTL.
 *   2. Fallback: In-memory Map — used when Redis is unavailable; a degraded-mode
 *      warning is logged once per Redis failure event.
 */
@WebSocketGateway({ cors: { origin: '*' } })
export class WebsocketGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server!: Server;

  /** In-memory fallback session store: clientId → connection timestamp */
  private readonly inMemorySessions = new Map<string, string>();

  /** Whether Redis is currently reachable */
  private redisAvailable = true;

  private readonly redis: Redis;
  private readonly sessionTtl: number;

  constructor() {
    const config = configuration();
    this.sessionTtl = config.sessionTtl;

    this.redis = new Redis(config.redisUrl, {
      // Disable auto-reconnect retries that would block startup
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
    });

    this.redis.on('error', (err: Error) => {
      if (this.redisAvailable) {
        this.redisAvailable = false;
        logger.warn({
          message:
            'Redis unavailable — switching to in-memory session fallback (degraded mode)',
          errorMessage: err.message,
        });
      }
    });

    this.redis.on('connect', () => {
      if (!this.redisAvailable) {
        this.redisAvailable = true;
        logger.info({ message: 'Redis reconnected — resuming Redis session storage' });
      }
    });

    // Attempt connection; errors are handled by the 'error' listener above
    this.redis.connect().catch(() => {
      // Handled by the 'error' event listener
    });
  }

  /**
   * Called by Socket.io when a new client connects.
   * Registers the session in Redis (or in-memory fallback) with a TTL.
   */
  async handleConnection(client: Socket): Promise<void> {
    const sessionKey = `session:${client.id}`;
    const connectedAt = new Date().toISOString();

    if (this.redisAvailable) {
      try {
        await this.redis.set(sessionKey, connectedAt, 'EX', this.sessionTtl);
        logger.info({
          message: 'WebSocket client connected — session registered in Redis',
          clientId: client.id,
          sessionKey,
          ttl: this.sessionTtl,
        });
        return;
      } catch (err) {
        this.redisAvailable = false;
        logger.warn({
          message:
            'Redis write failed — switching to in-memory session fallback (degraded mode)',
          clientId: client.id,
          errorMessage: err instanceof Error ? err.message : String(err),
        });
      }
    }

    // In-memory fallback
    this.inMemorySessions.set(client.id, connectedAt);
    logger.info({
      message: 'WebSocket client connected — session registered in memory (degraded mode)',
      clientId: client.id,
    });
  }

  /**
   * Called by Socket.io when a client disconnects.
   * Removes the session from Redis (or in-memory fallback).
   */
  async handleDisconnect(client: Socket): Promise<void> {
    const sessionKey = `session:${client.id}`;

    if (this.redisAvailable) {
      try {
        await this.redis.del(sessionKey);
        logger.info({
          message: 'WebSocket client disconnected — session removed from Redis',
          clientId: client.id,
          sessionKey,
        });
        return;
      } catch (err) {
        logger.warn({
          message: 'Redis delete failed during disconnect — removing from in-memory store',
          clientId: client.id,
          errorMessage: err instanceof Error ? err.message : String(err),
        });
      }
    }

    // In-memory fallback
    this.inMemorySessions.delete(client.id);
    logger.info({
      message: 'WebSocket client disconnected — session removed from memory (degraded mode)',
      clientId: client.id,
    });
  }

  /**
   * Handles all incoming messages from WebSocket clients.
   *
   * Validates the message structure. If the message is invalid, the connection
   * is closed with error code 4000 and the session is removed from the registry.
   *
   * @param message - The raw incoming message payload.
   * @param client  - The Socket.io client that sent the message.
   */
  @SubscribeMessage('message')
  async handleMessage(
    @MessageBody() message: unknown,
    @ConnectedSocket() client: Socket,
  ): Promise<void> {
    if (!validateWebSocketMessage(message)) {
      logger.warn({
        message: 'Invalid WebSocket message received — closing connection',
        clientId: client.id,
        receivedPayload: message,
      });

      // Remove session from registry before disconnecting
      const sessionKey = `session:${client.id}`;
      if (this.redisAvailable) {
        try {
          await this.redis.del(sessionKey);
        } catch (err) {
          logger.warn({
            message: 'Redis delete failed while handling invalid message — removing from in-memory store',
            clientId: client.id,
            errorMessage: err instanceof Error ? err.message : String(err),
          });
          this.inMemorySessions.delete(client.id);
        }
      } else {
        this.inMemorySessions.delete(client.id);
      }

      // Close the connection with error code 4000 (application-level invalid message)
      client.disconnect(true);
    }
  }

  /**
   * Broadcasts a message to all currently connected WebSocket clients.
   *
   * @param message - Any JSON-serializable payload to broadcast.
   */
  broadcastToAllClients(message: unknown): void {
    this.server.emit('message', message);
    logger.info({
      message: 'Broadcast sent to all connected clients',
      payload: message,
    });
  }
}
