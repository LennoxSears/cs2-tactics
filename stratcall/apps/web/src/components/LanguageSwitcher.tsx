import { useLocale, LOCALE_NAMES } from '../lib/i18n';
import type { SupportedLocale } from '../lib/i18n';

export default function LanguageSwitcher() {
  const { locale, setLocale } = useLocale();

  return (
    <select
      className="lang-switcher"
      value={locale}
      onChange={e => setLocale(e.target.value as SupportedLocale)}
      title="Language"
    >
      {(Object.entries(LOCALE_NAMES) as [SupportedLocale, string][]).map(([code, name]) => (
        <option key={code} value={code}>{name}</option>
      ))}
    </select>
  );
}
