import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { Kafka, Consumer, EachMessagePayload } from 'kafkajs';
import * as winston from 'winston';
import { configuration } from '../config/configuration';
import { WebsocketGateway } from '../websocket/websocket.gateway';

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json(),
  ),
  defaultMeta: { serviceName: 'api-gateway', module: 'KafkaConsumerService' },
  transports: [new winston.transports.Console()],
});

/**
 * NestJS service that consumes messages from the `predictions` Kafka topic
 * and broadcasts each message to all connected WebSocket clients.
 *
 * Lifecycle:
 *   - onModuleInit: connects to Kafka and starts consuming
 *   - onModuleDestroy: gracefully disconnects the consumer
 */
@Injectable()
export class KafkaConsumerService implements OnModuleInit, OnModuleDestroy {
  private readonly consumer: Consumer;

  constructor(private readonly websocketGateway: WebsocketGateway) {
    const config = configuration();

    const kafka = new Kafka({
      clientId: 'api-gateway-consumer',
      brokers: config.kafkaBrokers,
    });

    this.consumer = kafka.consumer({ groupId: 'api-gateway-predictions-group' });
  }

  async onModuleInit(): Promise<void> {
    try {
      await this.consumer.connect();
      logger.info({ message: 'Kafka consumer connected' });

      await this.consumer.subscribe({
        topic: 'predictions',
        fromBeginning: false,
      });
      await this.consumer.subscribe({
        topic: 'analyzed-news',
        fromBeginning: false,
      });
      logger.info({ message: 'Subscribed to predictions and analyzed-news topics' });

      await this.consumer.run({
        eachMessage: async (payload: EachMessagePayload): Promise<void> => {
          const { topic, partition, message } = payload;
          const rawValue = message.value?.toString();

          if (!rawValue) {
            logger.warn({
              message: 'Received empty Kafka message — skipping',
              topic,
              partition,
              offset: message.offset,
            });
            return;
          }

          let parsed: Record<string, unknown>;
          try {
            parsed = JSON.parse(rawValue) as Record<string, unknown>;
          } catch (err) {
            logger.warn({
              message: 'Failed to parse Kafka message as JSON — skipping',
              topic,
              partition,
              offset: message.offset,
              errorMessage: err instanceof Error ? err.message : String(err),
            });
            return;
          }

          // Tag the message with its source topic so the dashboard can route it
          if (topic === 'analyzed-news') {
            // Forward as an article record with type tag
            parsed = { ...parsed, type: 'article' };
          } else if (topic === 'predictions') {
            // Tag burst events and trend forecasts if not already tagged
            if (!parsed['type']) {
              if (parsed['eventId']) {
                parsed = { ...parsed, type: 'burst_event' };
              } else if (parsed['forecastId']) {
                parsed = { ...parsed, type: 'trend_forecast' };
              }
            }
          }

          logger.info({
            message: 'Broadcasting message to WebSocket clients',
            topic,
            type: parsed['type'],
          });

          this.websocketGateway.broadcastToAllClients(parsed);
        },
      });
    } catch (err) {
      logger.error({
        message: 'Failed to initialise Kafka consumer',
        errorMessage: err instanceof Error ? err.message : String(err),
        stack: err instanceof Error ? err.stack : undefined,
      });
      throw err;
    }
  }

  async onModuleDestroy(): Promise<void> {
    try {
      await this.consumer.disconnect();
      logger.info({ message: 'Kafka consumer disconnected' });
    } catch (err) {
      logger.error({
        message: 'Error while disconnecting Kafka consumer',
        errorMessage: err instanceof Error ? err.message : String(err),
      });
    }
  }
}
