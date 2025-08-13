import { useState } from 'react';
import { Group, ActionIcon, Tooltip, Badge, Popover } from '@mantine/core';
import axiosClient from '../api/axiosClient';

const QUICK = ['👍','😂','🔥','🎉','😮','❤️'];

export default function ReactionBar({ message, currentUserId }) {
  const [opened, setOpened] = useState(false);
  const counts = message.reactionSummary || {};
  const mine = new Set(message.myReactions || []);

  const toggle = async (emoji) => {
    try {
      // optimistic
      const next = { ...counts };
      const hasMine = mine.has(emoji);
      if (hasMine) {
        next[emoji] = Math.max(0, (next[emoji] || 1) - 1);
        mine.delete(emoji);
      } else {
        next[emoji] = (next[emoji] || 0) + 1;
        mine.add(emoji);
      }
      message.reactionSummary = next;
      message.myReactions = Array.from(mine);
      // server
      await axiosClient.post(`/messages/${message.id}/reactions`, { emoji });
    } catch (e) {
      // ignore; socket will reconcile
      console.error('reaction toggle failed', e);
    }
  };

  return (
    <Group gap={6} mt={6} justify="flex-end">
      {Object.entries(counts).map(([emoji, count]) =>
        count > 0 ? (
          <Badge
            key={emoji}
            variant={mine.has(emoji) ? 'filled' : 'light'}
            color={mine.has(emoji) ? 'violet' : 'gray'}
            style={{ cursor: 'pointer' }}
            onClick={() => toggle(emoji)}
          >
            {emoji} {count}
          </Badge>
        ) : null
      )}

      <Popover opened={opened} onChange={setOpened} position="top-end" withArrow>
        <Popover.Target>
          <Tooltip label="Add reaction">
            <ActionIcon variant="subtle" onClick={() => setOpened((v) => !v)}>＋</ActionIcon>
          </Tooltip>
        </Popover.Target>
        <Popover.Dropdown>
          <Group gap="xs">
            {QUICK.map((e) => (
              <ActionIcon key={e} variant="light" onClick={() => { setOpened(false); toggle(e); }}>
                {e}
              </ActionIcon>
            ))}
          </Group>
        </Popover.Dropdown>
      </Popover>
    </Group>
  );
}
