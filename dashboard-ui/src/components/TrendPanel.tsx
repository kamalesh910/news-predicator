'use client';

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { TrendForecast } from '@/types';

interface TrendPanelProps {
  forecasts: TrendForecast[];
}

/**
 * Renders an area chart of trend forecasts.
 * Updates whenever the `forecasts` prop changes (i.e. when new TrendForecast
 * messages arrive over WebSocket).
 *
 * Each data point shows: topicName (x-axis label), predictedVolume (area),
 * confidenceScore, and forecastHorizon in the tooltip.
 */
export default function TrendPanel({ forecasts }: TrendPanelProps) {
  if (forecasts.length === 0) {
    return (
      <div
        className="flex items-center justify-center rounded-lg border border-dashed border-gray-300 p-8 text-sm text-gray-500"
        role="status"
      >
        No trend forecasts available
      </div>
    );
  }

  // Build chart data — one entry per forecast, ordered by forecastHorizon
  const chartData = [...forecasts]
    .sort(
      (a, b) =>
        new Date(a.forecastHorizon).getTime() - new Date(b.forecastHorizon).getTime()
    )
    .map((f) => ({
      name: f.topicName,
      predictedVolume: f.predictedVolume,
      confidenceScore: Math.round(f.confidenceScore * 100),
      forecastHorizon: new Date(f.forecastHorizon).toLocaleString(),
      forecastId: f.forecastId,
    }));

  return (
    <section
      className="space-y-4"
      aria-label="Trend forecast visualization"
    >
      <h2 className="text-sm font-semibold text-gray-700">Trend Forecasts</h2>

      <ResponsiveContainer width="100%" height={300}>
        <AreaChart
          data={chartData}
          margin={{ top: 10, right: 20, left: 0, bottom: 0 }}
        >
          <defs>
            <linearGradient id="volumeGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="confidenceGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
            </linearGradient>
          </defs>

          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />

          <XAxis
            dataKey="name"
            tick={{ fontSize: 12, fill: '#6b7280' }}
            tickLine={false}
          />

          <YAxis
            yAxisId="volume"
            tick={{ fontSize: 12, fill: '#6b7280' }}
            tickLine={false}
            axisLine={false}
            label={{
              value: 'Volume',
              angle: -90,
              position: 'insideLeft',
              style: { fontSize: 11, fill: '#9ca3af' },
            }}
          />

          <YAxis
            yAxisId="confidence"
            orientation="right"
            domain={[0, 100]}
            tick={{ fontSize: 12, fill: '#6b7280' }}
            tickLine={false}
            axisLine={false}
            label={{
              value: 'Confidence %',
              angle: 90,
              position: 'insideRight',
              style: { fontSize: 11, fill: '#9ca3af' },
            }}
          />

          <Tooltip
            contentStyle={{
              fontSize: 12,
              borderRadius: '0.5rem',
              border: '1px solid #e5e7eb',
            }}
            formatter={(value: number, name: string) => {
              if (name === 'confidenceScore') return [`${value}%`, 'Confidence'];
              return [value, 'Predicted Volume'];
            }}
            labelFormatter={(label, payload: any[]) => {
              const item = payload?.[0]?.payload;
              return item
                ? `${label} — Horizon: ${item.forecastHorizon}`
                : label;
            }}
          />

          <Legend
            wrapperStyle={{ fontSize: 12, paddingTop: '8px' }}
            formatter={(value) =>
              value === 'predictedVolume' ? 'Predicted Volume' : 'Confidence %'
            }
          />

          <Area
            yAxisId="volume"
            type="monotone"
            dataKey="predictedVolume"
            stroke="#3b82f6"
            strokeWidth={2}
            fill="url(#volumeGradient)"
            dot={{ r: 3, fill: '#3b82f6' }}
            activeDot={{ r: 5 }}
          />

          <Area
            yAxisId="confidence"
            type="monotone"
            dataKey="confidenceScore"
            stroke="#10b981"
            strokeWidth={2}
            fill="url(#confidenceGradient)"
            dot={{ r: 3, fill: '#10b981' }}
            activeDot={{ r: 5 }}
          />
        </AreaChart>
      </ResponsiveContainer>

      {/* Tabular summary for accessibility */}
      <div className="overflow-x-auto">
        <table className="w-full text-xs text-gray-600" aria-label="Forecast data table">
          <thead>
            <tr className="border-b border-gray-200 text-left">
              <th className="pb-1 pr-4 font-medium">Topic</th>
              <th className="pb-1 pr-4 font-medium">Predicted Volume</th>
              <th className="pb-1 pr-4 font-medium">Confidence</th>
              <th className="pb-1 font-medium">Forecast Horizon</th>
            </tr>
          </thead>
          <tbody>
            {chartData.map((row) => (
              <tr key={row.forecastId} className="border-b border-gray-100">
                <td className="py-1 pr-4">{row.name}</td>
                <td className="py-1 pr-4">{row.predictedVolume.toLocaleString()}</td>
                <td className="py-1 pr-4">{row.confidenceScore}%</td>
                <td className="py-1">{row.forecastHorizon}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
