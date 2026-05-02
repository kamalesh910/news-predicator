import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';

/**
 * NestJS module that exposes the GET /health endpoint.
 *
 * The controller is self-contained — it creates its own short-lived
 * dependency clients on each request so no shared state is needed.
 */
@Module({
  controllers: [HealthController],
})
export class HealthModule {}
