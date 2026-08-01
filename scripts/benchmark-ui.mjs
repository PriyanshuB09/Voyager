import { app, BrowserWindow } from "electron";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectDirectory = path.resolve(scriptDirectory, "..");
const CYCLE_COUNT = 30;

app.whenReady().then(async () => {
  const window = new BrowserWindow({
    width: 1440,
    height: 900,
    show: false,
    backgroundColor: "#17181c",
    webPreferences: {
      preload: path.join(projectDirectory, "out/preload/preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      backgroundThrottling: false,
      partition: "voyager-performance-audit",
    },
  });

  const startedAt = performance.now();
  await window.loadFile(path.join(projectDirectory, "out/renderer/index.html"));
  const readyAt = performance.now();
  const rendererResult = await window.webContents.executeJavaScript(`(async () => {
    const wait = (milliseconds = 5) => new Promise((resolve) => setTimeout(resolve, milliseconds));
    const auto = document.querySelectorAll('.workspace-tabs button').item(0);
    const live = document.querySelectorAll('.workspace-tabs button').item(1);
    live.click();
    await wait(30);
    auto.click();
    await wait(30);
    const nodeCountBefore = document.querySelectorAll('*').length;
    const heapBefore = performance.memory?.usedJSHeapSize ?? null;
    const started = performance.now();
    let healthy = true;
    for (let index = 0; index < ${CYCLE_COUNT}; index += 1) {
      live.click();
      await wait();
      healthy &&= Boolean(document.querySelector('.live-workspace'));
      auto.click();
      await wait();
      healthy &&= document.querySelector('.auto-field-card .field-surface')?.dataset.measured === 'true';
      healthy &&= document.querySelector('.tree-viewport')?.dataset.measured === 'true';
    }
    const duration = performance.now() - started;
    const navigation = performance.getEntriesByType('navigation')[0];
    return {
      healthy,
      duration,
      averageCycleMs: duration / ${CYCLE_COUNT},
      nodeCountBefore,
      nodeCountAfter: document.querySelectorAll('*').length,
      heapBefore,
      heapAfter: performance.memory?.usedJSHeapSize ?? null,
      domInteractiveMs: navigation?.domInteractive ?? null,
      loadEventEndMs: navigation?.loadEventEnd ?? null,
    };
  })()`);

  const heapGrowth = rendererResult.heapBefore === null || rendererResult.heapAfter === null
    ? null
    : rendererResult.heapAfter - rendererResult.heapBefore;
  const checks = {
    rendererReadyUnder1500ms: readyAt - startedAt < 1500,
    domInteractiveUnder1000ms: rendererResult.domInteractiveMs !== null && rendererResult.domInteractiveMs < 1000,
    repeatedTransitionsHealthy: rendererResult.healthy,
    averageTabCycleUnder75ms: rendererResult.averageCycleMs < 75,
    noDomGrowth: rendererResult.nodeCountAfter <= rendererResult.nodeCountBefore + 4,
    heapGrowthUnder8MiB: heapGrowth !== null && heapGrowth < 8 * 1024 * 1024,
  };
  const result = {
    checks,
    passed: Object.values(checks).every(Boolean),
    measurements: {
      rendererReadyMs: Math.round((readyAt - startedAt) * 10) / 10,
      domInteractiveMs: rendererResult.domInteractiveMs,
      loadEventEndMs: rendererResult.loadEventEndMs,
      cycles: CYCLE_COUNT,
      cycleDurationMs: Math.round(rendererResult.duration * 10) / 10,
      averageCycleMs: Math.round(rendererResult.averageCycleMs * 10) / 10,
      nodeCountBefore: rendererResult.nodeCountBefore,
      nodeCountAfter: rendererResult.nodeCountAfter,
      heapBefore: rendererResult.heapBefore,
      heapAfter: rendererResult.heapAfter,
      heapGrowth,
    },
  };

  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  window.destroy();
  app.exit(result.passed ? 0 : 1);
}).catch((error) => {
  console.error(error);
  app.exit(1);
});
