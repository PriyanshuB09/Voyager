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
      backgroundThrottling: false,
      partition: "voyager-ui-audit",
    },
  });

  await window.loadFile(path.join(projectDirectory, "out/renderer/index.html"));
  const initial = await window.webContents.executeJavaScript(`(async () => {
    const wait = (milliseconds = 35) => new Promise((resolve) => setTimeout(resolve, milliseconds));
    const requireElement = (selector) => {
      const element = document.querySelector(selector);
      if (!element) throw new Error('Missing required UI element: ' + selector);
      return element;
    };
    const checks = {};

    requireElement('.tree-add-button').click();
    await wait();
    requireElement('.tree-add-menu button').click();
    await wait();
    const pathNode = requireElement('.tree-node-path');
    const nodeRect = pathNode.getBoundingClientRect();
    const pointer = { bubbles: true, clientX: nodeRect.left + 20, clientY: nodeRect.top + 20, pointerId: 1 };
    pathNode.dispatchEvent(new PointerEvent('pointerdown', pointer));
    window.dispatchEvent(new PointerEvent('pointerup', pointer));
    await wait();

    const elementSelect = requireElement('.field-actions select');
    const addButton = [...document.querySelectorAll('.field-actions > button')]
      .find((button) => button.textContent.trim() === 'Add');
    if (!addButton) throw new Error('Missing path element Add button');
    const chooseAndAdd = async (kind, count = 1) => {
      elementSelect.value = kind;
      elementSelect.dispatchEvent(new Event('change', { bubbles: true }));
      await wait();
      for (let index = 0; index < count; index += 1) addButton.click();
      await wait();
    };
    await chooseAndAdd('waypoint', 3);
    await chooseAndAdd('rotationTarget');
    await chooseAndAdd('eventTrigger');
    await chooseAndAdd('eventZone');
    await chooseAndAdd('constraintZone');

    checks.allPathElementTypes = document.querySelectorAll('.waypoint-marker').length === 3
      && document.querySelectorAll('.rotation-target-marker').length === 1
      && document.querySelectorAll('.event-trigger-marker').length === 1
      && document.querySelectorAll('.event-zone-handle').length === 2
      && document.querySelectorAll('.constraint-handle').length === 2;

    await wait(320);
    await chooseAndAdd('waypoint');
    await wait(320);
    [...document.querySelectorAll('.history-actions button')].find((button) => button.textContent.trim() === 'Undo')?.click();
    await wait();
    const undoRestoredThree = document.querySelectorAll('.waypoint-marker').length === 3;
    [...document.querySelectorAll('.history-actions button')].find((button) => button.textContent.trim() === 'Redo')?.click();
    await wait();
    const redoRestoredFour = document.querySelectorAll('.waypoint-marker').length === 4;
    [...document.querySelectorAll('.history-actions button')].find((button) => button.textContent.trim() === 'Undo')?.click();
    await wait();
    checks.undoRedo = undoRestoredThree && redoRestoredFour && document.querySelectorAll('.waypoint-marker').length === 3;

    pathNode.focus();
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'd', ctrlKey: true, bubbles: true }));
    await wait();
    const duplicated = document.querySelectorAll('.tree-node-path').length === 2;
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Delete', bubbles: true }));
    await wait();
    checks.treeDuplicateAndDelete = duplicated && document.querySelectorAll('.tree-node-path').length === 1;

    requireElement('.tree-add-button').click();
    await wait();
    requireElement('.tree-add-menu button').click();
    await wait();
    const secondPathNode = document.querySelectorAll('.tree-node-path').item(1);
    secondPathNode.focus();
    secondPathNode.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    await wait();
    secondPathNode.dispatchEvent(new KeyboardEvent('keydown', { key: 'F2', bubbles: true }));
    await wait();
    const renameInput = requireElement('.rename-input');
    const valueSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
    valueSetter.call(renameInput, 'Path 1');
    renameInput.dispatchEvent(new Event('input', { bubbles: true }));
    await wait();
    renameInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    await wait();
    checks.pathFileCollisionRejected = Boolean(document.querySelector('.rename-input'))
      && document.querySelector('.status-activity').textContent.includes('already uses the file name');
    document.querySelector('.rename-input')?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await wait();
    secondPathNode.focus();
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Delete', bubbles: true }));
    await wait();
    pathNode.focus();
    pathNode.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    await wait();

    const firstWaypoint = requireElement('.auto-field-card .waypoint-marker');
    firstWaypoint.focus();
    firstWaypoint.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    await wait();
    checks.keyboardWaypointEditor = Boolean(document.querySelector('.element-modal[role="dialog"]'));
    document.querySelector('[aria-label="Close modal"]')?.click();
    await wait();

    pathNode.focus();
    pathNode.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    await wait();
    checks.keyboardTreeSelection = pathNode.classList.contains('is-editing');

    requireElement('.tree-locate-button').click();
    await wait();
    const tools = requireElement('.nav-tools-button');
    const status = requireElement('.status-activity');
    checks.activityIsRightmost = status.compareDocumentPosition(tools) & Node.DOCUMENT_POSITION_PRECEDING
      ? status.getBoundingClientRect().left >= tools.getBoundingClientRect().right
      : false;

    const autoButton = document.querySelectorAll('.workspace-tabs button').item(0);
    const liveButton = document.querySelectorAll('.workspace-tabs button').item(1);
    [...document.querySelectorAll('.field-actions button')].find((button) => button.textContent.trim() === 'Playback')?.click();
    await wait();
    checks.playbackOpenedForCleanupTest = Boolean(document.querySelector('.playback-modal'));
    liveButton.click();
    await wait();
    checks.autoTransientToolsCloseOnLive = !document.querySelector('.playback-modal')
      && !document.querySelector('.element-modal')
      && !document.querySelector('.field-tools-menu');
    autoButton.click();
    await wait();
    const nodeCountBeforeCycles = document.querySelectorAll('*').length;
    let transitionsHealthy = true;
    for (let index = 0; index < 16; index += 1) {
      liveButton.click();
      await wait(15);
      transitionsHealthy &&= Boolean(document.querySelector('.live-workspace'))
        && !document.querySelector('.workspace[data-workspace-tab="auto"]');
      autoButton.click();
      await wait(15);
      const field = document.querySelector('.auto-field-card .field-surface');
      const tree = document.querySelector('.tree-viewport');
      transitionsHealthy &&= field?.dataset.measured === 'true'
        && tree?.dataset.measured === 'true'
        && document.querySelectorAll('.waypoint-marker').length === 3
        && !document.querySelector('.tree-visibility-warning')
        && !document.querySelector('.live-workspace');
    }
    checks.repeatedTabTransitions = transitionsHealthy;
    checks.noTransitionDomLeak = document.querySelectorAll('*').length <= nodeCountBeforeCycles + 4;

    let layoutsHealthy = true;
    let focusTreeModalAboveFieldToolbar = false;
    const layoutButtons = [...document.querySelectorAll('.layout-button')];
    const layoutNames = ['default', 'horizontal', 'mirrored', 'focus'];
    for (let index = 0; index < layoutButtons.length; index += 1) {
      layoutButtons[index].click();
      await wait(45);
      layoutsHealthy &&= requireElement('.voyager-app').classList.contains('layout-' + layoutNames[index]);
      layoutsHealthy &&= requireElement('.auto-field-card .field-surface').dataset.measured === 'true';
      layoutsHealthy &&= requireElement('.tree-viewport').dataset.measured === 'true';
      if (layoutNames[index] === 'focus') {
        const fieldToolbar = requireElement('.auto-field-card .field-toolbar');
        const treeModal = requireElement('.focus-tree-modal');
        focusTreeModalAboveFieldToolbar = Number.parseInt(getComputedStyle(treeModal).zIndex, 10)
          > Number.parseInt(getComputedStyle(fieldToolbar).zIndex, 10);
      }
    }
    layoutButtons[0].click();
    await wait();
    checks.allLayoutModes = layoutsHealthy;
    checks.focusTreeModalAboveFieldToolbar = focusTreeModalAboveFieldToolbar;

    const unnamedButtons = [...document.querySelectorAll('button, [role="button"]')].filter((element) => {
      if (element.getAttribute('aria-hidden') === 'true') return false;
      return !(element.getAttribute('aria-label') || element.getAttribute('title') || element.textContent.trim());
    });
    const unlabeledInputs = [...document.querySelectorAll('input, select, textarea')].filter((element) => {
      if (element.getAttribute('aria-label') || element.getAttribute('title')) return false;
      if (element.id && document.querySelector('label[for="' + CSS.escape(element.id) + '"]')) return false;
      return !element.closest('label');
    });
    checks.controlsHaveNames = unnamedButtons.length === 0 && unlabeledInputs.length === 0;

    const invalidInlineStyles = [...document.querySelectorAll('[style]')].filter((element) => /NaN|Infinity/.test(element.getAttribute('style') || ''));
    checks.finiteGeometry = invalidInlineStyles.length === 0;
    const fieldRect = requireElement('.auto-field-card .field-surface').getBoundingClientRect();
    checks.waypointsHaveFiniteBounds = [...document.querySelectorAll('.auto-field-card .waypoint-marker')].every((element) => {
      const rect = element.getBoundingClientRect();
      return [rect.left, rect.top, rect.width, rect.height].every(Number.isFinite)
        && rect.width > 0 && rect.height > 0
        && rect.right >= fieldRect.left && rect.left <= fieldRect.right
        && rect.bottom >= fieldRect.top && rect.top <= fieldRect.bottom;
    });

    const nav = requireElement('.voyager-nav');
    checks.noDesktopNavOverflow = nav.scrollWidth <= nav.clientWidth + 1;
    checks.desktopViewportContained = document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1
      && document.documentElement.scrollHeight <= document.documentElement.clientHeight + 1;

    requireElement('.nav-tools-button').click();
    await wait();
    requireElement('.app-menu-panel [role="menuitem"]').click();
    await wait();
    const settingsDialog = requireElement('.settings-modal[role="dialog"]');
    const settingsRect = settingsDialog.getBoundingClientRect();
    checks.settingsDialogSemantics = settingsDialog.getAttribute('aria-modal') === 'true'
      && settingsDialog.getAttribute('aria-labelledby') === 'settings-dialog-title';
    checks.settingsDialogFits = settingsRect.left >= 0 && settingsRect.top >= 0
      && settingsRect.right <= innerWidth && settingsRect.bottom <= innerHeight;
    requireElement('[aria-label="Close settings"]').click();
    await wait();

    const openToolAt = async (index, expectedSelector) => {
      requireElement('.nav-tools-button').click();
      await wait();
      document.querySelectorAll('.app-menu-panel [role="menuitem"]').item(index)?.click();
      await wait();
      const opened = Boolean(document.querySelector(expectedSelector));
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      await wait();
      return opened;
    };
    const obstacleDialog = await openToolAt(1, '.obstacle-dialog');
    const historyDialog = await openToolAt(3, '.version-history-dialog');
    const appearanceDialog = await openToolAt(4, '.preferences-dialog');
    checks.toolDialogs = obstacleDialog && historyDialog && appearanceDialog;

    requireElement('.activity-log-reveal').click();
    await wait();
    checks.activityLogDialog = Boolean(document.querySelector('.activity-log-dialog'));
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await wait();

    requireElement('.nav-save-button').click();
    await wait();
    checks.saveDialog = Boolean(document.querySelector('.save-dialog'));
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await wait();

    return {
      checks,
      passed: Object.values(checks).every(Boolean),
      diagnostics: {
        unnamedButtons: unnamedButtons.map((element) => element.outerHTML.slice(0, 180)),
        unlabeledInputs: unlabeledInputs.map((element) => element.outerHTML.slice(0, 180)),
        invalidInlineStyles: invalidInlineStyles.map((element) => element.outerHTML.slice(0, 180)),
        domNodes: document.querySelectorAll('*').length,
        heapBytes: performance.memory?.usedJSHeapSize ?? null,
      },
    };
  })()`);

  window.setSize(1000, 700);
  await new Promise((resolve) => setTimeout(resolve, 100));
  const compact = await window.webContents.executeJavaScript(`(() => {
    const nav = document.querySelector('.voyager-nav');
    const app = document.querySelector('.voyager-app');
    return {
      navContained: nav.scrollWidth <= nav.clientWidth + 1,
      appContained: app.scrollWidth <= app.clientWidth + 1,
      statusHidden: getComputedStyle(document.querySelector('.status-activity')).display === 'none',
      tabsVisible: [...document.querySelectorAll('.workspace-tabs button')].every((button) => button.getBoundingClientRect().width > 0),
    };
  })()`);
  initial.checks.compactNav = Object.values(compact).every(Boolean);
  initial.passed = Object.values(initial.checks).every(Boolean);
  initial.diagnostics.compact = compact;

  process.stdout.write(`${JSON.stringify(initial, null, 2)}\n`);
  window.destroy();
  app.exit(initial.passed ? 0 : 1);
}).catch((error) => {
  console.error(error);
  app.exit(1);
});
