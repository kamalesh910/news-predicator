import type { Meta, StoryObj } from '@storybook/react';
import TagCloud from './TagCloud';

const meta: Meta<typeof TagCloud> = {
  title: 'Elements/TagCloud',
  component: TagCloud,
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof TagCloud>;

export const Default: Story = {
  args: {
    tags: ['INFRASTRUCTURE', 'INVESTMENT', 'HYDROGEN', 'RENEWABLE', 'POLICY'],
  },
};

export const ManyTags: Story = {
  args: {
    tags: [
      'INFRASTRUCTURE', 'INVESTMENT', 'HYDROGEN', 'RENEWABLE', 'POLICY',
      'EMISSIONS', 'STRATEGIC', 'ESG-Scoring', 'CLIMATE', 'ENERGY',
      'CARBON', 'SUSTAINABILITY', 'NET-ZERO', 'GRID',
    ],
  },
};
