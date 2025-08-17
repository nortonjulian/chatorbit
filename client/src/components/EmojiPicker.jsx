import { useState } from 'react';
import { ActionIcon, Popover } from '@mantine/core';
import { IconMoodSmile } from '@tabler/icons-react';
import EmojiPicker from 'emoji-picker-react';

export default function CustomEmojiPicker({ onSelect }) {
  const [opened, setOpened] = useState(false);

  return (
    <Popover opened={opened} onChange={setOpened} position="top-start" shadow="md" withArrow>
      <Popover.Target>
        <ActionIcon variant="subtle" color="gray" size="lg" onClick={() => setOpened((o) => !o)}>
          <IconMoodSmile size={20} />
        </ActionIcon>
      </Popover.Target>

      <Popover.Dropdown p={0}>
        <EmojiPicker
          onEmojiClick={(emojiData) => {
            onSelect?.(emojiData.emoji);
            setOpened(false);
          }}
          searchDisabled={false}
          width={300}
          height={400}
        />
      </Popover.Dropdown>
    </Popover>
  );
}
