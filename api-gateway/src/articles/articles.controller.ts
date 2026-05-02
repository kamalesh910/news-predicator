import {
  Controller,
  Get,
  Param,
  Query,
  NotFoundException,
  ParseIntPipe,
  DefaultValuePipe,
} from '@nestjs/common';
import { ArticlesService, Article, BiasRecord, Prediction } from './articles.service';

/**
 * REST controller exposing endpoints for articles, bias scores, and predictions.
 *
 * Routes:
 *   GET /articles              — paginated list of articles (max 100 per page)
 *   GET /articles/:id          — single article by UUID
 *   GET /bias-scores           — paginated list of bias analysis records
 *   GET /predictions           — paginated list of burst events and trend forecasts
 */
@Controller()
export class ArticlesController {
  constructor(private readonly articlesService: ArticlesService) {}

  /**
   * Returns a paginated list of articles ordered by publication date descending.
   *
   * Query params:
   *   page     — 1-based page number (default: 1)
   *   pageSize — records per page (default: 20, max: 100)
   */
  @Get('articles')
  async getArticles(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('pageSize', new DefaultValuePipe(20), ParseIntPipe) pageSize: number,
  ): Promise<Article[]> {
    // Clamp pageSize to [1, 100]
    const clampedPageSize = Math.max(1, Math.min(pageSize, 100));
    const clampedPage = Math.max(1, page);
    return this.articlesService.getArticles(clampedPage, clampedPageSize);
  }

  /**
   * Returns a single article by its UUID.
   * Responds with HTTP 404 if the article is not found.
   */
  @Get('articles/:id')
  async getArticleById(@Param('id') id: string): Promise<Article> {
    const article = await this.articlesService.getArticleById(id);
    if (!article) {
      throw new NotFoundException(`Article with id "${id}" not found`);
    }
    return article;
  }

  /**
   * Returns a paginated list of bias analysis records ordered by analysis
   * timestamp descending.
   *
   * Query params:
   *   page     — 1-based page number (default: 1)
   *   pageSize — records per page (default: 20, max: 100)
   */
  @Get('bias-scores')
  async getBiasScores(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('pageSize', new DefaultValuePipe(20), ParseIntPipe) pageSize: number,
  ): Promise<BiasRecord[]> {
    const clampedPageSize = Math.max(1, Math.min(pageSize, 100));
    const clampedPage = Math.max(1, page);
    return this.articlesService.getBiasScores(clampedPage, clampedPageSize);
  }

  /**
   * Returns a paginated list of predictions (burst events and trend forecasts)
   * ordered by creation time descending.
   *
   * Query params:
   *   page     — 1-based page number (default: 1)
   *   pageSize — records per page (default: 20, max: 100)
   */
  @Get('predictions')
  async getPredictions(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('pageSize', new DefaultValuePipe(20), ParseIntPipe) pageSize: number,
  ): Promise<Prediction[]> {
    const clampedPageSize = Math.max(1, Math.min(pageSize, 100));
    const clampedPage = Math.max(1, page);
    return this.articlesService.getPredictions(clampedPage, clampedPageSize);
  }
}
