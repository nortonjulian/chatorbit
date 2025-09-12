// import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
// import io from 'socket.io-client';

// const CallCtx = createContext(null);
// export const useCall = () => useContext(CallCtx);

// export const CallProvider = ({ children }) => {
//   const socketRef = useRef(null);
//   const [incoming, setIncoming] = useState(null);   // { callId, fromUser, mode, chatId }
//   const [active, setActive] = useState(null);       // { callId, peerUser, mode }
//   const [status, setStatus] = useState('idle');     // 'idle' | 'ringing' | 'connecting' | 'in-call'
//   const [iceServers, setIceServers] = useState([]);

//   // WebRTC refs
//   const pcRef = useRef(null);
//   const localStreamRef = useRef(null);
//   const remoteStreamRef = useRef(new MediaStream());

//   // Initialize socket + fetch TURN/STUN servers
//   useEffect(() => {
//     const base = import.meta.env.VITE_API_BASE;
//     socketRef.current = io(base, { withCredentials: true });

//     fetch(`${base}/ice-servers`, { credentials: 'include' })
//       .then(r => r.json())
//       .then(({ iceServers }) => Array.isArray(iceServers) && setIceServers(iceServers))
//       .catch(() => { /* ignore; browser will still try default STUN if any */ });

//     const s = socketRef.current;

//     // Incoming call
//     const onIncoming = (payload) => {
//       setIncoming(payload);
//       setStatus('ringing');
//     };

//     // Caller-side: callee accepted
//     const onAccepted = ({ callId }) => {
//       if (active?.callId === callId) {
//         setStatus('connecting'); // start SDP as offerer
//         startOffer();
//       }
//     };

//     // Callee-side: room ready — wait for offer
//     const onReady = () => { /* noop: handled by 'offer' */ };

//     // Signaling
//     const onOffer = async ({ callId, sdp }) => {
//       if (active?.callId !== callId || !pcRef.current) return;
//       await pcRef.current.setRemoteDescription(new RTCSessionDescription(sdp));
//       const answer = await pcRef.current.createAnswer();
//       await pcRef.current.setLocalDescription(answer);
//       s.emit('call:answer', { callId, sdp: pcRef.current.localDescription });
//     };

//     const onAnswer = async ({ callId, sdp }) => {
//       if (active?.callId !== callId || !pcRef.current) return;
//       await pcRef.current.setRemoteDescription(new RTCSessionDescription(sdp));
//       setStatus('in-call');
//     };

//     const onIce = async ({ callId, candidate }) => {
//       if (active?.callId !== callId || !pcRef.current || !candidate) return;
//       try { await pcRef.current.addIceCandidate(candidate); } catch { /* ignore */ }
//     };

//     const onRejected = () => resetCall();
//     const onEnd = () => resetCall();

//     s.on('call:incoming', onIncoming);
//     s.on('call:accepted', onAccepted);
//     s.on('call:ready', onReady);
//     s.on('call:offer', onOffer);
//     s.on('call:answer', onAnswer);
//     s.on('call:ice', onIce);
//     s.on('call:rejected', onRejected);
//     s.on('call:end', onEnd);

//     return () => {
//       s.off('call:incoming', onIncoming);
//       s.off('call:accepted', onAccepted);
//       s.off('call:ready', onReady);
//       s.off('call:offer', onOffer);
//       s.off('call:answer', onAnswer);
//       s.off('call:ice', onIce);
//       s.off('call:rejected', onRejected);
//       s.off('call:end', onEnd);
//       s.close();
//     };
//     // eslint-disable-next-line react-hooks/exhaustive-deps
//   }, [active?.callId]);

//   function resetCall() {
//     setIncoming(null);
//     setActive(null);
//     setStatus('idle');

//     if (pcRef.current) {
//       pcRef.current.ontrack = null;
//       pcRef.current.onicecandidate = null;
//       try { pcRef.current.close(); } catch {}
//       pcRef.current = null;
//     }

//     if (localStreamRef.current) {
//       localStreamRef.current.getTracks().forEach(t => t.stop());
//       localStreamRef.current = null;
//     }

//     // Replace remote stream instance
//     remoteStreamRef.current = new MediaStream();
//   }

