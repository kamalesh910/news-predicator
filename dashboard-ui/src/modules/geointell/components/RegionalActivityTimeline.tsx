interface TimelineEvent {
  id: string;
  type: string;
  timestamp: string;
  description: string;
}

const EVENTS: TimelineEvent[] = [
  {
    id: '1',
    type: 'Protest Activity',
    timestamp: '15:42:18',
    description: 'Coordinated demonstrations reported in Central Delhi',
  },
  {
    id: '2',
    type: 'Trading Signals',
    timestamp: '14:28:55',
    description: 'Unusual trading patterns detected in energy sector',
  },
  {
    id: '3',
    type: 'Satellite Update',
    timestamp: '13:00:00',
    description: 'New satellite imagery processed for South Asia region',
  },
];

export default function RegionalActivityTimeline() {
  return (
    <div aria-label="Regional activity timeline">
      <h3 className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--color-text-secondary)' }}>
        Regional Activity
      </h3>
      <ol className="relative flex flex-col gap-0" style={{ borderLeft: '1px solid var(--color-border)', marginLeft: '8px' }}>
        {EVENTS.map((event) => (
          <li key={event.id} className="mb-4 ml-4">
            <span
              className="absolute -left-1.5 mt-1.5 w-3 h-3 rounded-full"
              style={{ background: 'var(--color-border)', border: '2px solid var(--color-surface)' }}
              aria-hidden="true"
            />
            <div className="flex items-center gap-2 mb-0.5">
              <span
                className="text-xs font-semibold px-1.5 py-0.5 rounded"
                style={{
                  backgroundColor: 'rgba(43, 127, 255, 0.15)',
                  color: 'var(--color-accent-primary)',
                  border: '1px solid rgba(43, 127, 255, 0.4)',
                }}
              >
                {event.type}
              </span>
              <time dateTime={event.timestamp} className="text-xs font-mono" style={{ color: 'var(--color-text-secondary)' }}>
                {event.timestamp}
              </time>
            </div>
            <p className="text-sm" style={{ color: 'var(--color-text-primary)' }}>{event.description}</p>
          </li>
        ))}
      </ol>
    </div>
  );
}
