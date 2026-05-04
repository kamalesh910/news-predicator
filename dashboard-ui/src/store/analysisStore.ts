import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { EntitySalienceItem } from '@/modules/dashboard/types';
import { SignalEvent } from '@/modules/analysis/types';

type TimeRange = '24H' | '7D' | '30D';

interface AnalysisState {
  activeTopicId: string | null;
  activeTimeRange: TimeRange;
  entitySalience: EntitySalienceItem[];
  signals: SignalEvent[];
}

interface AnalysisActions {
  setActiveTopicId: (topicId: string | null) => void;
  setActiveTimeRange: (range: TimeRange) => void;
  setEntitySalience: (items: EntitySalienceItem[]) => void;
  prependSignal: (event: SignalEvent) => void;
}

type AnalysisStore = AnalysisState & AnalysisActions;

export const useAnalysisStore = create<AnalysisStore>()(
  persist(
    (set) => ({
      activeTopicId: null,
      activeTimeRange: '24H',
      entitySalience: [],
      signals: [],

      setActiveTopicId: (topicId) => set({ activeTopicId: topicId }),
      setActiveTimeRange: (range) => set({ activeTimeRange: range }),
      setEntitySalience: (items) => set({ entitySalience: items }),

      prependSignal: (event) =>
        set((state) => {
          const updated = [event, ...state.signals];
          return { signals: updated.slice(0, 100) };
        }),
    }),
    {
      name: 'sentinel-analysis',
      storage: createJSONStorage(() => localStorage),
      skipHydration: true,
    }
  )
);
