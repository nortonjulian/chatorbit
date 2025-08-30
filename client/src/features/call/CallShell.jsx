import React from 'react';

export default function CallShell({ callId, remoteVideoRef, localVideoRef, topRight, bottomBar, children }) {
  return (
    <div className="relative h-[100dvh] w-full bg-black text-white">
      {/* Top bar */}
      <div className="absolute top-0 left-0 right-0 flex items-center justify-between p-3 pointer-events-none">
        <div className="pointer-events-auto text-xs text-white/80">Call ID: {callId}</div>
        <div className="pointer-events-auto">{topRight}</div>
      </div>

      {/* Video stage */}
      <div className="absolute inset-0 grid grid-cols-1 md:grid-cols-2 gap-2 p-2">
        <video ref={remoteVideoRef} autoPlay playsInline className="w-full h-full object-cover rounded-2xl bg-black" />
        <div className="relative">
          <video ref={localVideoRef} autoPlay muted playsInline className="w-full h-full object-cover rounded-2xl opacity-90 bg-black" />
          <div className="absolute bottom-2 right-2 text-xs bg-black/60 rounded px-2 py-1">You</div>
        </div>
      </div>

      {/* Children overlays (captions, RTT, etc.) */}
      {children}

      {/* Bottom controls */}
      <div className="absolute bottom-0 left-0 right-0 flex items-center justify-center p-3">
        <div className="pointer-events-auto w-full max-w-2xl">{bottomBar}</div>
      </div>
    </div>
  );
}