import { encode } from "@msgpack/msgpack";
import { app, BrowserWindow } from "electron";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { WebSocketServer } from "ws";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectDirectory = path.resolve(scriptDirectory, "..");
const screenshotPath = path.join(projectDirectory, "artifacts", "live-chassis-speeds.png");
const topics = [
  { id: 1, name: "/AdvantageKit/DriverStation/DSAttached", type: "boolean", typeIndex: 0 },
  { id: 2, name: "/AdvantageKit/RealOutputs/Odometry/Robot", type: "raw", typeIndex: 5 },
  { id: 3, name: "/Swerve/MeasuredChassisSpeeds", type: "raw", typeIndex: 5 },
  { id: 4, name: "/Swerve/SetpointChassisSpeeds", type: "raw", typeIndex: 5 },
];

function threeDoubles(first, second, third) {
  const buffer = new ArrayBuffer(24);
  const view = new DataView(buffer);
  view.setFloat64(0, first, true);
  view.setFloat64(8, second, true);
  view.setFloat64(16, third, true);
  return new Uint8Array(buffer);
}

const server = new WebSocketServer({
  port: 5810,
  handleProtocols(protocols) {
    if (protocols.has("v4.1.networktables.first.wpi.edu")) return "v4.1.networktables.first.wpi.edu";
    if (protocols.has("networktables.first.wpi.edu")) return "networktables.first.wpi.edu";
    return protocols.values().next().value;
  },
});

let poseX = 1;
const sockets = new Map();

server.on("connection", (socket) => {
  sockets.set(socket, performance.now());
  socket.on("close", () => sockets.delete(socket));
  socket.send(JSON.stringify(topics.map((topic) => ({
    method: "announce",
    params: { name: topic.name, id: topic.id, type: topic.type, properties: {} },
  }))));
});

const broadcast = setInterval(() => {
  poseX += 0.025;
  const timestamp = Math.round(performance.now() * 1000);
  sockets.forEach((connectedAt, socket) => {
    if (socket.readyState !== socket.OPEN) return;
    const slipping = performance.now() - connectedAt < 3000;
    const values = [
      [1, timestamp, 0, true],
      [2, timestamp, 5, threeDoubles(poseX, 2, 0.15)],
      [3, timestamp, 5, threeDoubles(0.3, 0.2, 0.75)],
      [4, timestamp, 5, threeDoubles(slipping ? 2.2 : 0.3, slipping ? -0.4 : 0.2, slipping ? 1.8 : 0.75)],
    ];
    values.forEach((value) => socket.send(encode(value)));
  });
}, 20);

async function closeServer() {
  clearInterval(broadcast);
  sockets.forEach((_connectedAt, socket) => socket.close());
  await new Promise((resolve) => server.close(resolve));
}

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
      partition: "voyager-telemetry-test",
    },
  });
  await window.loadFile(path.join(projectDirectory, "out/renderer/index.html"));
  await window.webContents.executeJavaScript("localStorage.setItem('voyager.nt4.address', 'localhost')");
  await window.webContents.reload();

  const result = await window.webContents.executeJavaScript(`(async () => {
    const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));
    const setReactInput = (input, value) => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
      setter.call(input, value);
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
    };
    const waitFor = async (test, timeout = 5000) => {
      const started = performance.now();
      while (performance.now() - started < timeout) {
        if (test()) return true;
        await wait(50);
      }
      return false;
    };

    document.querySelectorAll('.workspace-tabs button').item(1).click();
    await waitFor(() => document.querySelector('.live-workspace'));
    const directConnected = await waitFor(() => document.querySelector('.connection-dot.connected'));
    const directTopics = await waitFor(() => Number(document.querySelector('.topic-count strong')?.textContent ?? 0) >= 4);

    const selectTopic = async (pickerIndex, topicName) => {
      const picker = document.querySelectorAll('.topic-picker').item(pickerIndex);
      [...picker.querySelectorAll('.topic-picker-control button')].find((button) => button.textContent.trim() === 'Browse').click();
      await wait(60);
      const search = picker.querySelector('.topic-browser-toolbar input');
      setReactInput(search, topicName);
      await wait(80);
      const result = [...picker.querySelectorAll('.topic-search-result')].find((button) => button.textContent.includes(topicName));
      if (!result) throw new Error('Topic browser did not find ' + topicName);
      result.click();
      await wait(120);
    };
    await selectTopic(2, '/Swerve/MeasuredChassisSpeeds');
    await selectTopic(3, '/Swerve/SetpointChassisSpeeds');

    const directAnomaly = await waitFor(() => document.querySelector('.traction-banner.is-anomaly'));
    const directFrame = Boolean(document.querySelector('.live-robot-marker.is-anomaly'));
    const directTrail = await waitFor(() => document.querySelector('path.live-pose-trail.is-anomaly'));
    const measuredVector = Boolean(document.querySelector('.chassis-speed-vector.is-measured .translation-vector')
      && document.querySelector('.chassis-speed-vector.is-measured .rotation-vector'));
    const setpointVector = Boolean(document.querySelector('.chassis-speed-vector.is-setpoint .translation-vector')
      && document.querySelector('.chassis-speed-vector.is-setpoint .rotation-vector'));
    const speedLegend = document.querySelectorAll('.speed-readout').length === 2
      && document.querySelector('.speed-readout.is-measured')?.textContent.includes('vx')
      && document.querySelector('.speed-readout.is-setpoint')?.textContent.includes('rad/s');

    document.querySelectorAll('.transport-switch button').item(1).click();
    const fwcSelected = await waitFor(() => document.querySelectorAll('.transport-switch button').item(1).classList.contains('is-active'));
    const fwcConnected = await waitFor(() => document.querySelector('.connection-dot.connected'));
    const fwcTopics = await waitFor(() => Number(document.querySelector('.topic-count strong')?.textContent ?? 0) >= 4);
    const fwcAnomaly = await waitFor(() => document.querySelector('.traction-banner.is-anomaly'));
    const fwcRecovered = await waitFor(() => !document.querySelector('.traction-banner.is-anomaly'), 5500);
    const recoveredFrame = !document.querySelector('.live-robot-marker.is-anomaly');

    return {
      checks: { directConnected, directTopics, directAnomaly, directFrame, directTrail, measuredVector, setpointVector, speedLegend, fwcSelected, fwcConnected, fwcTopics, fwcAnomaly, fwcRecovered, recoveredFrame },
      passed: [directConnected, directTopics, directAnomaly, directFrame, directTrail, measuredVector, setpointVector, speedLegend, fwcSelected, fwcConnected, fwcTopics, fwcAnomaly, fwcRecovered, recoveredFrame].every(Boolean),
      topicCount: Number(document.querySelector('.topic-count strong')?.textContent ?? 0),
      status: document.querySelector('.traction-banner strong')?.textContent ?? null,
    };
  })()`);

  const image = await window.webContents.capturePage();
  await mkdir(path.dirname(screenshotPath), { recursive: true });
  await writeFile(screenshotPath, image.toPNG());
  process.stdout.write(`${JSON.stringify({ ...result, screenshotPath }, null, 2)}\n`);
  window.destroy();
  await closeServer();
  process.exit(result.passed ? 0 : 1);
}).catch(async (error) => {
  console.error(error);
  await closeServer();
  app.exit(1);
});
