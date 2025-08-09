import { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import { Select } from '@mantine/core';
import i18n from '../i18n';
import { LANGUAGES } from '../constants/languages';

export default function LanguageSelector({ currentLanguage = 'en', onChange }) {
  const [selected, setSelected] = useState(currentLanguage);

  useEffect(() => setSelected(currentLanguage), [currentLanguage]);

  // simple const instead of useMemo (avoids the React hook call entirely)
  const options = LANGUAGES.map(({ code, name }) => ({ value: code, label: name }));

  useEffect(() => {
    if (!selected) return;
    i18n.changeLanguage(selected);
    onChange?.(selected);
  }, [selected, onChange]);

  return (
    <Select
      label={i18n.t('Preferred language')}
      placeholder={i18n.t('Choose a language')}
      searchable
      clearable={false}
      data={options}
      value={selected}
      onChange={setSelected}
      nothingFoundMessage={i18n.t('No matches')}
      radius="md"
    />
  );
}

LanguageSelector.propTypes = {
  currentLanguage: PropTypes.string,
  onChange: PropTypes.func,
};
