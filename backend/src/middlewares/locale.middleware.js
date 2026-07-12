import i18n from '../utils/i18n.util.js';

/**
 * Middleware to detect and set locale for incoming requests
 * Priority: X-Locale header > lang query param > Accept-Language header > default (en)
 */
export const localeMiddleware = (req, res, next) => {
  const supportedLocales = ['en', 'ps', 'fa'];
  
  // 1. Check custom header X-Locale
  let locale = req.headers['x-locale'];
  
  // 2. Check query parameter ?lang=
  if (!locale || !supportedLocales.includes(locale)) {
    locale = req.query.lang;
  }
  
  // 3. Check Accept-Language header
  if (!locale || !supportedLocales.includes(locale)) {
    const acceptLanguage = req.headers['accept-language'];
    if (acceptLanguage) {
      const preferredLanguage = acceptLanguage.split(',')[0].split('-')[0];
      locale = preferredLanguage;
    }
  }
  
  // 4. Validate locale is supported
  if (!supportedLocales.includes(locale)) {
    locale = 'en'; // fallback to English
  }
  
  // Set locale for this request
  req.locale = locale;
  i18n.setLocale(req, locale);
  
  // Make translation function available on request
  req.t = i18n.__; // req.t('key')
  req.tn = i18n.__n; // req.tn('key', count) for pluralization
  
  next();
};
