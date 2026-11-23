(() => {
  'use strict';

  const dictionary = window.mifilContent;
  const languages = window.MiFiLLanguages;
  const projects = window.MiFiLProjects;
  const availability = window.MiFiLProjectAvailability || { 'playable-letter': true };
  const isReleased = (id) => availability[id] === true;
  const soonLabel = () => window.MiFiLComingSoon?.[language] || window.MiFiLComingSoon?.en || 'Coming soon';

  function projectHref(id, element) {
    const candidate = projects[id]?.href || element?.getAttribute('href') || (id === 'playable-letter' ? 'playable-letter/' : `page.html?view=${id}`);
    try {
      const url = new URL(candidate, document.baseURI);
      return ['https:', 'http:'].includes(url.protocol) ? url.href : new URL('index.html', document.baseURI).href;
    } catch {
      return new URL('index.html', document.baseURI).href;
    }
  }

  function refreshProjectUI() {
    document.querySelectorAll('[data-project]').forEach((entry) => {
      const id = entry.dataset.project;
      const project = projects[id];
      if (!project) return;
      const name = entry.querySelector('.project-name');
      if (name) name.textContent = project.name;
      const icon = entry.querySelector('.project-icon img');
      if (icon && project.icon) icon.src = project.icon;
      const released = isReleased(id);
      entry.classList.toggle('is-unreleased', !released);
      entry.setAttribute('aria-disabled', released ? 'false' : 'true');
      let status = entry.querySelector('.status-soon');
      if (!status && !released) {
        status = document.createElement('span');
        status.className = 'status-soon';
        status.dataset.comingSoon = '';
        status.textContent = soonLabel();
        entry.append(status);
      }
      if (status) status.hidden = released;
      const arrow = entry.querySelector('.arrow');
      if (arrow) arrow.hidden = !released;
      // Links keep their existing tag name; unreleased <button>s become
      // navigable through the same click handler once published.
      if (entry.tagName === 'A' && released) entry.href = projectHref(id, entry);
    });
    document.querySelectorAll('[data-world]').forEach((entry) => {
      const id = entry.dataset.world;
      if (!projects[id]) return;
      entry.textContent = projects[id].name;
      entry.href = projectHref(id, entry);
    });
    document.querySelectorAll('[data-face]').forEach((entry) => {
      const name = projects[entry.dataset.face]?.name;
      if (name) {
        entry.title = name;
        entry.setAttribute('aria-label', name);
      }
    });
    document.querySelectorAll('[data-window-project]').forEach((entry) => {
      entry.classList.toggle('is-unreleased', !isReleased(entry.dataset.windowProject));
      const name = projects[entry.dataset.windowProject]?.name || '';
      entry.setAttribute('aria-label', isReleased(entry.dataset.windowProject) ? name : `${name}: ${soonLabel()}`);
    });
  }

  const $ = (id) => document.getElementById(id);

  const storage = {
    get(key) {
      try {
        return localStorage.getItem(key);
      } catch {
        return null;
      }
    },
    set(key, value) {
      try {
        localStorage.setItem(key, value);
      } catch {
        // ignore
      }
    },
  };

  const session = {
    get(key) {
      try {
        return sessionStorage.getItem(key);
      } catch {
        return null;
      }
    },
    set(key, value) {
      try {
        sessionStorage.setItem(key, value);
      } catch {
        // ignore
      }
    },
  };

  let language = 'en';
  let house = null;
  let leaving = false;
  let navTimer = null;
  let previewTimer = null;

  const langSelect = $('language');
  const transition = $('transition');
  const stage = $('stage');
  // A restrained light halo follows the actual 3D position of the active window.
  // Kept separate from WebGL so it remains soft without expensive postprocessing.
  const windowGlow = document.createElement('div');
  windowGlow.className = 'project-window-glow';
  windowGlow.setAttribute('aria-hidden', 'true');
  stage?.appendChild(windowGlow);
  const windowNames = $('window-names');
  const mobileLabels = [...document.querySelectorAll('[data-window-project]')];
  const mobileMedia = matchMedia('(max-width: 760px)');

  function initialLanguage() {
    // Useful for checking the exact language edited in the admin panel.
    const requested = new URLSearchParams(location.search).get('lang');
    if (requested && dictionary[requested]) return requested;
    const saved = storage.get('mifil-lang');
    if (dictionary[saved]) {
      return saved;
    }

    const candidates = navigator.languages || [navigator.language || 'en'];
    for (const candidate of candidates) {
      const code = candidate.toLowerCase().split('-')[0];
      if (dictionary[code]) {
        return code;
      }
    }

    return 'en';
  }

  function text(key) {
    return dictionary[language]?.[key] || dictionary.en[key] || key;
  }

  function setLanguage(lang) {
    if (!dictionary[lang]) {
      return;
    }

    language = lang;
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';

    storage.set('mifil-lang', lang);

    if (langSelect) {
      langSelect.value = lang;
      langSelect.setAttribute('aria-label', text('language'));
    }

    document.querySelectorAll('[data-i]').forEach((element) => {
      element.textContent = text(element.dataset.i);
    });

    document.querySelectorAll('[data-label]').forEach((element) => {
      element.setAttribute('aria-label', text(element.dataset.label));
    });

    document.querySelectorAll('[data-teaser]').forEach((element) => {
      const id = element.dataset.teaser;
      element.textContent = window.MiFiLTeasers?.[lang]?.[id] || window.MiFiLTeasers?.en?.[id] || '';
    });

    document.querySelectorAll('[data-coming-soon]').forEach((el) => { el.textContent = soonLabel(); });
    document.querySelectorAll('.window-name.is-unreleased').forEach((el) => {
      el.setAttribute('aria-label', `${projects[el.dataset.windowProject]?.name || ''}: ${soonLabel()}`);
    });
    renderDetail();
  }

  function renderDetail() {
    if (!$('detail-title')) {
      return;
    }

    const params = new URLSearchParams(location.search);
    const candidate = params.get('view') || 'about';
    const allowedStatic = ['about', 'creator', 'privacy'];
    const id = Object.hasOwn(projects, candidate) || allowedStatic.includes(candidate)
      ? candidate
      : 'about';
    const staticPage = window.MiFiLPages?.[id];

    if (projects[id] && !isReleased(id)) {
      location.replace(new URL('index.html#worlds', document.baseURI).href);
      return;
    }
    document.body.dataset.view = id;

    const project = projects[id];
    const title = project?.name || text(staticPage?.titleKey || id);

    $('detail-title').textContent = title;
    $('detail-kicker').textContent = project ? text('worlds') : 'MiFiL';
    $('detail-description').textContent = text(project ? id : (staticPage?.bodyKey || `${id}Text`));
    document.title = `${title} · MiFiL`;

    document.querySelectorAll('[data-world]').forEach((link) => {
      const current = link.dataset.world === id;
      link.classList.toggle('is-current', current);
      if (current) {
        link.setAttribute('aria-current', 'page');
      } else {
        link.removeAttribute('aria-current');
      }
    });

    const box = $('detail-actions');
    box.replaceChildren();

    if (project) {
      if (project.links.length) {
        project.links.forEach((item) => {
          const link = document.createElement('a');
          link.href = item.href;
          link.textContent = text(item.label);
          box.append(link);
        });
      } else {
        const status = document.createElement('p');
        status.className = 'status';
        status.textContent = text('unlinked');
        box.append(status);
      }
    }
  }

  function fillLanguages() {
    if (!langSelect) {
      return;
    }

    const options = Object.entries(languages).map(([code, label]) => {
      const option = document.createElement('option');
      option.value = code;
      option.textContent = label;
      return option;
    });

    langSelect.replaceChildren(...options);
    langSelect.addEventListener('change', () => setLanguage(langSelect.value));
  }

  function setTransitionCenter() {
    if (!transition) {
      return;
    }

    let x = window.innerWidth / 2;
    let y = window.innerHeight / 2;

    if (stage) {
      const rect = stage.getBoundingClientRect();
      x = rect.left + rect.width / 2;
      y = rect.top + rect.height / 2;
    }

    transition.style.setProperty('--transition-x', `${(x / window.innerWidth) * 100}%`);
    transition.style.setProperty('--transition-y', `${(y / window.innerHeight) * 100}%`);
  }

  if ($('year')) {
    $('year').textContent = new Date().getFullYear();
  }

  fillLanguages();
  setLanguage(initialLanguage());
  refreshProjectUI();
  // Firestore arrives asynchronously; all existing controls and the 3D house
  // retain their event handlers and only visible content is refreshed.
  const refreshAfterContent = () => {
    refreshProjectUI();
    setLanguage(language);
  };
  window.addEventListener('mifil:content-ready', refreshAfterContent);
  // Also cover the unusual case where Firestore completed before this listener.
  if (window.MiFiLCMSStatus?.state === 'published') refreshAfterContent();

  const links = [...document.querySelectorAll('[data-project]')];
  const canvas = $('house-canvas');

  if (!canvas) {
    return;
  }

  function setActive(id) {
    links.forEach((link) => {
      link.classList.toggle('is-active', link.dataset.project === id);
    });
  }

  function clearLabel() {
    const label = $('window-label');
    if (label) {
      label.hidden = true;
    }
  }

  // Show project names close to their windows while the user rotates the house.
  // On desktop the existing hover tooltip continues to work unchanged.
  function updateVisibleWindowNames(visible) {
    const chosen = house?.hoverId || house?.highlight;
    const lit = !leaving && chosen === 'playable-letter'
      ? visible.find((item) => item.id === 'playable-letter') : null;
    if (lit) {
      windowGlow.style.left = `${lit.x}px`;
      windowGlow.style.top = `${lit.y}px`;
      windowGlow.classList.add('is-visible');
    } else {
      windowGlow.classList.remove('is-visible');
    }
    if (house?.ready) {
      const dots = document.querySelectorAll('[data-face]');
      let best = null;
      let bestDiff = Infinity;
      for (const dot of dots) {
        const target = { livemo: 0, 'our-quest': -Math.PI / 2, feel: Math.PI, 'playable-letter': Math.PI / 2 }[dot.dataset.face];
        const raw = (target - house.angle + Math.PI) % (2 * Math.PI);
        const diff = Math.abs(((raw + 2 * Math.PI) % (2 * Math.PI)) - Math.PI);
        if (diff < bestDiff) { bestDiff = diff; best = dot.dataset.face; }
      }
      dots.forEach((dot) => {
        const active = dot.dataset.face === best;
        dot.classList.toggle('is-active', active);
        dot.setAttribute('aria-pressed', active ? 'true' : 'false');
      });
    }
    if (!windowNames || leaving || !mobileMedia.matches) {
      if (windowNames) windowNames.hidden = true;
      return;
    }

    const byId = new Map(visible.map((item) => [item.id, item]));
    const bounds = stage.getBoundingClientRect();

    windowNames.hidden = false;
    for (const label of mobileLabels) {
      const item = byId.get(label.dataset.windowProject);
      label.hidden = !item;
      if (!item) continue;
      const name = projects[label.dataset.windowProject]?.name || '';
      label.textContent = name + (isReleased(label.dataset.windowProject) ? '' : ` · ${soonLabel()}`);

      // The badge sits just above its window, not over the glowing panes.
      label.style.left = `${Math.max(65, Math.min(bounds.width - 65, item.x))}px`;
      label.style.top = `${Math.max(35, item.y - 37)}px`;
    }
  }

  // The badges are functional links as well as labels.
  mobileLabels.forEach((label) => {
    label.addEventListener('click', (event) => {
      if (!house || leaving || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      if (isReleased(label.dataset.windowProject)) go(label.dataset.windowProject);
      else preview(label.dataset.windowProject, true);
    });
  });

  function showFallback() {
    windowGlow.classList.remove('is-visible');
    canvas.classList.remove('ready');
    $('fallback').hidden = false;
    $('scene-controls').hidden = true;
    $('fallback-hint').hidden = false;
    house = null;
    clearLabel();
    if (windowNames) windowNames.hidden = true;

    if (leaving) {
      const active = links.find((link) => link.classList.contains('is-active'));
      if (active) {
        if (isReleased(active.dataset.project)) location.assign(projectHref(active.dataset.project, active));
      }
    }
  }

  function preview(id, persistent = false) {
    if (!house || leaving) return;
    setActive(id);
    house.setHighlight(id);
    house.rotateTo(id);
    $('scene-status').textContent = isReleased(id) ? projects[id].name : `${projects[id].name}: ${soonLabel()}`;
    if (persistent) {
      clearTimeout(previewTimer);
      previewTimer = setTimeout(() => {
        if (!leaving) house?.setHighlight(null);
      }, 2800);
    }
  }

  function go(id) {
    const link = links.find((item) => item.dataset.project === id);
    if (!link || leaving) {
      return;
    }
    if (!isReleased(id)) {
      preview(id, true);
      return;
    }

    if (!house) {
      location.assign(projectHref(id, link));
      return;
    }

    leaving = true;
    windowGlow.classList.remove('is-visible');
    setActive(id);
    clearLabel();
    stage?.classList.add('is-entering');
    if (windowNames) windowNames.hidden = true;
    setTransitionCenter();

    $('scene-status').textContent = `${text('opening')} ${projects[id].name}`;
    document.querySelectorAll('.rotate').forEach((button) => {
      button.disabled = true;
    });

    const destination = projectHref(id, link);

    const navigate = () => {
      clearTimeout(navTimer);
      session.set('mifil-house-angle', String(house?.angle ?? 0));
      location.assign(destination);
    };

    try {
      if (!house.enter(id, navigate)) {
        navigate();
        return;
      }
      navTimer = setTimeout(navigate, 2200);
    } catch {
      navigate();
    }
  }

  try {
    if (!window.MiFiLHouse) {
      throw new Error('House unavailable');
    }

    const previous = session.get('mifil-house-angle');

    house = new window.MiFiLHouse(canvas, {
      angle: previous === null ? undefined : Number(previous),
      onReady() {
        canvas.classList.add('ready');
        $('fallback').hidden = true;
        $('scene-controls').hidden = false;
        $('fallback-hint').hidden = true;
      },
      onSelect: go,
      onVisibleWindows: updateVisibleWindowNames,
      onHover(id, point) {
        if (leaving) {
          return;
        }

        setActive(id);
        const tip = $('window-label');

        if (id && point && tip) {
          tip.textContent = projects[id].name + (isReleased(id) ? '' : ` · ${soonLabel()}`);
          tip.style.left = `${point.x}px`;
          tip.style.top = `${point.y}px`;
          tip.hidden = false;
        } else {
          clearLabel();
        }
      },
      onEnter() {
        if (!matchMedia('(prefers-reduced-motion: reduce)').matches) {
          setTransitionCenter();
          transition?.classList.add('enter');
        }
      },
      onLost: showFallback,
    });

  } catch (error) {
    console.warn('MiFiL house fallback:', error);
    showFallback();
  }

  links.forEach((link) => {
    const id = link.dataset.project;

    link.addEventListener('click', (event) => {
      if (!isReleased(id)) { event.preventDefault(); preview(id, true); return; }
      if (!house || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) {
        // A previously unreleased <button> can be enabled via CMS without
        // requiring a full HTML redesign. It has no native navigation.
        if (link.tagName === 'BUTTON' && !house && !event.defaultPrevented) {
          location.assign(projectHref(id, link));
        }
        return;
      }

      event.preventDefault();
      go(id);
    });

    const start = () => {
      if (leaving) {
        return;
      }
      setActive(id);
      house?.setHighlight(id);
      clearTimeout(previewTimer);
      previewTimer = setTimeout(() => {
        if (!leaving && !mobileMedia.matches) house?.rotateTo(id);
      }, 230);
    };

    const stop = () => {
      if (leaving) {
        return;
      }
      clearTimeout(previewTimer);
      setActive(null);
      house?.setHighlight(null);
    };

    link.addEventListener('mouseenter', start);
    link.addEventListener('mouseleave', stop);
    link.addEventListener('focus', start);
    link.addEventListener('blur', stop);
  });

  document.querySelectorAll('[data-face]').forEach((dot) => {
    dot.addEventListener('click', () => {
      const id = dot.dataset.face;
      if (!isReleased(id)) preview(id, true);
      else { house?.rotateTo(id); house?.setHighlight(id); }
    });
  });

  $('rotate-left').addEventListener('click', () => house?.rotate(-Math.PI / 2));
  $('rotate-right').addEventListener('click', () => house?.rotate(Math.PI / 2));

  window.addEventListener('resize', setTransitionCenter);
  window.addEventListener('pageshow', (event) => {
    if (event.persisted) {
      location.reload();
    }
  });
})();
