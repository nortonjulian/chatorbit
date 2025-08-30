import { useEffect, useRef, useState } from 'react';
export function useLiveCaptionsWS({ callId, enabled, language='en-US' }) {
  const [segments, setSegments] = useState([]);
  const wsRef = useRef(null);
  useEffect(() => {
    let stopPolling = () => {};
    (async () => {
      if (!callId || !enabled) return;
      // Ask server for wsUrl (also enforces PremiumGuard/quotas)
      const r = await fetch(`/calls/${callId}/captions/start`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ language }) });
      if (!r.ok) return; // handle 402→redirect elsewhere
      const { wsUrl } = await r.json();
      const full = (wsUrl.startsWith('ws') ? wsUrl : (location.origin.replace('http','ws') + wsUrl));
      const ws = new WebSocket(full);
      wsRef.current = ws;
      ws.onmessage = (ev) => {
        try {
          const msg = JSON.parse(ev.data);
          if (msg.type === 'partial') setSegments(s => [...s, { text: msg.text }]);
          if (msg.type === 'final') setSegments(s => [...s, { text: msg.text }]);
        } catch {}
      };
      ws.onclose = () => { /* noop */ };
    })();
    return () => {
      wsRef.current?.close();
      fetch(`/calls/${callId}/captions/stop`, { method:'POST' }).catch(()=>{});
    };
  }, [callId, enabled, language]);
  return { segments };
}

