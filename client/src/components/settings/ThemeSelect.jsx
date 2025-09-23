import { useState, useMemo } from 'react';
import { Select } from '@mantine/core';
import { getTheme, setTheme } from '../../utils/themeManager';
import { THEME_CATALOG } from '../../config/themes';

export default function ThemeSelect({ isPremium }) {
  const [value, setValue] = useState(getTheme());

  const data = useMemo(() => {
    const toOpt = (t) => ({ value: t, label: t[0].toUpperCase() + t.slice(1) });
    return [
      { group: 'Free', items: THEME_CATALOG.free.map(toOpt) },
      {
        group: 'Premium',
        items: THEME_CATALOG.premium.map((t) => ({
          ...toOpt(t),
          disabled: !isPremium, // greyed out unless premium
        })),
      },
    ];
  }, [isPremium]);

  return (
    <Select
      label="Theme"
      value={value}
      data={data}
      onChange={(v) => {
        if (!v) return;
        if (!isPremium && THEME_CATALOG.premium.includes(v)) return;
        setValue(v);
        setTheme(v); // writes storage + sets <html data-theme="...">
      }}
      id="theme"
      withinPortal
    />
  );
}
