import { useState, useEffect } from 'react';

const languages = [
    { code: 'af', name: 'Afrikaans' },
    { code: 'am', name: 'Amharic' },
    { code: 'ar', name: 'Arabic' },
    { code: 'az', name: 'Azerbaijani' },
    { code: 'be', name: 'Belarusian' },
    { code: 'bg', name: 'Bulgarian' },
    { code: 'bn', name: 'Bengali' },
    { code: 'bs', name: 'Bosnian' },
    { code: 'ca', name: 'Catalan' },
    { code: 'ceb', name: 'Cebuano' },
    { code: 'zh', name: 'Chinese' },
    { code: 'cs', name: 'Czech' },
    { code: 'cy', name: 'Welsh' },
    { code: 'da', name: 'Danish' },
    { code: 'de', name: 'German' },
    { code: 'el', name: 'Greek' },
    { code: 'en', name: 'English' },
    { code: 'eo', name: 'Esperanto' },
    { code: 'es', name: 'Spanish' },
    { code: 'et', name: 'Estonian' },
    { code: 'eu', name: 'Basque' },
    { code: 'fa', name: 'Persian' },
    { code: 'fi', name: 'Finnish' },
    { code: 'fr', name: 'French' },
    { code: 'ga', name: 'Irish' },
    { code: 'gd', name: 'Scottish Gaelic' },
    { code: 'gl', name: 'Galician' },
    { code: 'de', name: 'German' },
    { code: 'gu', name: 'Gujarati' },
    { code: 'ha', name: 'Hausa' },
    { code: 'haw', name: 'Hawaiian' },
    { code: 'he', name: 'Hebrew' },
    { code: 'hi', name: 'Hindi' },
    { code: 'hmn', name: 'Hmong' },
    { code: 'hr', name: 'Croatian' },
    { code: 'ht', name: 'Haitian Creole' },
    { code: 'hu', name: 'Hungarian' },
    { code: 'hy', name: 'Armenian' },
    { code: 'id', name: 'Indonesian' },
    { code: 'ig', name: 'Igbo' },
    { code: 'is', name: 'Icelandic' },
    { code: 'it', name: 'Italian' },
    { code: 'ja', name: 'Japanese' },
    { code: 'jv', name: 'Javanese' },
    { code: 'ka', name: 'Georgian' },
    { code: 'kk', name: 'Kazakh' },
    { code: 'km', name: 'Khmer' },
    { code: 'kn', name: 'Kannada' },
    { code: 'ko', name: 'Korean' },
    { code: 'ku', name: 'Kurdish (Kurmanji)' },
    { code: 'ky', name: 'Kyrgyz' },
    { code: 'la', name: 'Latin' },
    { code: 'lb', name: 'Luxembourgish' },
    { code: 'lo', name: 'Lao' },
    { code: 'lt', name: 'Lithuanian' },
    { code: 'lv', name: 'Latvian' },
    { code: 'mg', name: 'Malagasy' },
    { code: 'mi', name: 'Maori' },
    { code: 'mk', name: 'Macedonian' },
    { code: 'ml', name: 'Malayalam' },
    { code: 'mn', name: 'Mongolian' },
    { code: 'mr', name: 'Marathi' },
    { code: 'ms', name: 'Malay' },
    { code: 'mt', name: 'Maltese' },
    { code: 'my', name: 'Myanmar (Burmese)' },
    { code: 'ne', name: 'Nepali' },
    { code: 'nl', name: 'Dutch' },
    { code: 'no', name: 'Norwegian' },
    { code: 'ny', name: 'Chichewa' },
    { code: 'pa', name: 'Punjabi' },
    { code: 'pl', name: 'Polish' },
    { code: 'ps', name: 'Pashto' },
    { code: 'pt', name: 'Portuguese' },
    { code: 'ro', name: 'Romanian' },
    { code: 'ru', name: 'Russian' },
    { code: 'rw', name: 'Kinyarwanda' },
    { code: 'sd', name: 'Sindhi' },
    { code: 'si', name: 'Sinhala' },
    { code: 'sk', name: 'Slovak' },
    { code: 'sl', name: 'Slovenian' },
    { code: 'sm', name: 'Samoan' },
    { code: 'sn', name: 'Shona' },
    { code: 'es', name: 'Spanish' },
    { code: 'so', name: 'Somali' },
    { code: 'sq', name: 'Albanian' },
    { code: 'sr', name: 'Serbian' },
    { code: 'st', name: 'Sesotho' },
    { code: 'su', name: 'Sundanese' },
    { code: 'sv', name: 'Swedish' },
    { code: 'sw', name: 'Swahili' },
    { code: 'ta', name: 'Tamil' },
    { code: 'te', name: 'Telugu' },
    { code: 'tg', name: 'Tajik' },
    { code: 'th', name: 'Thai' },
    { code: 'tl', name: 'Filipino' },
    { code: 'tr', name: 'Turkish' },
    { code: 'tt', name: 'Tatar' },
    { code: 'ug', name: 'Uyghur' },
    { code: 'uk', name: 'Ukrainian' },
    { code: 'ur', name: 'Urdu' },
    { code: 'uz', name: 'Uzbek' },
    { code: 'vi', name: 'Vietnamese' },
    { code: 'xh', name: 'Xhosa' },
    { code: 'yi', name: 'Yiddish' },
    { code: 'yo', name: 'Yoruba' },
    { code: 'zh', name: 'Chinese' },
    { code: 'zu', name: 'Zulu' }
  ];

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