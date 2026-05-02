import { Module } from '@nestjs/common';
import { DbService } from './db.service';

/**
 * NestJS module that provides and exports the PostgreSQL connection pool service.
 *
 * Import this module in any feature module that needs database access.
 */
@Module({
  providers: [DbService],
  exports: [DbService],
})
export class DbModule {}
