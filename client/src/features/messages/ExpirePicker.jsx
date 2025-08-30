import { useMemo } from 'react';
import { Select } from '@mantine/core';
import useEntitlements from '@/hooks/useEntitlements';

// Helper to build options up to max days
function buildOptions(maxDays) {
  const hours = [
    { label: 'Off', value: '0' },
    { label: '1 hour', value: String(60 * 60) },
    { label: '6 hours', value: String(6 * 60 * 60) },
    { label: '12 hours', value: String(12 * 60 * 60) },
  ];
  const days = [
    { d: 1 }, { d: 3 }, { d: 7 }, { d: 14 }, { d: 30 }
  ].filter(x => x.d <= maxDays).map(x => ({ label: `${x.d} day${x.d>1?'s':''}`, value: String(x.d * 24 * 60 * 60) }));

  return [...hours, ...days];
}

export default function ExpirePicker({ value, onChange, label = 'Disappearing messages' }) {
  const { entitlements } = useEntitlements();
  const maxDays = Number(entitlements?.expireMaxDays || 1);
  const data = useMemo(() => buildOptions(maxDays), [maxDays]);
  const val = value != null ? String(value) : '0';

  return (
    <Select
      label={label}
      data={data}
      value={val}
      onChange={(v) => onChange?.(Number(v || 0))}
      withinPortal
      allowDeselect={false}
    />
  );
}
