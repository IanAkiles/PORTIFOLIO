(() => {
  const orbit = document.querySelector(".hero-orbit");
  const main = document.querySelector("main");
  const contact = document.getElementById("contato");
  if (!orbit || !main || !contact) return;

  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
  const mobile = window.matchMedia("(max-width: 820px)");
  let frame = 0;
  let finish = 1;

  function draw() {
    frame = 0;
    const progress = reduced.matches ? 0 : Math.max(0, Math.min(1, window.scrollY / finish));
    // A expansão acontece antes do contato e para, sem criar uma camada ilimitada.
    const travel = 1 - Math.pow(1 - progress, 3);
    const scale = mobile.matches ? 1 + travel * .7 : 1 + travel * 1.8;
    const x = (mobile.matches ? 38 : 28) * (1 - travel);
    const rotation = reduced.matches ? 0 : travel * 65;
    orbit.style.transform = `translate(-50%, -50%) translateX(${x}vw) scale(${scale}) rotate(${rotation}deg)`;
    orbit.style.opacity = String((mobile.matches ? .32 : .55) - travel * (mobile.matches ? .18 : .35));
  }

  function schedule() {
    if (!document.hidden && !frame) frame = requestAnimationFrame(draw);
  }

  /* Enquanto a página rola, a órbita ganha camada própria no compositor: transform/opacity deixam de re-rasterizar
     o SVG (até ~2.800 px) a cada quadro. Parado o scroll, a camada é solta e o Chrome rasteriza de novo na escala
     final, então a imagem em repouso continua nítida. */
  let settle = 0;
  function promote() {
    if (!settle) orbit.style.willChange = "transform, opacity";
    clearTimeout(settle);
    settle = setTimeout(() => {
      settle = 0;
      orbit.style.willChange = "";
    }, 160);
  }

  function measure() {
    finish = Math.max(1, contact.getBoundingClientRect().top + window.scrollY - window.innerHeight * .2);
    schedule();
  }

  window.addEventListener("scroll", () => {
    if (reduced.matches) return;
    promote();
    schedule();
  }, { passive: true });
  window.addEventListener("resize", measure);
  reduced.addEventListener("change", schedule);
  mobile.addEventListener("change", measure);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      cancelAnimationFrame(frame);
      frame = 0;
    } else measure();
  });
  if ("ResizeObserver" in window) new ResizeObserver(measure).observe(main);
  measure();
})();
