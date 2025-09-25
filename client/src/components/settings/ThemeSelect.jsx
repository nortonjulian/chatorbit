import { useState, useMemo, useEffect } from 'react';
import { Select } from '@mantine/core';
import { getTheme, setTheme } from '../../utils/themeManager';
import { THEME_CATALOG, THEME_LABELS } from '../../config/themes';

export default function ThemeSelector({ isPremium }) {
  const [value, setValue] = useState(getTheme());

  // Ensure the attribute is set on first mount too
  useEffect(() => {
    // in case main.jsx hasn’t applied yet
    setTheme(value);
  }, []); // run once

  const toOpt = (t) => ({ value: t, label: THEME_LABELS[t] || t });
  const data = useMemo(() => ([
    { group: 'Free', items: THEME_CATALOG.free.map(toOpt) },
    {
      group: 'Premium',
      items: THEME_CATALOG.premium.map((t) => ({
        ...toOpt(t),
        disabled: !isPremium,
      })),
    },
  ]), [isPremium]);

  return (
    <Select
      label="Theme"
      value={value}
      data={data}
      onChange={(v) => {
        if (!v) return;
        if (!isPremium && THEME_CATALOG.premium.includes(v)) return;
        setValue(v);
        setTheme(v); // sets localStorage and <html data-theme="...">
      }}
      id="theme"
      withinPortal
    />
  );
}
