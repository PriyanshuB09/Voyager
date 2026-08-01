import { decodeMulti, encode } from "@msgpack/msgpack";

export interface DirectNt4Topic {
  id: number;
  name: string;
  type: string;
  properties: Record<string, unknown>;
}

export interface DirectNt4ClientOptions {
  address: string;
  driverStationTopic: string;
  odometryTopic: string;
  measuredChassisSpeedsTopic: string | null;
  setpointChassisSpeedsTopic: string | null;
  onConnection: (connected: boolean) => void;
  onTopicAnnounce: (topic: DirectNt4Topic) => void;
  onTopicUnannounce: (topic: DirectNt4Topic) => void;
  onTopicValue: (topic: DirectNt4Topic, value: unknown) => void;
}

interface AnnounceMessage {
  method: "announce";
  params: {
    id: number;
    name: string;
    type: string;
    properties?: Record<string, unknown>;
  };
}

interface UnannounceMessage {
  method: "unannounce";
  params: { id: number; name: string };
}

type ControlMessage = AnnounceMessage | UnannounceMessage | { method: string; params?: unknown };

const SELECTED_AUTO_TOPIC = "/Voyager/SelectedAuto";
const NT4_PORT = 5810;
const RECONNECT_DELAY_MS = 500;
const CONNECTION_TIMEOUT_MS = 4000;

function endpointFromAddress(address: string): { host: string; port: number } {
  const trimmed = address.trim().replace(/^wss?:\/\//i, "").split("/")[0];
  if (/^\d+$/.test(trimmed)) {
    const team = trimmed.padStart(4, "0").slice(-4);
    return { host: `10.${Number(team.slice(0, 2))}.${Number(team.slice(2))}.2`, port: NT4_PORT };
  }
  const ipv6 = trimmed.match(/^\[([^\]]+)](?::(\d{1,5}))?$/);
  if (ipv6) return { host: `[${ipv6[1]}]`, port: ipv6[2] ? Number(ipv6[2]) : NT4_PORT };
  const match = trimmed.match(/^(.+):(\d{1,5})$/);
  return match ? { host: match[1], port: Number(match[2]) } : { host: trimmed || "localhost", port: NT4_PORT };
}

function isControlMessage(value: unknown): value is ControlMessage {
  return Boolean(value && typeof value === "object" && typeof (value as { method?: unknown }).method === "string");
}

function isAnnounce(message: ControlMessage): message is AnnounceMessage {
  if (message.method !== "announce" || !message.params || typeof message.params !== "object") return false;
  const params = message.params as Record<string, unknown>;
  return Number.isInteger(params.id) && typeof params.name === "string" && typeof params.type === "string";
}

function isUnannounce(message: ControlMessage): message is UnannounceMessage {
  if (message.method !== "unannounce" || !message.params || typeof message.params !== "object") return false;
  const params = message.params as Record<string, unknown>;
  return Number.isInteger(params.id) && typeof params.name === "string";
}

export class DirectNt4Client {
  private readonly options: DirectNt4ClientOptions;
  private readonly url: string;
  private readonly topicsById = new Map<number, DirectNt4Topic>();
  private socket: WebSocket | null = null;
  private reconnectTimer: number | null = null;
  private disposed = false;
  private nextUid = Math.floor(Math.random() * 100_000) + 1;
  private selectedAutoPublished = false;
  private connectionWaiters = new Set<(connected: boolean) => void>();

  constructor(options: DirectNt4ClientOptions) {
    this.options = options;
    const endpoint = endpointFromAddress(options.address);
    const clientId = Math.floor(Math.random() * 99_999_999);
    this.url = `ws://${endpoint.host}:${endpoint.port}/nt/Voyager_${clientId}`;
  }

  connect(): void {
    if (this.disposed || this.socket?.readyState === WebSocket.OPEN || this.socket?.readyState === WebSocket.CONNECTING) return;
    const socket = new WebSocket(this.url, [
      "v4.1.networktables.first.wpi.edu",
      "v4.0.networktables.first.wpi.edu",
    ]);
    socket.binaryType = "arraybuffer";
    this.socket = socket;

    socket.addEventListener("open", () => {
      if (this.disposed || this.socket !== socket) return;
      this.selectedAutoPublished = false;
      this.selectedAutoPubuid = 0;
      this.options.onConnection(true);
      this.connectionWaiters.forEach((waiter) => waiter(true));
      this.connectionWaiters.clear();
      this.sendSubscriptions();
    });
    socket.addEventListener("message", (event) => {
      if (this.disposed || this.socket !== socket) return;
      if (typeof event.data === "string") this.handleTextFrame(event.data);
      else if (event.data instanceof ArrayBuffer || ArrayBuffer.isView(event.data)) this.handleBinaryFrame(event.data);
    });
    socket.addEventListener("close", () => {
      if (this.socket === socket) this.socket = null;
      this.clearAnnouncedTopics();
      this.options.onConnection(false);
      if (!this.disposed) this.reconnectTimer = window.setTimeout(() => this.connect(), RECONNECT_DELAY_MS);
    });
    socket.addEventListener("error", () => socket.close());
  }

