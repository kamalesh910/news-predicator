/**
 * Kafka consumer group lag monitor for the ingestion-service.
 *
 * Uses the KafkaJS admin client to periodically check consumer group lag
 * across all partitions of the monitored topics. When the total lag for a
 * consumer group exceeds a configurable threshold, a structured warning log
 * entry is emitted.
 *
 * Satisfies Requirements 11.5
 */

import { Kafka, Admin } from 'kafkajs';
import { createServiceLogger } from './logger';

const logger = createServiceLogger('ingestion-service');

/** Configuration for the lag monitor. */
export interface LagMonitorConfig {
  /** Kafka broker addresses, e.g. ['kafka:9092'] */
  brokers: string[];
  /** Consumer group ID to monitor */
  groupId: string;
  /** Topics to check for lag (defaults to all topics assigned to the group) */
  topics?: string[];
  /** Lag threshold in messages; a warning is emitted when total lag exceeds this value */
  threshold: number;
  /** How often to check lag, in milliseconds (default: 30_000) */
  checkIntervalMs?: number;
}

/** Represents the lag for a single topic partition. */
export interface PartitionLag {
  topic: string;
  partition: number;
  lag: number;
}

/**
 * Computes per-partition lag for a consumer group by comparing committed
 * offsets against the latest (high-water-mark) offsets.
 *
 * @param admin  - Connected KafkaJS Admin client
 * @param groupId - Consumer group ID
 * @param topics  - Topics to inspect; if empty, all topics in the group are used
 * @returns Array of PartitionLag records
 */
export async function fetchGroupLag(
  admin: Admin,
  groupId: string,
  topics: string[],
): Promise<PartitionLag[]> {
  // Fetch committed offsets for the group
  const offsets = await admin.fetchOffsets({ groupId, topics });

  const results: PartitionLag[] = [];

  for (const topicOffsets of offsets) {
    const { topic, partitions } = topicOffsets;

    // Fetch the latest (end) offsets for each partition in this topic
    const endOffsets = await admin.fetchTopicOffsets(topic);
    const endOffsetMap = new Map<number, string>(
      endOffsets.map((p) => [p.partition, p.offset]),
    );

    for (const partitionInfo of partitions) {
      const committed = BigInt(partitionInfo.offset);
      const end = BigInt(endOffsetMap.get(partitionInfo.partition) ?? '0');
      // Lag is the number of messages the consumer is behind
      const lag = end > committed ? Number(end - committed) : 0;
      results.push({ topic, partition: partitionInfo.partition, lag });
    }
  }

  return results;
}

/**
 * Starts periodic Kafka consumer group lag monitoring.
 *
 * Emits a structured `warn` log entry whenever the total lag across all
 * monitored partitions exceeds `config.threshold`. The log entry includes:
 *   - `groupId`    — the consumer group being monitored
 *   - `totalLag`   — the summed lag across all partitions
 *   - `threshold`  — the configured threshold
 *   - `partitions` — per-partition breakdown
 *
 * @param config - Lag monitor configuration
 * @returns A `stop()` function that clears the interval and disconnects the admin client
 *
 * @example
 * const stop = startLagMonitoring({
 *   brokers: ['kafka:9092'],
 *   groupId: 'ingestion-consumer',
 *   topics: ['raw-news'],
 *   threshold: 1000,
 *   checkIntervalMs: 30_000,
 * });
 * // Later, to stop monitoring:
 * await stop();
 */
export function startLagMonitoring(config: LagMonitorConfig): () => Promise<void> {
  const {
    brokers,
    groupId,
    topics = [],
    threshold,
    checkIntervalMs = 30_000,
  } = config;

  const kafka = new Kafka({
    clientId: 'lag-monitor',
    brokers,
  });

  const admin = kafka.admin();
  let connected = false;
  let intervalHandle: ReturnType<typeof setInterval> | null = null;

  const check = async (): Promise<void> => {
    try {
      if (!connected) {
        await admin.connect();
        connected = true;
        logger.info('[lag-monitor] Admin client connected', { groupId });
      }

      const partitionLags = await fetchGroupLag(admin, groupId, topics);
      const totalLag = partitionLags.reduce((sum, p) => sum + p.lag, 0);

      if (totalLag > threshold) {
        logger.warn('[lag-monitor] Consumer group lag exceeds threshold', {
          groupId,
          totalLag,
          threshold,
          partitions: partitionLags,
        });
      } else {
        logger.debug('[lag-monitor] Consumer group lag within threshold', {
          groupId,
          totalLag,
          threshold,
        });
      }
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      logger.error('[lag-monitor] Failed to check consumer group lag', {
        groupId,
        errorType: error.constructor.name,
        errorMessage: error.message,
        stackTrace: error.stack ?? '',
      });
    }
  };

  // Run immediately, then on the configured interval
  void check();
  intervalHandle = setInterval(() => void check(), checkIntervalMs);

  return async (): Promise<void> => {
    if (intervalHandle !== null) {
      clearInterval(intervalHandle);
      intervalHandle = null;
    }
    if (connected) {
      await admin.disconnect();
      connected = false;
      logger.info('[lag-monitor] Admin client disconnected', { groupId });
    }
  };
}

/**
 * `LagMonitor` class — an object-oriented wrapper around `startLagMonitoring`.
 *
 * Useful when you prefer a class-based API or need to manage the monitor
 * lifecycle through dependency injection.
 *
 * @example
 * const monitor = new LagMonitor({
 *   brokers: ['kafka:9092'],
 *   groupId: 'ingestion-consumer',
 *   threshold: 1000,
 * });
 * monitor.start();
 * // Later:
 * await monitor.stop();
 */
export class LagMonitor {
  private readonly config: LagMonitorConfig;
  private stopFn: (() => Promise<void>) | null = null;

  constructor(config: LagMonitorConfig) {
    this.config = config;
  }

  /** Start monitoring. No-op if already running. */
  start(): void {
    if (this.stopFn !== null) {
      logger.warn('[LagMonitor] Already running — ignoring duplicate start()', {
        groupId: this.config.groupId,
      });
      return;
    }
    this.stopFn = startLagMonitoring(this.config);
  }

  /** Stop monitoring and disconnect the admin client. */
  async stop(): Promise<void> {
    if (this.stopFn !== null) {
      await this.stopFn();
      this.stopFn = null;
    }
  }

  /** Returns true if the monitor is currently running. */
  get isRunning(): boolean {
    return this.stopFn !== null;
  }
}
