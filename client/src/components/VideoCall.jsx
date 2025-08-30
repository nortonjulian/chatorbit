import { useEffect, useRef } from 'react';
import socket from '../lib/socket';           
import { API_BASE } from "@/config";    

export default function VideoCall({ partnerId }) {
  const localVideo = useRef(null);
  const remoteVideo = useRef(null);
  const pcRef = useRef(null);

  useEffect(() => {
    let pc;

    async function init() {
      // 1) Fetch ICE servers (Telnyx + Bandwidth proxied by your API)
      const res = await fetch(`${API_BASE}/ice-servers?provider=all`, {
        credentials: 'include',
        headers: { 'X-Requested-With': 'XMLHttpRequest' },
      });
      const { iceServers } = await res.json();

      // 2) Create RTCPeerConnection
      pc = new RTCPeerConnection({ iceServers });
      pcRef.current = pc;

      // 3) Local media
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      stream.getTracks().forEach((track) => pc.addTrack(track, stream));
      if (localVideo.current) localVideo.current.srcObject = stream;

      // 4) Remote track handler
      pc.ontrack = (event) => {
        if (remoteVideo.current) remoteVideo.current.srcObject = event.streams[0];
      };

      // 5) Relay ICE candidates via socket
      pc.onicecandidate = (event) => {
        if (event.candidate) {
          socket.emit('call:candidate', { candidate: event.candidate, to: partnerId });
        }
      };

      // (Offer/Answer signaling lives elsewhere; this component just wires media/ICE)
    }

    init();

    return () => {
      try { pc?.close(); } catch {}
      // Do NOT disconnect the shared socket here
    };
  }, [partnerId]);

  return (
    <div>
      <video ref={localVideo} autoPlay muted playsInline />
      <video ref={remoteVideo} autoPlay playsInline />
    </div>
  );
}
