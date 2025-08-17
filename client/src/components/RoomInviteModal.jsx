import { useEffect, useState } from 'react';
import {
  Modal,
  Stack,
  Group,
  Button,
  NumberInput,
  Select,
  TextInput,
  Image,
  CopyButton,
  Tooltip,
} from '@mantine/core';
import axiosClient from '../api/axiosClient';
import QRCode from 'qrcode';

export default function RoomInviteModal({ opened, onClose, roomId }) {
  const [expires, setExpires] = useState('1440'); // minutes (1 day)
  const [maxUses, setMaxUses] = useState(0); // 0 = unlimited
  const [invite, setInvite] = useState(null);
  const [qr, setQr] = useState(null);
  const [loading, setLoading] = useState(false);

  const createInvite = async () => {
    setLoading(true);
    try {
      const { data } = await axiosClient.post(`/chatrooms/${roomId}/invites`, {
        expiresInMinutes: Number(expires) || 0,
        maxUses: Number(maxUses) || 0,
      });
      setInvite(data);
      const png = await QRCode.toDataURL(data.url, { errorCorrectionLevel: 'M' });
      setQr(png);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!opened) {
      setInvite(null);
      setQr(null);
    }
  }, [opened]);

  return (
    <Modal opened={opened} onClose={onClose} title="Invite people" centered>
      <Stack gap="md">
        <Group grow>
          <Select
            label="Expires in"
            data={[
              { value: '30', label: '30 minutes' },
              { value: '1440', label: '1 day' },
              { value: String(7 * 1440), label: '7 days' },
              { value: '0', label: 'Never' },
            ]}
            value={expires}
            onChange={setExpires}
          />
          <NumberInput
            label="Max uses (0 = unlimited)"
            min={0}
            value={maxUses}
            onChange={(v) => setMaxUses(Number(v) || 0)}
          />
        </Group>

        <Button onClick={createInvite} loading={loading}>
          Generate link
        </Button>

        {invite && (
          <>
            <TextInput label="Invite link" value={invite.url} readOnly />
            <Group>
              <CopyButton value={invite.url} timeout={1500}>
                {({ copied, copy }) => (
                  <Tooltip label={copied ? 'Copied!' : 'Copy'}>
                    <Button variant="light" onClick={copy}>
                      {copied ? 'Copied' : 'Copy link'}
                    </Button>
                  </Tooltip>
                )}
              </CopyButton>
              <Button variant="light" onClick={() => window.open(invite.url, '_blank')}>
                Open
              </Button>
            </Group>
            {qr && <Image src={qr} alt="QR Code" maw={240} />}
          </>
        )}
      </Stack>
    </Modal>
  );
}
