import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import CaptionOverlay from '@/components/CaptionOverlay';
import { useLiveCaptions } from '@/hooks/useLiveCaptions';
import CallShell from '@/features/call/CallShell';
import CallControls from '@/features/call/components/CallControls';
import RttSidebar from '@/features/call/components/RttSidebar';

export default function CallView() {
  const { callId } = useParams();
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [showRtt, setShowRtt] = useState(false);

  // Video refs (replace with your own if you already have components)
  const remoteVideoRef = useRef(null);
  const localVideoRef = useRef(null);

  useEffect(() => {
    (async () => {
      const r = await fetch('/me');
      const j = await r.json();
      setUser(j.user || j);
    })();
  }, []);

  // TODO: wire to your real call engine
  useEffect(() => {
    // Example placeholder to show local camera (replace with your engine attach logic)
    let stream;
    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        if (localVideoRef.current) localVideoRef.current.srcObject = stream;
        // For demo, mirror local into remote as a placeholder
        if (remoteVideoRef.current) remoteVideoRef.current.srcObject = stream;
      } catch (e) {
        console.warn('getUserMedia failed (expected in dev without perms):', e);
      }
    })();
    return () => { stream?.getTracks?.().forEach(t => t.stop()); };
  }, []);

  if (!user) return <div className="p-4">Loading…</div>;

  const captionsOn = !!user?.a11yLiveCaptions;
  const { segments } = useLiveCaptions({ callId, enabled: captionsOn, language: 'en-US' });

  async function endCall() {
    // TODO: call your hangup endpoint/signaling, then navigate back
    navigate(-1);
  }

  return (
    <CallShell
      callId={callId}
      remoteVideoRef={remoteVideoRef}
      localVideoRef={localVideoRef}
      topRight={
        <button className="px-3 py-1.5 rounded-lg border text-sm" onClick={() => setShowRtt(v => !v)}>
          {showRtt ? 'Hide' : 'Show'} Live Chat (RTT)
        </button>
      }
      bottomBar={
        <CallControls
          callId={callId}
          currentUser={user}
          onEnd={endCall}
          onToggleCaptions={async (next) => {
            await fetch('/users/me/a11y', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ a11yLiveCaptions: next }) });
            setUser({ ...user, a11yLiveCaptions: next });
          }}
        />
      }
    >
      {/* Caption overlay */}
      {captionsOn && (
        <CaptionOverlay
          segments={segments}
          font={user.a11yCaptionFont || 'lg'}
          bg={user.a11yCaptionBg || 'dark'}
        />
      )}

      {/* RTT sidebar (mock UI; wire to your chat transport later) */}
      {showRtt && (
        <div className="absolute inset-y-0 right-0 w-full sm:w-80 bg-white/95 border-l shadow-lg">
          <RttSidebar callId={callId} />
        </div>
      )}
    </CallShell>
  );
}