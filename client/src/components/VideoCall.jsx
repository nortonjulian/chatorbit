import { useEffect, useMemo, useRef, useState } from 'react';
import { useCall } from '@/context/CallContext';

export default function VideoCall() {
  const { active, localStream, remoteStream, endCall } = useCall();
  const localRef = useRef(null);
  const remoteRef = useRef(null);
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);

  const inCall = useMemo(() => Boolean(active?.callId), [active]);

  // attach streams to video elements
  useEffect(() => {
    if (!inCall) return;
    const l = localRef.current;
    const r = remoteRef.current;

    if (l) {
      try { l.srcObject = localStream.current || null; } catch {}
      l.muted = true;
      l.playsInline = true;
      l.autoplay = true;
      l.onloadedmetadata = () => l.play().catch(() => {});
    }

    if (r) {
      try { r.srcObject = remoteStream.current || null; } catch {}
      r.playsInline = true;
      r.autoplay = true;
      r.onloadedmetadata = () => r.play().catch(() => {});
    }
  }, [inCall, localStream, remoteStream]);

  if (!inCall) return null;

  function toggleMic() {
    const tracks = localStream.current?.getAudioTracks?.() || [];
    const next = !micOn;
    tracks.forEach((t) => { t.enabled = next; });
    setMicOn(next);
  }

  function toggleCam() {
    const tracks = localStream.current?.getVideoTracks?.() || [];
    const next = !camOn;
    tracks.forEach((t) => { t.enabled = next; });
    setCamOn(next);
  }

  return (
    <div className="fixed inset-0 bg-black/80 z-40 flex items-center justify-center">
      <div className="relative w-full max-w-4xl aspect-video bg-black rounded-xl overflow-hidden shadow-2xl">
        {/* remote video big */}
        <video ref={remoteRef} className="absolute inset-0 w-full h-full object-cover" />

        {/* local preview pip */}
        <video
          ref={localRef}
          className="absolute bottom-4 right-4 w-48 h-28 object-cover rounded-lg border border-white/20 shadow-lg"
        />

        {/* controls */}
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-3">
          <button
            onClick={toggleMic}
            className={`px-4 py-2 rounded-full ${micOn ? 'bg-white/10 text-white' : 'bg-red-600 text-white'}`}
            title={micOn ? 'Mute microphone' : 'Unmute microphone'}
          >
            {micOn ? 'Mute' : 'Unmute'}
          </button>
          <button
            onClick={toggleCam}
            className={`px-4 py-2 rounded-full ${camOn ? 'bg-white/10 text-white' : 'bg-yellow-600 text-white'}`}
            title={camOn ? 'Turn camera off' : 'Turn camera on'}
          >
            {camOn ? 'Camera Off' : 'Camera On'}
          </button>
          <button
            onClick={endCall}
            className="px-4 py-2 rounded-full bg-red-700 text-white"
            title="Hang up"
          >
            Hang Up
          </button>
        </div>
      </div>
    </div>
  );
}
