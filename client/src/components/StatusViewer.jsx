import { useEffect, useState } from 'react';
import { Modal, Group, Text, ActionIcon, Progress, Badge } from '@mantine/core';
import { IconX, IconChevronLeft, IconChevronRight, IconMoodSmile } from '@tabler/icons-react';
import axiosClient from '../api/axiosClient';

export default function StatusViewer({ opened, onClose, author, stories }) {
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    if (opened) setIdx(0);
  }, [opened]);

  // mark seen when opened / when index changes (idempotent via upsert)
  useEffect(() => {
    if (!opened) return;
    const s = stories?.[idx];
    if (!s) return;
    axiosClient.patch(`/status/${s.id}/view`).catch(() => {});
  }, [opened, idx, stories]);

  const s = stories?.[idx];

  const react = async (emoji) => {
    if (!s) return;
    await axiosClient.post(`/status/${s.id}/reactions`, { emoji }).catch(() => {});
  };

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      size="lg"
      centered
      withCloseButton={false}
      padding="md"
    >
      <Group justify="space-between" align="center" mb="xs">
        <Group gap="xs" align="center">
          <Badge variant="light">{author?.username}</Badge>
          <Text size="xs" c="dimmed">
            {idx + 1}/{stories?.length || 0}
          </Text>
        </Group>
        <ActionIcon onClick={onClose}>
          <IconX size={18} />
        </ActionIcon>
      </Group>

      {/* progress */}
      <Progress value={((idx + 1) / (stories?.length || 1)) * 100} size="xs" mb="sm" />

      {/* media */}
      {!s ? null : s.assets?.length ? (
        s.assets[0].kind === 'IMAGE' ? (
          <img
            src={s.assets[0].url}
            alt=""
            style={{ width: '100%', maxHeight: '70vh', objectFit: 'contain', borderRadius: 8 }}
          />
        ) : s.assets[0].kind === 'VIDEO' ? (
          <video
            src={s.assets[0].url}
            controls
            style={{ width: '100%', maxHeight: '70vh', display: 'block', borderRadius: 8 }}
          />
        ) : s.assets[0].kind === 'AUDIO' ? (
          <audio src={s.assets[0].url} controls style={{ width: '100%' }} />
        ) : s.assets[0].kind === 'GIF' ? (
          <video
            src={s.assets[0].url}
            autoPlay
            muted
            loop
            playsInline
            style={{ width: '100%', borderRadius: 8 }}
          />
        ) : null
      ) : null}

      {s?.caption && (
        <Text size="sm" mt="sm" c="dimmed">
          {s.caption}
        </Text>
      )}

      <Group justify="space-between" mt="md">
        <ActionIcon
          variant="light"
          onClick={() => setIdx((i) => Math.max(0, i - 1))}
          disabled={idx === 0}
        >
          <IconChevronLeft size={18} />
        </ActionIcon>
        <Group>
          {/* quick reactions */}
          {['👍', '❤️', '😂', '🔥', '👏'].map((e) => (
            <ActionIcon key={e} variant="light" onClick={() => react(e)} title={`React ${e}`}>
              <IconMoodSmile size={16} />
              <span style={{ marginLeft: 4 }}>{e}</span>
            </ActionIcon>
          ))}
        </Group>
        <ActionIcon
          variant="light"
          onClick={() => setIdx((i) => Math.min((stories?.length || 1) - 1, i + 1))}
          disabled={idx >= (stories?.length || 1) - 1}
        >
          <IconChevronRight size={18} />
        </ActionIcon>
      </Group>
    </Modal>
  );
}
