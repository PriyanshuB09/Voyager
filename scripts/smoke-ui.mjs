/**
 * Copyright (c) 2026 Priyanshu Biswal
 * SPDX-License-Identifier: MIT
 */

import { app, BrowserWindow } from "electron";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectDirectory = path.resolve(scriptDirectory, "..");

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
      partition: "voyager-ui-smoke",
    },
  });

  process.stdout.write("smoke: app ready\n");
  await window.loadFile(path.join(projectDirectory, "out/renderer/index.html"));
  process.stdout.write("smoke: renderer loaded\n");
  const result = await window.webContents.executeJavaScript(`(async () => {
    const wait = (milliseconds = 50) => new Promise((resolve) => setTimeout(resolve, milliseconds));
    const requireElement = (selector) => {
      const element = document.querySelector(selector);
      if (!element) throw new Error('Missing required UI element: ' + selector);
      return element;
    };

    const checks = {};
    checks.workspace = Boolean(requireElement('.workspace'));
    checks.autoField = Boolean(requireElement('.auto-field-card .field-surface'));
    checks.tree = Boolean(requireElement('.tree-viewport'));

    requireElement('.nav-tools-button').click();
    await wait();
    checks.tools = document.querySelectorAll('.app-menu-panel [role="menuitem"]').length === 5;

    requireElement('.app-menu-panel [role="menuitem"]').click();
    await wait();
    checks.settings = Boolean(requireElement('.settings-modal'));
    const imageInput = requireElement('.settings-modal input[type="file"]');
    const imageData = '<svg xmlns="http://www.w3.org/2000/svg" width="640" height="320"><rect width="640" height="320" fill="#263043"/></svg>';
    const transfer = new DataTransfer();
    transfer.items.add(new File([imageData], 'field.svg', { type: 'image/svg+xml' }));
    imageInput.files = transfer.files;
    imageInput.dispatchEvent(new Event('change', { bubbles: true }));
    await wait(120);
    checks.crop = Boolean(requireElement('.field-crop-dialog'));
    [...document.querySelectorAll('.field-crop-dialog button')].find((button) => button.textContent.trim() === 'Cancel')?.click();
    await wait();
    requireElement('[aria-label="Close settings"]').click();
    await wait();

    requireElement('.tree-add-button').click();
    await wait();
    requireElement('.tree-add-menu button').click();
    await wait();
    const pathNode = requireElement('.tree-node-path');
    const pathNodeRect = pathNode.getBoundingClientRect();
    pathNode.dispatchEvent(new PointerEvent('pointerdown', {
      bubbles: true,
      clientX: pathNodeRect.left + 20,
      clientY: pathNodeRect.top + 20,
      pointerId: 1,
    }));
    window.dispatchEvent(new PointerEvent('pointerup', {
      bubbles: true,
      clientX: pathNodeRect.left + 20,
      clientY: pathNodeRect.top + 20,
      pointerId: 1,
    }));
    await wait();
    const addFieldElementButton = [...document.querySelectorAll('.field-actions > button')]
      .find((button) => button.textContent.trim() === 'Add');
    if (!addFieldElementButton) throw new Error('Missing Add field element button');
    addFieldElementButton.click();
    addFieldElementButton.click();
    await wait();
    checks.pathOverlaySetup = document.querySelectorAll('.waypoint-marker').length === 2;

    document.querySelectorAll('.workspace-tabs button').item(1).click();
    await wait();
    checks.liveField = Boolean(requireElement('.live-workspace .live-tab-field'));
    checks.topicPickers = document.querySelectorAll('.topic-picker').length === 4;
    const pathOverlayToggle = requireElement('.live-path-overlay-toggle');
    checks.livePathOverlayOption = !pathOverlayToggle.disabled;
    pathOverlayToggle.click();
    await wait();
    checks.livePathOverlay = Boolean(requireElement('[data-path-overlay="true"] .live-planned-path'))
      && document.querySelectorAll('[data-path-overlay="true"] .live-planned-path-waypoint').length === 2;
    const transportButtons = document.querySelectorAll('.transport-switch button');
    checks.transportSwitch = transportButtons.length === 2;
    transportButtons.item(1).click();
    await wait(250);
    transportButtons.item(0).click();
    await wait(100);
    document.querySelectorAll('.workspace-tabs button').item(0).click();
    await wait();
    checks.autoFieldMeasuredAfterTabReturn = requireElement('.auto-field-card .field-surface').dataset.measured === 'true';
    checks.treeMeasuredAfterTabReturn = requireElement('.tree-viewport').dataset.measured === 'true';
    checks.pathOverlaysAfterTabReturn = document.querySelectorAll('.waypoint-marker').length === 2;
    checks.pathVisibleAfterTabReturn = !document.querySelector('.tree-visibility-warning');

    const layoutButtons = document.querySelectorAll('.layout-button');
    layoutButtons.item(1).click();
    await wait();
    checks.layout = requireElement('.voyager-app').classList.contains('layout-horizontal');
    layoutButtons.item(0).click();
    await wait();

    requireElement('.nav-save-button').click();
    await wait();
    checks.save = Boolean(requireElement('.save-dialog'));

    return {
      checks,
      passed: Object.values(checks).every(Boolean),
      domNodes: document.querySelectorAll('*').length,
      heapBytes: performance.memory?.usedJSHeapSize ?? null,
    };
  })()`);
  process.stdout.write("smoke: interactions complete\n");

  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  window.destroy();
  app.exit(result.passed ? 0 : 1);
}).catch((error) => {
  console.error(error);
  app.exit(1);
});
