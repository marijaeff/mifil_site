(() => {
  'use strict';
  const cfg = window.MIFIL_LETTER_CONFIG || {};
  const i18n = window.MiFiLLetterI18n;
  const getText = key => i18n?.text(key) || key;
  const permittedUrl = value => {
    try { if (!value) return null; const u = new URL(value, location.href); return ['https:', 'http:'].includes(u.protocol) ? u.href : null; }
    catch { return null; }
  };
  const demoUrl = permittedUrl(cfg.demoUrl);
  const orderUrl = permittedUrl(cfg.orderUrl);
  if (demoUrl) document.querySelectorAll('.demo-link').forEach(a => {
    a.href = demoUrl; a.textContent = getText('demo');
  });
  if (orderUrl) document.querySelectorAll('.external-order').forEach(a => { a.href = orderUrl; a.hidden = false; });
  if (cfg.priceAndDelivery) {
    document.querySelector('#faq-price').textContent = cfg.priceAndDelivery;
    document.querySelector('#order-note').textContent = cfg.priceAndDelivery;
  }
  document.addEventListener('mifil:language-change', () => {
    if (demoUrl) document.querySelectorAll('.demo-link').forEach(a => { a.textContent = getText('demo'); });
    if (cfg.priceAndDelivery) {
      document.querySelector('#faq-price').textContent = cfg.priceAndDelivery;
      document.querySelector('#order-note').textContent = cfg.priceAndDelivery;
    }
    const result = document.querySelector('#brief-result');
    if (!result.hidden) result.hidden = true; // brief must be regenerated in selected language
  });
  const video = document.querySelector('#game-video');
  const levels = [...document.querySelectorAll('.level')];
  levels.forEach(button => button.addEventListener('click', () => {
    const level = Number(button.dataset.level);
    if (![1, 2, 3, 4].includes(level)) return;
    levels.forEach(b => {
      const selected = b === button;
      b.classList.toggle('active', selected);
      b.setAttribute('aria-pressed', String(selected));
    });
    video.pause();
    video.poster = `assets/level${level}.webp`;
    video.querySelector('source').src = `assets/level${level}.mp4`;
    video.setAttribute('aria-label', button.querySelector('strong').textContent);
    video.load();
    video.play().catch(() => {});
  }));
  const form = document.querySelector('#gift-form');
  const result = document.querySelector('#brief-result');
  const brief = document.querySelector('#brief');
  const status = document.querySelector('#status');
  document.querySelectorAll('.style-pick').forEach(button => button.addEventListener('click', () => {
    const input = [...form.querySelectorAll('input[name="style"]')].find(i => i.value === button.dataset.style);
    if (input) input.checked = true;
    result.hidden = true;
    document.querySelector('#create').scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
  }));
  form.addEventListener('input', () => { result.hidden = true; status.textContent = ''; });
  form.addEventListener('submit', event => {
    event.preventDefault();
    const data = new FormData(form);
    const occasion = document.querySelector('#occasion');
    const idea = document.querySelector('#details').value.trim();
    brief.value = [getText('briefTitle'), `${getText('occasion')}: ${occasion.options[occasion.selectedIndex].text}`, `${getText('styleLabel')}: ${data.get('style')}`, `${getText('ideaLabel')}: ${idea || getText('notSpecified')}`].join('\n');
    result.hidden = false;
    status.textContent = '';
    brief.focus();
  });
  document.querySelector('#copy').addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(brief.value); status.textContent = getText('copied'); }
    catch { brief.focus(); brief.select(); status.textContent = getText('copyManually'); }
  });
  document.querySelector('#year').textContent = new Date().getFullYear();
})();