//   async function createPC() {
//     const pc = new RTCPeerConnection({ iceServers });
//     pc.onicecandidate = (e) => {
//       if (e.candidate && active?.callId) {
//         socketRef.current.emit('call:ice', { callId: active.callId, candidate: e.candidate });
//       }
//     };
//     pc.ontrack = (e) => {
//       // Merge all tracks into a single MediaStream ref
//       e.streams.forEach(stream => {
//         stream.getTracks().forEach(t => remoteStreamRef.current.addTrack(t));
//       });
//     };
//     pcRef.current = pc;
//   }

//   async function getLocalStream(mode) {
//     const constraints = mode === 'VIDEO'
//       ? { audio: true, video: { width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 24 } } }
//       : { audio: true, video: false };

//     try {
//       localStreamRef.current = await navigator.mediaDevices.getUserMedia(constraints);
//       return localStreamRef.current;
//     } catch (err) {
//       // Surface failure and clean up state
//       resetCall();
//       throw err;
//     }
//   }

//   // Caller: after 'call:accepted', create and send offer
//   async function startOffer() {
//     const stream = localStreamRef.current || await getLocalStream(active.mode);
//     await createPC();
//     stream.getTracks().forEach(t => pcRef.current.addTrack(t, stream));
//     const offer = await pcRef.current.createOffer();
//     await pcRef.current.setLocalDescription(offer);
//     socketRef.current.emit('call:offer', { callId: active.callId, sdp: pcRef.current.localDescription });
//   }

//   // Public API
//   async function startCall({ toUserId, chatId, mode }) {
//     setStatus('connecting');

//     // Pre-warm local media for instant preview
//     await getLocalStream(mode);

//     const resp = await new Promise((resolve) => {
//       socketRef.current.emit('call:invite', { toUserId, chatId, mode }, resolve);
//     });

//     if (resp?.ok) {
//       setActive({ callId: resp.callId, peerUser: { id: toUserId }, mode });
//       // Wait for 'call:accepted' → startOffer()
//     } else {
//       resetCall();
//       throw new Error(resp?.error || 'Failed to start call');
//     }
//   }

//   async function acceptCall() {
//     if (!incoming) return;

//     const { callId, fromUser, mode } = incoming;
//     await getLocalStream(mode);
//     setActive({ callId, peerUser: fromUser, mode });
//     await createPC();

//     // We are the ANSWERER: add our tracks and wait for offer
//     localStreamRef.current.getTracks().forEach(t => pcRef.current.addTrack(t, localStreamRef.current));

//     await new Promise((resolve) => socketRef.current.emit('call:accept', { callId }, resolve));
//     setIncoming(null);
//     setStatus('connecting'); // wait for 'call:offer'
//   }

//   function rejectCall() {
//     if (!incoming) return;
//     socketRef.current.emit('call:reject', { callId: incoming.callId });
//     setIncoming(null);
//     setStatus('idle');
//   }

//   function endCall() {
//     const callId = active?.callId || incoming?.callId;
//     if (callId) socketRef.current.emit('call:end', { callId, reason: 'hangup' });
//     resetCall();
//   }

//   const value = useMemo(() => ({
//     status,
//     incoming,
//     active,
//     localStream: localStreamRef,   // .current is a MediaStream or null
//     remoteStream: remoteStreamRef, // .current is a MediaStream
//     startCall,
//     acceptCall,
//     rejectCall,
//     endCall,
//   }), [status, incoming, active]);

//   return <CallCtx.Provider value={value}>{children}</CallCtx.Provider>;
// };


import { createContext, useContext, useEffect, useRef, useState } from 'react';
import socket from '@/lib/socket';
import { API_BASE } from '@/config';

const CallCtx = createContext(null);
export const useCall = () => useContext(CallCtx);

