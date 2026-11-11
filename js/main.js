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

    /* --- faixa horizontal (mobile): auto-scroll + arraste com inércia --- */
    const mobileQuery = window.matchMedia("(max-width: 820px)");
    const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const SPEED = 0.8;
    const DECAY = 0.95;
    const DRAG_THRESHOLD = 6;
    let marquee = null;

    const stopMarquee = () => {
      if (!marquee) return;
      marquee.destroy();
      marquee = null;
    };

    const startMarquee = () => {
      if (marquee || !mobileQuery.matches || motionQuery.matches || !projects.length) return;

      const originals = Array.from(grid.children);
      const wrap = document.createElement("div");
      wrap.className = "project-marquee";
      grid.parentNode.insertBefore(wrap, grid);
      wrap.appendChild(grid);

      const clones = originals.map((card, i) => {
        const clone = card.cloneNode(true);
        clone.setAttribute("aria-hidden", "true");
        clone.tabIndex = -1;
        clone.addEventListener("click", () => openProject(projects[i], clone));
        grid.appendChild(clone);
        return clone;
      });

      let offset = 0;
      let velocity = 0;
      let dragging = false;
      let moved = false;
      let startX = 0;
      let startOffset = 0;
      let lastX = 0;
      let lastT = 0;
      let visible = !("IntersectionObserver" in window);
      let raf = 0;
      let pointerId = null;
      let loopWidth = 0;

      const measure = () => { loopWidth = clones[0].offsetLeft - originals[0].offsetLeft; };
      const wrapOffset = () => {
        const h = loopWidth;
        if (!h) return;
        if (offset <= -h) offset += h;
        if (offset > 0) offset -= h;
      };

      const frame = () => {
        raf = 0;
        if (!visible || document.hidden) return;
        if (!dragging) {
          if (Math.abs(velocity) > 0.1) {
            offset += velocity;
            velocity *= DECAY;
          } else {
            velocity = 0;
            offset -= SPEED;
          }
        }
        wrapOffset();
        grid.style.transform = `translate3d(${offset}px,0,0)`;
        raf = requestAnimationFrame(frame);
      };

      const sync = () => {
        if (visible && !document.hidden) {
          if (!raf) raf = requestAnimationFrame(frame);
        } else {
          cancelAnimationFrame(raf);
          raf = 0;
        }
      };

      const onDown = (e) => {
        if (e.pointerType === "mouse" && e.button !== 0) return;
        dragging = true;
        moved = false;
        velocity = 0;
        pointerId = e.pointerId;
        startX = lastX = e.clientX;
        startOffset = offset;
        lastT = performance.now();
      };

      const onMove = (e) => {
        if (!dragging || e.pointerId !== pointerId) return;
        const dx = e.clientX - startX;
        if (!moved && Math.abs(dx) > DRAG_THRESHOLD) {
          moved = true;
          wrap.classList.add("is-dragging");
          try { wrap.setPointerCapture(e.pointerId); } catch (_) {}
        }
        if (!moved) return;
        const now = performance.now();
        const dt = Math.max(now - lastT, 1);
        velocity = ((e.clientX - lastX) / dt) * 16;
        lastX = e.clientX;
        lastT = now;
        offset = startOffset + dx;
      };

      const onUp = (e) => {
        if (!dragging || (e && e.pointerId !== pointerId)) return;
        dragging = false;
        wrap.classList.remove("is-dragging");
        if (moved) {
          try { wrap.releasePointerCapture(pointerId); } catch (_) {}
        }
        pointerId = null;
      };

      /* um arraste não deve abrir o modal */
      const onClickCapture = (e) => {
        if (moved) {
          e.stopPropagation();
          e.preventDefault();
          moved = false;
        }
      };

      wrap.addEventListener("pointerdown", onDown);
      wrap.addEventListener("pointermove", onMove);
      wrap.addEventListener("pointerup", onUp);
      wrap.addEventListener("pointercancel", onUp);
      wrap.addEventListener("click", onClickCapture, true);
      wrap.addEventListener("dragstart", (e) => e.preventDefault());

      const observer = "IntersectionObserver" in window
        ? new IntersectionObserver((entries) => { visible = entries[0].isIntersecting; sync(); })
        : null;
      observer?.observe(wrap);
      const sizing = "ResizeObserver" in window ? new ResizeObserver(measure) : null;
      sizing?.observe(grid);
      window.addEventListener("resize", measure);
      document.addEventListener("visibilitychange", sync);
      measure();
      sync();

      marquee = {
        destroy() {
          cancelAnimationFrame(raf);
          observer?.disconnect();
          sizing?.disconnect();
          window.removeEventListener("resize", measure);
          document.removeEventListener("visibilitychange", sync);
          wrap.removeEventListener("pointerdown", onDown);
          wrap.removeEventListener("pointermove", onMove);
          wrap.removeEventListener("pointerup", onUp);
          wrap.removeEventListener("pointercancel", onUp);
          wrap.removeEventListener("click", onClickCapture, true);
          clones.forEach((clone) => clone.remove());
          grid.style.transform = "";
          wrap.parentNode.insertBefore(grid, wrap);
          wrap.remove();
        },
      };
    };

    const syncMarquee = () => (mobileQuery.matches && !motionQuery.matches ? startMarquee() : stopMarquee());
    mobileQuery.addEventListener("change", syncMarquee);
    motionQuery.addEventListener("change", syncMarquee);
    syncMarquee();

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
