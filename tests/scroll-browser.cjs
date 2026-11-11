// Run with Playwright available: node tests/scroll-browser.cjs [base URL].
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const base = process.argv[2] || 'http://127.0.0.1:8875';

(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const results = [];
  try {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route('**/js/mascot-boot.js*', route => route.fulfill({ body: '', contentType: 'text/javascript' }));
    await page.route('**/js/flag.js*', route => route.fulfill({ body: '', contentType: 'text/javascript' }));
    await page.addInitScript(() => {
      window.__work = { frames: 0, reads: 0 };
      const raf = window.requestAnimationFrame;
      window.requestAnimationFrame = callback => {
        const marquee = new Error().stack.includes('/js/main.js');
        return raf.call(window, now => { if (marquee) __work.frames++; callback(now); });
      };
      const width = Object.getOwnPropertyDescriptor(Element.prototype, 'scrollWidth');
      Object.defineProperty(Element.prototype, 'scrollWidth', { get() {
        if (this.id === 'grid') __work.reads++;
        return width.get.call(this);
      } });
    });
    await page.goto(base);
    await page.locator('#cookie-acknowledge').click();
    await page.locator('#contato').evaluate(el => el.scrollIntoView({ behavior: 'instant' }));
    await page.waitForTimeout(250);
    await page.evaluate(() => { __work.frames = 0; });
    await page.waitForTimeout(300);
    assert.equal(await page.evaluate(() => __work.frames), 0, 'offscreen carousel must stop scheduling frames');
    await page.locator('#projetos').evaluate(el => el.scrollIntoView({ behavior: 'instant' }));
    await page.waitForTimeout(250);
    const before = await page.locator('#grid').evaluate(el => el.style.transform);
    await page.evaluate(() => { __work.reads = 0; });
    await page.waitForTimeout(300);
    assert.notEqual(await page.locator('#grid').evaluate(el => el.style.transform), before, 'visible carousel resumes');
    assert.equal(await page.evaluate(() => __work.reads), 0, 'animation must not measure layout every frame');
    await page.setViewportSize({ width: 430, height: 844 });
    await page.waitForTimeout(300);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    const card = page.locator('#grid .project-card').first();
    // Freeze movement only for the click; the live animation was checked above.
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.waitForFunction(() => !document.querySelector('.project-marquee'));
    assert.equal(await page.locator('.project-marquee').count(), 0);
    await card.click();
    assert.equal(await page.locator('#dlg').evaluate(el => el.open), true);
    await page.locator('#dlg-close').click();
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.waitForSelector('.project-marquee');
    assert.equal(await page.locator('.project-marquee').count(), 1);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.waitForFunction(() => !document.querySelector('.project-marquee'));
    assert.equal(await page.locator('.project-marquee').count(), 0, 'desktop resize removes mobile loop');
    await page.locator('#projetos').evaluate(el => el.scrollIntoView({ behavior: 'instant' }));
    await page.waitForFunction(() => document.querySelector('#projetos').classList.contains('ribbon-ready'));
    await page.waitForTimeout(800);
    const position = await page.locator('#ribbon-position').textContent();
    await page.locator('#ribbon-next').click();
    await page.waitForFunction(previous => document.querySelector('#ribbon-position').textContent !== previous, position);
    const box = await page.locator('#ribbon-canvas').boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    const scroll = await page.evaluate(() => scrollY);
    await page.mouse.wheel(0, 350);
    await page.waitForFunction(previous => scrollY > previous + 100, scroll);
    assert.deepEqual(errors, []);
    results.push('carousel pause, resume, cached layout, resize, modal, reduced motion; desktop gallery navigation and vertical wheel');
    await context.close();

    const flagPage = await browser.newPage({ viewport: { width: 390, height: 844 } });
    const source = fs.readFileSync(path.join(__dirname, '../js/flag.js'), 'utf8');
    await flagPage.route('**/js/flag.js*', route => route.fulfill({ contentType: 'text/javascript', body: source.replace(
      'flags.push(flag);',
      'const simulate = flag.simulate; flag.simulate = (dt, wind) => { if (wind === false) { __warmup.batch++; __warmup.max = Math.max(__warmup.max, __warmup.batch); } return simulate(dt, wind); }; flags.push(flag);'
    ) }));
    await flagPage.route('**/js/mascot-boot.js*', route => route.fulfill({ body: '', contentType: 'text/javascript' }));
    await flagPage.addInitScript(() => {
      window.__warmup = { batch: 0, max: 0 };
      setInterval(() => { __warmup.batch = 0; }, 0);
    });
    await flagPage.goto(base);
    await flagPage.locator('#bandeira').evaluate(el => el.scrollIntoView({ behavior: 'instant' }));
    await flagPage.waitForFunction(() => document.querySelector('#bandeira').classList.contains('is-ready'));
    const maxBatch = await flagPage.evaluate(() => __warmup.max);
    assert.ok(maxBatch > 0 && maxBatch <= 54, `cloth preparation must yield between small batches; observed ${maxBatch}`);
    results.push(`cloth warmup yields (largest batch: ${maxBatch})`);
    await flagPage.close();
    console.log(JSON.stringify(results, null, 2));
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exit(1); });
