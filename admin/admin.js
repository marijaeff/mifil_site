import { firebaseConfig, isFirebaseConfigured } from '../firebase/config.js';

const $ = (id) => document.getElementById(id);
const projectIds = ['playable-letter', 'livemo', 'our-quest', 'feel'];
const pageIds = ['about', 'creator', 'privacy'];
const pageName = { about: 'О MiFiL', creator: 'От создателя', privacy: 'Конфиденциальность' };
const sectionName = { overview: 'Обзор', projects: 'Проекты', translations: 'Переводы', pages: 'Страницы', publish: 'Публикация' };
const sourceKeys = { about: ['about', 'aboutText'], creator: ['creator', 'creatorText'], privacy: ['privacy', 'privacyText'] };
const defaultLinks = {
  'playable-letter': 'playable-letter/',
  livemo: 'page.html?view=livemo',
  'our-quest': 'page.html?view=our-quest',
  feel: 'page.html?view=feel',
};
const state = {
  tab: 'overview', lang: 'ru', bundle: null, publicBundle: null,
  dirty: false, saved: true, busy: false, user: null,
  db: null, auth: null, sdk: null,
};
const clone = (value) => JSON.parse(JSON.stringify(value));

function element(tag, className, textContent) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (textContent !== undefined) node.textContent = textContent;
  return node;
}
function add(parent, ...children) { parent.append(...children); return parent; }
function showOnly(screen) {
  ['setup-screen', 'login-screen', 'admin-app'].forEach((id) => { $(id).hidden = id !== screen; });
}
function notice(message, error = false) {
  const target = $('notice');
  target.hidden = false;
  target.className = error ? 'notice error' : 'notice';
  target.textContent = message;
}
function reportLoginError(message) {
  $('login-error').hidden = false;
  $('login-error').textContent = message;
}
function markDirty() {
  state.dirty = true;
  state.saved = false;
  refreshSaveStatus();
}
function refreshSaveStatus() {
  const label = $('state-indicator');
  if (!state.bundle) label.textContent = 'База пуста';
  else if (state.dirty) label.textContent = 'Есть несохранённые изменения';
  else if (state.saved) label.textContent = 'Черновик сохранён';
  else label.textContent = 'Без изменений';
  label.classList.toggle('saved', !state.dirty);
  $('save-draft-btn').disabled = !state.bundle || state.busy;
  $('publish-btn').disabled = !state.bundle || state.busy;
}
function loading(on) {
  state.busy = on;
  refreshSaveStatus();
}
function legacyBundle() {
  const translations = clone(window.mifilContent || {});
  const projects = {};
  for (const id of projectIds) {
    const original = window.MiFiLProjects?.[id] || {};
    projects[id] = {
      name: original.name || id,
      href: defaultLinks[id],
      icon: `assets/icon-${id}.png`,
      released: window.MiFiLProjectAvailability?.[id] === true,
      links: clone(original.links || []),
    };
  }
  return {
    schemaVersion: 1,
    languages: clone(window.MiFiLLanguages || {}),
    translations,
    teasers: clone(window.MiFiLTeasers || {}),
    comingSoon: clone(window.MiFiLComingSoon || {}),
    projects,
    pages: {
      about: { titleKey: 'about', bodyKey: 'aboutText', published: true },
      creator: { titleKey: 'creator', bodyKey: 'creatorText', published: true },
      privacy: { titleKey: 'privacy', bodyKey: 'privacyText', published: true },
    },
  };
}
function fromFirestore(snapshot) {
  if (!snapshot.exists()) return null;
  const value = snapshot.data();
  if (value?.schemaVersion !== 1) throw new Error('Неподдерживаемая версия данных. Содержимое базы не было изменено.');
  const { updatedAt, ...content } = value;
  return clone(content);
}
function validateBundle() {
  if (!state.bundle || state.bundle.schemaVersion !== 1) throw new Error('Черновик не загружен.');
  for (const id of projectIds) {
    const item = state.bundle.projects[id];
    if (!item || !item.name?.trim()) throw new Error(`У проекта ${id} должно быть название.`);
    try {
      const url = new URL(item.href, new URL('../', import.meta.url));
      if (!['https:', 'http:'].includes(url.protocol)) throw new Error('Недопустимая ссылка');
    } catch { throw new Error(`Проверь ссылку проекта «${item.name}».`); }
    if (!/^assets\/[\w./-]+\.(png|webp|jpe?g|svg)(\?[\w=&.-]+)?$/i.test(item.icon) || item.icon.includes('..')) {
      throw new Error(`Проверь путь к иконке проекта «${item.name}».`);
    }
  }
}
function persistedBundle() {
  validateBundle();
  return { ...clone(state.bundle), updatedAt: state.sdk.serverTimestamp() };
}
async function loadContent() {
  const { doc, getDoc } = state.sdk;
  const publicRef = doc(state.db, 'siteContent', 'public');
  const draftRef = doc(state.db, 'siteContent', 'draft');
  const [publicSnapshot, draftSnapshot] = await Promise.all([getDoc(publicRef), getDoc(draftRef)]);
  state.publicBundle = fromFirestore(publicSnapshot);
  state.bundle = fromFirestore(draftSnapshot) || (state.publicBundle ? clone(state.publicBundle) : null);
  state.dirty = false;
  state.saved = Boolean(draftSnapshot.exists());
  updateLayout();
}
async function importLegacy() {
  if (state.busy || state.bundle) return;
  if (!confirm('Импортировать исходные 4 проекта, 3 страницы и 16 языков? Будет создана первая опубликованная версия.')) return;
  loading(true);
  try {
    const data = legacyBundle();
    if (!Object.keys(data.translations).length) throw new Error('Не найдены локальные переводы из texts.js.');
    const { doc, runTransaction, serverTimestamp } = state.sdk;
    const published = doc(state.db, 'siteContent', 'public');
    const draft = doc(state.db, 'siteContent', 'draft');
    await runTransaction(state.db, async (transaction) => {
      const current = await transaction.get(published);
      if (current.exists()) throw new Error('Публикация уже существует. Импорт отменён, данные сохранены.');
      const withDate = { ...data, updatedAt: serverTimestamp() };
      transaction.set(published, withDate);
      transaction.set(draft, withDate);
    });
    await loadContent();
    notice('Содержимое сайта перенесено! Опубликованы 4 проекта, 3 страницы и переводы.');
  } catch (error) {
    notice(`Не удалось выполнить импорт: ${error.message}`, true);
  } finally { loading(false); }
}
async function saveDraft() {
  if (state.busy || !state.bundle) return;
  loading(true);
  try {
    await state.sdk.setDoc(state.sdk.doc(state.db, 'siteContent', 'draft'), persistedBundle());
    state.dirty = false;
    state.saved = true;
    notice('Черновик сохранён. Посетители сайта пока видят опубликованную версию.');
  } catch (error) { notice(`Черновик не сохранён: ${error.message}`, true); }
  finally { loading(false); }
}
async function publish() {
  if (state.busy || !state.bundle) return;
  if (!confirm('Опубликовать текущую версию? Изменения сразу станут доступны посетителям после обновления страницы.')) return;
  loading(true);
  try {
    const { doc, writeBatch } = state.sdk;
    const batch = writeBatch(state.db);
    const payload = persistedBundle();
    batch.set(doc(state.db, 'siteContent', 'draft'), payload);
    batch.set(doc(state.db, 'siteContent', 'public'), payload);
    await batch.commit();
    state.publicBundle = clone(state.bundle);
    state.dirty = false;
    state.saved = true;
    notice('Опубликовано! Обнови страницу сайта, чтобы увидеть изменения.');
    renderTab();
  } catch (error) { notice(`Не удалось опубликовать: ${error.message}`, true); }
  finally { loading(false); }
}
async function restorePublished() {
  if (state.busy || !state.publicBundle) return;
  if (!confirm('Заменить текущий черновик последней опубликованной версией? Несохранённые изменения будут потеряны.')) return;
  loading(true);
  try {
    await state.sdk.setDoc(state.sdk.doc(state.db, 'siteContent', 'draft'), {
      ...clone(state.publicBundle), updatedAt: state.sdk.serverTimestamp(),
    });
    state.bundle = clone(state.publicBundle);
    state.dirty = false;
    state.saved = true;
    renderTab();
    notice('Черновик восстановлен из последней публикации.');
  } catch (error) { notice(`Не удалось восстановить черновик: ${error.message}`, true); }
  finally { loading(false); }
}
function downloadBackup() {
  if (!state.bundle) return;
  const payload = JSON.stringify(state.bundle, null, 2);
  const url = URL.createObjectURL(new Blob([payload], { type: 'application/json;charset=utf-8' }));
  const link = element('a');
  link.href = url;
  link.download = `mifil-content-backup-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function formField(label, value, change, { multiline = false, placeholder = '', full = false } = {}) {
  const field = element('div', 'form-field' + (full ? ' span-all' : ''));
  const name = element('label', '', label);
  const control = element(multiline ? 'textarea' : 'input');
  if (!multiline) control.type = 'text';
  control.value = value || '';
  control.placeholder = placeholder;
  control.addEventListener('input', () => { change(control.value); markDirty(); });
  add(field, name, control);
  return field;
}
function sectionCard(title, description) {
  const card = element('section', 'card');
  add(card, element('h2', '', title));
  if (description) add(card, element('p', '', description));
  return card;
}
function stat(value, title) {
  return add(element('div', 'stat'), element('div', 'stat-value', String(value)), element('div', 'stat-label', title));
}
function button(text, className, callback) {
  const node = element('button', `btn ${className || 'ghost'}`, text);
  node.type = 'button';
  node.addEventListener('click', callback);
  return node;
}
function renderOverview(parent) {
  const group = add(element('div', 'stats'),
    stat(projectIds.length, 'Проекта'),
    stat(Object.keys(state.bundle.languages).length, 'Языков'),
    stat(pageIds.length, 'Страницы'));
  parent.append(group);
  const card = sectionCard('Твой сайт теперь управляется через CMS',
    'Текущие тексты сохранены в Firestore. Изменения сначала остаются в черновике и появляются на сайте только после публикации.');
  const grid = element('div', 'info-grid');
  for (const [title, description] of [
    ['Проекты', 'Названия, ссылки, иконки и статусы публикации существующих четырёх миров.'],
    ['Переводы', 'Сайт поддерживает 16 языков. Меняй заголовки, краткие описания и основные тексты.'],
    ['Страницы', 'Тексты страниц «О MiFiL», «От создателя» и «Конфиденциальность».'],
    ['Публикация', 'Сохраняй черновик, выгружай JSON-копию и публикуй изменения.'],
  ]) {
    const item = element('div');
    add(item, element('h3', '', title), element('p', '', description));
    grid.append(item);
  }
  add(card, grid);
  parent.append(card);
  const help = sectionCard('Особенность 3D-дома', 'Его четыре окна закреплены за текущими проектами. Мы не меняли анимации или модели. Создание дополнительных разделов и назначение проектов окнам — отдельный следующий этап.');
  parent.append(help);
}
function renderProjects(parent) {
  const card = sectionCard('Проекты на главной', 'Редактируй существующие проекты. Публикация проекта включит переход по ссылке и снимет пометку «Скоро».');
  for (const id of projectIds) {
    const data = state.bundle.projects[id];
    if (!data) continue;
    const row = element('div', 'project-row');
    const icon = element('img', 'project-thumb');
    icon.src = `../assets/icon-${id}.png`;
    icon.alt = '';
    const fields = element('div');
    const header = element('div', 'card-header');
    add(header, element('h3', '', id), element('span', 'tag' + (data.released ? ' published' : ''), data.released ? 'Опубликован' : 'Скоро'));
    const form = element('div', 'form-grid');
    add(form,
      formField('Название', data.name, (value) => { data.name = value; }),
      formField('Ссылка (от корня сайта)', data.href, (value) => { data.href = value; }),
      formField('Путь к иконке', data.icon, (value) => { data.icon = value; }, { full: true })
    );
    const checkLine = element('label', 'checkline');
    const checkbox = element('input');
    checkbox.type = 'checkbox';
    checkbox.checked = data.released;
    checkbox.addEventListener('change', () => {
      data.released = checkbox.checked;
      header.querySelector('.tag').textContent = data.released ? 'Опубликован' : 'Скоро';
      header.querySelector('.tag').classList.toggle('published', data.released);
      markDirty();
    });
    add(checkLine, checkbox, element('span', '', 'Проект доступен посетителям'));
    add(fields, header, form, checkLine);
    add(row, icon, fields);
    card.append(row);
  }
  parent.append(card);
}
function ensureLanguageData(language) {
  if (!state.bundle.translations[language]) state.bundle.translations[language] = {};
  if (!state.bundle.teasers[language]) state.bundle.teasers[language] = {};
}
function translationField(label, value, callback, multiline = false) {
  const field = element('div', 'translation-item' + (multiline ? ' full' : ''));
  const caption = element('label', '', label);
  const input = element(multiline ? 'textarea' : 'input');
  if (!multiline) input.type = 'text';
  input.value = value || '';
  input.addEventListener('input', () => { callback(input.value); markDirty(); });
  add(field, caption, input);
  return field;
}
function renderTranslations(parent) {
  const lang = state.lang;
  ensureLanguageData(lang);
  const translation = state.bundle.translations[lang];
  const keys = Object.keys(state.bundle.translations.en || translation);
  const shortKeys = keys.filter((key) => !key.endsWith('Text') && !projectIds.includes(key));
  const longKeys = keys.filter((key) => key.endsWith('Text') || projectIds.includes(key));
  const simple = sectionCard('Интерфейс', 'Названия навигации, кнопок, заголовков и служебных сообщений.');
  const grid = element('div', 'translation-group');
  for (const key of shortKeys) {
    const visibleLabel = key === 'intro' ? 'intro (сейчас не отображается на главной)' : key;
    grid.append(translationField(visibleLabel, translation[key], (value) => { translation[key] = value; }));
  }
  simple.append(grid);
  parent.append(simple);
  const pages = sectionCard('Основные тексты и описания', 'Эти тексты используются на страницах «О MiFiL» и в карточках проектов.');
  const content = element('div', 'translation-group');
  for (const key of longKeys) content.append(translationField(key, translation[key], (value) => { translation[key] = value; }, true));
  pages.append(content);
  parent.append(pages);
  const teasers = sectionCard('Короткие описания проектов', 'Небольшие подписи под названиями на главной странице.');
  const teaserFields = element('div', 'translation-group');
  for (const id of projectIds) teaserFields.append(translationField(state.bundle.projects[id]?.name || id, state.bundle.teasers[lang][id], (value) => { state.bundle.teasers[lang][id] = value; }));
  teasers.append(teaserFields);
  parent.append(teasers);
  const soon = sectionCard('Статус проекта');
  const soonGrid = element('div', 'translation-group');
  soonGrid.append(translationField('Текст «Скоро»', state.bundle.comingSoon[lang], (value) => { state.bundle.comingSoon[lang] = value; }));
  soon.append(soonGrid);
  parent.append(soon);
}
function renderPages(parent) {
  ensureLanguageData(state.lang);
  parent.append(element('p', 'muted', `Редактируется язык: ${state.bundle.languages[state.lang] || state.lang}. На сайте выбери тот же язык. Для проверки открой страницу по ссылке ниже.`));
  const group = element('div', 'page-list');
  for (const id of pageIds) {
    const card = sectionCard(pageName[id]);
    const [titleKey, textKey] = sourceKeys[id];
    const map = state.bundle.translations[state.lang];
    const info = element('p', 'muted');
    const previewLink = element('a', '', 'Проверить опубликованную страницу ↗');
    previewLink.href = `../page.html?view=${id}&lang=${state.lang}&cmsDebug=1`;
    previewLink.target = '_blank';
    previewLink.rel = 'noopener';
    info.append('После публикации: ', previewLink);
    const grid = element('div', 'form-grid');
    add(grid,
      formField('Заголовок', map[titleKey], (value) => { map[titleKey] = value; }, { full: true }),
      formField('Текст страницы', map[textKey], (value) => { map[textKey] = value; }, { multiline: true, full: true })
    );
    add(card, info, grid);
    group.append(card);
  }
  parent.append(group);
  const future = sectionCard('Что появится на следующем этапе', 'Создание произвольных страниц, разделов, блоков, изменение их порядка и загрузка изображений. Пока редактор работает с существующими страницами.');
  parent.append(future);
}
function renderPublish(parent) {
  const card = sectionCard('Публикация изменений', 'Сначала сохрани черновик или сразу опубликуй текущие изменения. Опубликованные данные доступны всем посетителям сайта.');
  const row = element('div', 'card-actions');
  add(row,
    button('Сохранить черновик', 'ghost', saveDraft),
    button('Опубликовать сейчас', 'primary', publish)
  );
  card.append(row);
  parent.append(card);
  const control = sectionCard('Резервные копии и восстановление', 'Перед крупными изменениями сохраняй JSON-копию своего черновика. Восстановление из публикации не меняет сам публичный сайт.');
  const actions = element('div', 'card-actions');
  const restore = button('Вернуть черновик к опубликованной версии', 'secondary', restorePublished);
  restore.disabled = !state.publicBundle;
  add(actions, button('Скачать JSON-копию', 'ghost', downloadBackup), restore);
  control.append(actions);
  parent.append(control);
  const note = sectionCard('Что уже подключено', 'Публичный сайт читает только документ siteContent/public. Черновик siteContent/draft защищён правами администратора; никаких секретных ключей в браузере нет.');
  parent.append(note);
}
function renderTab() {
  const root = $('tab-content');
  if (!state.bundle) return;
  root.replaceChildren();
  const tab = state.tab;
  const descriptions = {
    overview: 'Всё важное о текущем содержимом MiFiL.',
    projects: 'Настройки четырёх существующих миров и их доступности.',
    translations: 'Редактирование локализованных текстов для всех 16 языков.',
    pages: 'Существующие информационные страницы сайта.',
    publish: 'Контроль сохранения и публикации содержимого.',
  };
  $('breadcrumb').textContent = sectionName[tab];
  $('page-heading-title').textContent = sectionName[tab];
  $('page-description').textContent = descriptions[tab];
  $('locale-control').hidden = !(tab === 'translations' || tab === 'pages');
  document.querySelectorAll('[data-tab]').forEach((buttonNode) => {
    const active = buttonNode.dataset.tab === tab;
    buttonNode.classList.toggle('is-current', active);
    if (active) buttonNode.setAttribute('aria-current', 'page');
    else buttonNode.removeAttribute('aria-current');
  });
  ({ overview: renderOverview, projects: renderProjects, translations: renderTranslations,
    pages: renderPages, publish: renderPublish })[tab](root);
  refreshSaveStatus();
}
function updateLayout() {
  $('empty-state').hidden = Boolean(state.bundle);
  $('editor-area').hidden = !state.bundle;
  if (state.bundle) {
    const select = $('locale-select');
    select.replaceChildren();
    for (const [code, name] of Object.entries(state.bundle.languages)) {
      const option = element('option', '', `${name} (${code})`);
      option.value = code;
      select.append(option);
    }
    if (!state.bundle.languages[state.lang]) state.lang = 'en';
    select.value = state.lang;
    renderTab();
  }
  refreshSaveStatus();
}
function wireUI() {
  $('login-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    $('login-error').hidden = true;
    $('login-submit').disabled = true;
    try {
      await state.sdk.signInWithEmailAndPassword(state.auth, $('login-email').value, $('login-password').value);
    } catch {
      reportLoginError('Не удалось войти. Проверь почту и пароль.');
    } finally { $('login-submit').disabled = false; }
  });
  $('logout-btn').addEventListener('click', () => state.sdk.signOut(state.auth));
  $('sidebar-nav').addEventListener('click', (event) => {
    const btn = event.target.closest('[data-tab]');
    if (!btn || !state.bundle) return;
    state.tab = btn.dataset.tab;
    renderTab();
  });
  $('locale-select').addEventListener('change', (event) => {
    state.lang = event.target.value;
    renderTab();
  });
  $('import-btn').addEventListener('click', importLegacy);
  $('save-draft-btn').addEventListener('click', saveDraft);
  $('publish-btn').addEventListener('click', publish);
  window.addEventListener('beforeunload', (event) => {
    if (state.dirty) { event.preventDefault(); event.returnValue = ''; }
  });
}
async function start() {
  wireUI();
  if (!isFirebaseConfigured()) { showOnly('setup-screen'); return; }
  showOnly('login-screen');
  try {
    const [appSDK, authSDK, firestoreSDK] = await Promise.all([
      import('https://www.gstatic.com/firebasejs/13.4.0/firebase-app.js'),
      import('https://www.gstatic.com/firebasejs/13.4.0/firebase-auth.js'),
      import('https://www.gstatic.com/firebasejs/13.4.0/firebase-firestore.js'),
    ]);
    state.sdk = { ...authSDK, ...firestoreSDK };
    const app = appSDK.getApps().length ? appSDK.getApp() : appSDK.initializeApp(firebaseConfig);
    state.auth = authSDK.getAuth(app);
    state.db = firestoreSDK.getFirestore(app);
    authSDK.onAuthStateChanged(state.auth, async (user) => {
      if (!user) {
        state.user = null;
        state.bundle = null;
        state.publicBundle = null;
        $('login-password').value = '';
        showOnly('login-screen');
        return;
      }
      try {
        const adminRef = firestoreSDK.doc(state.db, 'cmsAdmins', user.uid);
        const permission = await firestoreSDK.getDoc(adminRef);
        if (!permission.exists()) {
          await authSDK.signOut(state.auth);
          reportLoginError('У этого аккаунта нет прав администратора. Добавь документ cmsAdmins/UID через Firebase Console.');
          return;
        }
        state.user = user;
        showOnly('admin-app');
        await loadContent();
      } catch (error) {
        showOnly('login-screen');
        reportLoginError(`Не удалось открыть панель: ${error.message}`);
      }
    });
  } catch (error) {
    showOnly('login-screen');
    reportLoginError(`Ошибка подключения Firebase: ${error.message}`);
  }
}
start();
