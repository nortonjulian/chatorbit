import { useEffect, useState } from 'react';
import { Modal, Textarea, Group, Button } from '@mantine/core';
import axiosClient from '../api/axiosClient';
import { useUser } from '../context/UserContext';

export default function RoomAboutModal({ opened, onClose, room, onSaved }) {
  const { currentUser } = useUser();
  const canEdit =
    currentUser?.role === 'ADMIN' || currentUser?.id === room?.ownerId;

  const [value, setValue] = useState(room?.description || '');
  const [saving, setSaving] = useState(false);

  useEffect(
    () => setValue(room?.description || ''),
    [room?.id, room?.description]
  );

  const save = async () => {
    if (!canEdit) return onClose();
    setSaving(true);
    try {
      const { data } = await axiosClient.patch(`/chatrooms/${room.id}/meta`, {
        description: value,
      });
      onSaved?.(data);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal opened={opened} onClose={onClose} title="About this group" centered>
      <Textarea
        value={value}
        onChange={(e) => setValue(e.currentTarget.value)}
        placeholder="Describe the purpose, rules, links, etc."
        minRows={4}
        autosize
        readOnly={!canEdit}
      />
      {canEdit && (
        <Group justify="flex-end" mt="md">
          <Button onClick={save} loading={saving}>
            Save
          </Button>
        </Group>
      )}
    </Modal>
  );
}
