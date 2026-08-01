import { app, BrowserWindow } from "electron";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectDirectory = path.resolve(scriptDirectory, "..");
const screenshotPath = path.join(projectDirectory, "artifacts", "focus-modal-stacking.png");

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
      partition: "voyager-focus-stacking-test",
    },
  });

  await window.loadFile(path.join(projectDirectory, "out/renderer/index.html"));
  const result = await window.webContents.executeJavaScript(`(async () => {
    const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));
    document.querySelectorAll('.layout-button').item(3)?.click();
    await wait(100);

    const workspace = document.querySelector('.workspace');
    const fieldToolbar = document.querySelector('.auto-field-card .field-toolbar');
    const treeModal = document.querySelector('.focus-tree-modal');
    if (!workspace || !fieldToolbar || !treeModal) {
      return { passed: false, reason: 'Required focus-layout elements were not rendered.' };
    }

    const workspaceRect = workspace.getBoundingClientRect();
    const fieldToolbarRect = fieldToolbar.getBoundingClientRect();
    treeModal.style.left = (fieldToolbarRect.left - workspaceRect.left + 20) + 'px';
    treeModal.style.top = (fieldToolbarRect.top - workspaceRect.top) + 'px';
    await wait(50);

    const treeModalRect = treeModal.getBoundingClientRect();
    const overlap = {
      left: Math.max(fieldToolbarRect.left, treeModalRect.left),
      right: Math.min(fieldToolbarRect.right, treeModalRect.right),
      top: Math.max(fieldToolbarRect.top, treeModalRect.top),
      bottom: Math.min(fieldToolbarRect.bottom, treeModalRect.bottom),
    };
    const overlaps = overlap.right > overlap.left && overlap.bottom > overlap.top;
    const point = overlaps
      ? { x: (overlap.left + overlap.right) / 2, y: (overlap.top + overlap.bottom) / 2 }
      : null;
    const topElement = point ? document.elementFromPoint(point.x, point.y) : null;
    const modalZ = Number.parseInt(getComputedStyle(treeModal).zIndex, 10);
    const toolbarZ = Number.parseInt(getComputedStyle(fieldToolbar).zIndex, 10);
    return {
      passed: overlaps && modalZ > toolbarZ && Boolean(topElement && treeModal.contains(topElement)),
      overlaps,
      modalZ,
      toolbarZ,
      topElement: topElement?.className ?? topElement?.tagName ?? null,
      topElementInsideModal: Boolean(topElement && treeModal.contains(topElement)),
    };
  })()`);

  const image = await window.webContents.capturePage();
  await mkdir(path.dirname(screenshotPath), { recursive: true });
  await writeFile(screenshotPath, image.toPNG());
  process.stdout.write(`${JSON.stringify({ ...result, screenshotPath }, null, 2)}\n`);
  window.destroy();
  app.exit(result.passed ? 0 : 1);
}).catch((error) => {
  console.error(error);
  app.exit(1);
});
