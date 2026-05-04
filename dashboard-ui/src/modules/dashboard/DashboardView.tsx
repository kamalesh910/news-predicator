'use client';

import { useEffect, useState } from 'react';
import KpiRow from './components/KpiRow';
import VelocityChart from '@/components/charts/VelocityChart';
import GeoRiskPanel from './components/GeoRiskPanel';
import TrendingTopicsTable from './components/TrendingTopicsTable';
import ErrorBoundary from '@/components/common/ErrorBoundary';
import { getSocket } from '@/lib/websocket';
import { useDashboardStore } from '@/store/dashboardStore';
import type { Article, BurstEvent, TrendForecast } from '@/modules/dashboard/types';

const VELOCITY_DATA = [
  { time: '00:00', value: 45 },
  { time: '04:00', value: 62 },
  { time: '08:00', value: 78 },
  { time: '12:00', value: 84 },
  { time: '16:00', value: 71 },
  { time: '20:00', value: 58 },
];

/**
 * DashboardView — the main dashboard page composition.
 *
 * Subscribes to the WebSocket for live article, burst-event, and forecast
 * messages and merges them into the dashboard store. Renders the KPI row,
 * velocity chart, geo-risk panel, and trending topics table inside an
 * ErrorBoundary.
 */
export default function DashboardView() {
  const [activeRange, setActiveRange] = useState<string>('24H');

  const mergeArticle = useDashboardStore((state) => state.mergeArticle);
  const mergeBurstEvent = useDashboardStore((state) => state.mergeBurstEvent);
  const mergeForecast = useDashboardStore((state) => state.mergeForecast);

  useEffect(() => {
    const socket = getSocket();

    function handleMessage(msg: Record<string, unknown>) {
      if (msg.type === 'article' || 'articleId' in msg) {
        mergeArticle(msg as unknown as Article);
      } else if (msg.type === 'burst_event') {
        mergeBurstEvent(msg as unknown as BurstEvent);
      } else if (msg.type === 'trend_forecast') {
        mergeForecast(msg as unknown as TrendForecast);
      }
    }

    socket.on('message', handleMessage);

    return () => {
      socket.off('message', handleMessage);
    };
  }, [mergeArticle, mergeBurstEvent, mergeForecast]);

  return (
    <ErrorBoundary fallback={<p>Dashboard unavailable</p>}>
      <div className="flex flex-col gap-6">
        <KpiRow />
        <TrendingTopicsTable />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <VelocityChart
            data={VELOCITY_DATA}
            timeRanges={['1H', '24H', '7D']}
            activeRange={activeRange}
            onRangeChange={setActiveRange}
            chartType="line"
            peakAnnotation="PEAK: 84.2"
          />
          <GeoRiskPanel />
        </div>
      </div>
    </ErrorBoundary>
  );
}
