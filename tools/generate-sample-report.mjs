import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT = 9223;
const APP_PORT = 1422;
const APP_URL = `http://localhost:${APP_PORT}`;
const SAMPLES_DIR = join(process.cwd(), 'docs', 'samples');

mkdirSync(SAMPLES_DIR, { recursive: true });

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function startServer() {
  console.log(`Starting vite dev server on port ${APP_PORT}...`);
  const proc = spawn('npx.cmd', ['vite', '--port', String(APP_PORT), '--strictPort'], {
    stdio: 'pipe',
    shell: true,
  });

  for (let i = 0; i < 40; i++) {
    try {
      const res = await fetch(APP_URL);
      if (res.ok) {
        console.log(`Vite dev server responding at ${APP_URL}`);
        return proc;
      }
    } catch {
      await sleep(200);
    }
  }
  proc.kill();
  throw new Error('Vite dev server failed to start');
}

async function startChrome() {
  const profileDir = join(process.env.TEMP || 'C:\\Temp', 'chrome-report-' + Date.now());
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

  close() {
    this.ws.close();
  }
}

async function run() {
  const serverProc = await startServer();
  let chromeProc = null;

  try {
    console.log('Launching headless Chrome for PDF generation...');
    const { proc, wsUrl } = await startChrome();
    chromeProc = proc;

    const client = new CdpClient(wsUrl);
    await client.waitOpen();

    const target = await client.send('Target.createTarget', { url: APP_URL });
    const pageWs = `ws://127.0.0.1:${PORT}/devtools/page/${target.targetId}`;
    const page = new CdpClient(pageWs);
    await page.waitOpen();

    await page.send('Page.enable');
    await page.send('DOM.enable');
    await page.send('Emulation.setDeviceMetricsOverride', {
      width: 1280,
      height: 900,
      deviceScaleFactor: 1,
      mobile: false,
    });

    await sleep(1500);

    // Ensure Arabic locale
    console.log('Setting Arabic locale in app...');
    await page.eval(`localStorage.setItem('i18nextLng', 'ar'); location.reload();`);
    await sleep(1500);

    // Start Demo Experience
    console.log('Starting Demo Experience...');
    await page.eval(`(() => {
      const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('بدء تجربة وضع العرض'));
      if (btn) btn.click();
    })()`);
    await sleep(2000);

    // Navigate to Scan tab via HashRouter
    console.log('Navigating to Scan tab via HashRouter (#/scan)...');
    await page.eval(`window.location.hash = '#/scan'`);
    await sleep(1500);

    const scanButtons = await page.eval(`Array.from(document.querySelectorAll('button')).map(b => b.textContent.trim())`);
    console.log('Scan page buttons:', scanButtons);

    // Select Pre-Purchase Inspection mode
    console.log('Selecting Pre-Purchase Inspection mode...');
    await page.eval(`(() => {
      const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('فحص ما قبل الشراء'));
      if (btn) btn.click();
    })()`);
    await sleep(800);

    // Run Scan
    console.log('Starting diagnostic scan...');
    await page.eval(`(() => {
      const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('بدء الفحص'));
      if (btn) btn.click();
    })()`);

    // Wait for scan to complete (demo scan takes ~2s)
    console.log('Waiting for scan to complete...');
    await sleep(4000);

    const afterScanButtons = await page.eval(`Array.from(document.querySelectorAll('button')).map(b => b.textContent.trim())`);
    console.log('Buttons after scan:', afterScanButtons);

    // Open Report Modal
    console.log('Opening Diagnostic Report View modal...');
    await page.eval(`(() => {
      const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('عرض التقرير الكامل'));
      if (btn) btn.click();
    })()`);
    await sleep(1500);

    // Capture screenshot of the report modal preview
    console.log('Capturing preview screenshot...');
    const { data: screenData } = await page.send('Page.captureScreenshot', { format: 'png' });
    const screenBuffer = Buffer.from(screenData, 'base64');
    const previewPath = join(SAMPLES_DIR, 'report-sample-preview.png');
    writeFileSync(previewPath, screenBuffer);
    console.log(`Saved screenshot preview: ${previewPath} (${Math.round(screenBuffer.length / 1024)} KB)`);

    // Generate real PDF via Chromium printToPDF
    console.log('Printing to PDF via Page.printToPDF...');
    const pdfResult = await page.send('Page.printToPDF', {
      landscape: false,
      displayHeaderFooter: false,
      printBackground: true,
      preferCSSPageSize: true,
      paperWidth: 8.27, // A4 in inches
      paperHeight: 11.69,
      marginTop: 0.4,
      marginBottom: 0.4,
      marginLeft: 0.4,
      marginRight: 0.4,
    });

    const pdfBuffer = Buffer.from(pdfResult.data, 'base64');
    const pdfPath = join(SAMPLES_DIR, 'report-sample.pdf');
    writeFileSync(pdfPath, pdfBuffer);
    console.log(`Saved PDF report: ${pdfPath} (${Math.round(pdfBuffer.length / 1024)} KB)`);

    page.close();
    client.close();
  } finally {
    if (chromeProc) chromeProc.kill('SIGKILL');
    serverProc.kill('SIGTERM');
    process.exit(0);
  }
}

run().catch((err) => {
  console.error('Error generating report sample:', err);
  process.exit(1);
});
