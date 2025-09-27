import { useState, useMemo } from 'react';
import { Text } from '@mantine/core';
import { useTranslation } from 'react-i18next';

// Props:
// - originalText?: string
// - translatedText?: string|null  (pass null to disable translation for this render)
// - showBothDefault?: boolean     (if true & both exist, show both stacked w/o toggle)
// - condensed?: boolean           (smaller font)
// - onCopy?: () => void           (optional copy hook)
export default function TranslatedText({
  originalText = '',
  translatedText = null,
  showBothDefault = false,
  condensed = false,
  onCopy,
}) {
  const { t } = useTranslation(['common']);
  const both = Boolean(originalText) && Boolean(translatedText);
  const [showOriginal, setShowOriginal] = useState(showBothDefault);

  const primary = useMemo(() => {
    if (!both) return translatedText || originalText || '';
    return showOriginal ? originalText : translatedText;
  }, [both, translatedText, originalText, showOriginal]);

  const secondary = useMemo(() => {
    if (!both) return null;
    return showOriginal ? translatedText : originalText;
  }, [both, translatedText, originalText, showOriginal]);

  return (
    <div>
      <Text
        size={condensed ? 'sm' : 'md'}
        onCopy={onCopy}
        style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}
      >
        {primary}
      </Text>

      {both && showBothDefault && secondary && (
        <Text
          size={condensed ? 'xs' : 'sm'}
          c="dimmed"
          mt={4}
          style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}
        >
          {secondary}
        </Text>
      )}

      {both && !showBothDefault && (
        <button
          type="button"
          onClick={() => setShowOriginal((v) => !v)}
          style={{
            marginTop: 4,
            background: 'none',
            border: 'none',
            padding: 0,
            textDecoration: 'underline',
            cursor: 'pointer',
            fontSize: condensed ? 12 : 13,
            opacity: 0.8,
          }}
          aria-label={
            showOriginal
              ? t('common.showTranslation', 'Show translation')
              : t('common.showOriginal', 'Show original')
          }
        >
          {showOriginal
            ? t('common.showTranslation', 'Show translation')
            : t('common.showOriginal', 'Show original')}
        </button>
      )}
    </div>
  );
}
