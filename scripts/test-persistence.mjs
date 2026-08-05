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
    width: 1200,
    height: 800,
    show: false,
    backgroundColor: "#17181c",
    webPreferences: {
      preload: path.join(projectDirectory, "out/preload/preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      backgroundThrottling: false,
      partition: "voyager-persistence-audit",
    },
  });

  const renderer = path.join(projectDirectory, "out/renderer/index.html");
  await window.loadFile(renderer);
  await window.webContents.executeJavaScript(`new Promise((resolve, reject) => {
    const request = indexedDB.open('voyager-autonomous-builder', 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains('kv')) request.result.createObjectStore('kv');
    };
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const database = request.result;
      const transaction = database.transaction('kv', 'readwrite');
      transaction.objectStore('kv').put({
        settings: {
          fieldLengthMeters: -10,
          fieldWidthMeters: 0,
          robotLengthMeters: Infinity,
          robotWidthMeters: NaN,
          layoutMode: 'invalid-layout',
          designPreset: 'invalid-design',
          themePreset: 'custom',
          customThemeName: 'Audit theme',
          customTheme: { background: '#123456' },
          defaultIntermediateHandOffRadiusMeters: Infinity,
        },
        treeNodes: [
          { id: 'duplicate', kind: 'path', name: 'Audit_Path', x: Infinity, y: NaN, parentId: 'duplicate', nextId: 'duplicate', selectedForRoutine: false, editing: true },
          { id: 'duplicate', kind: 'event', name: '', x: 350, y: 90, parentId: 'missing', nextId: null, selectedForRoutine: false, editing: false },
        ],
        pathDataByName: {
          Audit_Path: {
            waypoints: [
              { id: 'same-waypoint', x: Infinity, y: -50, angle: NaN, handoff: Infinity, profiled: true },
              { id: 'same-waypoint', x: 3, y: 4, angle: 45, handoff: 0.2, profiled: true },
            ],
            rotationTargets: [{ id: 'rotation', position: Infinity, angle: NaN, profiled: true }],
            events: [{ id: 'event', name: '', position: -30 }],
            eventZones: [{ id: 'zone', startName: '', endName: '', startPosition: 99, endPosition: -5 }],
            constraintZones: [{ id: 'constraint', startPosition: Infinity, endPosition: NaN, maxTranslationalVelocity: -1, maxTranslationalAcceleration: 0, maxRotationalVelocity: NaN, maxRotationalAcceleration: Infinity }],
          },
        },
        knownPathFileNames: ['Audit_Path.json', '../unsafe.json'],
        activePathNodeId: 'duplicate',
        selectedTreeNodeId: 'missing',
        pan: { x: NaN, y: Infinity },
        treeModalRect: { x: NaN, y: Infinity, width: -1, height: 0 },
        playbackModalPosition: { x: Infinity, y: NaN },
        activityLog: [{ id: 'bad', kind: 'unknown', message: 'invalid', timestamp: Date.now() }],
        obstacles: [],
        versionHistory: [],
      }, 'app-state');
      transaction.oncomplete = () => { database.close(); resolve(true); };
      transaction.onerror = () => reject(transaction.error);
    };
  })`);

  await window.reload();
  await new Promise((resolve) => setTimeout(resolve, 250));
  const result = await window.webContents.executeJavaScript(`(() => {
    const field = document.querySelector('.auto-field-card .field-surface');
    const fieldRect = field.getBoundingClientRect();
    const handoffRects = [...document.querySelectorAll('.handoff-circle')].map((element) => element.getBoundingClientRect());
    const nodeIds = [...document.querySelectorAll('[data-tree-node-id]')].map((element) => element.dataset.treeNodeId);
    const invalidInlineStyles = [...document.querySelectorAll('[style]')].filter((element) => /NaN|Infinity/.test(element.getAttribute('style') || ''));
    const checks = {
      customThemeRestored: getComputedStyle(document.documentElement).getPropertyValue('--bg').trim().toLowerCase() === '#123456',
      invalidLayoutRecovered: document.querySelector('.voyager-app').classList.contains('layout-default'),
      invalidDesignRecovered: document.querySelector('.voyager-app').classList.contains('design-precision-grid'),
      duplicateTreeIdsRepaired: nodeIds.length === 2 && new Set(nodeIds).size === 2,
      pathGeometryRecovered: document.querySelectorAll('.auto-field-card .waypoint-marker').length === 2,
      handoffRadiusBounded: handoffRects.length === 2 && handoffRects.every((rect) => rect.width <= fieldRect.height + 2 && rect.height <= fieldRect.height + 2),
      finiteInlineGeometry: invalidInlineStyles.length === 0,
      invalidActivityDiscarded: !document.querySelector('.status-activity').textContent.includes('invalid'),
      selfConnectionDiscarded: document.querySelectorAll('.tree-edge').length === 0,
      measuredAfterRecovery: field.dataset.measured === 'true' && document.querySelector('.tree-viewport').dataset.measured === 'true',
    };
    return {
      checks,
      passed: Object.values(checks).every(Boolean),
      diagnostics: { nodeIds, invalidInlineStyles: invalidInlineStyles.map((element) => element.outerHTML.slice(0, 160)) },
    };
  })()`);

  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  window.destroy();
  app.exit(result.passed ? 0 : 1);
}).catch((error) => {
  console.error(error);
  app.exit(1);
});
