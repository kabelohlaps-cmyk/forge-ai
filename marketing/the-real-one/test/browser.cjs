// Browser half of the ad test: layout checks on the animatic, then a
// frame-accurate 16:9 recording. Run through test_ad.py, which sets NODE_PATH so
// `playwright` resolves from the global install.
//   node browser.cjs <animatic.html> <out-dir> <end-seconds>
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const [, , page_path, out, endArg] = process.argv;
const END = Number(endArg);
const url = 'file://' + path.resolve(page_path);
const HIDE_CHROME = '#controls{display:none!important} #viewport{padding:0!important}';

async function seek(page, t) {
  await page.evaluate(t => {
    const s = document.getElementById('scrub');
    if (document.getElementById('play').textContent === 'Pause') document.getElementById('play').click();
    s.value = t; s.dispatchEvent(new Event('input'));
  }, t);
  await page.waitForTimeout(1300); // let CSS transitions settle
}

// Visible stage elements, as fractions of stage height.
const boxes = page => page.evaluate(() => {
  const stage = document.getElementById('stage').getBoundingClientRect();
  const sel = ['#cap', '#ingot', '#count', '.card', '#logo', '#tag'];
  const out = [];
  for (const s of sel) for (const el of document.querySelectorAll(s)) {
    const cs = getComputedStyle(el);
    if (+cs.opacity < 0.5 || !el.textContent.trim() && s === '#cap') continue;
    // captions are full-width boxes; measure the text itself
    let r = el.getBoundingClientRect();
    if (s === '#cap') { const rg = document.createRange(); rg.selectNodeContents(el); r = rg.getBoundingClientRect(); }
    if (!r.height) continue;
    out.push({ sel: s, top: (r.top - stage.top) / stage.height, bottom: (r.bottom - stage.top) / stage.height,
               left: (r.left - stage.left) / stage.width, right: (r.right - stage.left) / stage.width });
  }
  return out;
});

(async () => {
  const browser = await chromium.launch();
  const result = { errors: [], layout: [] };

  // ---- layout checks ----
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  page.on('pageerror', e => result.errors.push(e.message));
  page.on('console', m => m.type() === 'error' && result.errors.push(m.text()));
  await page.goto(url);
  const SAMPLES = [1.5, 3.8, 6.8, 9.0, 13.0, 15.6, 16.9, 19.5, 22.0, 24.0, 25.8, 28.0, 29.9];
  for (const aspect of ['16:9', '9:16']) {
    if (aspect === '9:16') await page.click('#aspect');
    for (const t of SAMPLES) {
      await seek(page, t);
      const b = await boxes(page);
      const issues = [];
      for (const x of b) {
        if (x.left < -0.001 || x.right > 1.001 || x.top < -0.001 || x.bottom > 1.001) issues.push(`${x.sel} leaves the frame`);
        if (aspect === '9:16' && x.bottom > 0.82) issues.push(`${x.sel} enters bottom 18% (bottom at ${(x.bottom * 100).toFixed(1)}%)`);
        if (aspect === '9:16' && x.sel === '#cap' && (x.top < 0.20 || x.top > 0.30)) issues.push(`caption top at ${(x.top * 100).toFixed(1)}%, outside 20–30%`);
      }
      const cap = b.find(x => x.sel === '#cap');
      if (cap) for (const x of b) if (x.sel !== '#cap' && x.top < cap.bottom && x.bottom > cap.top && x.left < cap.right && x.right > cap.left)
        issues.push(`caption overlaps ${x.sel}`);
      result.layout.push({ aspect, t, issues });
      await page.screenshot({ path: path.join(out, `frame-${aspect.replace(':', 'x')}-${t.toFixed(1)}.png`) });
    }
  }
  await page.close();

  // ---- recording (16:9) ----
  // Playwright's screencast falls seconds behind on this page (heavy blur),
  // so instead: slow the page clock and every CSS transition to 1/SLOW speed,
  // screenshot as fast as possible, and stamp each frame with the page's own
  // clock. test_ad.py assembles the frames at those timestamps.
  const SLOW = 4;
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  await ctx.addInitScript(slow => {
    const real = performance.now.bind(performance), base = real();
    performance.now = () => base + (real() - base) / slow;
  }, SLOW);
  const rec = await ctx.newPage();
  const cdp = await ctx.newCDPSession(rec);
  await cdp.send('Animation.enable');
  await cdp.send('Animation.setPlaybackRate', { playbackRate: 1 / SLOW });
  await rec.goto(url);
  await rec.addStyleTag({ content: HIDE_CHROME });
  await rec.evaluate(() => dispatchEvent(new Event('resize')));
  await rec.waitForTimeout(500);
  await rec.evaluate(() => document.getElementById('restart').click());
  const framesDir = path.join(out, 'frames'); fs.mkdirSync(framesDir, { recursive: true });
  result.frames = [];
  for (let i = 0; ; i++) {
    const a = await rec.evaluate(() => now());
    const file = path.join(framesDir, `f${String(i).padStart(5, '0')}.jpg`);
    await rec.screenshot({ path: file, type: 'jpeg', quality: 90 });
    const b = await rec.evaluate(() => now());
    result.frames.push([file, (a + b) / 2]);
    if (b >= END) break;
  }
  await ctx.close();
  await browser.close();
  console.log(JSON.stringify(result));
})();
