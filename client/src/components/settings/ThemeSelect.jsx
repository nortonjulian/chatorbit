import { useState, useMemo, useEffect } from 'react';
import { Select, Switch, Stack } from '@mantine/core';
import { getTheme, setTheme } from '../../utils/themeManager';
import { THEME_CATALOG, THEME_LABELS } from '../../config/themes';

export default function ThemeSelect({ isPremium, hideFreeOptions = false }) {
  const [value, setValue] = useState(getTheme());
  const [coolOnMidnight, setCoolOnMidnight] = useState(
    typeof window !== 'undefined' ? localStorage.getItem('co-cta') === 'cool' : false
  );

  useEffect(() => {
    setTheme(value);
  }, []); // on mount

  // Apply/remember blue→purple override on Midnight
  useEffect(() => {
    const root = document.documentElement;
    if (value === 'midnight' && coolOnMidnight) {
      root.setAttribute('data-cta', 'cool');
      localStorage.setItem('co-cta', 'cool');
    } else {
      root.removeAttribute('data-cta');
      localStorage.removeItem('co-cta');
    }
  }, [value, coolOnMidnight]);

  const toOpt = (t) => ({ value: t, label: THEME_LABELS[t] || t });

  const data = useMemo(() => {
    const groups = [];
    if (!hideFreeOptions) {
      groups.push({ group: 'Free', items: THEME_CATALOG.free.map(toOpt) });
    }
    groups.push({
      group: 'Premium',
      items: THEME_CATALOG.premium.map((t) => ({
        ...toOpt(t),
        disabled: !isPremium,
      })),
    });
    return groups;
  }, [isPremium, hideFreeOptions]);

  return (
    <Stack gap="sm">
      <Select
        label="Theme"
        value={value}
        data={data}
        onChange={(v) => {
          if (!v) return;
          if (!isPremium && THEME_CATALOG.premium.includes(v)) return;
          setValue(v);
          setTheme(v);
        }}
        id="theme"
        withinPortal
      />
    </Stack>
  );
}
