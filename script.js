(function () {
  const contentByLang = window.mifilContent;
  if (!contentByLang) return;

  const titleEl = document.getElementById("hero-title");
  const subtitleEl = document.getElementById("hero-subtitle");
  const enterLinkEl = document.getElementById("enter-link");
  const langButtons = document.querySelectorAll(".lang-button");

  const supportedLangs = Object.keys(contentByLang);

  function detectInitialLang() {
    const savedLang = localStorage.getItem("mifil-lang");
    if (savedLang && supportedLangs.includes(savedLang)) return savedLang;

    const browserLang = (navigator.language || "en").slice(0, 2).toLowerCase();
    if (supportedLangs.includes(browserLang)) return browserLang;

    return "en";
  }

  function renderProject(project) {
    const card = document.getElementById(project.id);
    if (!card) return;

    const title = card.querySelector(".project-title");
    const description = card.querySelector(".project-description");

    if (title) title.innerHTML = project.title.replace(/\n/g, "<br>");
    if (description) description.innerHTML = project.description.replace(/\n/g, "<br>");

    card.setAttribute(
      "aria-label",
      `${project.title.replace(/\n/g, " ")} — ${project.description.replace(/\n/g, " ")}`
    );

    if (card.tagName === "A") {
      if (!project.disabled) {
        card.href = project.url || "#";
        card.target = project.external ? "_blank" : "_self";
        card.rel = project.external ? "noopener noreferrer" : "";
      } else {
        card.removeAttribute("href");
        card.removeAttribute("target");
        card.removeAttribute("rel");
      }
    }

    if (project.disabled) {
      card.classList.add("is-disabled");
      card.setAttribute("aria-disabled", "true");
    } else {
      card.classList.remove("is-disabled");
      card.removeAttribute("aria-disabled");
    }
  }

  function setLanguage(lang) {
    const content = contentByLang[lang];
    if (!content) return;

    document.documentElement.lang = lang;
    localStorage.setItem("mifil-lang", lang);

    if (titleEl) titleEl.textContent = content.hero.title;
    if (subtitleEl) subtitleEl.textContent = content.hero.subtitle;
    if (enterLinkEl) enterLinkEl.textContent = content.hero.enterLabel;

    content.projects.forEach(renderProject);

    langButtons.forEach((button) => {
      const active = button.dataset.lang === lang;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-pressed", active ? "true" : "false");
    });
  }

  langButtons.forEach((button) => {
    button.addEventListener("click", () => {
      setLanguage(button.dataset.lang);
    });
  });

  setLanguage(detectInitialLang());
})();