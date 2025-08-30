import React, { useEffect, useState } from 'react';
import TranscriptBubble from '@/components/TranscriptBubble';

export default function AudioMessage({ msg, currentUser }) {
  const [transcript, setTranscript] = useState(null);

  useEffect(() => {
    let isMounted = true;
    (async () => {
      if (!currentUser?.a11yVoiceNoteSTT || !msg?.audioUrl) return;
      try {
        await fetch(`/media/${msg.id}/transcribe`, { method: 'POST', headers: { 'Content-Type': 'application/json' } });
        const r = await fetch(`/transcripts/${msg.id}`);
        if (r.ok) {
          const j = await r.json();
          if (isMounted) setTranscript(j.transcript);
        }
      } catch {}
    })();
    return () => { isMounted = false; };
  }, [msg?.id, msg?.audioUrl, currentUser?.a11yVoiceNoteSTT]);

  return (
    <div>
      <audio controls src={msg.audioUrl} className="w-full" />
      {transcript ? <TranscriptBubble segments={transcript.segments} /> : <div className="text-xs text-gray-400 mt-1">Transcribing…</div>}
    </div>
  );
}
