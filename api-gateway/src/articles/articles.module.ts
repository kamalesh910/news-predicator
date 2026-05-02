import { Module } from '@nestjs/common';
import { ArticlesController } from './articles.controller';
import { ArticlesService } from './articles.service';
import { DbModule } from '../db/db.module';

/**
 * NestJS module that provides REST endpoints for articles, bias scores,
 * and predictions, backed by the PostgreSQL connection pool from DbModule.
 */
@Module({
  imports: [DbModule],
  controllers: [ArticlesController],
  providers: [ArticlesService],
  exports: [ArticlesService],
})
export class ArticlesModule {}
