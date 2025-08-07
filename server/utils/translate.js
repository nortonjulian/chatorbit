import { v2 } from '@google-cloud/translate';
import dotenv from 'dotenv';
dotenv.config();

const { Translate } = v2;
const translate = new Translate({
  key: process.env.GOOGLE_API_KEY,
});

export const translateMessageIfNeeded = async (content, sender, participants) => {
  const senderLang = sender.preferredLanguage || 'en';

  const detectedLang = franc(content || '') || 'und';
  if (detectedLang === 'und' || detectedLang === senderLang) {
    return { translatedText: null, targetLang: null }
  }

  const recipientLangs = participants
    .filter((p) => p.userId !== sender.id)
    .map((p) => p.user?.preferredLanguage || 'en');

  const uniqueLangs = [...new Set(recipientLangs)];

  if (uniqueLangs.length === 1 && uniqueLangs[0] === senderLang) {
    return { translatedText: null, targetLang: null };
  }

  const targetLang = uniqueLangs.find((lang) => lang !== senderLang) || 'en';

  try {
    const [translatedText] = await translate.translate(content, targetLang);
    return { translatedText, targetLang };
  } catch (error) {
    console.error('Translation failed:', error);
    return { translatedText: null, targetLang: null };
  }
};
