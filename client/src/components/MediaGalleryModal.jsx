import { useEffect, useState, useMemo } from 'react';
import { Modal, SimpleGrid, Image, Text, Group, Button } from '@mantine/core';
import { getMediaInRoom } from '../utils/messagesStore';

/**
 * MediaGalleryModal
 * - Pulls media from the local message cache (IndexedDB) via getMediaInRoom(roomId)
 * - Supports images, videos, and audio (attachments-first; falls back to legacy fields if present)
 * - Lightweight viewer modal for a single selected item
 */
export default function MediaGalleryModal({ opened, onClose, roomId }) {
  const [items, setItems] = useState([]);
  const [viewerIndex, setViewerIndex] = useState(null);

  // load cached media when opened
  useEffect(() => {
    let alive = true;
    (async () => {
      if (!opened) return;
      const media = await getMediaInRoom(roomId);
      // Expecting items like:
      // { id, kind: 'IMAGE'|'VIDEO'|'AUDIO', url, mimeType?, caption?, width?, height?, durationSec?, messageId? }
      // Fallbacks (legacy): some stores may return { imageUrl } only for images.
      if (alive) {
        const normalized = (Array.isArray(media) ? media : [])
          .map((m) => {
            // Try to infer kind if missing
            const url = m.url || m.imageUrl || m.audioUrl || m.videoUrl || '';
            const mime = m.mimeType || '';
            const kind =
              m.kind ||
              (mime.startsWith('image/')
                ? 'IMAGE'
                : mime.startsWith('video/')
                  ? 'VIDEO'
                  : mime.startsWith('audio/')
                    ? 'AUDIO'
                    : m.imageUrl
                      ? 'IMAGE'
                      : null) ||
              'FILE';
            return { ...m, url, kind };
          })
          .filter((m) => m.url); // only display if we have a URL
        setItems(normalized.reverse()); // newest first
      }
    })();
    return () => {
      alive = false;
    };
  }, [opened, roomId]);

  const selected = useMemo(
    () => (viewerIndex != null ? items[viewerIndex] : null),
    [viewerIndex, items]
  );

  const closeViewer = () => setViewerIndex(null);

  return (
    <>
      <Modal opened={opened} onClose={onClose} title="Shared media" size="lg" centered padding="md">
        {items.length === 0 ? (
          <Text c="dimmed">No media cached locally yet.</Text>
        ) : (
          <SimpleGrid cols={{ base: 2, sm: 3, md: 4 }} spacing="xs">
            {items.map((m, i) =>
              m.kind === 'IMAGE' ? (
                <Image
                  key={m.id ?? `${m.url}-${i}`}
                  radius="md"
                  src={m.url}
                  alt={m.caption || 'image'}
                  style={{ cursor: 'pointer' }}
                  onClick={() => setViewerIndex(i)}
                />
              ) : m.kind === 'VIDEO' ? (
                <div
                  key={m.id ?? `${m.url}-${i}`}
                  style={{ borderRadius: 8, overflow: 'hidden', cursor: 'pointer' }}
                  onClick={() => setViewerIndex(i)}
                >
                  <video
                    src={m.url}
                    style={{ width: '100%', display: 'block' }}
                    preload="metadata"
                    muted
                  />
                </div>
              ) : m.kind === 'AUDIO' ? (
                <div key={m.id ?? `${m.url}-${i}`} style={{ paddingTop: 6 }}>
                  <audio src={m.url} style={{ width: '100%' }} controls preload="metadata" />
                </div>
              ) : null
            )}
          </SimpleGrid>
        )}
      </Modal>

      {/* Lightweight viewer for a single selected item */}
      <Modal
        opened={viewerIndex != null}
        onClose={closeViewer}
        withCloseButton
        centered
        size="lg"
        padding="md"
        title={selected?.caption || (selected?.kind ? selected.kind.toLowerCase() : 'preview')}
      >
        {!selected ? null : selected.kind === 'IMAGE' ? (
          <>
            <Image
              radius="md"
              src={selected.url}
              alt={selected.caption || 'image'}
              fit="contain"
              styles={{ image: { maxHeight: '70vh' } }}
            />
            {selected.caption && (
              <Text size="sm" mt="sm" c="dimmed">
                {selected.caption}
              </Text>
            )}
          </>
        ) : selected.kind === 'VIDEO' ? (
          <>
            <video
              src={selected.url}
              style={{ width: '100%', maxHeight: '70vh', display: 'block', borderRadius: 8 }}
              controls
              preload="metadata"
            />
            {selected.caption && (
              <Text size="sm" mt="sm" c="dimmed">
                {selected.caption}
              </Text>
            )}
          </>
        ) : selected.kind === 'AUDIO' ? (
          <>
            <audio src={selected.url} style={{ width: '100%' }} controls preload="metadata" />
            {selected.caption && (
              <Text size="sm" mt="sm" c="dimmed">
                {selected.caption}
              </Text>
            )}
          </>
        ) : null}

        {/* Basic actions (download). Forward/Edit can be added later from here. */}
        {selected?.url && (
          <Group justify="flex-end" mt="md">
            <Button component="a" href={selected.url} download variant="light">
              Download
            </Button>
          </Group>
        )}
      </Modal>
    </>
  );
}
