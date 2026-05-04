interface TagCloudProps {
  tags: string[];
}

/**
 * TagCloud — renders a list of tags as styled pill elements.
 * No external dependency required.
 */
export default function TagCloud({ tags }: TagCloudProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {tags.map((tag) => (
        <span
          key={tag}
          className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium"
          style={{
            backgroundColor: 'var(--color-surface-2)',
            color: 'var(--color-text-primary)',
            border: '1px solid var(--color-border)',
          }}
        >
          {tag}
        </span>
      ))}
    </div>
  );
}
