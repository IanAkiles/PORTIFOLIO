(() => {
  "use strict";

  const footer = document.querySelector(".night");
  if (!footer) return;

  const video = footer.querySelector(".night-video");
  const still = footer.querySelector(".night-still");
  const canvas = footer.querySelector(".night-fx");
  const power = document.getElementById("night-power");
  const status = document.getElementById("night-status");
  const clock = document.getElementById("night-clock");
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  /* --- relógio de Manaus --- */
  if (clock) {
    const format = new Intl.DateTimeFormat("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "America/Manaus"
    });

    const updateClock = () => {
      const now = new Date();
      clock.textContent = format.format(now);
      clock.setAttribute("datetime", now.toISOString());
    };

    updateClock();
    window.setInterval(updateClock, 30000);
  }

  /* --- cena: vídeo, quadro noturno e brilho --- */
  let glowTarget = 0;
  let glowValue = 0;
  let videoStarted = false;
  let powered = true;
  let inView = false;
  let rafId = 0;
  const startedAt = performance.now();

  const showStill = () => {
    if (still) still.hidden = false;
    video?.classList.remove("is-visible");
  };

  const playVideoOnce = () => {
    if (!video || videoStarted || reduceMotion.matches) return;

    videoStarted = true;
    video.src = window.innerWidth <= 820 ? video.dataset.srcMobile : video.dataset.srcDesktop;
    video.load();

    const attempt = video.play();
    if (attempt) {
      attempt.catch(() => {
        showStill();
        glowTarget = Math.max(glowTarget, .55);
      });
    }
  };

  video?.addEventListener("playing", () => {
    if (still) still.hidden = true;
    video.classList.add("is-visible");
  });

  video?.addEventListener("ended", () => {
    showStill();
    glowTarget = 1;
  });

  video?.addEventListener("timeupdate", () => {
    if (video.currentTime >= 4.72) glowTarget = Math.max(glowTarget, 1);
  });

  video?.addEventListener("error", () => {
    videoStarted = true;
    showStill();
    glowTarget = Math.max(glowTarget, .55);
  });

  if (reduceMotion.matches) {
    showStill();
    glowTarget = .55;
  }

  /* --- canvas: scanlines, estrelas no celular e brilho --- */
  const ctx = canvas ? canvas.getContext("2d") : null;
  let width = 0;
  let height = 0;
  let dpr = 1;
  let stars = [];

  const buildStars = () => {
    stars = [];
    if (width > 820) return;

    let seed = 1337;
    const random = () => {
      seed = (seed * 16807) % 2147483647;
      return seed / 2147483647;
    };

    const count = 64;
    for (let i = 0; i < count; i += 1) {
      stars.push({
        x: random() * width,
        y: random() * height * .5,
        r: .5 + random() * 1.25,
        phase: random() * Math.PI * 2,
        speed: .5 + random()
      });
    }
  };

  const draw = (now) => {
    if (!ctx || !width || !height) return;

    ctx.clearRect(0, 0, width, height);

    if (reduceMotion.matches) {
      glowValue = glowTarget || .55;
    } else {
      glowValue += (glowTarget - glowValue) * .045;
    }

    const t = (now - startedAt) / 1000;

    if (stars.length) {
      stars.forEach((star) => {
        const twinkle = reduceMotion.matches ? .6 : .42 + .38 * Math.sin(t * star.speed + star.phase);
        ctx.fillStyle = `rgba(226, 244, 232, ${twinkle * .55})`;
        ctx.beginPath();
        ctx.arc(star.x, star.y, star.r, 0, Math.PI * 2);
        ctx.fill();
      });
    }

    if (glowValue > .004) {
      const pulse = reduceMotion.matches ? 1 : .82 + .18 * Math.sin(t * 1.15);
      const gx = width * .657;
      const gy = height * .66;
      const radius = Math.max(64, Math.min(width, height) * .16) * (.9 + .1 * pulse);

      const glow = ctx.createRadialGradient(gx, gy, 0, gx, gy, radius);
      glow.addColorStop(0, `rgba(224, 255, 208, ${.6 * glowValue * pulse})`);
      glow.addColorStop(.35, `rgba(168, 240, 170, ${.2 * glowValue * pulse})`);
      glow.addColorStop(1, "rgba(168, 240, 170, 0)");

      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(gx, gy, radius, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = `rgba(244, 255, 228, ${.8 * glowValue})`;
      ctx.beginPath();
      ctx.arc(gx, gy, Math.max(1.6, radius * .018), 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.fillStyle = "rgba(2, 6, 3, .16)";
    for (let y = 0; y < height; y += 3) {
      ctx.fillRect(0, y, width, 1);
    }

    if (!reduceMotion.matches) {
      const band = ((t / 7) % 1) * (height * 1.3) - height * .15;
      const gradient = ctx.createLinearGradient(0, band - height * .11, 0, band + height * .11);
      gradient.addColorStop(0, "rgba(208, 255, 220, 0)");
      gradient.addColorStop(.5, "rgba(208, 255, 220, .05)");
      gradient.addColorStop(1, "rgba(208, 255, 220, 0)");
      ctx.fillStyle = gradient;
      ctx.fillRect(0, band - height * .11, width, height * .22);
    }
  };

  const frame = (now) => {
    rafId = 0;
    draw(now);
    if (inView && powered && !reduceMotion.matches) {
      rafId = window.requestAnimationFrame(frame);
    }
  };

  const startFx = () => {
    if (!ctx || !width || !height || !inView || !powered || document.hidden) return;
    if (reduceMotion.matches) {
      draw(performance.now());
      return;
    }
    if (!rafId) rafId = window.requestAnimationFrame(frame);
  };

  const stopFx = () => {
    if (rafId) {
      window.cancelAnimationFrame(rafId);
      rafId = 0;
    }
    if (ctx && width && height) ctx.clearRect(0, 0, width, height);
  };

  const resize = () => {
    if (!canvas || !ctx) return;

    const rect = footer.getBoundingClientRect();
    width = Math.round(rect.width);
    height = Math.round(rect.height);
    if (!width || !height) return;

    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    buildStars();

    if (reduceMotion.matches) draw(performance.now());
  };

  if (canvas && ctx) {
    resize();
    if ("ResizeObserver" in window) {
      new ResizeObserver(resize).observe(footer);
    } else {
      window.addEventListener("resize", resize);
    }
  }

  const syncScene = () => {
    if (!inView || !powered || document.hidden) {
      video?.pause();
      stopFx();
      return;
    }
    if (reduceMotion.matches) {
      video?.pause();
      showStill();
      stopFx();
    } else if (!videoStarted) {
      playVideoOnce();
    } else if (video && video.paused && !video.ended && !video.error) {
      video.play().catch(showStill);
    }
    startFx();
  };

  document.addEventListener("visibilitychange", syncScene);
  reduceMotion.addEventListener("change", syncScene);

  /* --- ligar/desligar --- */
  const setPower = (next) => {
    powered = next;
    footer.dataset.power = next ? "on" : "off";

    if (power) {
      power.setAttribute("aria-pressed", String(next));
      power.setAttribute("aria-label", next ? "Desligar energia" : "Ligar energia");
    }

    if (status) status.textContent = next ? "sistema offline" : "tela desligada";

    syncScene();
  };

  power?.addEventListener("click", () => setPower(!powered));

  /* --- só anima e baixa o vídeo quando o rodapé aparece --- */
  if ("IntersectionObserver" in window) {
    new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          inView = entry.isIntersecting;

          syncScene();
        });
      },
      { threshold: 0.35 }
    ).observe(footer);
  } else {
    inView = true;
    syncScene();
  }
})();
