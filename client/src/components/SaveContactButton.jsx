import { useState, useEffect } from 'react';
import axiosClient from '../api/axiosClient';
import { Button, TextInput, Group, Text } from '@mantine/core';
import { IconCheck } from '@tabler/icons-react';

function SaveContactButton({ currentUserId, otherUserId }) {
  const [isSaved, setIsSaved] = useState(false);
  const [alias, setAlias] = useState('');
  const [showAliasInput, setShowAliasInput] = useState(false);

  useEffect(() => {
    const checkContact = async () => {
      try {
        const res = await axiosClient.get(`/contacts/${currentUserId}`);
        const found = res.data.find((c) => c.userId === otherUserId);
        if (found) {
          setIsSaved(true);
          setAlias(found.alias || '');
        }
      } catch (err) {
        console.error('Failed to check contact:', err);
      }
    };
    checkContact();
  }, [currentUserId, otherUserId]);

  const saveContact = async () => {
    try {
      await axiosClient.post('/contacts', {
        ownerId: currentUserId,
        userId: otherUserId,
        alias,
      });
      setIsSaved(true);
      setShowAliasInput(false);
    } catch (err) {
      console.error('Failed to save contact:', err);
    }
  };

  if (isSaved) {
    return (
      <Group gap="xs">
        <IconCheck size={16} color="green" />
        <Text size="sm" c="green">
          Saved
        </Text>
      </Group>
    );
  }

  return (
    <div>
      {showAliasInput ? (
        <Group gap="xs" wrap="nowrap">
          <TextInput
            value={alias}
            onChange={(e) => setAlias(e.currentTarget.value)}
            placeholder="Alias (optional)"
            size="xs"
            radius="md"
          />
          <Button
            size="xs"
            radius="md"
            variant="filled"
            color="blue"
            onClick={saveContact}
          >
            Save
          </Button>
        </Group>
      ) : (
        <Button
          variant="subtle"
          size="xs"
          radius="md"
          color="blue"
          onClick={() => setShowAliasInput(true)}
        >
          Save Contact
        </Button>
      )}
    </div>
  );
}

export default SaveContactButton;
