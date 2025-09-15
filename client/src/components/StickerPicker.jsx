import { useEffect, useState } from 'react';
import { Modal, TextInput, SimpleGrid, Image, Loader } from '@mantine/core';
import axiosClient from '../api/axiosClient';
import { toast } from '../utils/toast';

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
    if (!term || term.length < 2) {
      setResults([]);
      return;
    }
    setLoading(true);
    try {
      const { data } = await axiosClient.get('/stickers/search', {
        params: { q: term },
      });
      setResults(data?.results || []);
      if ((data?.results || []).length === 0) {
        // Optional: keep this subtle (no toast) to avoid noise as users type.
        // If you'd prefer a toast, uncomment:
        // toast.info('No results. Try a different search.');
      }
    } catch (e) {
      console.error(e);
      setResults([]);
      toast.err('Unable to load stickers right now. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleEnter = (value) => {
    const v = value.trim();
    if (v.length < 2) {
      toast.info('Type at least 2 characters to search.');
      return;
    }
    search(v);
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
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            handleEnter(q);
          }
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
                try {
                  onPick?.({
                    kind: r.kind || 'GIF', // 'GIF' or 'STICKER'
                    url: r.url,
                    mimeType: r.mimeType || 'image/gif',
                    width: r.width ?? null,
                    height: r.height ?? null,
                  });
                  toast.ok('Added to message.');
                  onClose?.();
                } catch (err) {
                  console.error(err);
                  toast.err('Could not add that sticker. Please try again.');
                }
              }}
            />
          ))}
        </SimpleGrid>
      )}
    </Modal>
  );
}
