import { useEffect, useMemo, useState } from 'react';
import { Switch } from '@mantine/core';
import PremiumGuard from '../components/PremiumGuard';
import axiosClient from '../api/axiosClient';
import { useUser } from '../context/UserContext';

const FONT_OPTIONS = ['sm', 'md', 'lg', 'xl'];
const BG_OPTIONS = ['light', 'dark', 'transparent'];

// Tailwind helpers: keep UI modest by default
const UI_FONT_SIZE_CLASSES = { sm: 'text-sm', md: 'text-base', lg: 'text-lg', xl: 'text-xl' };

// 🔧 Adjust this if your router is mounted with a prefix (e.g., '/api')
const A11Y_PATH = '/users/me/a11y';

export default function SettingsAccessibility() {
  const { currentUser } = useUser();

  const [loaded, setLoaded] = useState(!!currentUser);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  // Keep raw user and a separate prefs object that drives the UI
  const [user, setUser] = useState(currentUser || null);
  const [prefs, setPrefs] = useState(() => projectPrefs(currentUser));

  // Field-level error map so a failing toggle shows an inline hint, not a global rollback
  const [fieldErrors, setFieldErrors] = useState({});

  // Capability checks
  const vibSupported = typeof navigator !== 'undefined' && 'vibrate' in navigator;
  const reduceMotion =
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;

  // Small by default; user can opt into bigger
  const uiFont = prefs.a11yUiFont || 'md';
  const uiFontClass = useMemo(() => UI_FONT_SIZE_CLASSES[uiFont] || UI_FONT_SIZE_CLASSES.md, [uiFont]);

  // Load fresh user (and merge prefs)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data } = await axiosClient.get('/users/me');
        if (cancelled) return;
        const fresh = data.user || data;
        setUser(fresh);
        setPrefs((prev) => ({ ...prev, ...projectPrefs(fresh) }));
        setError('');
      } catch (e) {
        if (!cancelled) setError('Failed to load settings');
      } finally {
        if (!cancelled) setLoaded(true);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Generic optimistic saver: updates UI first, persists second, shows inline error if it fails
  async function savePref(field, value) {
    setFieldErrors((m) => ({ ...m, [field]: '' }));
    setPrefs((p) => ({ ...p, [field]: value })); // 👈 instant UI change
    setSaving(true);
    try {
      const body = { [field]: value };
      const { data } = await axiosClient.patch(A11Y_PATH, body);
      // Merge server echo if present
      const serverUser = data?.user || null;
      if (serverUser) {
        setUser((u) => ({ ...(u || {}), ...serverUser }));
        setPrefs((p) => ({ ...p, ...projectPrefs(serverUser) }));
      }
    } catch (e) {
      const msg = readableAxiosError(e) || 'Save failed';
      setFieldErrors((m) => ({ ...m, [field]: msg }));
      // ❗ We DO NOT roll back the UI; the user keeps their toggle visually on.
      // If you prefer rollback, uncomment:
      // setPrefs((p) => ({ ...p, [field]: user?.[field] ?? defaultFor(field) }));
    } finally {
      setSaving(false);
    }
  }

  if (!loaded) return <div className="p-4">Loading…</div>;
  if (error && !user) return <div className="p-4 text-red-600">{error}</div>;

  return (
    <div className={`p-4 max-w-3xl ${uiFontClass}`}>
      <h1 className="font-semibold mb-1">Accessibility &amp; Alerts</h1>
      <p className="text-gray-500 mb-4">Options to make ChatOrbit easier to use without relying on sound.</p>
      {error && <div className="mb-3 text-sm text-red-600">{error}</div>}

      <section className="space-y-4">
        {/* Interface font size (controls overall size of this panel) */}
        <Card>
          <CardTitle>Interface font size</CardTitle>
          <SelectRow
            label="Interface font size"
            options={FONT_OPTIONS}
            value={prefs.a11yUiFont || 'md'}
            onChange={(v) => savePref('a11yUiFont', v)}
          />
          {fieldErrors.a11yUiFont && <FieldError msg={fieldErrors.a11yUiFont} />}
          <div className="text-xs text-gray-500">
            Starts at normal size. Increase if you prefer larger text in accessibility settings.
          </div>
        </Card>

        <Card>
          <CardTitle>Notifications</CardTitle>

          <SwitchRow
            label="Visual alerts for messages & calls"
            desc="Show banners and title blink so you don’t miss activity."
            checked={!!prefs.a11yVisualAlerts}
            onChange={(v) => savePref('a11yVisualAlerts', v)}
            errorMsg={fieldErrors.a11yVisualAlerts}
          />

          <SwitchRow
            label="Vibrate on new messages (when supported)"
            desc={vibSupported ? 'Trigger device vibration with notifications.' : 'Not supported on this device.'}
            checked={!!prefs.a11yVibrate}
            onChange={(v) => savePref('a11yVibrate', v)}
            disabled={!vibSupported}
            errorMsg={fieldErrors.a11yVibrate}
          />

          <SwitchRow
            label="Flash screen on incoming call"
            desc={reduceMotion ? 'Disabled due to system reduce-motion.' : 'Brief bright flash when a call rings.'}
            checked={!!prefs.a11yFlashOnCall}
            onChange={(v) => savePref('a11yFlashOnCall', v)}
            disabled={reduceMotion}
            errorMsg={fieldErrors.a11yFlashOnCall}
          />
        </Card>

        <Card>
          <CardTitle>Live captions (calls)</CardTitle>
          <PremiumGuard inline>
            <SwitchRow
              label="Enable live captions during calls (Premium)"
              desc="Show real-time captions from the other participant’s audio."
              checked={!!prefs.a11yLiveCaptions}
              onChange={(v) => savePref('a11yLiveCaptions', v)}
              errorMsg={fieldErrors.a11yLiveCaptions}
            />
          </PremiumGuard>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
            <SelectRow
              label="Caption font size"
              options={FONT_OPTIONS}
              value={prefs.a11yCaptionFont || 'lg'}
              onChange={(v) => savePref('a11yCaptionFont', v)}
            />
            {fieldErrors.a11yCaptionFont && <FieldError msg={fieldErrors.a11yCaptionFont} />}

            <SelectRow
              label="Caption background"
              options={['light', 'dark', 'transparent']}
              value={prefs.a11yCaptionBg || 'dark'}
              onChange={(v) => savePref('a11yCaptionBg', v)}
            />
            {fieldErrors.a11yCaptionBg && <FieldError msg={fieldErrors.a11yCaptionBg} />}
          </div>
        </Card>

        <Card>
          <CardTitle>Voice notes</CardTitle>
          <SwitchRow
            label="Auto-transcribe voice notes"
            desc="Attach a transcript to audio messages you receive."
            checked={!!prefs.a11yVoiceNoteSTT}
            onChange={(v) => savePref('a11yVoiceNoteSTT', v)}
            errorMsg={fieldErrors.a11yVoiceNoteSTT}
          />
        </Card>
      </section>

      <div className="pt-4 text-sm text-gray-500">{saving ? 'Saving…' : 'Changes are saved instantly.'}</div>
    </div>
  );
}

