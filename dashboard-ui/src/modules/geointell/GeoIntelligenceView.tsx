'use client';

import RegionTabs from './components/RegionTabs';
import IndiaMap from './components/IndiaMap';
import DistrictBreakdown from './components/DistrictBreakdown';
import RegionalActivityTimeline from './components/RegionalActivityTimeline';
import ArcGauge from '@/components/charts/ArcGauge';
import KpiCard from '@/components/elements/KpiCard';
import ErrorBoundary from '@/components/common/ErrorBoundary';

/**
 * GeoIntelligenceView — the Geo Intelligence screen composition.
 *
 * Split layout: left side has region tabs + India map; right side has
 * risk gauge, KPI cards, district breakdown, and regional activity timeline.
 *
 * Requirements: 9.1, 9.6, 9.7, 9.8, 13.5
 */
export default function GeoIntelligenceView() {
  return (
    <ErrorBoundary fallback={<p>Geo Intelligence unavailable</p>}>
      <div className="flex flex-col gap-4">
        {/* Region tabs span full width */}
        <RegionTabs />

        {/* Split layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left: India map */}
          <div
            className="rounded-lg p-4"
            style={{ background: 'var(--color-surface)', color: 'var(--color-text-primary)' }}
          >
            <h2
              className="text-sm font-semibold uppercase tracking-widest mb-4"
              style={{ color: 'var(--color-text-secondary)' }}
            >
              GEO INTELLIGENCE
            </h2>
            <IndiaMap />
          </div>

          {/* Right: analysis panel */}
          <div className="flex flex-col gap-4">
            {/* Critical Risk Level gauge */}
            <div
              className="rounded-lg p-4 flex justify-center"
              style={{ background: 'var(--color-surface)' }}
            >
              <ArcGauge
                value={8.4}
                max={10}
                label="Critical Risk Level"
                ariaLabel="Critical Risk Level: 8.4 out of 10"
              />
            </div>

            {/* KPI cards row */}
            <div className="grid grid-cols-2 gap-4">
              <KpiCard
                label="SENTIMENT"
                value="-12.4%"
                trend="-12.4%"
                ariaLabel="Regional sentiment: -12.4%"
              />
              <KpiCard
                label="STABILITY"
                value="64%"
                ariaLabel="Regional stability: 64%"
              />
            </div>

            {/* District breakdown */}
            <div
              className="rounded-lg p-4"
              style={{ background: 'var(--color-surface)' }}
            >
              <DistrictBreakdown />
            </div>

            {/* Regional activity timeline */}
            <div
              className="rounded-lg p-4"
              style={{ background: 'var(--color-surface)' }}
            >
              <RegionalActivityTimeline />
            </div>
          </div>
        </div>
      </div>
    </ErrorBoundary>
  );
}
