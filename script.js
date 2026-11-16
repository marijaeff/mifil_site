(() => {
  'use strict';

  const dictionary = window.mifilContent;
  const languages = window.MiFiLLanguages;
  const projects = window.MiFiLProjects;

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

  const langSelect = $('language');
  const transition = $('transition');
  const stage = $('stage');

  function initialLanguage() {
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

    document.body.dataset.view = id;

    const project = projects[id];
    const title = project?.name || text(id);

    $('detail-title').textContent = title;
    $('detail-kicker').textContent = project ? text('worlds') : 'MiFiL';
    $('detail-description').textContent = text(project ? id : `${id}Text`);
    document.title = `${title} · MiFiL`;

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

  function showFallback() {
    canvas.classList.remove('ready');
    $('fallback').hidden = false;
    $('scene-controls').hidden = true;
    $('fallback-hint').hidden = false;
    house = null;
    clearLabel();

    if (leaving) {
      const active = links.find((link) => link.classList.contains('is-active'));
      if (active) {
        location.assign(active.href);
      }
    }
  }

  function go(id) {
    const link = links.find((item) => item.dataset.project === id);
    if (!link || leaving) {
      return;
    }

    if (!house) {
      location.assign(link.href);
      return;
    }

    leaving = true;
    setActive(id);
    clearLabel();
    setTransitionCenter();

    $('scene-status').textContent = `${text('opening')} ${projects[id].name}`;
    document.querySelectorAll('.rotate').forEach((button) => {
      button.disabled = true;
    });

    const destination = link.href;

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
      onSelect: go,
      onHover(id, point) {
        if (leaving) {
          return;
        }

        setActive(id);
        const tip = $('window-label');

        if (id && point && tip) {
          tip.textContent = projects[id].name;
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

    canvas.classList.add('ready');
    $('fallback').hidden = true;
    $('scene-controls').hidden = false;
  } catch (error) {
    console.warn('MiFiL house fallback:', error);
    showFallback();
  }

  links.forEach((link) => {
    const id = link.dataset.project;

    link.addEventListener('click', (event) => {
      if (!house || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) {
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
    };

    const stop = () => {
      if (leaving) {
        return;
      }
      setActive(null);
      house?.setHighlight(null);
    };

    link.addEventListener('mouseenter', start);
    link.addEventListener('mouseleave', stop);
    link.addEventListener('focus', start);
    link.addEventListener('blur', stop);
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
