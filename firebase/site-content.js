/**
 * Public, READ-ONLY MiFiL content loader.
 * The original texts.js and assets scripts remain the automatic offline/
 * unconfigured fallback. No authentication or private data is read here.
 */
import { firebaseConfig, isFirebaseConfigured } from './config.js';

const allowedIds = ['livemo', 'our-quest', 'feel', 'playable-letter'];
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
  if (!bundle || bundle.schemaVersion !== 1) return;
  const dictionary = window.mifilContent;
  const projects = window.MiFiLProjects;
  const statuses = window.MiFiLProjectAvailability;
  if (!dictionary || !projects || !statuses) return;

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
    if (!item || typeof item !== 'object') continue;
    if (typeof item.name === 'string') projects[id].name = item.name;
    if (typeof item.released === 'boolean') statuses[id] = item.released;
    if (Array.isArray(item.links)) projects[id].links = item.links.filter((link) =>
      link && typeof link.label === 'string' && typeof link.href === 'string')
      .map((link) => ({ label: link.label, href: safeHref(link.href, '#') }));
    const defaultHref = id === 'playable-letter' ? 'playable-letter/' : `page.html?view=${id}`;
    projects[id].href = safeHref(item.href, defaultHref);
    if (safeAssetPath(item.icon)) projects[id].icon = item.icon;
  }
  if (bundle.pages && typeof bundle.pages === 'object') {
    window.MiFiLPages = Object.fromEntries(
      ['about', 'creator', 'privacy'].filter((id) => bundle.pages[id] && bundle.pages[id].published !== false)
        .map((id) => [id, {
          titleKey: String(bundle.pages[id].titleKey || id),
          bodyKey: String(bundle.pages[id].bodyKey || `${id}Text`),
        }])
    );
  }
  window.dispatchEvent(new CustomEvent('mifil:content-ready'));
}

async function load() {
  if (!isFirebaseConfigured()) return;
  try {
    const [{ initializeApp, getApps, getApp }, { getFirestore, doc, getDoc }] = await Promise.all([
      import('https://www.gstatic.com/firebasejs/13.4.0/firebase-app.js'),
      import('https://www.gstatic.com/firebasejs/13.4.0/firebase-firestore.js'),
    ]);
    const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
    const snapshot = await getDoc(doc(getFirestore(app), 'siteContent', 'public'));
    if (snapshot.exists()) applyPublishedContent(snapshot.data());
  } catch (error) {
    // Never take the website down if Firebase is offline, misconfigured,
    // or temporarily blocked. Keep the local content as a safe fallback.
    console.warn('[MiFiL] Published content unavailable; using bundled content.', error);
  }
}
load();
