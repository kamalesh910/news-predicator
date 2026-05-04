interface ArcGaugeProps {
  value: number;
  max: number;
  label: string;
  ariaLabel: string;
}

/**
 * ArcGauge — renders a semicircular SVG arc gauge displaying a single score.
 *
 * The arc spans 180° (a semicircle). The filled portion is proportional to value/max.
 */
export default function ArcGauge({ value, max, label, ariaLabel }: ArcGaugeProps) {
  const radius = 60;
  const strokeWidth = 10;
  const cx = 80;
  const cy = 80;

  // Arc circumference for a semicircle (π * r)
  const circumference = Math.PI * radius;
  const ratio = Math.min(Math.max(value / max, 0), 1);
  const filledLength = ratio * circumference;
  const gapLength = circumference - filledLength;

  // The arc path: start at left (180°), sweep clockwise to right (0°)
  const startX = cx - radius;
  const startY = cy;
  const endX = cx + radius;
  const endY = cy;

  const arcPath = `M ${startX} ${startY} A ${radius} ${radius} 0 0 1 ${endX} ${endY}`;

  return (
    <div
      className="flex flex-col items-center gap-2"
      aria-label={ariaLabel}
      role="img"
    >
      <svg
        width={cx * 2}
        height={cy + strokeWidth}
        viewBox={`0 0 ${cx * 2} ${cy + strokeWidth}`}
        aria-hidden="true"
      >
        {/* Background track */}
        <path
          d={arcPath}
          fill="none"
          stroke="var(--color-surface-2)"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
        />
        {/* Filled arc */}
        <path
          d={arcPath}
          fill="none"
          stroke="var(--color-accent-primary)"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={`${filledLength} ${gapLength}`}
        />
        {/* Value text */}
        <text
          x={cx}
          y={cy - 4}
          textAnchor="middle"
          fontSize="20"
          fontWeight="bold"
          fill="var(--color-text-primary)"
        >
          {value}
        </text>
      </svg>
      {/* Label */}
      <span
        className="text-sm font-medium text-center"
        style={{ color: 'var(--color-text-secondary)' }}
      >
        {label}
      </span>
    </div>
  );
}
