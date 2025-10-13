

import { es } from './es';
import { en } from './en';
import { fr } from './fr';
import { de } from './de';
import { pt } from './pt';
import { zh } from './zh';

type Translations = {
  [key: string]: any;
};

export const translations: Translations = {
  es,
  en,
  fr,
  de,
  pt,
  zh,
};