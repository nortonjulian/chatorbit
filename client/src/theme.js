import { createTheme } from '@mantine/core';

export const chatOrbitTheme = createTheme({
  /** Brand colors: accessible blues/yellows */
  colors: {
    orbitBlue: [
      '#e8f0ff', '#cfe0ff', '#a7c5ff', '#7aa6ff', '#4c85ff',
      '#276bff', '#1a5df3', '#1348c1', '#0d3591', '#072361'
    ],
    orbitYellow: [
      '#fff9e6', '#fff1c2', '#ffe58a', '#ffd64d', '#ffc61a',
      '#e6ad00', '#b38700', '#806100', '#4d3a00', '#1a1400'
    ],
  },
  primaryColor: 'orbitBlue',
  fontFamily: 'Inter, ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, "Apple Color Emoji", "Segoe UI Emoji"',
  defaultRadius: 'lg',
});
