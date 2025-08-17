// src/components/VoiceRecorder.jsx
import { useEffect, useRef, useState } from 'react';
import { ActionIcon, Tooltip } from '@mantine/core';
import { IconMicrophone, IconPlayerStop } from '@tabler/icons-react';

export default function VoiceRecorder({ onRecorded, disabled }) {
  const [rec, setRec] = useState(null);
  const [recording, setRecording] = useState(false);
  const chunksRef = useRef([]);
  const startedAtRef = useRef(0);

  useEffect(() => {
    return () => rec?.stream?.getTracks()?.forEach((t) => t.stop());
  }, [rec]);

  const start = async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const mr = new MediaRecorder(stream, { mimeType: 'audio/webm' });
    chunksRef.current = [];
    startedAtRef.current = Date.now();

    mr.ondataavailable = (e) => e.data.size && chunksRef.current.push(e.data);
    mr.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: mr.mimeType || 'audio/webm' });
      const durationMs = Date.now() - startedAtRef.current;
      onRecorded?.(blob, Math.round(durationMs / 1000));
      stream.getTracks().forEach((t) => t.stop());
      setRec(null);
      setRecording(false);
    };

    mr.start();
    setRec(mr);
    setRecording(true);
  };

  const stop = () => rec && rec.state !== 'inactive' && rec.stop();

  return (
    <Tooltip label={recording ? 'Stop' : 'Hold to record'}>
      <ActionIcon
        variant="light"
        radius="xl"
        onMouseDown={start}
        onMouseUp={stop}
        onMouseLeave={stop}
        disabled={disabled}
        aria-label="Record voice"
      >
        {recording ? <IconPlayerStop size={18} /> : <IconMicrophone size={18} />}
      </ActionIcon>
    </Tooltip>
  );
}
