import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import HttpBackend from 'i18next-http-backend';

import { SUPPORTED_LNGS } from './constants/languages'; // all your language codes

i18n
  .use(HttpBackend)        // load translations over HTTP
  .use(LanguageDetector)   // detect user language
  .use(initReactI18next)
  .init({
    supportedLngs: SUPPORTED_LNGS,     // accept everything in your selector
    fallbackLng: 'en',                  // fall back to English if a key/file is missing
    nonExplicitSupportedLngs: true,     // map es-MX -> es, pt-BR -> pt, etc.

    interpolation: { escapeValue: false },

    detection: {
      order: ['localStorage', 'cookie', 'navigator', 'htmlTag', 'querystring'],
      caches: ['localStorage', 'cookie'],
      lookupLocalStorage: 'i18nextLng',
      lookupCookie: 'i18nextLng',
    },

    backend: {
      // Served from client/public
      loadPath: '/locales/{{lng}}/translation.json',
      // optional cache-buster if you set a version env
      queryStringParams: { v: import.meta.env?.VITE_APP_VERSION || '' },
    },

    returnNull: false,
    debug: false,
  });

export default i18n;
