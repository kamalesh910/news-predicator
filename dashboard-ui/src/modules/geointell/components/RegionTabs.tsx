'use client';

import { useGeoStore } from '@/store/geoStore';

const TABS = ['South Asia', 'Central Asia', 'Southeast Asia'] as const;

export default function RegionTabs() {
  const { activeRegionTab, setActiveRegionTab } = useGeoStore();

  return (
    <nav aria-label="Region tabs" className="flex gap-1 mb-4" style={{ borderBottom: '1px solid var(--color-border)' }}>
      {TABS.map((tab) => {
        const isActive = activeRegionTab === tab;
        return (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveRegionTab(tab)}
            aria-current={isActive ? 'true' : undefined}
            className="px-4 py-2 text-sm font-medium transition-colors focus:outline-none"
            style={
              isActive
                ? { borderBottom: '2px solid var(--color-accent-primary)', color: 'var(--color-accent-primary)', marginBottom: '-1px' }
                : { color: 'var(--color-text-secondary)' }
            }
          >
            {tab}
          </button>
        );
      })}
    </nav>
  );
}
