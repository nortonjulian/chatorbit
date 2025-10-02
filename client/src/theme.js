import { createTheme } from '@mantine/core';

/**
 * Chatforia Mantine theme
 * - Uses CSS variables defined in styles/themes.css
 * - Primary color maps to --accent by design (interactive accents)
 * - Components lean on var(--cta-gradient), var(--card), var(--fg), etc.
 */
export const chatforiaTheme = createTheme({
  colors: {
    // Mantine expects a 10-step scale; we proxy to CSS var to keep tokens single-source.
    foria: Array(10).fill('var(--accent)'),
  },
  primaryColor: 'foria',
  primaryShade: 5,
  defaultRadius: 'lg',
  fontFamily:
    'Inter, ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, "Apple Color Emoji", "Segoe UI Emoji"',

  components: {
    Button: {
      defaultProps: { radius: 'xl', size: 'md', variant: 'filled' },
      styles: () => ({
        root: {
          position: 'relative',
          background: 'var(--cta-gradient)',    // theme-aware CTA gradient
          color: 'var(--cta-label)',            // readable on both themes
          border: 'none',
          boxShadow: '0 6px 20px var(--shadow-accent)',
          transition: 'filter .15s ease, box-shadow .15s ease, transform .05s ease',
          '::before': {
            content: '""',
            position: 'absolute',
            inset: 0,
            borderRadius: 'inherit',
            background: 'var(--cta-overlay, transparent)', // dark overlay in midnight
            pointerEvents: 'none',
          },
          '&:hover': { filter: 'brightness(1.03)' },
          '&:active': { transform: 'translateY(1px)' },
          '&[data-disabled]': {
            filter: 'saturate(0.85) opacity(0.85)',
            boxShadow: 'none',
          },
        },
      }),
      variants: {
        filled: () => ({
          root: {
            background: 'var(--cta-gradient)',
            color: 'var(--cta-label)',
            border: 'none',
          },
        }),
        light: () => ({
          root: {
            background: 'transparent',
            color: 'var(--accent)',
            border: '1px solid var(--border)',
            boxShadow: 'none',
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

    /* Switch & Checkbox follow --switch-gradient everywhere */
    Switch: {
      styles: () => ({
        root: {
          '&[data-checked] .mantine-Switch-track, &[data-checked="true"] .mantine-Switch-track': {
            background: 'var(--switch-gradient)',
            borderColor: 'transparent',
          },
        },
        track: {
          backgroundColor: 'var(--border)',
          border: '1px solid var(--border)',
        },
        thumb: { background: '#fff' }, // chosen for contrast atop the gradient
      }),
    },

    Checkbox: {
      styles: () => ({
        input: {
          '&:checked + .mantine-Checkbox-inner': {
            background: 'var(--switch-gradient)',
            borderColor: 'transparent',
          },
        },
        icon: { color: '#fff' }, // keeps icon visible atop gradient fill
      }),
    },
  },
});
