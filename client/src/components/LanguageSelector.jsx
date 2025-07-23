import { useState, useEffect } from 'react';

const languages = [
    { code: 'en', name: 'English' },
    { code: 'es', name: 'Spanish' },
    { code: 'fr', name: 'French' },
    { code: 'de', name: 'German' },
    { code: 'zh', name: 'Chinese' },
    { code: 'ja', name: 'Japanese' }
]

function LanguageSelector({ currentLanguage, onChange }) {
    const [selectedLanguage, setSelectedLanguage] = useState(currentLanguage || 'en')

    useEffect(() => {
        onChange(selectedLanguage);
    }, [selectedLanguage, onChange])

    return (
        <select
          value={selectedLanguage}
          onChange={(e) => setSelectedLanguage(e.target.value)}
          className="border rounded px-3 py-2"
        >
          {languages.map(({ code, name}) => (
            <option key={code} value={code}>
                {name}
            </option>
          ))}  
        </select>
    )
}

export default LanguageSelector