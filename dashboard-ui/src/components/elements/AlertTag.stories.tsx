import type { Meta, StoryObj } from '@storybook/react';
import AlertTag from './AlertTag';

const meta: Meta<typeof AlertTag> = {
  title: 'Elements/AlertTag',
  component: AlertTag,
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof AlertTag>;

export const Critical: Story = {
  args: {
    label: 'CRITICAL',
    variant: 'critical',
  },
};

export const Elevated: Story = {
  args: {
    label: 'ELEVATED',
    variant: 'elevated',
  },
};

export const Stable: Story = {
  args: {
    label: 'STABLE',
    variant: 'stable',
  },
};
