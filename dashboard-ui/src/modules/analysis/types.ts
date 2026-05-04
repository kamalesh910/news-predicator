export type { EntitySalienceItem } from '../dashboard/types';

export interface SignalEvent {
  id: string;
  type: 'NARRATIVE SHIFT' | 'VOLATILITY ALERT' | 'SYSTEM UPDATE';
  timestamp: string;
  description: string;
}
