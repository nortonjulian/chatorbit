import { useEffect, useMemo, useState } from 'react';
import PropTypes from 'prop-types';
import { Select } from '@mantine/core';
import { useTranslation } from 'react-i18next';

export default function LanguageSelector({ currentLanguage = 'en', onChange }) {
  const { t, i18n } = useTranslation();
  const [selected, setSelected] = useState(currentLanguage);
  const [codes, setCodes] = useState([]);
  const [loading, setLoading] = useState(true);

  // Keep internal state in sync if parent updates currentLanguage
  useEffect(() => setSelected(currentLanguage), [currentLanguage]);

  // Load available language codes from the manifest written by the generator
  useEffect(() => {
    let cancelled = false;
    const v = import.meta.env?.VITE_APP_VERSION || '';
    setLoading(true);
    fetch(`/locales/manifest.json${v ? `?v=${v}` : ''}`)
      .then((r) => r.ok ? r.json() : Promise.reject(new Error(r.statusText)))
      .then(({ codes }) => { if (!cancelled) setCodes(Array.isArray(codes) ? codes : []); })
      .catch(() => { if (!cancelled) setCodes([]); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  // Localized labels for language codes
  const options = useMemo(() => {
    // Some codes aren't well-covered by Intl yet; map a few friendly names
    const special = {
      'zh-CN': 'Chinese (Simplified)',
      'zh-TW': 'Chinese (Traditional)',
      'yue': 'Cantonese',
      'ckb': 'Kurdish (Sorani)',
      'fil': 'Filipino (Tagalog)',
      'mni-Mtei': 'Meiteilon (Manipuri)'
    };

    const dn = new Intl.DisplayNames([i18n.resolvedLanguage], { type: 'language' });

    const labelFor = (code) => {
      // Try exact; then fallback to the base subtag (e.g. 'pt' from 'pt-BR')
      const base = code.split('-')[0];
      const fromIntl = dn.of(code) || dn.of(base);
      const name = special[code] || fromIntl || code;
      return capitalize(name);
    };

    // Ensure the current language is always present even if manifest missed it
    const unique = Array.from(new Set([...codes, i18n.resolvedLanguage]));
    const list = unique.map((code) => ({ value: code, label: labelFor(code) }));
    return list.sort((a, b) => a.label.localeCompare(b.label));
  }, [codes, i18n.resolvedLanguage]);

  // Change language (preload bundle before switching to avoid flicker)
  useEffect(() => {
    if (!selected) return;
    i18n.loadLanguages(selected).then(() => {
      i18n.changeLanguage(selected);
      onChange?.(selected); // persist if you like (e.g., localStorage/server)
    });
  }, [selected, i18n, onChange]);

  return (
    <Select
      label={t('profile.preferredLanguage')}
      placeholder={t('profile.chooseLanguage')}
      searchable
      clearable={false}
      data={options}
      value={selected}
      onChange={(val) => val && setSelected(val)}
      nothingFoundMessage={t('common.noMatches')}
      radius="md"
      disabled={loading || options.length === 0}
    />
  );
}

LanguageSelector.propTypes = {
  currentLanguage: PropTypes.string,
  onChange: PropTypes.func,
};

function capitalize(s) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}
