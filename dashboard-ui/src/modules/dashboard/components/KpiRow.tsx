import KpiCard from '@/components/elements/KpiCard';

/**
 * KpiRow — renders the four top-level KPI cards for the main dashboard.
 * Collapses to a single column on small screens, two on sm, four on lg.
 */
export default function KpiRow() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <KpiCard
        label="TOTAL TOPICS"
        value="1,284"
        trend="+12%"
      />
      <KpiCard
        label="HIGH RISK ALERTS"
        value="24 CRITICAL"
        tags={['POLITICAL', 'CYBER']}
      />
      <KpiCard
        label="ACTIVE REGIONS"
        value="82 Nodes"
      />
      <KpiCard
        label="GLOBAL SENTIMENT"
        value="68/100"
        trend="STABLE TREND"
      />
    </div>
  );
}