  disconnect(): void {
    this.disposed = true;
    if (this.reconnectTimer !== null) window.clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
    this.connectionWaiters.forEach((waiter) => waiter(false));
    this.connectionWaiters.clear();
    this.clearAnnouncedTopics();
    this.socket?.close();
    this.socket = null;
    this.options.onConnection(false);
  }

  async publishRoutine(routineCode: string): Promise<void> {
    const connected = await this.waitForConnection();
    if (!connected || !this.socket || this.socket.readyState !== WebSocket.OPEN) {
      throw new Error("The direct NT4 client is not connected.");
    }
    if (!this.selectedAutoPublished) {
      const pubuid = this.nextUid++;
      this.sendControl({
        method: "publish",
        params: {
          name: SELECTED_AUTO_TOPIC,
          type: "string",
          pubuid,
          properties: { retained: true },
        },
      });
      this.selectedAutoPublished = true;
      this.selectedAutoPubuid = pubuid;
    }
    this.socket.send(encode([this.selectedAutoPubuid, 0, 4, routineCode]));
  }

  private selectedAutoPubuid = 0;

  private waitForConnection(): Promise<boolean> {
    if (this.socket?.readyState === WebSocket.OPEN) return Promise.resolve(true);
    return new Promise((resolve) => {
      let completed = false;
      const finish = (connected: boolean): void => {
        if (completed) return;
        completed = true;
        window.clearTimeout(timeout);
        this.connectionWaiters.delete(finish);
        resolve(connected);
      };
      const timeout = window.setTimeout(() => finish(false), CONNECTION_TIMEOUT_MS);
      this.connectionWaiters.add(finish);
    });
  }

  private sendSubscriptions(): void {
    this.sendControl({
      method: "subscribe",
      params: { topics: ["/"], subuid: this.nextUid++, options: { prefix: true, topicsonly: true } },
    });
    this.sendControl({
      method: "subscribe",
      params: { topics: [this.options.driverStationTopic], subuid: this.nextUid++, options: { periodic: 0.1 } },
    });
    const fastTopics = [
      this.options.odometryTopic,
      this.options.measuredChassisSpeedsTopic,
      this.options.setpointChassisSpeedsTopic,
    ].filter((topic): topic is string => Boolean(topic));
    this.sendControl({
      method: "subscribe",
      params: { topics: [...new Set(fastTopics)], subuid: this.nextUid++, options: { periodic: 0.02 } },
    });
  }

  private sendControl(message: Record<string, unknown>): void {
    if (this.socket?.readyState === WebSocket.OPEN) this.socket.send(JSON.stringify([message]));
  }

  private clearAnnouncedTopics(): void {
    if (this.topicsById.size === 0) return;
    const topics = [...this.topicsById.values()];
    this.topicsById.clear();
    topics.forEach((topic) => this.options.onTopicUnannounce(topic));
  }

  private handleTextFrame(frame: string): void {
    let decoded: unknown;
    try {
      decoded = JSON.parse(frame);
    } catch {
      return;
    }
    if (!Array.isArray(decoded)) return;
    decoded.forEach((value) => {
      if (!isControlMessage(value)) return;
      if (isAnnounce(value)) {
        const topic: DirectNt4Topic = {
          id: value.params.id,
          name: value.params.name,
          type: value.params.type,
          properties: value.params.properties ?? {},
        };
        this.topicsById.set(topic.id, topic);
        this.options.onTopicAnnounce(topic);
      } else if (isUnannounce(value)) {
        const topic = this.topicsById.get(value.params.id) ?? {
          id: value.params.id,
          name: value.params.name,
          type: "unknown",
          properties: {},
        };
        this.topicsById.delete(value.params.id);
        this.options.onTopicUnannounce(topic);
      }
    });
  }

  private handleBinaryFrame(frame: ArrayBuffer | ArrayBufferView): void {
    try {
      for (const decoded of decodeMulti(frame instanceof ArrayBuffer ? new Uint8Array(frame) : new Uint8Array(frame.buffer, frame.byteOffset, frame.byteLength))) {
        if (!Array.isArray(decoded) || decoded.length !== 4) continue;
        const topicId = Number(decoded[0]);
        if (!Number.isInteger(topicId) || topicId < 0) continue;
        const topic = this.topicsById.get(topicId);
        if (topic) this.options.onTopicValue(topic, decoded[3]);
      }
    } catch (error) {
      console.warn("Voyager ignored a malformed NT4 binary frame.", error);
    }
  }
}
