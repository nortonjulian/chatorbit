import { useEffect, useMemo, useState } from 'react';
import { Modal, Tabs, Button, Group, Stack, Text, FileInput, Table, Checkbox, TextInput, Divider } from '@mantine/core';
import Papa from 'papaparse';
import { parse as parseVCard } from 'vcard-parser';
import { importContacts } from '../api/contacts';
import { toast } from '../utils/toast';

function mapCSV(rows) {
  // Heuristics: name, phone, email columns
  const lower = (s)=> (s||'').toLowerCase();
  const findCol = (cols, keys) => {
    const i = cols.findIndex(c => keys.some(k => lower(c).includes(k)));
    return i >= 0 ? i : null;
  };

  const [header, ...data] = rows;
  if (!header) return [];

  const nameIdx  = findCol(header, ['name', 'full name', 'display']);
  const phoneIdx = findCol(header, ['phone', 'mobile', 'tel']);
  const emailIdx = findCol(header, ['email', 'mail']);

  return data.map(r => ({
    name: nameIdx != null ? r[nameIdx] : '',
    phones: phoneIdx != null ? String(r[phoneIdx] || '').split(/[;,/]/).map(s => s.trim()).filter(Boolean) : [],
    emails: emailIdx != null ? String(r[emailIdx] || '').split(/[;,/]/).map(s => s.trim()).filter(Boolean) : [],
  })).filter(c => (c.name || c.phones?.length || c.emails?.length));
}

function mapVCF(text) {
  try {
    const cards = parseVCard(text);
    return cards.map(card => {
      const name = (card.fn && card.fn[0]?.value) || '';
      const tels = (card.tel || []).map(t => (Array.isArray(t.value) ? t.value[0] : t.value)).filter(Boolean);
      const emails = (card.email || []).map(e => (Array.isArray(e.value) ? e.value[0] : e.value)).filter(Boolean);
      return { name, phones: tels, emails };
    }).filter(c => (c.name || c.phones?.length || c.emails?.length));
  } catch {
    return [];
  }
}

function canUseContactsPicker() {
  return typeof navigator !== 'undefined' && 'contacts' in navigator && 'select' in navigator.contacts;
}

