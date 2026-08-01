import { app, BrowserWindow } from "electron";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectDirectory = path.resolve(scriptDirectory, "..");
const requestedOutput = process.argv[2] ?? "artifacts/voyager-ui.png";
const requestedState = process.argv[3] ?? "workspace";
const outputPath = path.resolve(projectDirectory, requestedOutput);

app.commandLine.appendSwitch("disable-gpu-vsync");

app.whenReady().then(async () => {
  const window = new BrowserWindow({
    width: 1440,
    height: 900,
    show: false,
    backgroundColor: "#111318",
    webPreferences: {
      preload: path.join(projectDirectory, "out/preload/preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      partition: "voyager-ui-capture",
    },
  });

  const startedAt = performance.now();
  await window.loadFile(path.join(projectDirectory, "out/renderer/index.html"));
  await window.webContents.executeJavaScript("new Promise((resolve) => setTimeout(resolve, 250))");
  if (requestedState === "tools") {
    await window.webContents.executeJavaScript("document.querySelector('.nav-tools-button')?.click()");
  } else if (requestedState === "live") {
    await window.webContents.executeJavaScript("document.querySelectorAll('.workspace-tabs button').item(1)?.click()");
    await window.webContents.executeJavaScript("new Promise((resolve) => setTimeout(resolve, 100))");
  } else if (requestedState === "live-auto") {
    await window.webContents.executeJavaScript(`(async () => {
      const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));
      document.querySelector('.tree-add-button')?.click();
      await wait(50);
      document.querySelector('.tree-add-menu button')?.click();
      await wait(50);
      const pathNode = document.querySelector('.tree-node-path');
      if (pathNode) {
        pathNode.focus();
        pathNode.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'Enter' }));
      }
      await wait(50);
      const addButton = [...document.querySelectorAll('.field-actions > button')].find((button) => button.textContent.trim() === 'Add');
      addButton?.click();
      addButton?.click();
      await wait(50);
      document.querySelectorAll('.workspace-tabs button').item(1)?.click();
      await wait(100);
      document.querySelectorAll('.workspace-tabs button').item(0)?.click();
      await wait(100);
      document.querySelector('.tree-locate-button')?.click();
      await wait(50);
    })()`);
  } else if (requestedState === "settings") {
    await window.webContents.executeJavaScript("document.querySelector('.nav-tools-button')?.click()");
    await window.webContents.executeJavaScript("new Promise((resolve) => setTimeout(resolve, 50))");
    await window.webContents.executeJavaScript("document.querySelector('.app-menu-panel button')?.click()");
    await window.webContents.executeJavaScript("new Promise((resolve) => setTimeout(resolve, 100))");
  } else if (requestedState === "crop") {
    await window.webContents.executeJavaScript(`(async () => {
      document.querySelector('.nav-tools-button')?.click();
      await new Promise((resolve) => setTimeout(resolve, 50));
      document.querySelector('.app-menu-panel button')?.click();
      await new Promise((resolve) => setTimeout(resolve, 50));
      const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="700"><rect width="1200" height="700" fill="#273449"/><rect x="100" y="70" width="1000" height="500" rx="18" fill="#4d725a"/><path d="M600 70V570M100 320H1100" stroke="#dce5dc" stroke-width="8"/><text x="600" y="650" text-anchor="middle" fill="white" font-size="38">Broadcast border to crop away</text></svg>';
      const transfer = new DataTransfer();
      transfer.items.add(new File([svg], 'field.svg', { type: 'image/svg+xml' }));
      const input = document.querySelector('.settings-modal input[type="file"]');
      input.files = transfer.files;
      input.dispatchEvent(new Event('change', { bubbles: true }));
      await new Promise((resolve) => setTimeout(resolve, 150));
    })()`);
  }
  if (requestedState !== "workspace") {
    await window.webContents.executeJavaScript("new Promise((resolve) => setTimeout(resolve, 150))");
  }
  if (requestedState === "crop") {
    window.showInactive();
    await window.webContents.executeJavaScript("new Promise((resolve) => setTimeout(resolve, 120))");
  }

  const metrics = await window.webContents.executeJavaScript(`({
    domNodes: document.querySelectorAll('*').length,
    heapBytes: performance.memory?.usedJSHeapSize ?? null,
    menuDebug: (() => {
      const menu = document.querySelector('.app-menu-panel');
      if (!menu) return null;
      const rect = menu.getBoundingClientRect();
      const style = getComputedStyle(menu);
      const navStyle = getComputedStyle(document.querySelector('.voyager-nav'));
      return { rect: rect.toJSON(), display: style.display, visibility: style.visibility, opacity: style.opacity, zIndex: style.zIndex, navOverflow: navStyle.overflow };
    })(),
    dialogDebug: (() => {
      const dialog = document.querySelector('[data-slot="dialog-content"], .settings-modal');
      if (!dialog) return null;
      const rect = dialog.getBoundingClientRect();
      const style = getComputedStyle(dialog);
      return { rect: rect.toJSON(), display: style.display, visibility: style.visibility, opacity: style.opacity, zIndex: style.zIndex };
    })(),
    navigation: performance.getEntriesByType('navigation')[0]?.toJSON() ?? null,
    paints: performance.getEntriesByType('paint').map((entry) => entry.toJSON()),
  })`);
  const image = await window.webContents.capturePage();
  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, image.toPNG());
  if (requestedState === "crop") window.hide();

  process.stdout.write(`${JSON.stringify({
    ...metrics,
    captureReadyMs: Math.round((performance.now() - startedAt) * 10) / 10,
    outputPath,
  }, null, 2)}\n`);

  window.destroy();
  app.quit();
}).catch((error) => {
  console.error(error);
  app.exit(1);
});
