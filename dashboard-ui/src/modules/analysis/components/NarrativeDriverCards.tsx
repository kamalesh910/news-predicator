/**
 * NarrativeDriverCards — displays profile cards for key narrative drivers,
 * each showing an avatar placeholder, name, title, and impact/reach metric.
 */

interface DriverProfile {
  id: string;
  name: string;
  title: string;
  metric: string;
  metricLabel: string;
}

const DRIVERS: DriverProfile[] = [
  {
    id: 'thorne',
    name: 'Dr. Aris Thorne',
    title: 'Policy Director, IRENA',
    metric: '98.2k',
    metricLabel: 'IMPACT',
  },
  {
    id: 'vance',
    name: 'Elena Vance',
    title: 'Energy Correspondent, Reuters',
    metric: '142.5k',
    metricLabel: 'REACH',
  },
];

/** Returns up to two uppercase initials from a display name. */
function getInitials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join('');
}

export default function NarrativeDriverCards() {
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
        Key Narrative Drivers
      </h2>

      {/* Profile cards */}
      <div className="flex flex-col gap-3">
        {DRIVERS.map((driver) => (
          <div
            key={driver.id}
            className="flex items-center gap-3 rounded-lg p-3"
            style={{
              background: 'var(--color-surface-2)',
              border: '1px solid var(--color-border)',
            }}
          >
            {/* Avatar placeholder */}
            <div
              className="flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold"
              style={{
                background: 'var(--color-accent-primary)',
                color: '#FFFFFF',
              }}
              aria-hidden="true"
            >
              {getInitials(driver.name)}
            </div>

            {/* Name and title */}
            <div className="flex-1 min-w-0">
              <p
                className="text-sm font-semibold truncate"
                style={{ color: 'var(--color-text-primary)' }}
              >
                {driver.name}
              </p>
              <p
                className="text-xs truncate"
                style={{ color: 'var(--color-text-secondary)' }}
              >
                {driver.title}
              </p>
            </div>

            {/* Metric */}
            <div className="flex-shrink-0 text-right">
              <p
                className="text-sm font-bold tabular-nums"
                style={{ color: 'var(--color-accent-primary)' }}
              >
                {driver.metric}
              </p>
              <p
                className="text-xs font-semibold uppercase tracking-wide"
                style={{ color: 'var(--color-text-secondary)' }}
              >
                {driver.metricLabel}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
