(() => {
  const hero = document.querySelector(".hero");
  if (!hero) return;

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const u = Math.max(1, window.innerWidth / 1440);
  const spring = "cubic-bezier(.34,1.56,.64,1)";
  const ease = "cubic-bezier(.2,.8,.2,1)";

  if (!reduceMotion) {
    const top = [".hero-logo", ".hero-nav", ".hero-cta"];
    top.forEach((selector, index) => {
      const el = hero.querySelector(selector);
      if (!el) return;
      const animation = el.animate(
        [
          { opacity: 0, transform: `translateY(${-16 * u}px)` },
          { opacity: 1, transform: "translateY(0)" }
        ],
        { duration: 720, delay: index * 60, easing: ease, fill: "both" }
      );
      animation.finished.then(() => animation.cancel()).catch(() => {});
    });

    const kicker = hero.querySelector('[data-enter="kicker"]');
    if (kicker) {
      const animation = kicker.animate(
        [
          { opacity: 0, filter: "blur(12px)", transform: `translateY(${14 * u}px)` },
          { opacity: 1, filter: "blur(0)", transform: "translateY(0)" }
        ],
        { duration: 820, delay: 220, easing: ease, fill: "both" }
      );
      animation.finished.then(() => animation.cancel()).catch(() => {});
    }

    hero.querySelectorAll('[data-enter="title"]').forEach((el, index) => {
      const animation = el.animate(
        [
          { opacity: 0, filter: "blur(16px)", transform: `translateY(${46 * u}px)` },
          { opacity: 1, filter: "blur(0)", transform: "translateY(0)" }
        ],
        { duration: 900, delay: 360 + index * 160, easing: spring, fill: "both" }
      );
      animation.finished.then(() => animation.cancel()).catch(() => {});
    });

    hero.querySelectorAll('[data-enter="copy"]').forEach((el, index) => {
      const animation = el.animate(
        [
          { opacity: 0, transform: `translateY(${26 * u}px)` },
          { opacity: 1, transform: "translateY(0)" }
        ],
        { duration: 760, delay: 720 + index * 70, easing: ease, fill: "both" }
      );
      animation.finished.then(() => animation.cancel()).catch(() => {});
    });

    const featured = hero.querySelector('[data-enter="featured"]');
    if (featured) {
      const animation = featured.animate(
        [
          { opacity: 0, transform: `translateY(${24 * u}px)` },
          { opacity: 1, transform: "translateY(0)" }
        ],
        { duration: 760, delay: 940, easing: ease, fill: "both" }
      );
      animation.finished.then(() => animation.cancel()).catch(() => {});
    }

    hero.querySelectorAll('[data-enter="card"]').forEach((el, index) => {
      const animation = el.animate(
        [
          { opacity: 0, transform: `translateY(${30 * u}px)` },
          { opacity: 1, transform: "translateY(0)" }
        ],
        { duration: 780, delay: 1000 + index * 90, easing: ease, fill: "both" }
      );
      animation.finished.then(() => animation.cancel()).catch(() => {});
    });
  }

  const video = hero.querySelector(".hero-loop");
  if (!video || reduceMotion) return;

  video.addEventListener("playing", () => video.classList.add("is-playing"), { once: true });
  video.src = video.dataset.src;
  video.play().catch(() => {
    // Autoplay bloqueado: a placa estática permanece visível.
  });
})();
