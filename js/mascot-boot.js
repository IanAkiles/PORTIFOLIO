(() => {
  "use strict";

  const section = document.getElementById("mascote");
  if (!section) return;

  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");

  /* --- entrada do texto --- */
  if ("IntersectionObserver" in window && !reduce.matches) {
    section.classList.add("is-armed");
    const reveal = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        section.classList.add("is-in");
        reveal.disconnect();
      }
    }, { threshold: 0.25 });
    reveal.observe(section);
  }

  /* --- cena 3D: só carrega quando a seção está perto --- */
  const connection = navigator.connection || {};
  const lowData = connection.saveData === true || /(^|-)2g$/.test(connection.effectiveType || "");

  const toStatic = () => {
    section.classList.add("mascot-static");
    section.classList.add("is-in");
  };

  const hasWebGL = () => {
    try {
      const probe = document.createElement("canvas");
      return Boolean(probe.getContext("webgl2"));
    } catch {
      return false;
    }
  };

  if (lowData || !hasWebGL()) {
    toStatic();
    return;
  }

  const load = () => {
    import("./mascot.js?v=mascot-20261109").catch((error) => {
      console.error("[mascot]", error);
      toStatic();
    });
  };

  if (!("IntersectionObserver" in window)) {
    load();
    return;
  }

  const near = new IntersectionObserver((entries) => {
    if (entries.some((entry) => entry.isIntersecting)) {
      near.disconnect();
      load();
    }
  }, { rootMargin: "600px 0px" });
  near.observe(section);
})();
