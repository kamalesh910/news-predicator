import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { DistrictItem } from '@/modules/dashboard/types';

interface GeoState {
  activeRegionTab: string;
  selectedCityPin: string | null;
  districtBreakdown: DistrictItem[];
}

interface GeoActions {
  setActiveRegionTab: (tab: string) => void;
  setSelectedCityPin: (pin: string | null) => void;
  setDistrictBreakdown: (items: DistrictItem[]) => void;
}

type GeoStore = GeoState & GeoActions;

export const useGeoStore = create<GeoStore>()(
  persist(
    (set) => ({
      activeRegionTab: 'South Asia',
      selectedCityPin: null,
      districtBreakdown: [],

      setActiveRegionTab: (tab) => set({ activeRegionTab: tab }),
      setSelectedCityPin: (pin) => set({ selectedCityPin: pin }),
      setDistrictBreakdown: (items) => set({ districtBreakdown: items }),
    }),
    {
      name: 'sentinel-geo',
      storage: createJSONStorage(() => localStorage),
      skipHydration: true,
    }
  )
);
