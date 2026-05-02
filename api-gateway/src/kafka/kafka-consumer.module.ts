import { Module } from '@nestjs/common';
import { KafkaConsumerService } from './kafka-consumer.service';
import { WebsocketModule } from '../websocket/websocket.module';

/**
 * NestJS module that provides the Kafka consumer for the `predictions` topic.
 *
 * Imports WebsocketModule so that WebsocketGateway can be injected into
 * KafkaConsumerService for broadcasting prediction events to connected clients.
 */
@Module({
  imports: [WebsocketModule],
  providers: [KafkaConsumerService],
})
export class KafkaConsumerModule {}
