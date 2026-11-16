import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, statSync } from 'node:fs';
import { resolve } from 'node:path';

const PORT = 9222;
const DEV_PORT = 1420;
const DEV_URL = `http://localhost:${DEV_PORT}`;
const PDF_PATH = resolve('docs/samples/report-sample.pdf');
const EXE_PATH = resolve('src-tauri/target/debug/obd-diagnose.exe');

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function startVite() {
  console.log(`Starting Vite on port ${DEV_PORT}...`);
  const proc = spawn('cmd.exe', ['/c', 'npx', 'vite', '--port', String(DEV_PORT), '--strictPort'], {
    shell: false,
    stdio: 'inherit',
  });
  for (let i = 0; i < 40; i++) {
    try {
      const res = await fetch(DEV_URL);
      if (res.ok) {
        console.log(`Vite is up at ${DEV_URL}`);
        return proc;
      }
    } catch {
      await sleep(250);
    }
  }
  proc.kill();
  throw new Error('Vite failed to start on port 1420');
}

async function startTauri() {
  console.log(`Launching real Tauri app: ${EXE_PATH}...`);
  const env = {
    ...process.env,
    WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS: `--remote-debugging-port=${PORT}`,
  };
  const proc = spawn(EXE_PATH, [], { env, stdio: 'pipe' });
  return proc;
}

async function getDevtoolsTargets() {
  for (let i = 0; i < 40; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${PORT}/json`);
      if (res.ok) {
        const targets = await res.json();
        const page = targets.find((t) => t.type === 'page' && t.url.includes('1420'));
        if (page) return page;
      }
    } catch {
      // waiting
    }
    await sleep(250);
  }
  throw new Error('Could not connect to WebView2 DevTools');
}

class CdpClient {
  constructor(url) {
    this.ws = new WebSocket(url);
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
    const res = await this.send('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true,
    });
    if (res.exceptionDetails) {
      throw new Error(JSON.stringify(res.exceptionDetails));
    }
    return res.result?.value;
  }

  close() {
    this.ws.close();
  }
}

async function main() {
  mkdirSync(resolve('docs/samples'), { recursive: true });

  const viteProc = await startVite();
  let tauriProc = null;

  try {
    tauriProc = await startTauri();
    console.log('Tauri app launched. Waiting for WebView2 remote debugging port...');
    const pageTarget = await getDevtoolsTargets();
    console.log(`Connected to WebView2 page target: ${pageTarget.title} (${pageTarget.url})`);

    const client = new CdpClient(pageTarget.webSocketDebuggerUrl);
    await client.waitOpen();
    await client.send('Page.enable');
    await client.send('Runtime.enable');

    client.ws.addEventListener('message', (e) => {
      const msg = JSON.parse(e.data);
      if (msg.method === 'Runtime.consoleAPICalled') {
        console.log('[BROWSER CONSOLE]', msg.params.type, msg.params.args.map(a => a.value || a.description).join(' '));
      } else if (msg.method === 'Runtime.exceptionThrown') {
        console.error('[BROWSER EXCEPTION]', msg.params.exceptionDetails.text, msg.params.exceptionDetails.exception?.description);
      }
    });

    console.log('Checking Tauri bridge availability inside running app...');
    const hasTauri = await client.eval('Boolean(window.__TAURI__)');
    console.log('window.__TAURI__ present:', hasTauri);

    console.log('Navigating to Arabic sample report route in real Tauri app...');
    await client.send('Page.navigate', { url: 'http://localhost:1420/#/report-preview' });
    await sleep(1000);

    await client.eval(`
      (async () => {
        try {
          localStorage.setItem('obd.language', 'ar');
        } catch (e) {
          console.warn('Could not set localStorage', e);
        }
      })()
    `);

    const pageText = await client.eval("document.body.innerText");
    console.log("PAGE TEXT AT START:", pageText);

    // Poll until report is mounted
    for (let i = 0; i < 40; i++) {
      const isReportMounted = await client.eval("Boolean(document.querySelector('#diagnostic-report-print-root'))");
      const currentUrl = await client.eval("window.location.href");
      console.log(`Poll ${i}: url=${currentUrl}, reportMounted=${isReportMounted}`);
      if (isReportMounted) {
        console.log('Report mounted in DOM!');
        break;
      }
      await sleep(250);
    }

    // Wait for Cairo font subset to finish rendering
    await client.eval('document.fonts.ready');
    await sleep(1500);

    // Call Rust save_pdf command inside the real Tauri app!
    console.log(`Invoking save_pdf command on Tauri to save: ${PDF_PATH}`);
    const savedPath = await client.eval(`
      window.__TAURI__.core.invoke('save_pdf', {
        path: ${JSON.stringify(PDF_PATH)}
      })
    `);
    console.log('save_pdf returned path:', savedPath);

    client.close();

    if (existsSync(PDF_PATH)) {
      const stat = statSync(PDF_PATH);
      console.log(`SUCCESS: PDF generated by real Tauri app via WebView2 PrintToPdf! Size: ${stat.size} bytes`);
    } else {
      throw new Error(`PDF was not found at ${PDF_PATH}`);
    }
  } finally {
    if (tauriProc) {
      console.log('Terminating Tauri app process...');
      tauriProc.kill();
      spawn('taskkill', ['/F', '/IM', 'obd-diagnose.exe'], { stdio: 'ignore' });
    }
    if (viteProc) {
      console.log('Terminating Vite server...');
      viteProc.kill();
    }
  }
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
