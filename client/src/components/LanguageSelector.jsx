import { useEffect, useState, useMemo } from 'react';
import PropTypes from 'prop-types';
import { Select } from '@mantine/core';
import { LANGUAGES } from '../constants/languages';
import i18n from '../i18n';

const options = useMemo(() => LANGUAGES.map(({ code, name }) => ({ value: code, label: name })), []);

export default function LanguageSelector({ currentLanguage = 'en', onChange }) {
  const [selected, setSelected] = useState(currentLanguage);

  // keep internal state in sync if parent changes prop
  useEffect(() => setSelected(currentLanguage), [currentLanguage]);

  // map to Mantine Select data shape
  const options = useMemo(
    () => languages.map(({ code, name }) => ({ value: code, label: name })),
    []
  );

  useEffect(() => {
    if (!selected) return;
    // Switch UI immediately
    i18n.changeLanguage(selected);
    // Bubble up to parent (UserProfile) so it can save to backend
    onChange?.(selected);
  }, [selected, onChange]);

  return (
    <Select
      label="Preferred language"
      placeholder="Choose a language"
      searchable
      clearable={false}
      data={options}
      value={selected}
      onChange={setSelected}
      nothingFoundMessage="No matches"
      radius="md"
    />
  );
}

LanguageSelector.propTypes = {
  currentLanguage: PropTypes.string,
  onChange: PropTypes.func,
};
