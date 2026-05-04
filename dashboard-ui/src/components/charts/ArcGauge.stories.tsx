import type { Meta, StoryObj } from '@storybook/react';
import ArcGauge from './ArcGauge';

const meta: Meta<typeof ArcGauge> = {
  title: 'Charts/ArcGauge',
  component: ArcGauge,
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof ArcGauge>;

export const LowValue: Story = {
  args: {
    value: 20,
    max: 100,
    label: 'Low Risk',
    ariaLabel: 'Risk level: 20 out of 100',
  },
};

export const MidValue: Story = {
  args: {
    value: 50,
    max: 100,
    label: 'Moderate Risk',
    ariaLabel: 'Risk level: 50 out of 100',
  },
};

export const HighValue: Story = {
  args: {
    value: 84,
    max: 100,
    label: 'Critical Risk Level',
    ariaLabel: 'Risk level: 84 out of 100',
  },
};
