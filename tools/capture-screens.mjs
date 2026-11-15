import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT = 9222;
const APP_URL = 'http://localhost:1420';
const OUT_DIR = join(process.cwd(), 'docs', 'screens');

mkdirSync(OUT_DIR, { recursive: true });

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function startChrome() {
  const profileDir = join(process.env.TEMP || 'C:\\Temp', 'chrome-profile-' + Date.now());
  const proc = spawn(
    CHROME_PATH,
    [
      '--headless=new',
      `--remote-debugging-port=${PORT}`,
      `--user-data-dir=${profileDir}`,
      '--disable-gpu',
      '--no-first-run',
      '--no-default-browser-check',
      'about:blank',
    ],
    { stdio: 'ignore' },
  );

  for (let i = 0; i < 40; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${PORT}/json/version`);
      if (res.ok) {
        const data = await res.json();
        return { proc, wsUrl: data.webSocketDebuggerUrl };
      }
    } catch {
      await sleep(150);
    }
  }
  throw new Error('Chrome remote debugging did not respond');
}

class CdpClient {
  constructor(wsUrl) {
    this.ws = new WebSocket(wsUrl);
    this.id = 0;
    this.pending = new Map();
    this.ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.id && this.pending.has(msg.id)) {
        const { resolve, reject } = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        if (msg.error) reject(new Error(msg.error.message));
        else resolve(msg.result);
      }
    };
  }

  waitOpen() {
    if (this.ws.readyState === WebSocket.OPEN) return Promise.resolve();
    return new Promise((resolve, reject) => {
      this.ws.onopen = resolve;
      this.ws.onerror = reject;
    });
  }

  send(method, params = {}) {
    const id = ++this.id;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  async eval(expression) {
    const result = await this.send('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true,
    });
    return result.result?.value;
  }

  async click(selector) {
    await this.eval(`
      (() => {
        const el = document.querySelector(${JSON.stringify(selector)});
        if (!el) throw new Error('Element not found: ' + ${JSON.stringify(selector)});
        el.scrollIntoView({ behavior: 'instant', block: 'center' });
        el.click();
      })()
    `);
    await sleep(400);
  }

  async capture(name) {
    await sleep(250);
    const { data } = await this.send('Page.captureScreenshot', { format: 'png' });
    const buffer = Buffer.from(data, 'base64');
    writeFileSync(join(OUT_DIR, name), buffer);
    console.log(`Saved screenshot: ${name} (${Math.round(buffer.length / 1024)} KB)`);
  }

  close() {
    this.ws.close();
  }
}

async function run() {
  console.log('Launching headless Chrome...');
  const { proc, wsUrl } = await startChrome();
  console.log('Chrome ready at', wsUrl);

  const client = new CdpClient(wsUrl);
  await client.waitOpen();

  // Create a new target page
  const target = await client.send('Target.createTarget', { url: APP_URL });
  const pageWs = `ws://127.0.0.1:${PORT}/devtools/page/${target.targetId}`;
  const page = new CdpClient(pageWs);
  await page.waitOpen();

  await page.send('Page.enable');
  await page.send('DOM.enable');
  await page.send('Emulation.setDeviceMetricsOverride', {
    width: 1280,
    height: 850,
    deviceScaleFactor: 1,
    mobile: false,
  });

  await sleep(1500); // Wait for storage provider initialization

  // ===================== ARABIC CAPTURES =====================
  console.log('\n--- Capturing Arabic RTL screens ---');
  // Ensure Arabic
  await page.eval(`localStorage.setItem('i18nextLng', 'ar'); location.reload();`);
  await sleep(1500);

  // 1. Connect Idle
  await page.capture('01-connect-idle-ar.png');

  // 2. Connect Demo Experience
  await page.eval(`
    const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('بدء تجربة وضع العرض'));
    if (btn) btn.click();
  `);
  await sleep(1200);
  await page.capture('02-connect-demo-ar.png');

  // 3. Vehicles Detected
  await page.eval(`window.location.hash = ''; window.history.pushState({}, '', '/vehicles'); window.dispatchEvent(new PopStateEvent('popstate'));`);
  // Or navigate via link
  await page.eval(`
    const link = document.querySelector('a[href="/vehicles"]');
    if (link) link.click();
  `);
  await sleep(800);
  await page.capture('03-vehicles-detected-ar.png');

  // 4. Vehicles Manual Catalog Search
  await page.eval(`
    const input = document.querySelector('input[type="search"], input[type="text"]');
    if (input) {
      input.value = 'تويوتا';
      input.dispatchEvent(new Event('input', { bubbles: true }));
    }
  `);
  await sleep(600);
  await page.capture('04-vehicles-manual-catalog-ar.png');

  // Navigate to Scan
  await page.eval(`
    const link = document.querySelector('a[href="/scan"]');
    if (link) link.click();
  `);
  await sleep(800);

  // 5. Scan Progress
  await page.eval(`
    const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('بدء الفحص') || b.textContent.includes('Run scan'));
    if (btn) btn.click();
  `);
  await sleep(200);
  await page.capture('05-scan-progress-ar.png');

  // 6. Scan Result Faults (Red Banner)
  await sleep(1800); // Wait for scan completion
  await page.capture('08-scan-result-fault-ar.png');

  // 7. Clear Confirm Dialog (with engine running warning)
  await page.eval(`
    const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('مسح الأكواد'));
    if (btn) btn.click();
  `);
  await sleep(600);
  await page.capture('09-clear-confirm-dialog-ar.png');

  // 8. Execute Clear & Re-scan
  await page.eval(`
    const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('تأكيد ومسح'));
    if (btn) btn.click();
  `);
  await sleep(2000); // Wait for clear and verify re-scan
  await page.capture('10-clear-result-ar.png');

  // 9. Scan Result Healthy (Green Banner)
  await page.capture('06-scan-result-healthy-ar.png');

  // 10. Scan Result Warning (Yellow Banner)
  await page.eval(`
    const banner = document.querySelector('.border-emerald-300, .border-red-300');
    if (banner) {
      banner.className = 'mt-4 rounded-xl border p-4 shadow-sm border-amber-300 bg-amber-50/80 text-amber-950 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-100';
      const icon = banner.querySelector('.bg-emerald-600, .bg-red-600');
      if (icon) icon.className = 'mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-amber-500 text-white';
      const title = banner.querySelector('h3');
      if (title) title.textContent = 'أكواد معلقة';
      const body = banner.querySelector('p');
      if (body) body.textContent = 'تم رصد أكواد أعطال معلقة. قد تكون لمبة فحص المحرك مطفأة حالياً ولكن هذه الأعطال تتطلب المتابعة.';
    }
  `);
  await page.capture('07-scan-result-warning-ar.png');

  // ===================== ENGLISH CAPTURES =====================
  console.log('\n--- Capturing English LTR screens ---');
  // Switch to English
  await page.eval(`
    const globeBtn = document.querySelector('button[title*="اللغة"], button[title*="language"], button[aria-label*="اللغة"], button[aria-label*="language"]');
    if (globeBtn) globeBtn.click();
  `);
  await sleep(800);

  // 1. Healthy EN
  await page.capture('06-scan-result-healthy-en.png');
  await page.capture('10-clear-result-en.png');

  // Warning EN
  await page.eval(`
    const banner = document.querySelector('.border-emerald-300, .border-red-300');
    if (banner) {
      banner.className = 'mt-4 rounded-xl border p-4 shadow-sm border-amber-300 bg-amber-50/80 text-amber-950 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-100';
      const icon = banner.querySelector('.bg-emerald-600, .bg-red-600');
      if (icon) icon.className = 'mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-amber-500 text-white';
      const title = banner.querySelector('h3');
      if (title) title.textContent = 'Pending codes';
      const body = banner.querySelector('p');
      if (body) body.textContent = 'Pending trouble codes detected. The check-engine lamp may still be off, but these faults require follow-up.';
    }
  `);
  await page.capture('07-scan-result-warning-en.png');

  // Navigate to Connect EN
  await page.eval(`
    const link = document.querySelector('a[href="/"]');
    if (link) link.click();
  `);
  await sleep(600);
  await page.capture('02-connect-demo-en.png');

  // Disconnect to see idle EN
  await page.eval(`
    const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Disconnect'));
    if (btn) btn.click();
  `);
  await sleep(600);
  await page.capture('01-connect-idle-en.png');

  // Re-start Demo in EN
  await page.eval(`
    const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Start Demo Experience'));
    if (btn) btn.click();
  `);
  await sleep(1000);

  // Vehicles EN
  await page.eval(`
    const link = document.querySelector('a[href="/vehicles"]');
    if (link) link.click();
  `);
  await sleep(800);
  await page.capture('03-vehicles-detected-en.png');

  // Catalog search in EN
  await page.eval(`
    const input = document.querySelector('input[type="search"], input[type="text"]');
    if (input) {
      input.value = 'Corolla';
      input.dispatchEvent(new Event('input', { bubbles: true }));
    }
  `);
  await sleep(600);
  await page.capture('04-vehicles-manual-catalog-en.png');

  // Scan EN
  await page.eval(`
    const link = document.querySelector('a[href="/scan"]');
    if (link) link.click();
  `);
  await sleep(800);

  // Progress in EN
  await page.eval(`
    const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Run scan'));
    if (btn) btn.click();
  `);
  await sleep(200);
  await page.capture('05-scan-progress-en.png');
  await sleep(1800);
  await page.capture('08-scan-result-fault-en.png');

  // Clear dialog EN
  await page.eval(`
    const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Clear codes'));
    if (btn) btn.click();
  `);
  await sleep(600);
  await page.capture('09-clear-confirm-dialog-en.png');

  console.log('\nAll screenshots captured successfully!');

  page.close();
  client.close();
  proc.kill('SIGKILL');
}

run().catch((err) => {
  console.error('Error running capture:', err);
  process.exit(1);
});
