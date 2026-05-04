/**
 * GeoRiskPanel — displays a simplified SVG outline of India with city pins
 * and a risk distribution summary below the map.
 */
export default function GeoRiskPanel() {
  // Approximate SVG coordinates for India outline (simplified ~20-point polygon)
  // ViewBox: 0 0 200 220
  const indiaPath =
    'M 95,5 L 115,8 L 135,18 L 150,30 L 160,50 L 165,70 L 170,90 ' +
    'L 160,110 L 155,130 L 145,150 L 130,165 L 115,175 L 100,185 ' +
    'L 90,195 L 80,185 L 65,170 L 55,150 L 45,130 L 40,110 ' +
    'L 38,90 L 42,70 L 50,50 L 62,32 L 75,18 Z';

  // Approximate SVG positions for major cities within the viewBox
  const cities = [
    { id: 'delhi', name: 'Delhi NCR', label: 'Delhi NCR CRITICAL', cx: 100, cy: 65, risk: 'critical' as const },
    { id: 'mumbai', name: 'Mumbai', cx: 68, cy: 120, risk: 'elevated' as const },
    { id: 'bengaluru', name: 'Bengaluru', cx: 95, cy: 155, risk: 'stable' as const },
  ];

  const pinColors: Record<string, string> = {
    critical: 'var(--color-alert)',
    elevated: '#FBBF24',
    stable: '#34D399',
  };

  const riskDistribution = [
    { label: 'SAFE', percentage: 62, color: 'var(--color-accent-primary)' },
    { label: 'WARNING', percentage: 24, color: '#FBBF24' },
    { label: 'DANGER', percentage: 14, color: 'var(--color-alert)' },
  ];

  return (
    <div
      className="rounded-lg p-4 flex flex-col gap-4"
      style={{ background: 'var(--color-surface)', color: 'var(--color-text-primary)' }}
    >
      {/* Panel title */}
      <h2
        className="text-sm font-semibold uppercase tracking-widest"
        style={{ color: 'var(--color-text-secondary)' }}
      >
        Geo Risk: India
      </h2>

      {/* SVG map */}
      <div className="relative flex justify-center">
        <svg
          viewBox="0 0 200 220"
          width="100%"
          style={{ maxWidth: 280 }}
          aria-label="Simplified map of India showing risk regions"
          role="img"
        >
          {/* India outline */}
          <path
            d={indiaPath}
            fill="var(--color-surface-2)"
            stroke="var(--color-border)"
            strokeWidth="1.5"
          />

          {/* City pins */}
          {cities.map((city) => (
            <g key={city.id} aria-label={`${city.name} pin`}>
              {/* Pin circle */}
              <circle
                cx={city.cx}
                cy={city.cy}
                r={5}
                fill={pinColors[city.risk]}
                stroke="var(--color-bg-base)"
                strokeWidth="1.5"
              />
              {/* Pin stem */}
              <line
                x1={city.cx}
                y1={city.cy + 5}
                x2={city.cx}
                y2={city.cy + 10}
                stroke={pinColors[city.risk]}
                strokeWidth="1.5"
              />
            </g>
          ))}

          {/* Delhi NCR CRITICAL overlay label */}
          <g>
            <rect
              x={108}
              y={52}
              width={72}
              height={16}
              rx={3}
              fill="rgba(231, 129, 112, 0.2)"
              stroke="var(--color-alert)"
              strokeWidth="0.75"
            />
            <text
              x={144}
              y={63}
              textAnchor="middle"
              fontSize="7"
              fontWeight="bold"
              fill="var(--color-alert)"
              fontFamily="inherit"
            >
              Delhi NCR CRITICAL
            </text>
          </g>
        </svg>
      </div>

      {/* Risk distribution */}
      <div className="flex flex-col gap-2">
        {riskDistribution.map((item) => (
          <div key={item.label} className="flex items-center gap-2">
            {/* Colored dot */}
            <span
              className="inline-block w-2.5 h-2.5 rounded-full flex-shrink-0"
              style={{ backgroundColor: item.color }}
              aria-hidden="true"
            />
            {/* Label */}
            <span
              className="text-xs font-semibold uppercase tracking-wide flex-1"
              style={{ color: 'var(--color-text-secondary)' }}
            >
              {item.label}
            </span>
            {/* Percentage */}
            <span
              className="text-xs font-bold"
              style={{ color: item.color }}
            >
              {item.percentage}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
