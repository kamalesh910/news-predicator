interface AlertTagProps {
  label: string;
  variant: 'critical' | 'elevated' | 'stable';
}

const variantStyles: Record<AlertTagProps['variant'], React.CSSProperties> = {
  critical: {
    backgroundColor: 'rgba(231, 129, 112, 0.15)',
    color: 'var(--color-alert)',
    borderColor: 'var(--color-alert)',
  },
  elevated: {
    backgroundColor: 'rgba(251, 191, 36, 0.15)',
    color: '#FBBF24',
    borderColor: '#FBBF24',
  },
  stable: {
    backgroundColor: 'rgba(52, 211, 153, 0.15)',
    color: '#34D399',
    borderColor: '#34D399',
  },
};

/**
 * AlertTag — displays a risk level badge with both color and text label.
 * Never conveys risk level through color alone (WCAG 1.4.1).
 */
export default function AlertTag({ label, variant }: AlertTagProps) {
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold border"
      style={variantStyles[variant]}
    >
      {label}
    </span>
  );
}