/* ---------------- helpers & presentational ---------------- */

function projectPrefs(u) {
  if (!u) return {
    a11yUiFont: 'md',
    a11yVisualAlerts: false,
    a11yVibrate: false,
    a11yFlashOnCall: false,
    a11yLiveCaptions: false,
    a11yVoiceNoteSTT: false,
    a11yCaptionFont: 'lg',
    a11yCaptionBg: 'dark',
  };
  return {
    a11yUiFont: u.a11yUiFont ?? 'md',
    a11yVisualAlerts: !!u.a11yVisualAlerts,
    a11yVibrate: !!u.a11yVibrate,
    a11yFlashOnCall: !!u.a11yFlashOnCall,
    a11yLiveCaptions: !!u.a11yLiveCaptions,
    a11yVoiceNoteSTT: !!u.a11yVoiceNoteSTT,
    a11yCaptionFont: u.a11yCaptionFont || 'lg',
    a11yCaptionBg: u.a11yCaptionBg || 'dark',
  };
}

function readableAxiosError(e) {
  if (!e) return '';
  const status = e.response?.status;
  const msg = e.response?.data?.error || e.message;
  if (status === 401) return 'Please sign in again.';
  if (status === 402) return 'Premium required.';
  if (status === 403) return 'Not allowed.';
  if (status === 404) return 'Endpoint not found.';
  return msg || 'Save failed';
}

function FieldError({ msg }) {
  if (!msg) return null;
  return <div className="text-xs text-red-600 mt-1">{msg}</div>;
}

function Card({ children }) {
  return <div className="rounded-2xl border p-4 shadow-sm bg-white space-y-3">{children}</div>;
}

function CardTitle({ children }) {
  return <h2 className="font-medium">{children}</h2>;
}

function SwitchRow({ label, desc, checked, onChange, disabled, errorMsg }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        <div className="font-medium">{label}</div>
        {desc && <div className="text-xs text-gray-500">{desc}</div>}
        {errorMsg && <FieldError msg={errorMsg} />}
      </div>
      <Switch
        checked={!!checked}
        onChange={(e) => {
          // Ensure the handler fires even if some parent is inert
          e.stopPropagation?.();
          onChange(e.currentTarget.checked);
        }}
        disabled={disabled}
        aria-label={label}
        // Prevent any parent container from swallowing clicks
        style={{ pointerEvents: 'auto' }}
      />
    </div>
  );
}

function SelectRow({ label, options, value, onChange }) {
  return (
    <label className="flex items-center justify-between gap-4">
      <span className="font-medium">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="border rounded-lg px-3 py-2"
      >
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </label>
  );
}
