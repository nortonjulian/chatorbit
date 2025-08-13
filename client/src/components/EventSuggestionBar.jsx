import { useMemo, useState } from 'react';
import { Group, Button, Modal, TextInput, Textarea } from '@mantine/core';
import chrono from 'chrono-node';
import { DateTime } from 'luxon';
import axiosClient from '../api/axiosClient';

function fmtGoogle(dtISO) {
  // YYYYMMDDTHHmmssZ in UTC
  return DateTime.fromISO(dtISO).toUTC().toFormat("yyyyLLdd'T'HHmmss'Z'");
}

function fmtLocalRange(startISO, endISO, isAllDay) {
  const s = DateTime.fromISO(startISO);
  const e = DateTime.fromISO(endISO);
  if (isAllDay) return `${s.toLocaleString(DateTime.DATE_MED)} (all day)`;
  const sameDay = s.hasSame(e, 'day');
  if (sameDay) {
    return `${s.toLocaleString(DateTime.DATE_MED)} • ${s.toLocaleString(DateTime.TIME_SIMPLE)}–${e.toLocaleString(DateTime.TIME_SIMPLE)}`;
  }
  return `${s.toLocaleString(DateTime.DATETIME_MED)} → ${e.toLocaleString(DateTime.DATETIME_MED)}`;
}

export default function EventSuggestionBar({ messages, currentUser, chatroom }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [location, setLocation] = useState('');
  const [description, setDescription] = useState('');

  const candidate = useMemo(() => {
    const last = (messages || []).slice(-5).reverse();
    for (const m of last) {
      const text = m.decryptedContent || m.translatedForMe || m.rawContent || '';
      if (!text) continue;
      const res = chrono.parse(text, new Date(), { forwardDate: true })?.[0];
      if (res?.start) {
        const start = res.start.date();
        const end = (res.end && res.end.date()) || DateTime.fromJSDate(start).plus({ hours: 1 }).toJSDate();
        return {
          messageId: m.id,
          snippet: text.slice(0, 200),
          startISO: DateTime.fromJSDate(start).toUTC().toISO(),
          endISO: DateTime.fromJSDate(end).toUTC().toISO(),
          isAllDay: !res.start.isCertain('hour'),
        };
      }
    }
    return null;
  }, [messages]);

  if (!candidate || !chatroom?.id) return null;

  const openComposer = () => {
    setTitle(`ChatOrbit: ${chatroom?.name || 'Event'}`);
    setLocation('');
    setDescription(`From chat: "${candidate.snippet}"`);
    setOpen(true);
  };

  const googleHref = () => {
    const q = new URLSearchParams({
      action: 'TEMPLATE',
      text: title || 'Event',
      dates: `${fmtGoogle(candidate.startISO)}/${fmtGoogle(candidate.endISO)}`,
      details: description || '',
      location: location || '',
    }).toString();
    return `https://calendar.google.com/calendar/render?${q}`;
  };

  const outlookHref = () => {
    const q = new URLSearchParams({
      path: '/calendar/action/compose',
      rru: 'addevent',
      subject: title || 'Event',
      startdt: DateTime.fromISO(candidate.startISO).toUTC().toISO(),
      enddt: DateTime.fromISO(candidate.endISO).toUTC().toISO(),
      body: description || '',
      location: location || '',
    }).toString();
    return `https://outlook.live.com/calendar/0/deeplink/compose?${q}`;
  };

  async function postEventToast(extraLines = []) {
    // Build the message text that will be posted into the room
    const whenLine = fmtLocalRange(candidate.startISO, candidate.endISO, candidate.isAllDay);
    const lines = [
      `📅 ${title || 'Event'}`,
      location ? `📍 ${location}` : null,
      `🕒 ${whenLine}`,
      ...(description ? [description] : []),
      ...extraLines,
    ].filter(Boolean);

    const form = new FormData();
    form.append('chatRoomId', String(chatroom.id));
    form.append('expireSeconds', '0');
    form.append('content', lines.join('\n'));

    try {
      await axiosClient.post('/messages', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
    } catch (e) {
      // Non-blocking: if post fails, just ignore so user still gets their calendar action.
      console.warn('event toast post failed', e);
    }
  }

  async function clickGoogle() {
    const href = googleHref();
    window.open(href, '_blank', 'noopener,noreferrer');
    await postEventToast([`➕ Google: ${href}`]);
    setOpen(false);
  }

  async function clickOutlook() {
    const href = outlookHref();
    window.open(href, '_blank', 'noopener,noreferrer');
    await postEventToast([`➕ Outlook: ${href}`]);
    setOpen(false);
  }

  async function downloadIcs() {
    const { data } = await axiosClient.post('/calendar/ics?inline=1', {
      title,
      description,
      location,
      startISO: candidate.startISO,
      endISO: candidate.endISO,
    });
    const blob = new Blob([data.ics], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'event.ics';
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);

    await postEventToast(['⬇️ ICS file downloaded (add to your calendar).']);
    setOpen(false);
  }

  async function emailInvite() {
    const to = (prompt('Send invite to (comma-separated emails):') || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    if (!to.length) return;

    await axiosClient.post('/calendar/email-invite', {
      to,
      title,
      description,
      location,
      startISO: candidate.startISO,
      endISO: candidate.endISO,
    });

    await postEventToast([`📧 Invites emailed to: ${to.join(', ')}`]);
    setOpen(false);
  }

  return (
    <>
      <Group justify="center" mt="xs" gap="xs">
        <Button size="xs" variant="light" onClick={openComposer}>
          Add to calendar?
        </Button>
      </Group>

      <Modal opened={open} onClose={() => setOpen(false)} title="Create calendar event" centered>
        <TextInput label="Title" value={title} onChange={(e) => setTitle(e.currentTarget.value)} mb="sm" />
        <TextInput label="Location" value={location} onChange={(e) => setLocation(e.currentTarget.value)} mb="sm" />
        <Textarea label="Description" value={description} onChange={(e) => setDescription(e.currentTarget.value)} mb="md" />

        <Group justify="space-between">
          <Group gap="xs">
            <Button size="xs" onClick={clickGoogle}>Google</Button>
            <Button size="xs" onClick={clickOutlook}>Outlook</Button>
            <Button size="xs" variant="light" onClick={downloadIcs}>Download .ics</Button>
          </Group>
          <Button size="xs" variant="default" onClick={emailInvite}>Email invite</Button>
        </Group>
      </Modal>
    </>
  );
}