export default function ImportContactsModal({ opened, onClose, defaultCountry = 'US' }) {
  const [rows, setRows] = useState([]);             // parsed contacts
  const [selected, setSelected] = useState(new Set());
  const [filter, setFilter] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!opened) { setRows([]); setSelected(new Set()); setFilter(''); }
  }, [opened]);

  const filtered = useMemo(() => {
    const f = filter.toLowerCase();
    if (!f) return rows;
    return rows.filter(r =>
      (r.name || '').toLowerCase().includes(f) ||
      (r.phones||[]).some(p => p.includes(f)) ||
      (r.emails||[]).some(e => e.toLowerCase().includes(f))
    );
  }, [rows, filter]);

  const toggle = (idx) => {
    const next = new Set(selected);
    if (next.has(idx)) next.delete(idx); else next.add(idx);
    setSelected(next);
  };

  const pickFromDevice = async () => {
    try {
      const props = ['name', 'tel', 'email'];
      const opts = { multiple: true };
      const picked = await navigator.contacts.select(props, opts);
      const mapped = picked.map(p => ({
        name: Array.isArray(p.name) ? p.name[0] : p.name,
        phones: (p.tel || []).map(String),
        emails: (p.email || []).map(String),
      }));
      setRows(mapped);
      setSelected(new Set(mapped.map((_, i) => i))); // preselect all
      toast.ok(`Imported ${mapped.length} from device (preview)`);
    } catch (e) {
      toast.err('Unable to read contacts from device.');
    }
  };

  const onCSV = async (file) => {
    if (!file) return;
    Papa.parse(file, {
      complete: (res) => {
        const mapped = mapCSV(res.data);
        setRows(mapped);
        setSelected(new Set(mapped.map((_, i) => i)));
        toast.ok(`Parsed ${mapped.length} contacts from CSV.`);
      },
      error: () => toast.err('Failed parsing CSV.'),
      skipEmptyLines: true,
    });
  };

  const onVCF = async (file) => {
    if (!file) return;
    const text = await file.text();
    const mapped = mapVCF(text);
    setRows(mapped);
    setSelected(new Set(mapped.map((_, i) => i)));
    toast.ok(`Parsed ${mapped.length} contacts from VCF.`);
  };

  const submit = async () => {
    const payload = filtered
      .map((c, i) => ({ c, i }))
      .filter(({ i }) => selected.has(i))
      .map(({ c }) => c);

    if (!payload.length) {
      toast.info('Select at least one contact.');
      return;
    }
    if (payload.length > 2000) {
      toast.err('Limit 2000 contacts per import.');
      return;
    }

    setLoading(true);
    try {
      const res = await importContacts({ defaultCountry, contacts: payload });
      toast.ok(`Imported: ${res.added} • Updated: ${res.updated} • Duplicates: ${res.skippedDuplicates} • Invalid: ${res.invalid}`);
      onClose?.();
    } catch (e) {
      toast.err('Import failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal opened={opened} onClose={onClose} title="Import contacts" size="xl" centered>
      <Stack gap="md">
        <Text c="dimmed">
          Only the contacts you select will be uploaded. Phone numbers are normalized to your region ({defaultCountry}).
        </Text>

        <Tabs defaultValue={canUseContactsPicker() ? 'device' : 'file'}>
          {canUseContactsPicker() && (
            <Tabs.List>
              <Tabs.Tab value="device">From phone</Tabs.Tab>
              <Tabs.Tab value="file">From file (.vcf / .csv)</Tabs.Tab>
            </Tabs.List>
          )}
          {!canUseContactsPicker() && (
            <Tabs.List>
              <Tabs.Tab value="file">From file (.vcf / .csv)</Tabs.Tab>
            </Tabs.List>
          )}

          {canUseContactsPicker() && (
            <Tabs.Panel value="device" pt="sm">
              <Group justify="space-between" align="center">
                <Button onClick={pickFromDevice}>Open phone contacts</Button>
                <TextInput placeholder="Filter…" value={filter} onChange={(e)=>setFilter(e.target.value)} />
              </Group>
            </Tabs.Panel>
          )}

          <Tabs.Panel value="file" pt="sm">
            <Group gap="sm" wrap="nowrap">
              <FileInput accept=".csv,text/csv" placeholder="Pick a CSV file" onChange={onCSV} />
              <FileInput accept=".vcf,text/vcard" placeholder="Pick a VCF file" onChange={onVCF} />
              <TextInput placeholder="Filter…" value={filter} onChange={(e)=>setFilter(e.target.value)} style={{ flex: 1 }} />
            </Group>
          </Tabs.Panel>
        </Tabs>

        <Divider />

        <Table striped highlightOnHover withTableBorder withColumnBorders>
          <Table.Thead>
            <Table.Tr>
              <Table.Th style={{ width: 48 }}></Table.Th>
              <Table.Th>Name</Table.Th>
              <Table.Th>Phones</Table.Th>
              <Table.Th>Emails</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {filtered.slice(0, 500).map((c, i) => (
              <Table.Tr key={i}>
                <Table.Td>
                  <Checkbox checked={selected.has(i)} onChange={() => toggle(i)} />
                </Table.Td>
                <Table.Td>{c.name || <Text c="dimmed">—</Text>}</Table.Td>
                <Table.Td>{(c.phones||[]).join(', ') || <Text c="dimmed">—</Text>}</Table.Td>
                <Table.Td>{(c.emails||[]).join(', ') || <Text c="dimmed">—</Text>}</Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
        {filtered.length > 500 && <Text c="dimmed">Showing first 500… refine filter to narrow.</Text>}

        <Group justify="flex-end">
          <Button variant="default" onClick={onClose}>Cancel</Button>
          <Button loading={loading} onClick={submit}>Import selected</Button>
        </Group>
      </Stack>
    </Modal>
  );
}
