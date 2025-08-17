import { useEffect, useState } from 'react';
import { Modal, TextInput, SimpleGrid, Image, Loader } from '@mantine/core';
import axiosClient from '../api/axiosClient';

export default function StickerPicker({ opened, onClose, onPick }) {
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState([]);

  useEffect(() => {
    if (!opened) return;
    setQ('');
    setResults([]);
  }, [opened]);

  const search = async (term) => {
    setLoading(true);
    try {
      const { data } = await axiosClient.get('/stickers/search', {
        params: { q: term },
      });
      setResults(data?.results || []);
    } catch (e) {
      console.error(e);
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title="Stickers & GIFs"
      size="lg"
      centered
    >
      <TextInput
        placeholder="Search GIFs (powered by Tenor)"
        value={q}
        onChange={(e) => {
          const v = e.currentTarget.value;
          setQ(v);
          if (v.trim().length >= 2) search(v.trim());
          else setResults([]);
        }}
        mb="md"
      />
      {loading ? (
        <Loader />
      ) : (
        <SimpleGrid cols={{ base: 3, sm: 4, md: 6 }} spacing="xs">
          {results.map((r) => (
            <Image
              key={r.id}
              src={r.thumb || r.url}
              alt="sticker"
              radius="md"
              style={{ cursor: 'pointer' }}
              onClick={() => {
                onPick({
                  kind: r.kind || 'GIF', // 'GIF' or 'STICKER'
                  url: r.url,
                  mimeType: r.mimeType || 'image/gif',
                  width: r.width ?? null,
                  height: r.height ?? null,
                });
                onClose?.();
              }}
            />
          ))}
        </SimpleGrid>
      )}
    </Modal>
  );
}
