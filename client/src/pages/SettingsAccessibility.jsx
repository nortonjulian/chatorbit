import React, { useEffect, useState } from 'react';
import PremiumGuard from '@/components/PremiumGuard';

const FONT_OPTIONS = ['sm','md','lg','xl'];
const BG_OPTIONS = ['light','dark','transparent'];

export default function SettingsAccessibility() {
  const [user, setUser] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    // Fetch minimal profile with a11y fields (adjust endpoint if needed)
    (async () => {
      try {
        const r = await fetch('/me'); // or your user/me endpoint
        const j = await r.json();
        setUser(j.user || j);
      } catch (e) {
        setError('Failed to load settings');
      }
    })();
  }, []);

  async function patch(updates) {
    if (!user) return;
    setSaving(true); setError('');
    try {
      const r = await fetch('/users/me/a11y', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      });
      if (r.status === 402) {
        // Premium required for this toggle
        window.location.assign('/settings/upgrade');
        return;
      }
      const j = await r.json();
      if (!r.ok || j.error) throw new Error(j.error || 'Save failed');
      setUser({ ...user, ...updates, ...(j.user||{}) });
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  if (!user) return <div className="p-4">Loading…</div>;

  return (
    <div className="p-4 max-w-3xl">
      <h1 className="text-2xl font-semibold mb-1">Accessibility & Alerts</h1>
      <p className="text-sm text-gray-500 mb-4">Options to make ChatOrbit easier to use without relying on sound.</p>
      {error && <div className="mb-3 text-sm text-red-600">{error}</div>}

      <section className="space-y-4">
        <Card>
          <CardTitle>Notifications</CardTitle>
          <ToggleRow
            label="Visual alerts for messages & calls"
            desc="Show banners and title blink so you don’t miss activity."
            checked={!!user.a11yVisualAlerts}
            onChange={(v) => patch({ a11yVisualAlerts: v })}
          />
          <ToggleRow
            label="Vibrate on new messages (when supported)"
            desc="Trigger device vibration with incoming notifications."
            checked={!!user.a11yVibrate}
            onChange={(v) => patch({ a11yVibrate: v })}
          />
          <ToggleRow
            label="Flash screen on incoming call"
            desc="Brief bright flash when a call rings. Respects reduce‑motion."
            checked={!!user.a11yFlashOnCall}
            onChange={(v) => patch({ a11yFlashOnCall: v })}
          />
        </Card>

        <Card>
          <CardTitle>Live captions (calls)</CardTitle>
          <PremiumGuard inline>
            <ToggleRow
              label="Enable live captions during calls (Premium)"
              desc="Show real‑time captions from the other participant’s audio."
              checked={!!user.a11yLiveCaptions}
              onChange={(v) => patch({ a11yLiveCaptions: v })}
            />
          </PremiumGuard>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
            <SelectRow
              label="Caption font size"
              options={FONT_OPTIONS}
              value={user.a11yCaptionFont || 'lg'}
              onChange={(v) => patch({ a11yCaptionFont: v })}
            />
            <SelectRow
              label="Caption background"
              options={BG_OPTIONS}
              value={user.a11yCaptionBg || 'dark'}
              onChange={(v) => patch({ a11yCaptionBg: v })}
            />
          </div>
        </Card>

        <Card>
          <CardTitle>Voice notes</CardTitle>
          <ToggleRow
            label="Auto‑transcribe voice notes"
            desc="Attach a transcript to audio messages you receive."
            checked={!!user.a11yVoiceNoteSTT}
            onChange={(v) => patch({ a11yVoiceNoteSTT: v })}
          />
        </Card>
      </section>

      <div className="pt-4 text-sm text-gray-500">{saving ? 'Saving…' : 'Changes are saved instantly.'}</div>
    </div>
  );
}

function Card({ children }) {
  return <div className="rounded-2xl border p-4 shadow-sm bg-white space-y-3">{children}</div>;
}
function CardTitle({ children }) {
  return <h2 className="text-lg font-medium">{children}</h2>;
}
function ToggleRow({ label, desc, checked, onChange }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <div className="font-medium">{label}</div>
        {desc && <div className="text-xs text-gray-500">{desc}</div>}
      </div>
      <label className="inline-flex items-center cursor-pointer select-none">
        <input type="checkbox" className="sr-only" checked={checked} onChange={e=>onChange(e.target.checked)} />
        <span className={`w-11 h-6 flex items-center rounded-full p-1 transition ${checked?'bg-black':'bg-gray-300'}`}>
          <span className={`bg-white w-5 h-5 rounded-full transform transition ${checked?'translate-x-5':'translate-x-0'}`}></span>
        </span>
      </label>
    </div>
  );
}
function SelectRow({ label, options, value, onChange }) {
  return (
    <label className="flex items-center justify-between gap-4">
      <span className="font-medium">{label}</span>
      <select value={value} onChange={e=>onChange(e.target.value)} className="border rounded-lg px-3 py-2">
        {options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    </label>
  );
}