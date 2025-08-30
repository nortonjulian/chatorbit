import { useState } from 'react';

export default function CallControls({ callId, currentUser, onEnd, onToggleCaptions }) {
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [ccOn, setCcOn] = useState(!!currentUser?.a11yLiveCaptions);

  return (
    <div className="mx-auto flex items-center justify-center gap-3 bg-black/50 rounded-2xl px-4 py-2">
      <IconButton
        active={camOn}
        label={camOn ? 'Camera on' : 'Camera off'}
        onClick={() => {
          // TODO: toggle your real video track
          setCamOn(v => !v);
        }}
      >
        {camOn ? '📷' : '🚫📷'}
      </IconButton>

      <IconButton
        active={micOn}
        label={micOn ? 'Mic on' : 'Mic muted'}
        onClick={() => {
          // TODO: toggle your real audio track
          setMicOn(v => !v);
        }}
      >
        {micOn ? '🎙️' : '🔇'}
      </IconButton>

      <IconButton
        active={ccOn}
        label={ccOn ? 'Captions on' : 'Captions off'}
        onClick={async () => {
          const next = !ccOn;
          setCcOn(next);
          await onToggleCaptions?.(next);
        }}
      >
        CC
      </IconButton>

      <button
        className="ml-2 px-4 py-2 rounded-2xl bg-red-600 hover:bg-red-700 text-white font-medium"
        onClick={onEnd}
      >End</button>
    </div>
  );
}

function IconButton({ active, label, onClick, children }) {
  return (
    <button
      className={`px-3 py-2 rounded-2xl border bg-white text-black hover:bg-gray-100 ${active ? '' : 'opacity-70'}`}
      title={label}
      onClick={onClick}
    >
      <span className="text-lg leading-none">{children}</span>
    </button>
  );
}