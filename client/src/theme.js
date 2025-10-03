import { createTheme } from '@mantine/core';

/**
 * Chatforia Mantine theme
 * - Consumes CSS variables from styles/themes.css
 * - Do not hardcode brand hexes here; rely on tokens only
 * - Light uses warm flagship sweep; Dark uses cool sweep (set in themes.css)
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

  /** Global component overrides */
  components: {
    // ---------- BUTTON ----------
    Button: {
      defaultProps: { radius: 'xl', size: 'md', variant: 'filled' },
      styles: () => ({
        root: {
          position: 'relative',
          background: 'var(--cta-gradient)',
          color: 'var(--cta-label)',
          border: 'none',
          boxShadow: '0 6px 20px var(--shadow-accent)',
          transition: 'filter .15s ease, box-shadow .15s ease, transform .05s ease',
          '::before': {
            content: '""',
            position: 'absolute',
            inset: 0,
            borderRadius: 'inherit',
            background: 'var(--cta-overlay, transparent)',
            pointerEvents: 'none',
          },
          '&:hover': { filter: 'brightness(1.03)' },
          '&:active': { transform: 'translateY(1px)' },
          '&:focus-visible': { outline: '2px solid transparent', boxShadow: '0 0 0 3px var(--ring)' },
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
        outline: () => ({
          root: {
            background: 'transparent',
            color: 'var(--accent)',
            border: '1.5px solid var(--accent)',
            boxShadow: 'none',
            '&:hover': { background: 'color-mix(in oklab, var(--accent) 10%, transparent)' },
          },
        }),
        subtle: () => ({
          root: {
            background: 'color-mix(in oklab, var(--accent) 10%, transparent)',
            color: 'var(--accent)',
            border: '1px solid var(--border)',
            boxShadow: 'none',
          },
        }),
        link: () => ({
          root: {
            background: 'transparent',
            color: 'var(--accent)',
            border: 'none',
            boxShadow: 'none',
            paddingInline: 0,
            '&:hover': { textDecoration: 'underline' },
          },
        }),
      },
    },

    // ---------- TEXT INPUTS ----------
    TextInput: {
      defaultProps: { size: 'md', variant: 'filled' },
      styles: () => ({
        input: {
          backgroundColor: 'var(--card)',
          color: 'var(--fg)',
          borderColor: 'var(--border)',
          boxShadow: 'none',
          '&:focus, &:focus-within': {
            borderColor: 'var(--accent)',
            boxShadow: '0 0 0 3px var(--ring)',
          },
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
          '&:focus, &:focus-within': {
            borderColor: 'var(--accent)',
            boxShadow: '0 0 0 3px var(--ring)',
          },
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

    Textarea: {
      defaultProps: { variant: 'filled' },
      styles: () => ({
        input: {
          backgroundColor: 'var(--card)',
          color: 'var(--fg)',
          borderColor: 'var(--border)',
          '&:focus, &:focus-within': { borderColor: 'var(--accent)', boxShadow: '0 0 0 3px var(--ring)' },
        },
        label: { color: 'var(--fg)' },
      }),
    },

    // ---------- TOGGLES ----------
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
        thumb: { background: '#fff' },
      }),
    },

    Checkbox: {
      styles: () => ({
        input: {
          '&:checked + .mantine-Checkbox-inner': {
            background: 'var(--switch-gradient)',
            borderColor: 'transparent',
          },
          '&:focus-visible + .mantine-Checkbox-inner': {
            boxShadow: '0 0 0 3px var(--ring)',
          },
        },
        icon: { color: '#fff' },
      }),
    },

    Radio: {
      styles: () => ({
        radio: {
          '&:checked': { background: 'var(--switch-gradient)', borderColor: 'transparent' },
          '&:focus-visible': { boxShadow: '0 0 0 3px var(--ring)' },
        },
        icon: { color: '#fff' },
      }),
    },

    // ---------- ACTION ICON ----------
    ActionIcon: {
      defaultProps: { radius: 'xl', variant: 'light' },
      variants: {
        filled: () => ({
          root: {
            background: 'var(--cta-gradient)',
            color: 'var(--cta-label)',
            border: 'none',
            boxShadow: '0 6px 20px var(--shadow-accent)',
            '&:hover': { filter: 'brightness(1.06)' },
          },
        }),
        light: () => ({
          root: {
            background: 'transparent',
            color: 'var(--accent)',
            border: '1px solid var(--border)',
            '&:hover': { background: 'color-mix(in oklab, var(--accent) 10%, transparent)' },
          },
        }),
      },
      styles: () => ({
        root: { '&:focus-visible': { boxShadow: '0 0 0 3px var(--ring)' } },
      }),
    },

    // ---------- BADGE ----------
    Badge: {
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
            background: 'color-mix(in oklab, var(--accent) 12%, transparent)',
            color: 'var(--accent)',
            border: '1px solid var(--border)',
          },
        }),
        outline: () => ({
          root: { color: 'var(--accent)', border: '1px solid var(--accent)', background: 'transparent' },
        }),
      },
    },

    // ---------- TABS ----------
    Tabs: {
      styles: () => ({
        tab: {
          color: 'var(--muted)',
          '&[data-active]': { color: 'var(--accent)' },
          '&:focus-visible': { boxShadow: '0 0 0 3px var(--ring)' },
        },
        indicator: { background: 'var(--accent)' },
        list: { borderColor: 'var(--border)' },
      }),
    },

    // ---------- LINKS ----------
    Anchor: {
      styles: () => ({
        root: {
          color: 'var(--accent)',
          textDecoration: 'none',
          '&:hover': { textDecoration: 'underline' },
          '&:focus-visible': { boxShadow: '0 0 0 3px var(--ring)', outline: '2px solid transparent' },
        },
      }),
    },

    // ---------- SURFACES ----------
    Paper: { styles: () => ({ root: { background: 'var(--card)', color: 'var(--fg)', borderColor: 'var(--border)' } }) },
    Card:  { styles: () => ({ root: { background: 'var(--card)', color: 'var(--fg)', borderColor: 'var(--border)' } }) },

    Modal: {
      styles: () => ({
        content: { background: 'var(--card)', color: 'var(--fg)', border: '1px solid var(--border)' },
        header:  { background: 'var(--card)', color: 'var(--fg)', borderBottom: '1px solid var(--border)' },
      }),
    },

    Popover: {
      styles: () => ({
        dropdown: { background: 'var(--card)', color: 'var(--fg)', border: '1px solid var(--border)' },
      }),
    },

    Menu: {
      styles: () => ({
        dropdown: { background: 'var(--card)', color: 'var(--fg)', border: '1px solid var(--border)' },
        item: { '&[data-hovered]': { background: 'color-mix(in oklab, var(--accent) 10%, transparent)' } },
      }),
    },

    Tooltip: {
      styles: () => ({
        tooltip: { background: 'var(--fg)', color: 'var(--bg)', border: '1px solid var(--border)' },
        arrow: { background: 'var(--fg)' },
      }),
    },

    // ---------- MISC ----------
    Loader: { styles: () => ({ root: { color: 'var(--accent)' } }) },
    Progress: {
      styles: () => ({
        root: { background: 'color-mix(in oklab, var(--accent) 12%, transparent)' },
        section: { background: 'var(--accent)' },
      }),
    },
  },
});
