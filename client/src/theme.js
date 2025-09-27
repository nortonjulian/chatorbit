import { createTheme } from '@mantine/core';

export const chatOrbitTheme = createTheme({
  colors: {
    // Mantine’s primary palette proxies to your CSS var
    orbit: Array(10).fill('var(--accent)'),
  },
  primaryColor: 'orbit',
  primaryShade: 5,
  defaultRadius: 'lg',
  fontFamily:
    'Inter, ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, "Apple Color Emoji", "Segoe UI Emoji"',

  components: {
    Button: {
      defaultProps: { radius: 'xl', size: 'md', variant: 'filled' },
      styles: () => ({
        root: {
          background: 'var(--orbit-gradient, var(--accent))',
          color: '#fff',
          border: 'none',
          boxShadow: '0 6px 20px rgba(43,109,246,0.22)',
        },
      }),
      variants: {
        filled: () => ({
          root: {
            background: 'var(--orbit-gradient, var(--accent))',
            color: '#fff',
            border: 'none',
          },
        }),
        light: () => ({
          root: {
            background: 'transparent',
            color: 'var(--accent)',
            border: '1px solid var(--border)',
          },
        }),
      },
    },

    TextInput: {
      defaultProps: { size: 'md', variant: 'filled' },
      styles: () => ({
        input: {
          backgroundColor: 'var(--card)',
          color: 'var(--fg)',
          borderColor: 'var(--border)',
          boxShadow: 'none',
        },
        label: { color: 'var(--fg)' },
      }),
      variants: {
        filled: () => ({
          input: {
            backgroundColor: 'var(--card)',
            borderColor: 'var(--border)',
            color: 'var(--fg)',
          },
        }),
      },
    },

    PasswordInput: {
      defaultProps: { size: 'md', variant: 'filled' },
      styles: () => ({
        input: {
          backgroundColor: 'var(--card)',
          color: 'var(--fg)',
          borderColor: 'var(--border)',
          boxShadow: 'none',
        },
        label: { color: 'var(--fg)' },
      }),
      variants: {
        filled: () => ({
          input: {
            backgroundColor: 'var(--card)',
            borderColor: 'var(--border)',
            color: 'var(--fg)',
          },
        }),
      },
    },
  },
});
