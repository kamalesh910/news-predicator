/**
 * TopicHeader — displays the topic identity, volatility badge, title,
 * description, and primary action buttons for the Analysis view.
 */
export default function TopicHeader() {
  return (
    <div
      className="rounded-lg p-6 flex flex-col gap-4"
      style={{ background: 'var(--color-surface)', color: 'var(--color-text-primary)' }}
    >
      {/* Top row: topic ID tag + volatility badge */}
      <div className="flex items-center gap-3 flex-wrap">
        {/* Topic ID pill */}
        <span
          className="inline-flex items-center px-2 py-0.5 rounded text-xs font-mono font-semibold"
          style={{
            background: 'var(--color-surface-2)',
            color: 'var(--color-text-secondary)',
            border: '1px solid var(--color-border)',
          }}
        >
          #TX-9902
        </span>

        {/* Volatility badge */}
        <span
          className="inline-flex items-center px-2.5 py-0.5 rounded text-xs font-bold uppercase tracking-wide"
          style={{
            background: 'rgba(251, 191, 36, 0.15)',
            color: '#FBBF24',
            border: '1px solid rgba(251, 191, 36, 0.4)',
          }}
        >
          HIGH VOLATILITY
        </span>
      </div>

      {/* Title */}
      <h1 className="text-2xl font-bold leading-tight" style={{ color: 'var(--color-text-primary)' }}>
        Climate Policy Infrastructure
      </h1>

      {/* Description */}
      <p className="text-sm leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>
        Monitoring narrative evolution across global policy channels and media ecosystems.
      </p>

      {/* Action buttons */}
      <div className="flex items-center gap-3 flex-wrap">
        <button
          type="button"
          className="inline-flex items-center px-4 py-2 rounded text-sm font-semibold transition-opacity hover:opacity-80"
          style={{
            background: 'var(--color-surface-2)',
            color: 'var(--color-text-primary)',
            border: '1px solid var(--color-border)',
          }}
        >
          Export Analysis
        </button>

        <button
          type="button"
          className="inline-flex items-center px-4 py-2 rounded text-sm font-semibold transition-opacity hover:opacity-80"
          style={{
            background: 'var(--color-accent-primary)',
            color: '#FFFFFF',
            border: '1px solid var(--color-accent-primary)',
          }}
        >
          Track Narrative
        </button>
      </div>
    </div>
  );
}
