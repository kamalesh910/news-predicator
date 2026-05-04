/**
 * ViralNarratives — displays trending hashtag pills for the active topic.
 * Each pill uses the accent-primary color for border and text.
 */

const HASHTAGS = [
  '#GreenFuture',
  '#CleanEnergyNow',
  '#NetZero',
  '#GridResilience',
  '#SolarTech',
  '#CarbonZero',
];

export default function ViralNarratives() {
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
        Viral Narratives
      </h2>

      {/* Hashtag pills */}
      <div className="flex flex-wrap gap-2" role="list" aria-label="Viral narrative hashtags">
        {HASHTAGS.map((tag) => (
          <span
            key={tag}
            role="listitem"
            className="inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold"
            style={{
              color: 'var(--color-accent-primary)',
              border: '1px solid var(--color-accent-primary)',
              background: 'rgba(43, 127, 255, 0.08)',
            }}
          >
            {tag}
          </span>
        ))}
      </div>
    </div>
  );
}
