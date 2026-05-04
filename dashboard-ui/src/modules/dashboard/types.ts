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

export type ConnectionStatus = 'connected' | 'reconnecting' | 'disconnected';

export interface EntitySalienceItem {
  keyword: string;
  change: number; // percentage change, positive or negative
}

export interface DistrictItem {
  name: string;
  riskLevel: 'critical' | 'elevated' | 'stable';
  signalDensity: number; // percentage 0-100
  anomalies: number;
}
