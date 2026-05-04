import type { Meta, StoryObj } from '@storybook/react';
import KpiCard from './KpiCard';

const meta: Meta<typeof KpiCard> = {
  title: 'Elements/KpiCard',
  component: KpiCard,
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof KpiCard>;

export const Default: Story = {
  args: {
    label: 'TOTAL TOPICS',
    value: '1,284',
  },
};

export const WithTrend: Story = {
  args: {
    label: 'GLOBAL SENTIMENT',
    value: '68/100',
    trend: '+12%',
  },
};

export const WithTags: Story = {
  args: {
    label: 'HIGH RISK ALERTS',
    value: '24 CRITICAL',
    tags: ['POLITICAL', 'CYBER'],
  },
};

export const CriticalAlert: Story = {
  args: {
    label: 'ACTIVE THREATS',
    value: '7 CRITICAL',
    trend: '-3%',
    tags: ['MILITARY', 'CYBER', 'ECONOMIC'],
    ariaLabel: 'Active threats: 7 critical',
  },
};
