import { createContext, useContext, useState, useCallback, useMemo } from 'react';
import type { ReactNode } from 'react';
import { createElement } from 'react';
import en from './en';
import type { LocaleKeys, LocaleMap } from './en';

export type SupportedLocale =
  | 'en' | 'ru' | 'pt-BR' | 'fr' | 'de' | 'zh-CN'
  | 'da' | 'sv' | 'pl' | 'tr' | 'fi' | 'mn';

export const LOCALE_NAMES: Record<SupportedLocale, string> = {
  en: 'English',
  ru: 'Русский',
  'pt-BR': 'Português (BR)',
  fr: 'Français',
  de: 'Deutsch',
  'zh-CN': '中文',
  da: 'Dansk',
  sv: 'Svenska',
  pl: 'Polski',
  tr: 'Türkçe',
  fi: 'Suomi',
  mn: 'Монгол',
};

// Lazy-load locale files to avoid bundling all at once
const loaders: Record<SupportedLocale, () => Promise<{ default: LocaleMap }>> = {
  en: () => Promise.resolve({ default: en }),
  ru: () => import('./ru'),
  'pt-BR': () => import('./pt-BR'),
  fr: () => import('./fr'),
  de: () => import('./de'),
  'zh-CN': () => import('./zh-CN'),
  da: () => import('./da'),
  sv: () => import('./sv'),
  pl: () => import('./pl'),
  tr: () => import('./tr'),
  fi: () => import('./fi'),
  mn: () => import('./mn'),
};

const STORAGE_KEY = 'stratcall-locale';

function detectLocale(): SupportedLocale {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored && stored in loaders) return stored as SupportedLocale;

  const nav = navigator.language || '';
  // Try exact match first (e.g. pt-BR, zh-CN)
  if (nav in loaders) return nav as SupportedLocale;
  // Try base language (e.g. pt -> pt-BR, zh -> zh-CN)
  const base = nav.split('-')[0];
  if (base === 'pt') return 'pt-BR';
  if (base === 'zh') return 'zh-CN';
  if (base in loaders) return base as SupportedLocale;

  return 'en';
}

// Interpolate {key} placeholders
function interpolate(template: string, vars?: Record<string, string | number>): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (_, key) => {
    const val = vars[key];
    return val !== undefined ? String(val) : `{${key}}`;
  });
}

interface I18nContextValue {
  locale: SupportedLocale;
  setLocale: (locale: SupportedLocale) => void;
  t: (key: LocaleKeys, vars?: Record<string, string | number>) => string;
}

const I18nContext = createContext<I18nContextValue>({
  locale: 'en',
  setLocale: () => {},
  t: (key) => en[key] || key,
});

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<SupportedLocale>(detectLocale);
  const [messages, setMessages] = useState<LocaleMap>(en);

  const setLocale = useCallback(async (next: SupportedLocale) => {
    try {
      const mod = await loaders[next]();
      setMessages(mod.default);
      setLocaleState(next);
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Fallback to English on load failure
      setMessages(en);
      setLocaleState('en');
    }
  }, []);

  // Load initial locale if not English
  useState(() => {
    const initial = detectLocale();
    if (initial !== 'en') {
      loaders[initial]().then(mod => {
        setMessages(mod.default);
        setLocaleState(initial);
      }).catch(() => {});
    }
  });

  const t = useCallback((key: LocaleKeys, vars?: Record<string, string | number>): string => {
    const template = messages[key] || en[key] || key;
    return interpolate(template, vars);
  }, [messages]);

  const value = useMemo(() => ({ locale, setLocale, t }), [locale, setLocale, t]);

  return createElement(I18nContext.Provider, { value }, children);
}

export function useLocale() {
  return useContext(I18nContext);
}

export type { LocaleKeys, LocaleMap };
