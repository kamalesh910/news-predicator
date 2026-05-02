import { Module } from '@nestjs/common';
import { WebsocketGateway } from './websocket.gateway';

/**
 * NestJS module that provides and exports the WebSocket gateway.
 *
 * Import this module in AppModule to activate WebSocket connection handling
 * and session management.
 */
@Module({
  providers: [WebsocketGateway],
  exports: [WebsocketGateway],
})
export class WebsocketModule {}
