/**
 * MiFiL CMS — public, read-only Firestore content loader.
 * Local texts.js and asset scripts remain the fallback if Firebase is unavailable.
 * Add ?cmsDebug=1 (or &cmsDebug=1) to the public URL to see which source was used.
 */
import { firebaseConfig, isFirebaseConfigured } from './config.js';

const allowedIds = ['livemo', 'our-quest', 'feel', 'playable-letter'];
const debugMode = new URLSearchParams(location.search).get('cmsDebug') === '1';
let debugElement = null;

function reportStatus(state, explanation, publishedAt = '') {
  const info = { state, explanation, publishedAt };
  window.MiFiLCMSStatus = info;
  window.dispatchEvent(new CustomEvent('mifil:content-status', { detail: info }));
  if (!debugMode) return;
  if (!debugElement) {
    debugElement = document.createElement('div');
    debugElement.setAttribute('role', 'status');
    debugElement.setAttribute('aria-live', 'polite');
    debugElement.style.cssText = [
      'position:fixed', 'bottom:12px', 'left:12px', 'z-index:99999',
      'max-width:min(450px,calc(100vw - 24px))', 'white-space:pre-wrap',
      'overflow-wrap:anywhere', 'background:#101d30', 'color:#f3f6fc',
      'border:1px solid #7890aa', 'border-radius:12px', 'padding:12px 16px',
      'font:13px/1.5 system-ui,sans-serif', 'box-shadow:0 8px 24px #0005',
    ].join(';');
    document.body.append(debugElement);
  }
  const lang = document.documentElement.lang || 'en';
  debugElement.textContent = `MiFiL CMS: ${explanation}\nЯзык страницы: ${lang}` +
    (publishedAt ? `\nДата публикации: ${publishedAt}` : '');
}

const safeAssetPath = (value) => typeof value === 'string' &&
  /^(?:assets\/[-\w./]+\.(?:png|jpg|jpeg|webp|svg))(?:\?[-\w=&.]+)?$/i.test(value) && !value.includes('..');

function safeHref(value, fallback) {
  if (typeof value !== 'string' || !value.trim()) return fallback;
  try {
    const url = new URL(value, location.href);
    return ['https:', 'http:'].includes(url.protocol) ? value : fallback;
  } catch {
    return fallback;
  }
}

function applyPublishedContent(bundle) {
  if (!bundle || bundle.schemaVersion !== 1) return false;
  const dictionary = window.mifilContent;
  const projects = window.MiFiLProjects;
  if (!dictionary || !projects) throw new Error('Не загружены локальные данные texts.js');

  // This object was previously missing on page.html, silently preventing ALL
  // translations and page text from being applied there.
  const statuses = window.MiFiLProjectAvailability ||
    (window.MiFiLProjectAvailability = { 'playable-letter': true });

  for (const [lang, map] of Object.entries(bundle.translations || {})) {
    if (!dictionary[lang] || !map || typeof map !== 'object') continue;
    for (const [key, value] of Object.entries(map)) {
      if (typeof value === 'string') dictionary[lang][key] = value;
    }
  }
  for (const [lang, map] of Object.entries(bundle.teasers || {})) {
    if (!window.MiFiLTeasers?.[lang] || !map || typeof map !== 'object') continue;
    for (const id of allowedIds) {
      if (typeof map[id] === 'string') window.MiFiLTeasers[lang][id] = map[id];
    }
  }
  for (const [lang, value] of Object.entries(bundle.comingSoon || {})) {
    if (typeof value === 'string' && window.MiFiLComingSoon?.[lang] !== undefined) {
      window.MiFiLComingSoon[lang] = value;
    }
  }
  for (const id of allowedIds) {
    const item = bundle.projects?.[id];
    if (!item || typeof item !== 'object' || !projects[id]) continue;
    if (typeof item.name === 'string') projects[id].name = item.name;
    if (typeof item.released === 'boolean') statuses[id] = item.released;
    if (Array.isArray(item.links)) {
      projects[id].links = item.links.filter((link) =>
        link && typeof link.label === 'string' && typeof link.href === 'string')
        .map((link) => ({ label: link.label, href: safeHref(link.href, '#') }));
    }
    const defaultHref = id === 'playable-letter' ? 'playable-letter/' : `page.html?view=${id}`;
    projects[id].href = safeHref(item.href, defaultHref);
    if (safeAssetPath(item.icon)) projects[id].icon = item.icon;
  }
  if (bundle.pages && typeof bundle.pages === 'object') {
    window.MiFiLPages = Object.fromEntries(
      ['about', 'creator', 'privacy']
        .filter((id) => bundle.pages[id] && bundle.pages[id].published !== false)
        .map((id) => [id, {
          titleKey: String(bundle.pages[id].titleKey || id),
          bodyKey: String(bundle.pages[id].bodyKey || `${id}Text`),
        }])
    );
  }
  window.dispatchEvent(new CustomEvent('mifil:content-ready'));
  return true;
}

async function load() {
  if (!isFirebaseConfigured()) {
    reportStatus('fallback', 'Используются локальные тексты: Firebase не настроен');
    return;
  }
  reportStatus('loading', 'Загрузка опубликованных данных из Firebase…');
  try {
    const [{ initializeApp, getApps, getApp }, { getFirestore, doc, getDocFromServer }] = await Promise.all([
      import('https://www.gstatic.com/firebasejs/13.4.0/firebase-app.js'),
      import('https://www.gstatic.com/firebasejs/13.4.0/firebase-firestore.js'),
    ]);
    const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
    // Ask the server, not a potentially stale Firestore browser cache.
    const snapshot = await getDocFromServer(doc(getFirestore(app), 'siteContent', 'public'));
    if (!snapshot.exists()) {
      reportStatus('fallback', 'Используются локальные тексты: публикация отсутствует в Firestore');
      return;
    }
    const bundle = snapshot.data();
    if (!applyPublishedContent(bundle)) {
      reportStatus('fallback', 'Используются локальные тексты: неизвестный формат публикации');
      return;
    }
    const updatedAt = bundle.updatedAt?.toDate?.();
    reportStatus('published', 'Опубликованные данные загружены из Firestore',
      updatedAt instanceof Date && !Number.isNaN(updatedAt.getTime()) ? updatedAt.toLocaleString() : '');
  } catch (error) {
    console.warn('[MiFiL] Published content unavailable; using bundled content.', error);
    const code = typeof error?.code === 'string' ? ` (${error.code})` : '';
    reportStatus('fallback', `Используются локальные тексты: ошибка загрузки Firebase${code}`);
  }
}

load();
