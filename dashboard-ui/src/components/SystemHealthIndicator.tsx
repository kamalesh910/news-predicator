'use client';

import { useEffect, useState } from 'react';

type HealthStatus = 'healthy' | 'degraded' | 'unknown';

const POLL_INTERVAL_MS = 30_000;

/**
 * Polls GET /health on the API Gateway every 30 seconds and displays the
 * current system health status.
 *
 * - Green  "Healthy"  — the health endpoint returned HTTP 200
 * - Yellow "Degraded" — the health endpoint returned a non-200 status
 * - Gray   "Unknown"  — the initial check has not completed yet or the
 *                       endpoint is unreachable
 *
 * Requirements: 9.1, 12.5
 */
export default function SystemHealthIndicator() {
  const [status, setStatus] = useState<HealthStatus>('unknown');

  useEffect(() => {
    const apiGatewayUrl =
      process.env.NEXT_PUBLIC_API_GATEWAY_URL ?? 'http://localhost:4000';
    const healthUrl = `${apiGatewayUrl}/health`;

    async function checkHealth() {
      try {
        const response = await fetch(healthUrl, { cache: 'no-store' });
        setStatus(response.ok ? 'healthy' : 'degraded');
      } catch {
        setStatus('degraded');
      }
    }

    // Run immediately on mount, then on the interval
    void checkHealth();
    const intervalId = setInterval(() => void checkHealth(), POLL_INTERVAL_MS);

    return () => clearInterval(intervalId);
  }, []);

  const config: Record<HealthStatus, { dotClass: string; label: string; textClass: string }> = {
    healthy: {
      dotClass: 'bg-green-500',
      label: 'Healthy',
      textClass: 'text-green-700',
    },
    degraded: {
      dotClass: 'bg-yellow-400',
      label: 'Degraded',
      textClass: 'text-yellow-700',
    },
    unknown: {
      dotClass: 'bg-gray-400',
      label: 'Unknown',
      textClass: 'text-gray-600',
    },
  };

  const { dotClass, label, textClass } = config[status];

  return (
    <div
      className="flex items-center gap-2 text-sm font-medium"
      role="status"
      aria-live="polite"
      aria-label={`System health: ${label}`}
    >
      <span
        className={`inline-block h-2.5 w-2.5 rounded-full ${dotClass}`}
        aria-hidden="true"
      />
      <span className={textClass}>{label}</span>
    </div>
  );
}