export function CallProvider({ children, me }) {
  const [incoming, setIncoming] = useState(null);    // { callId, fromUser, mode, offer }
  const [active, setActive] = useState(null);        // { callId, peerId }
  const pcRef = useRef(null);

  // Keep local & remote streams for UI
  const localStreamRef = useRef(null);               // MediaStream | null
  const remoteStreamRef = useRef(new MediaStream()); // always a MediaStream instance

  // socket listeners
  useEffect(() => {
    function onIncoming(payload) {
      setIncoming(payload);
    }
    function onAnswer({ callId, answer }) {
      if (!pcRef.current) return;
      pcRef.current.setRemoteDescription(answer);
      setActive((prev) => prev || { callId });
    }
    function onCandidate({ candidate }) {
      if (candidate && pcRef.current) {
        pcRef.current.addIceCandidate(candidate).catch(() => {});
      }
    }
    function onEnded() {
      cleanup();
    }

    socket.on('call:incoming', onIncoming);
    socket.on('call:answer', onAnswer);
    socket.on('call:candidate', onCandidate);
    socket.on('call:ended', onEnded);
    return () => {
      socket.off('call:incoming', onIncoming);
      socket.off('call:answer', onAnswer);
      socket.off('call:candidate', onCandidate);
      socket.off('call:ended', onEnded);
    };
  }, []);

  async function createPeer() {
    if (pcRef.current) {
      try { pcRef.current.close(); } catch {}
    }
    const res = await fetch(`${API_BASE}/ice-servers?provider=all`, { credentials: 'include' });
    const { iceServers } = await res.json();

    const pc = new RTCPeerConnection({ iceServers });

    pc.onicecandidate = ({ candidate }) => {
      if (candidate && active?.peerId) {
        fetch(`${API_BASE}/calls/candidate`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ callId: active?.callId, toUserId: active?.peerId, candidate }),
        }).catch(() => {});
      }
    };

    pc.ontrack = (e) => {
      // merge all incoming tracks into a single remote stream
      e.streams.forEach((stream) => {
        stream.getTracks().forEach((t) => {
          // prevent duplicates
          if (!remoteStreamRef.current.getTracks().find((rt) => rt.id === t.id)) {
            remoteStreamRef.current.addTrack(t);
          }
        });
      });
    };

    pcRef.current = pc;
    return pc;
  }

  async function startCall({ calleeId, mode = 'VIDEO' }) {
    const pc = await createPeer();
    const local = await navigator.mediaDevices.getUserMedia({
      video: mode === 'VIDEO',
      audio: true,
    });
    localStreamRef.current = local;
    local.getTracks().forEach((t) => pc.addTrack(t, local));

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    const resp = await fetch(`${API_BASE}/calls/invite`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ calleeId, mode, offer }),
    });
    const { callId } = await resp.json();
    setActive({ callId, peerId: calleeId });
  }

  async function acceptCall() {
    const { callId, fromUser, offer, mode } = incoming || {};
    const pc = await createPeer();

    const local = await navigator.mediaDevices.getUserMedia({
      video: mode === 'VIDEO',
      audio: true,
    });
    localStreamRef.current = local;
    local.getTracks().forEach((t) => pc.addTrack(t, local));

    await pc.setRemoteDescription(offer);
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);

    await fetch(`${API_BASE}/calls/answer`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ callId, answer }),
    });

    setActive({ callId, peerId: fromUser.id });
    setIncoming(null);
  }

  async function rejectCall() {
    if (!incoming) return;
    await fetch(`${API_BASE}/calls/end`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ callId: incoming.callId, reason: 'rejected' }),
    }).catch(() => {});
    setIncoming(null);
  }

  async function endCall() {
    const callId = active?.callId || incoming?.callId;
    if (!callId) return;
    await fetch(`${API_BASE}/calls/end`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ callId }),
    }).catch(() => {});
    cleanup();
  }

  function cleanup() {
    try { pcRef.current?.getSenders().forEach((s) => s.track?.stop()); } catch {}
    try { pcRef.current?.close(); } catch {}
    pcRef.current = null;

    if (localStreamRef.current) {
      try { localStreamRef.current.getTracks().forEach((t) => t.stop()); } catch {}
      localStreamRef.current = null;
    }

    // reset remote stream instance
    remoteStreamRef.current = new MediaStream();
    setActive(null);
    setIncoming(null);
  }

  const value = {
    incoming,
    active,
    startCall,
    acceptCall,
    rejectCall,
    endCall,
    pcRef,
    localStream: localStreamRef,
    remoteStream: remoteStreamRef,
  };

  return <CallCtx.Provider value={value}>{children}</CallCtx.Provider>;
}
