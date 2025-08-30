import { useEffect, useRef, useState } from 'react';

export function useLiveCaptions({ callId, enabled, language = 'en-US' }) {
  const [segments, setSegments] = useState([]);
  const running = useRef(false);

  useEffect(() => {
    let stop = () => {};
    (async () => {
      if (!callId || !enabled) return;
      try {
        running.current = true;
        await fetch(`/calls/${callId}/captions/start`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ language }) });
        // MOCK: poll transcript every 2s (replace with WS later)
        const id = setInterval(async () => {
          if (!running.current) return;
          try {
            const r = await fetch(`/calls/${callId}/transcript`);
            if (r.ok) {
              const j = await r.json();
              setSegments(j.transcript?.segments || []);
            }
          } catch {}
        }, 2000);
        stop = () => clearInterval(id);
      } catch (e) {
        console.warn('captions start failed', e);
      }
    })();
    return () => { running.current = false; stop(); };
  }, [callId, enabled, language]);

  const stopCaptions = async () => {
    try { await fetch(`/calls/${callId}/captions/stop`, { method: 'POST' }); } catch {}
  };

  return { segments, stopCaptions };
}