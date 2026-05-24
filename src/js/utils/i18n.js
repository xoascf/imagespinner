import { $ } from './dom.js';
import { storageGet, storageSet } from './storage.js';

// __locales is injected by the build process (auto-discovered from src/locales/*.json)
// At dev time, falls back to empty object — load locales manually if needed
const locales = typeof __locales !== 'undefined' ? __locales : {};
const fallbackLang = 'en';

export let language = storageGet('spinnerLanguage', fallbackLang);

export function setLanguage(lang) {
  language = lang;
  storageSet('spinnerLanguage', lang);
}

export function t(key) {
  const loc = locales[language] || locales[fallbackLang] || {};
  return loc.strings?.[key] || locales[fallbackLang]?.strings?.[key] || key;
}

export function formatStatus(key, params) {
  const loc = locales[language] || locales[fallbackLang] || {};
  const tmpl = loc.status?.[key] || locales[fallbackLang]?.status?.[key];
  if (tmpl && params) {
    return tmpl.replace(/\{(\w+)\}/g, (_, k) => params[k] != null ? params[k] : k);
  }
  return t(key);
}

export function populateLanguageSelect() {
  const sel = $('languageSelect');
  if (!sel) return;
  sel.innerHTML = '';
  for (const [code, data] of Object.entries(locales)) {
    const opt = document.createElement('option');
    opt.value = code;
    opt.textContent = data.meta?.nativeName || data.meta?.name || code;
    sel.appendChild(opt);
  }
  sel.value = language;
}

export function applyLanguage() {
  document.documentElement.lang = language;
  document.title = t('appTitle');
  populateLanguageSelect();
  document.querySelectorAll('[data-i18n]').forEach(el => {
    el.textContent = t(el.dataset.i18n);
  });
  document.querySelectorAll('[data-i18n-aria]').forEach(el => {
    el.setAttribute('aria-label', t(el.dataset.i18nAria));
  });
  const statusKey = $('status').dataset.statusKey || 'ready';
  const params = $('status').dataset.statusParams ? JSON.parse($('status').dataset.statusParams) : null;
  $('status').textContent = formatStatus(statusKey, params);
  import('../controls/status.js').then(m => m.updatePauseBtnText());
  import('../controls/position.js').then(m => m.updateMeta());
}
