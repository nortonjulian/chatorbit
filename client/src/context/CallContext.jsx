import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import io from 'socket.io-client';

const CallCtx = createContext(null);
export const useCall = () => useContext(CallCtx);

export const CallProvider = ({ children }) => {
  const socketRef = useRef(null);
  const [incoming, setIncoming] = useState(null);   // { callId, fromUser, mode, chatId }
  const [active, setActive] = useState(null);       // { callId, peerUser, mode }
  const [status, setStatus] = useState('idle');     // 'idle' | 'ringing' | 'connecting' | 'in-call'
  const [iceServers, setIceServers] = useState([]);

  // WebRTC refs
  const pcRef = useRef(null);
  const localStreamRef = useRef(null);
  const remoteStreamRef = useRef(new MediaStream());

  // Initialize socket + fetch TURN/STUN servers
  useEffect(() => {
    const base = import.meta.env.VITE_API_BASE;
    socketRef.current = io(base, { withCredentials: true });

    fetch(`${base}/ice-servers`, { credentials: 'include' })
      .then(r => r.json())
      .then(({ iceServers }) => Array.isArray(iceServers) && setIceServers(iceServers))
      .catch(() => { /* ignore; browser will still try default STUN if any */ });

    const s = socketRef.current;

    // Incoming call
    const onIncoming = (payload) => {
      setIncoming(payload);
      setStatus('ringing');
    };

    // Caller-side: callee accepted
    const onAccepted = ({ callId }) => {
      if (active?.callId === callId) {
        setStatus('connecting'); // start SDP as offerer
        startOffer();
      }
    };

    // Callee-side: room ready — wait for offer
    const onReady = () => { /* noop: handled by 'offer' */ };

    // Signaling
    const onOffer = async ({ callId, sdp }) => {
      if (active?.callId !== callId || !pcRef.current) return;
      await pcRef.current.setRemoteDescription(new RTCSessionDescription(sdp));
      const answer = await pcRef.current.createAnswer();
      await pcRef.current.setLocalDescription(answer);
      s.emit('call:answer', { callId, sdp: pcRef.current.localDescription });
    };

    const onAnswer = async ({ callId, sdp }) => {
      if (active?.callId !== callId || !pcRef.current) return;
      await pcRef.current.setRemoteDescription(new RTCSessionDescription(sdp));
      setStatus('in-call');
    };

    const onIce = async ({ callId, candidate }) => {
      if (active?.callId !== callId || !pcRef.current || !candidate) return;
      try { await pcRef.current.addIceCandidate(candidate); } catch { /* ignore */ }
    };

    const onRejected = () => resetCall();
    const onEnd = () => resetCall();

    s.on('call:incoming', onIncoming);
    s.on('call:accepted', onAccepted);
    s.on('call:ready', onReady);
    s.on('call:offer', onOffer);
    s.on('call:answer', onAnswer);
    s.on('call:ice', onIce);
    s.on('call:rejected', onRejected);
    s.on('call:end', onEnd);

    return () => {
      s.off('call:incoming', onIncoming);
      s.off('call:accepted', onAccepted);
      s.off('call:ready', onReady);
      s.off('call:offer', onOffer);
      s.off('call:answer', onAnswer);
      s.off('call:ice', onIce);
      s.off('call:rejected', onRejected);
      s.off('call:end', onEnd);
      s.close();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active?.callId]);

  function resetCall() {
    setIncoming(null);
    setActive(null);
    setStatus('idle');

    if (pcRef.current) {
      pcRef.current.ontrack = null;
      pcRef.current.onicecandidate = null;
      try { pcRef.current.close(); } catch {}
      pcRef.current = null;
    }

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(t => t.stop());
      localStreamRef.current = null;
    }

    // Replace remote stream instance
    remoteStreamRef.current = new MediaStream();
  }

  async function createPC() {
    const pc = new RTCPeerConnection({ iceServers });
    pc.onicecandidate = (e) => {
      if (e.candidate && active?.callId) {
        socketRef.current.emit('call:ice', { callId: active.callId, candidate: e.candidate });
      }
    };
    pc.ontrack = (e) => {
      // Merge all tracks into a single MediaStream ref
      e.streams.forEach(stream => {
        stream.getTracks().forEach(t => remoteStreamRef.current.addTrack(t));
      });
    };
    pcRef.current = pc;
  }

  async function getLocalStream(mode) {
    const constraints = mode === 'VIDEO'
      ? { audio: true, video: { width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 24 } } }
      : { audio: true, video: false };

    try {
      localStreamRef.current = await navigator.mediaDevices.getUserMedia(constraints);
      return localStreamRef.current;
    } catch (err) {
      // Surface failure and clean up state
      resetCall();
      throw err;
    }
  }

  // Caller: after 'call:accepted', create and send offer
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

    // Pre-warm local media for instant preview
    await getLocalStream(mode);

    const resp = await new Promise((resolve) => {
      socketRef.current.emit('call:invite', { toUserId, chatId, mode }, resolve);
    });

    if (resp?.ok) {
      setActive({ callId: resp.callId, peerUser: { id: toUserId }, mode });
      // Wait for 'call:accepted' → startOffer()
    } else {
      resetCall();
      throw new Error(resp?.error || 'Failed to start call');
    }
  }

  async function acceptCall() {
    if (!incoming) return;

    const { callId, fromUser, mode } = incoming;
    await getLocalStream(mode);
    setActive({ callId, peerUser: fromUser, mode });
    await createPC();

    // We are the ANSWERER: add our tracks and wait for offer
    localStreamRef.current.getTracks().forEach(t => pcRef.current.addTrack(t, localStreamRef.current));

    await new Promise((resolve) => socketRef.current.emit('call:accept', { callId }, resolve));
    setIncoming(null);
    setStatus('connecting'); // wait for 'call:offer'
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
    status,
    incoming,
    active,
    localStream: localStreamRef,   // .current is a MediaStream or null
    remoteStream: remoteStreamRef, // .current is a MediaStream
    startCall,
    acceptCall,
    rejectCall,
    endCall,
  }), [status, incoming, active]);

  return <CallCtx.Provider value={value}>{children}</CallCtx.Provider>;
};
