import React from 'react';

interface KpiCardProps {
  label: string;
  value: string;
  trend?: string;       // e.g. "+12%" or "-5%"
  tags?: string[];      // e.g. ["POLITICAL", "CYBER"]
  ariaLabel?: string;
}

/**
 * KpiCard — displays a single key performance indicator with optional trend and tags.
 *
 * Trend coloring:
 *  - Starts with "+" → green (text-green-400)
 *  - Starts with "-" → red (var(--color-alert))
 *  - Otherwise       → secondary text color
 */
export default function KpiCard({ label, value, trend, tags, ariaLabel }: KpiCardProps) {
  const getTrendStyle = (): React.CSSProperties & { className?: string } => {
    if (!trend) return {};
    if (trend.startsWith('+')) return {};
    if (trend.startsWith('-')) return { color: 'var(--color-alert)' };
    return {};
  };

  const getTrendClassName = (): string => {
    if (!trend) return '';
    if (trend.startsWith('+')) return 'text-green-400';
    if (trend.startsWith('-')) return '';
    return 'text-[var(--color-text-secondary)]';
  };

  return (
    <div
      className="rounded-lg p-4 flex flex-col gap-2"
      style={{ background: 'var(--color-surface)', color: 'var(--color-text-primary)' }}
      aria-label={ariaLabel ?? label}
    >
      {/* Label */}
      <span
        className="text-xs font-semibold uppercase tracking-widest"
        style={{ color: 'var(--color-text-secondary)' }}
      >
        {label}
      </span>

      {/* Value */}
      <span className="text-2xl font-bold leading-tight">
        {value}
      </span>

      {/* Trend */}
      {trend !== undefined && (
        <span
          className={`text-sm font-medium ${getTrendClassName()}`}
          style={trend.startsWith('-') ? getTrendStyle() : undefined}
        >
          {trend}
        </span>
      )}

      {/* Tags */}
      {tags && tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-1">
          {tags.map((tag) => (
            <span
              key={tag}
              className="text-xs px-2 py-0.5 rounded-full border"
              style={{
                borderColor: 'var(--color-border)',
                color: 'var(--color-text-secondary)',
              }}
            >
              {tag}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
