import { Translate } from '@google-cloud/translate/build/src/v2/index.js';
import dotenv from 'dotenv';
dotenv.config()

const translate = new Translate({ key: process.env.GOOGLE_API_KEY })

export const translateMessageIfNeeded = async (content, sender, participants) => {
    const senderLang = sender.preferredLanguage || 'en'

    const recipientLangs = participants
    .filter(p => p.userId !== sender.id)
    .map(p => p.user?.preferredLanguage || 'en')

    const uniqueLangs = [...new Set(recipientLangs)]

    if (uniqueLangs.length === 1 && uniqueLangs[0] === senderLang) return null

    const targetLang = uniqueLangs.find(lang => lang !== senderLang) || 'en'

    try {
        const [translated] = await translate.translate(content, targetLang);
        return translated;
    } catch (error) {
        console.log("Translation failed:", error);
        return null;
    }
}

