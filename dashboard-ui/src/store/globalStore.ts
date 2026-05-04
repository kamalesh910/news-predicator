import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { ConnectionStatus } from '@/modules/dashboard/types';

interface GlobalState {
  wsStatus: ConnectionStatus;
  searchQuery: string;
  notificationCount: number;
}

interface GlobalActions {
  setWsStatus: (status: ConnectionStatus) => void;
  setSearchQuery: (query: string) => void;
  setNotificationCount: (count: number) => void;
}

type GlobalStore = GlobalState & GlobalActions;

export const useGlobalStore = create<GlobalStore>()(
  persist(
    (set) => ({
      wsStatus: 'disconnected',
      searchQuery: '',
      notificationCount: 0,

      setWsStatus: (status) => set({ wsStatus: status }),
      setSearchQuery: (query) => set({ searchQuery: query }),
      setNotificationCount: (count) => set({ notificationCount: count }),
    }),
    {
      name: 'sentinel-global',
      storage: createJSONStorage(() => localStorage),
      skipHydration: true,
    }
  )
);
