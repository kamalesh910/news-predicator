import TagCloud from '@/components/elements/TagCloud';

/**
 * SemanticCluster — displays a tag cloud of semantically related terms
 * for the active analysis topic.
 */
export default function SemanticCluster() {
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
        Semantic Cluster
      </h2>

      <TagCloud
        tags={[
          'INFRASTRUCTURE',
          'INVESTMENT',
          'HYDROGEN',
          'RENEWABLE',
          'POLICY',
          'EMISSIONS',
          'STRATEGIC',
          'ESG-Scoring',
        ]}
      />
    </div>
  );
}
