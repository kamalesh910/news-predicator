'use client';

import { useState } from 'react';
import TopicHeader from './components/TopicHeader';
import VelocityChart from '@/components/charts/VelocityChart';
import EntitySaliencePanel from './components/EntitySaliencePanel';
import SemanticCluster from './components/SemanticCluster';
import ViralNarratives from './components/ViralNarratives';
import NarrativeDriverCards from './components/NarrativeDriverCards';
import ArcGauge from '@/components/charts/ArcGauge';
import SignalStream from './components/SignalStream';
import ErrorBoundary from '@/components/common/ErrorBoundary';

const VELOCITY_DATA = [
  { time: '00:00', value: 38 },
  { time: '04:00', value: 55 },
  { time: '08:00', value: 72 },
  { time: '12:00', value: 91 },
  { time: '16:00', value: 67 },
  { time: '20:00', value: 49 },
];

/**
 * AnalysisView — the main topic analysis page composition.
 *
 * Composes all analysis sub-components inside an ErrorBoundary, providing
 * a velocity chart with time-range toggle, entity salience, semantic cluster,
 * viral narratives, narrative driver cards, a polarization arc gauge, and
 * a live signal stream.
 *
 * Requirements: 8.1, 8.2, 8.7, 13.5
 */
export default function AnalysisView() {
  const [activeRange, setActiveRange] = useState<string>('24H');

  return (
    <ErrorBoundary fallback={<p>Topic Analysis unavailable</p>}>
      <div className="flex flex-col gap-6">
        <TopicHeader />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <VelocityChart
            data={VELOCITY_DATA}
            timeRanges={['24H', '7D', '30D']}
            activeRange={activeRange}
            onRangeChange={setActiveRange}
            chartType="bar"
          />
          <EntitySaliencePanel />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <SemanticCluster />
          <ViralNarratives />
          <NarrativeDriverCards />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <ArcGauge
            value={72}
            max={100}
            label="Constructive Sentiment"
            ariaLabel="Polarization Index: 72% Constructive Sentiment"
          />
          <SignalStream />
        </div>
      </div>
    </ErrorBoundary>
  );
}
