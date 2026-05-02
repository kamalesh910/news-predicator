export interface BurstEvent {
  eventId: string;
  topicName: string;
  articleCount: number;
  windowStart: string;
  windowEnd: string;
  detectionTimestamp: string;
}

export interface Article {
  articleId: string;
  title: string;
  sourceName: string;
  publishedAt: string;
  biasScore: number | null;
}

export interface TrendForecast {
  forecastId: string;
  topicName: string;
  predictedVolume: number;
  confidenceScore: number;
  forecastHorizon: string;
}
