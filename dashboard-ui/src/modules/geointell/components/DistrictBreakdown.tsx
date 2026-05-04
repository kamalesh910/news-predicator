'use client';

import { useGeoStore } from '@/store/geoStore';
import AlertTag from '@/components/elements/AlertTag';

interface District {
  id: string;
  name: string;
  riskLevel: 'critical' | 'elevated' | 'stable';
  signalDensity: number;
  anomalies: number;
}

const DISTRICTS: District[] = [
  { id: 'central-delhi', name: 'Central Delhi', riskLevel: 'critical', signalDensity: 92, anomalies: 14 },
  { id: 'south-delhi', name: 'South Delhi', riskLevel: 'elevated', signalDensity: 74, anomalies: 3 },
  { id: 'east-delhi', name: 'East Delhi', riskLevel: 'stable', signalDensity: 45, anomalies: 1 },
];

const DENSITY_BAR_COLORS: Record<District['riskLevel'], string> = {
  critical: 'var(--color-alert)',
  elevated: '#FBBF24',
  stable: '#34D399',
};

export default function DistrictBreakdown() {
  const { selectedCityPin } = useGeoStore();

  return (
    <div className="flex flex-col gap-2" aria-label="District breakdown">
      <h3 className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: 'var(--color-text-secondary)' }}>
        District Breakdown
      </h3>
      {DISTRICTS.map((district) => {
        const isHighlighted = selectedCityPin === district.id;
        return (
          <div
            key={district.id}
            className="rounded p-3 border transition-colors"
            style={{
              borderColor: isHighlighted ? 'var(--color-accent-primary)' : 'var(--color-border)',
              background: isHighlighted ? 'rgba(43, 127, 255, 0.08)' : 'var(--color-surface-2)',
            }}
            aria-selected={isHighlighted}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>{district.name}</span>
              <AlertTag label={district.riskLevel.toUpperCase()} variant={district.riskLevel} />
            </div>
            <div className="mb-1">
              <div className="flex justify-between text-xs mb-1" style={{ color: 'var(--color-text-secondary)' }}>
                <span>Signal Density</span>
                <span>{district.signalDensity}%</span>
              </div>
              <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--color-border)' }}>
                <div
                  className="h-full rounded-full"
                  style={{ width: `${district.signalDensity}%`, backgroundColor: DENSITY_BAR_COLORS[district.riskLevel] }}
                  role="progressbar"
                  aria-valuenow={district.signalDensity}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label={`Signal density ${district.signalDensity}%`}
                />
              </div>
            </div>
            <div className="text-xs mt-1" style={{ color: 'var(--color-text-secondary)' }}>
              <span className="font-medium" style={{ color: 'var(--color-text-primary)' }}>{district.anomalies}</span>{' '}
              {district.anomalies === 1 ? 'anomaly' : 'anomalies'} detected
            </div>
          </div>
        );
      })}
    </div>
  );
}
