import type { Meta, StoryObj } from '@storybook/react';
import VelocityChart from './VelocityChart';

const SAMPLE_DATA = [
  { time: '00:00', value: 45 },
  { time: '04:00', value: 62 },
  { time: '08:00', value: 78 },
  { time: '12:00', value: 84 },
  { time: '16:00', value: 71 },
  { time: '20:00', value: 58 },
];

const meta: Meta<typeof VelocityChart> = {
  title: 'Charts/VelocityChart',
  component: VelocityChart,
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof VelocityChart>;

export const LineChart: Story = {
  args: {
    data: SAMPLE_DATA,
    timeRanges: ['1H', '24H', '7D'],
    activeRange: '24H',
    onRangeChange: () => {},
    chartType: 'line',
  },
};

export const BarChart: Story = {
  args: {
    data: SAMPLE_DATA,
    timeRanges: ['24H', '7D', '30D'],
    activeRange: '7D',
    onRangeChange: () => {},
    chartType: 'bar',
  },
};

export const WithPeakAnnotation: Story = {
  args: {
    data: SAMPLE_DATA,
    timeRanges: ['1H', '24H', '7D'],
    activeRange: '24H',
    onRangeChange: () => {},
    chartType: 'line',
    peakAnnotation: 'PEAK: 84.2',
  },
};
