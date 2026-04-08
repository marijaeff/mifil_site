(function () {
  const content = window.mifilContent;
  if (!content) return;

  const titleEl = document.getElementById('hero-title');
  const subtitleEl = document.getElementById('hero-subtitle');
  const enterLinkEl = document.getElementById('enter-link');

  if (titleEl) titleEl.textContent = content.hero.title;
  if (subtitleEl) subtitleEl.textContent = content.hero.subtitle;
  if (enterLinkEl) enterLinkEl.textContent = content.hero.enterLabel;

  content.projects.forEach((project) => {
    const card = document.getElementById(project.id);
    if (!card) return;

    const title = card.querySelector('.project-title');
    const description = card.querySelector('.project-description');

    if (title) title.innerHTML = project.title.replace(/\n/g, '<br>');
    if (description) description.innerHTML = project.description.replace(/\n/g, '<br>');

    card.href = project.url;
    card.target = project.external ? '_blank' : '_self';
    card.rel = project.external ? 'noopener noreferrer' : '';
    card.setAttribute('aria-label', `${project.title.replace(/\n/g, ' ')} — ${project.description.replace(/\n/g, ' ')}`);
  });
})();
