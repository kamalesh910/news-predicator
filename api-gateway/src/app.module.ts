import { Module } from '@nestjs/common';
import { WebsocketModule } from './websocket/websocket.module';
import { KafkaConsumerModule } from './kafka/kafka-consumer.module';
import { ArticlesModule } from './articles/articles.module';
import { DbModule } from './db/db.module';
import { HealthModule } from './health/health.module';

/**
 * Root NestJS application module.
 *
 * Feature modules are imported here. The actual module implementations
 * are created in later tasks (17.1–17.5, 18, 19); placeholders are
 * listed as comments so the import list is easy to fill in incrementally.
 *
 * Planned modules:
 *   - WebsocketModule      (task 17.1) — WebSocket gateway + session management  ✓
 *   - KafkaConsumerModule  (task 17.3) — Kafka consumer + prediction broadcast   ✓
 *   - ArticlesModule       (task 18)   — REST endpoints for articles / bias scores ✓
 *   - DbModule             (task 18)   — PostgreSQL connection pool               ✓
 *   - HealthModule         (task 19)   — GET /health with dependency checks       ✓
 */
@Module({
  imports: [
    WebsocketModule,
    KafkaConsumerModule,
    DbModule,
    ArticlesModule,
    HealthModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
