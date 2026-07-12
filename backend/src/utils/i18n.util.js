import i18n from 'i18n';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

i18n.configure({
  locales: ['en', 'ps', 'fa'],
  defaultLocale: 'en',
  fallbacks: { 'ps': 'en', 'fa': 'en' },
  directory: path.join(__dirname, '../../locales'),
  objectNotation: true,
  updateFiles: false,
  syncFiles: false,
  indent: '  ',
  extension: '.json',
  api: {
    __: 't',
    __n: 'tn'
  },
  register: global
});

export default i18n;
