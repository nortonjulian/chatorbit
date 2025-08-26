import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import io from 'socket.io-client';

const CallCtx = createContext(null);
export const useCall = () => useContext(CallCtx);

export default function CallProvider({ children }) {
  const socketRef = useRef(null);
  const [incoming, setIncoming] = useState(null);     // { callId, fromUser, mode, chatId }
  const [active, setActive] = useState(null);         // { callId, peerUser, mode }
  const [status, setStatus] = useState('idle');       // 'idle' | 'ringing' | 'connecting' | 'in-call'
  const [iceServers, setIceServers] = useState([]);
  
  // WebRTC refs
  const pcRef = useRef(null);
  const localStreamRef = useRef(null);
  const remoteStreamRef = useRef(new MediaStream());

  // Init socket + ice servers
  useEffect(() => {
    socketRef.current = io(import.meta.env.VITE_API_BASE, { withCredentials: true });
    fetch(`${import.meta.env.VITE_API_BASE}/ice-servers`, { credentials: 'include' })
      .then(r => r.json()).then(({ iceServers }) => setIceServers(iceServers)).catch(() => {});
    const s = socketRef.current;

    // incoming call
    s.on('call:incoming', (p) => { setIncoming(p); setStatus('ringing'); });

    // accepted (other side accepted)
    s.on('call:accepted', ({ callId }) => {
      if (active?.callId === callId) {
        setStatus('connecting'); // start SDP as offerer
        startOffer();
      }
    });

    // room ready (both joined)
    s.on('call:ready', ({ callId }) => {
      // callee side: wait for offer
    });

    // signaling
    s.on('call:offer', async ({ callId, sdp }) => {
      if (active?.callId !== callId) return;
      await pcRef.current.setRemoteDescription(new RTCSessionDescription(sdp));
      const ans = await pcRef.current.createAnswer();
      await pcRef.current.setLocalDescription(ans);
      s.emit('call:answer', { callId, sdp: pcRef.current.localDescription });
    });

    s.on('call:answer', async ({ callId, sdp }) => {
      if (active?.callId !== callId) return;
      await pcRef.current.setRemoteDescription(new RTCSessionDescription(sdp));
      setStatus('in-call');
    });

    s.on('call:ice', async ({ callId, candidate }) => {
      if (active?.callId !== callId) return;
      try { await pcRef.current.addIceCandidate(candidate); } catch {}
    });

    s.on('call:rejected', () => { resetCall(); });
    s.on('call:end', () => { resetCall(); });

    return () => { s.close(); };
  }, []);

  function resetCall() {
    setIncoming(null);
    setActive(null);
    setStatus('idle');
    if (pcRef.current) { pcRef.current.ontrack = null; pcRef.current.close(); pcRef.current = null; }
    localStreamRef.current?.getTracks().forEach(t => t.stop());
    localStreamRef.current = null;
    remoteStreamRef.current = new MediaStream();
  }

  async function createPC() {
    const pc = new RTCPeerConnection({ iceServers });
    pc.onicecandidate = (e) => {
      if (e.candidate) socketRef.current.emit('call:ice', { callId: active.callId, candidate: e.candidate });
    };
    pc.ontrack = (e) => {
      e.streams[0].getTracks().forEach(t => remoteStreamRef.current.addTrack(t));
    };
    pcRef.current = pc;
  }

  async function getLocalStream(mode) {
    const constraints = mode === 'VIDEO'
      ? { audio: true, video: { width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 24 } } }
      : { audio: true, video: false };
    localStreamRef.current = await navigator.mediaDevices.getUserMedia(constraints);
    return localStreamRef.current;
  }

  // Caller: after call:accepted, start offer
  async function startOffer() {
    const stream = localStreamRef.current || await getLocalStream(active.mode);
    await createPC();
    stream.getTracks().forEach(t => pcRef.current.addTrack(t, stream));
    const offer = await pcRef.current.createOffer();
    await pcRef.current.setLocalDescription(offer);
    socketRef.current.emit('call:offer', { callId: active.callId, sdp: pcRef.current.localDescription });
  }

  // Public API
  async function startCall({ toUserId, chatId, mode }) {
    setStatus('connecting');
    // create local stream early for preview
    await getLocalStream(mode);
    const resp = await new Promise((resolve) => {
      socketRef.current.emit('call:invite', { toUserId, chatId, mode }, resolve);
    });
    if (resp?.ok) {
      setActive({ callId: resp.callId, peerUser: { id: toUserId }, mode });
      // Wait for 'call:accepted' then startOffer()
    } else {
      resetCall();
      throw new Error(resp?.error || 'Failed to start call');
    }
  }

  async function acceptCall() {
    const { callId, fromUser, mode } = incoming;
    await getLocalStream(mode);
    setActive({ callId, peerUser: fromUser, mode });
    await createPC();
    // add our tracks now; we will be the ANSWERER
    localStreamRef.current.getTracks().forEach(t => pcRef.current.addTrack(t, localStreamRef.current));
    await new Promise((resolve) => socketRef.current.emit('call:accept', { callId }, resolve));
    setIncoming(null);
    setStatus('connecting'); // wait for offer
  }

  function rejectCall() {
    if (!incoming) return;
    socketRef.current.emit('call:reject', { callId: incoming.callId });
    setIncoming(null);
    setStatus('idle');
  }

  function endCall() {
    const callId = active?.callId || incoming?.callId;
    if (callId) socketRef.current.emit('call:end', { callId, reason: 'hangup' });
    resetCall();
  }

  const value = useMemo(() => ({
    status, incoming, active,
    localStream: localStreamRef,
    remoteStream: remoteStreamRef,
    startCall, acceptCall, rejectCall, endCall,
  }), [status, incoming, active]);

  return <CallCtx.Provider value={value}>{children}</CallCtx.Provider>;
}
