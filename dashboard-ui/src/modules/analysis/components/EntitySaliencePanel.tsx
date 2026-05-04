/**
 * EntitySaliencePanel — displays a ranked list of keywords with percentage
 * change indicators. Positive changes are shown in accent-primary; negative
 * changes are shown in alert color.
 */

interface SalienceItem {
  rank: number;
  keyword: string;
  change: number;
}

const SALIENCE_DATA: SalienceItem[] = [
  { rank: 1, keyword: 'Carbon Tax', change: 12.4 },
  { rank: 2, keyword: 'Green Subsidy', change: 8.1 },
  { rank: 3, keyword: 'Net Zero 2050', change: -2.5 },
  { rank: 4, keyword: 'Grid Modernization', change: 15.9 },
  { rank: 5, keyword: 'Solar Supply Chain', change: 1.2 },
];

export default function EntitySaliencePanel() {
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
        Entity Salience
      </h2>

      {/* Ranked list */}
      <ol className="flex flex-col gap-3" aria-label="Entity salience rankings">
        {SALIENCE_DATA.map((item) => {
          const isPositive = item.change >= 0;
          const changeColor = isPositive
            ? 'var(--color-accent-primary)'
            : 'var(--color-alert)';
          const changeLabel = `${isPositive ? '+' : ''}${item.change}%`;

          return (
            <li key={item.rank} className="flex items-center gap-3">
              {/* Rank number */}
              <span
                className="w-5 text-xs font-bold text-right flex-shrink-0"
                style={{ color: 'var(--color-text-secondary)' }}
                aria-label={`Rank ${item.rank}`}
              >
                {item.rank}
              </span>

              {/* Keyword name */}
              <span
                className="flex-1 text-sm font-medium"
                style={{ color: 'var(--color-text-primary)' }}
              >
                {item.keyword}
              </span>

              {/* Percentage change */}
              <span
                className="text-sm font-bold tabular-nums"
                style={{ color: changeColor }}
                aria-label={`${changeLabel} change`}
              >
                {changeLabel}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
