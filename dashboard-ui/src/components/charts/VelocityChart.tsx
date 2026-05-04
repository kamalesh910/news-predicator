'use client';

import React from 'react';
import {
  LineChart,
  BarChart,
  Line,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';

interface VelocityChartProps {
  data: { time: string; value: number }[];
  timeRanges: string[];
  activeRange: string;
  onRangeChange: (range: string) => void;
  peakAnnotation?: string; // e.g. "PEAK: 84.2"
  chartType: 'line' | 'bar';
}

/**
 * VelocityChart — renders a Recharts line or bar chart with time-range toggle buttons.
 *
 * - `chartType === 'line'`: renders a LineChart with a single Line
 * - `chartType === 'bar'`:  renders a BarChart with a single Bar
 * - If `peakAnnotation` is provided, a ReferenceLine is drawn at the max data value
 *   with the annotation text as its label.
 */
export default function VelocityChart({
  data,
  timeRanges,
  activeRange,
  onRangeChange,
  peakAnnotation,
  chartType,
}: VelocityChartProps) {
  // Compute the max value for the optional peak ReferenceLine
  const maxValue = data.length > 0 ? Math.max(...data.map((d) => d.value)) : 0;

  const sharedAxisProps = {
    stroke: 'var(--color-text-secondary)',
    tick: { fill: 'var(--color-text-secondary)', fontSize: 11 },
  };

  const renderChart = () => {
    if (chartType === 'bar') {
      return (
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
          <XAxis dataKey="time" {...sharedAxisProps} />
          <YAxis {...sharedAxisProps} />
          <Tooltip
            contentStyle={{
              background: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              color: 'var(--color-text-primary)',
            }}
          />
          {peakAnnotation && (
            <ReferenceLine
              y={maxValue}
              stroke="var(--color-alert)"
              strokeDasharray="4 2"
              label={{
                value: peakAnnotation,
                fill: 'var(--color-text-primary)',
                fontSize: 11,
              }}
            />
          )}
          <Bar dataKey="value" fill="var(--color-accent-primary)" />
        </BarChart>
      );
    }

    // Default: line chart
    return (
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
        <XAxis dataKey="time" {...sharedAxisProps} />
        <YAxis {...sharedAxisProps} />
        <Tooltip
          contentStyle={{
            background: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            color: 'var(--color-text-primary)',
          }}
        />
        {peakAnnotation && (
          <ReferenceLine
            y={maxValue}
            stroke="var(--color-alert)"
            strokeDasharray="4 2"
            label={{
              value: peakAnnotation,
              fill: 'var(--color-text-primary)',
              fontSize: 11,
            }}
          />
        )}
        <Line
          type="monotone"
          dataKey="value"
          stroke="var(--color-accent-primary)"
          strokeWidth={2}
          dot={false}
        />
      </LineChart>
    );
  };

  return (
    <div aria-label="Sentiment velocity chart">
      {/* Time-range toggle buttons */}
      <div className="flex gap-2 mb-3">
        {timeRanges.map((range) => {
          const isActive = range === activeRange;
          return (
            <button
              key={range}
              type="button"
              onClick={() => onRangeChange(range)}
              style={
                isActive
                  ? {
                      background: 'var(--color-accent-primary)',
                      color: '#fff',
                    }
                  : {
                      background: 'var(--color-surface-2)',
                      color: 'var(--color-text-secondary)',
                    }
              }
              className="px-3 py-1 rounded text-xs font-semibold transition-colors"
              aria-pressed={isActive}
            >
              {range}
            </button>
          );
        })}
      </div>

      {/* Chart */}
      <ResponsiveContainer width="100%" height={200}>
        {renderChart()}
      </ResponsiveContainer>
    </div>
  );
}
