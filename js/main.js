(() => {
  "use strict";

  /* --- aviso de cookies --- */
  const cookieKey = "ian_cookie_notice";
  const cookieNotice = document.getElementById("cookie-notice");
  const cookieAck = document.getElementById("cookie-acknowledge");
  const cookieSettings = document.getElementById("cookie-settings");

  if (cookieNotice && cookieAck) {
    const acknowledged = document.cookie
      .split("; ")
      .some((cookie) => cookie.startsWith(`${cookieKey}=`));

    cookieNotice.hidden = acknowledged;

    cookieAck.addEventListener("click", () => {
      document.cookie = `${cookieKey}=acknowledged; Max-Age=15552000; Path=/; SameSite=Lax${
        location.protocol === "https:" ? "; Secure" : ""
      }`;
      cookieNotice.hidden = true;
      cookieAck.blur();
    });

    cookieSettings?.addEventListener("click", () => {
      cookieNotice.hidden = false;
      cookieAck.focus();
    });
  }

  /* --- vídeo de contato --- */
  const contactVideo = document.querySelector(".contact-animation");
  const videoButton = document.querySelector(".contact-art .video-play");
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  if (contactVideo && videoButton) {
    let started = false;

    const syncVideoButton = () => {
      const paused = contactVideo.paused;
      videoButton.textContent = paused ? "Reproduzir animação" : "Pausar animação";
      videoButton.setAttribute("aria-pressed", String(!paused));
    };

    const startVideo = () => {
      if (started) return;
      started = true;
      contactVideo.play().catch(() => {});
    };

    videoButton.addEventListener("click", () => {
      if (contactVideo.paused) {
        started = true;
        contactVideo.play().catch(() => {});
      } else {
        contactVideo.pause();
      }
    });

    contactVideo.addEventListener("play", syncVideoButton);
    contactVideo.addEventListener("pause", syncVideoButton);
    contactVideo.addEventListener("error", () => {
      videoButton.disabled = true;
      videoButton.textContent = "Animação indisponível";
    });

    if (reduceMotion.matches) {
      contactVideo.autoplay = false;
      contactVideo.removeAttribute("autoplay");
      contactVideo.pause();
    }

    syncVideoButton();

    if ("IntersectionObserver" in window && !reduceMotion.matches) {
      new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              if (!started) startVideo();
              else if (contactVideo.dataset.autoResume === "1") {
                delete contactVideo.dataset.autoResume;
                contactVideo.play().catch(() => {});
              }
            } else if (!contactVideo.paused) {
              contactVideo.dataset.autoResume = "1";
              contactVideo.pause();
            }
          });
        },
        { threshold: 0.15 }
      ).observe(contactVideo);
    }
  }

  /* --- projetos --- */
  const grid = document.getElementById("grid");
  const dialog = document.getElementById("dlg");
  const closeButton = document.getElementById("dlg-close");
  const media = document.getElementById("dlg-img");
  const category = document.getElementById("dlg-cat");
  const title = document.getElementById("dlg-title");
  const site = document.getElementById("dlg-site");
  const description = document.getElementById("dlg-desc");
  const tags = document.getElementById("dlg-tags");
  const meta = document.getElementById("dlg-meta");
  const maint = document.getElementById("dlg-maint");
  const link = document.getElementById("dlg-link");

  let lastTrigger = null;

  const iconPlay = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg>';

  const openProject = (project, trigger) => {
    if (!dialog) return;

    lastTrigger = trigger;
    media.src = project.capa;
    media.alt = `Capa do projeto ${project.titulo}`;
    category.textContent = `${project.categoria}/`;
    title.textContent = project.titulo;
    site.textContent = project.site;
    description.textContent = project.descricao;
    tags.innerHTML = project.tags.map((tag) => `<span>${tag}</span>`).join("");
    meta.textContent = [project.periodo, project.instituicao].filter(Boolean).join(" · ");
    maint.hidden = !project.manutencao;

    if (project.url) {
      link.hidden = false;
      link.href = project.url;

      if (/^https?:/i.test(project.url)) {
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        link.textContent = "abrir projeto ↗";
      } else {
        link.removeAttribute("target");
        link.removeAttribute("rel");
        link.textContent = "abrir projeto →";
      }
    } else {
      link.hidden = true;
      link.removeAttribute("href");
    }

    dialog.showModal();
    closeButton.focus();
  };

  if (grid && dialog) {
    const projects = typeof PROJECTS !== "undefined" ? PROJECTS : [];

    projects.forEach((project) => {
      const card = document.createElement("button");
      card.type = "button";
      card.className = "project-card";
      card.setAttribute("aria-haspopup", "dialog");
      card.setAttribute("aria-label", `${project.titulo} — ${project.categoria}. Ver detalhes`);
      card.innerHTML = `
        <img src="${project.capa}" alt="" loading="lazy" decoding="async" width="756" height="546">
        <span class="project-card-cat">${project.categoria}</span>
        <span class="maint" role="note"${project.manutencao ? "" : " hidden"}>EM MANUTENÇÃO</span>
        <span class="project-card-meta">
          <span class="project-card-badge" aria-hidden="true">${iconPlay}</span>
          <span>
            <span class="project-card-title">${project.titulo}</span>
            <span class="project-card-site">${project.site}</span>
          </span>
        </span>`;

      card.addEventListener("click", () => openProject(project, card));
      grid.appendChild(card);
    });

    window.IAN = window.IAN || {};
    window.IAN.openProject = (index, trigger) => {
      const project = projects[index];
      if (project) openProject(project, trigger || null);
    };

    closeButton.addEventListener("click", () => dialog.close());

    dialog.addEventListener("click", (event) => {
      if (event.target === dialog) dialog.close();
    });

    dialog.addEventListener("keydown", (event) => {
      if (event.key !== "Tab") return;

      const focusables = Array.from(
        dialog.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')
      ).filter((element) => !element.disabled && element.getClientRects().length > 0);

      if (!focusables.length) return;

      const first = focusables[0];
      const last = focusables[focusables.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    });

    dialog.addEventListener("close", () => {
      lastTrigger?.focus();
      lastTrigger = null;
    });
  }
})();
