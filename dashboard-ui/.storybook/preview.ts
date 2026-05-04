import type { Preview } from '@storybook/react';
import '../src/assets/styles/variables.css';
import '../src/app/globals.css';

const preview: Preview = {
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    backgrounds: {
      default: 'dark',
      values: [
        { name: 'dark', value: '#11151F' },
        { name: 'light', value: '#ffffff' },
      ],
    },
  },
};

export default preview;
