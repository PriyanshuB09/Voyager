// src/lib/CSPNetwork.tsx
import React, { createContext, useContext, useEffect, useRef, useState, ReactNode } from "react";

/* ================================
   Types
================================ */
export type CSPNTOptions = {
  simulation?: boolean;
  teamNumber?: number;
  teamIP?: string;
  port?: number; // default 5810
};

export type NTType =
  | "string"
  | "number"
  | "boolean"
  | "string[]"
  | "number[]"
  | "boolean[]";

type SubscriberCallback<T> = (v: T) => void;
type PendingPublish = { topic: string; value: any; type: NTType };

/* ================================
   NT4 Binary Opcodes
================================ */
const OPCODE_CLIENT_HELLO = 0x01;
const OPCODE_SERVER_HELLO = 0x02;
const OPCODE_PUBLISH = 0x03;

/* ================================
   Binary Helpers
================================ */
function encodeValue(type: NTType, value: any): ArrayBuffer {
  switch (type) {
    case "number":
      const buf = new ArrayBuffer(8);
      new DataView(buf).setFloat64(0, value, true);
      return buf;
    case "boolean":
      return Uint8Array.of(value ? 1 : 0).buffer;
    case "string":
      const enc = new TextEncoder();
      return new Uint8Array(enc.encode(value)).buffer;
    case "number[]":
      const arrBuf = new ArrayBuffer(4 + 8 * value.length);
      const view = new DataView(arrBuf);
      view.setUint32(0, value.length, true);
      value.forEach((v: number, i: number) => view.setFloat64(4 + i * 8, v, true));
      return arrBuf;
    case "boolean[]":
      const bArr = new ArrayBuffer(4 + value.length);
      const bView = new DataView(bArr);
      bView.setUint32(0, value.length, true);
      value.forEach((v: boolean, i: number) => bView.setUint8(4 + i, v ? 1 : 0));
      return bArr;
    case "string[]":
      // simple concatenation with length prefixes
      const encodedStrings = value.map((s: string) => {
        const encStr = new TextEncoder().encode(s);
        const bufStr = new ArrayBuffer(4 + encStr.byteLength);
        new DataView(bufStr).setUint32(0, encStr.byteLength, true);
        new Uint8Array(bufStr).set(encStr, 4);
        return bufStr;
      });
      const totalLength = encodedStrings.reduce((acc: any, buf: { byteLength: any; }) => acc + buf.byteLength, 0);
      const finalBuf = new ArrayBuffer(totalLength);
      let offset = 0;
      encodedStrings.forEach((buf: { byteLength: number; }) => {
        new Uint8Array(finalBuf).set(new Uint8Array(buf as ArrayBuffer), offset);
        offset += buf.byteLength;
      });
      return finalBuf;
  }
}

/* ================================
   CSPNTClient
================================ */
class CSPNTClient {
  private ws?: WebSocket;
  private connected = false;
  private reconnectTimer?: number;
  private heartbeatTimer?: number;
  private clientId = 1;
  private subscribers = new Map<string, Set<SubscriberCallback<any>>>();
  private connectionListeners = new Set<(connected: boolean) => void>();
  private pendingPublishes: PendingPublish[] = [];

  constructor(private options: CSPNTOptions) {}

  connect() {
    const url = this.buildUrl();
    this.ws = new WebSocket(url);
    this.ws.binaryType = "arraybuffer";

    this.ws.onopen = () => {
      this.connected = true;
      console.log("[CSPNT] ✅ Connected");
    
      if (this.reconnectTimer) {
        clearInterval(this.reconnectTimer);
        this.reconnectTimer = undefined;
      }
    
      this.sendHandshake();
      this.flushPendingPublishes();
      this.connectionListeners.forEach((cb) => cb(true));
      this.startHeartbeat();
    };
    

    this.ws.onclose = (event) => {
      if (!this.connected) return; // already disconnected or reconnecting
      this.connected = false;
      console.warn("[CSPNT] ⚠️ Disconnected");
    
      // Stop heartbeat immediately
      this.stopHeartbeat();
    
      // Notify listeners
      this.connectionListeners.forEach((cb) => cb(false));
    
      // Attempt reconnect only if not already scheduled
      if (!this.reconnectTimer) {
        this.reconnectTimer = window.setInterval(() => {
          console.log("[CSPNT] 🔁 Retrying connection...");
          this.connect();
        }, 2000);
      }
    };
    

    this.ws.onerror = (err) => {
      console.error("[CSPNT] WebSocket error", err);
      this.ws?.close();
    };

    this.ws.onmessage = (event) => {
      if (!(event.data instanceof ArrayBuffer)) return;
      this.handleFrame(event.data);
    };
  }

  private buildUrl(): string {
    const port = this.options.port || 5810;
    if (this.options.simulation) return `ws://127.0.0.1:${port}`;
    if (this.options.teamIP) return `ws://${this.options.teamIP}:${port}`;
    if (this.options.teamNumber) {
      const tn = this.options.teamNumber.toString().padStart(4, "0");
      return `ws://roborio-${tn}-local:${port}`;
    }
    return `ws://127.0.0.1:${port}`;
  }

  private tryReconnect() {
    if (this.reconnectTimer) return;
    this.reconnectTimer = window.setInterval(() => {
      console.log("[CSPNT] 🔁 Retrying connection...");
      this.connect();
    }, 2000);
  }

  private startHeartbeat() {
    this.heartbeatTimer = window.setInterval(() => this.sendHandshake(), 2000);
  }

  private stopHeartbeat() {
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    this.heartbeatTimer = undefined;
  }

  private sendHandshake() {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    const buf = new ArrayBuffer(6);
    const view = new DataView(buf);
    view.setUint8(0, OPCODE_CLIENT_HELLO);
    view.setUint32(1, this.clientId, true);
    view.setUint8(5, 0);
    this.ws.send(buf);
  }

  private handleFrame(frame: ArrayBuffer) {
    const view = new DataView(frame);
    const opcode = view.getUint8(0);

    if (opcode === OPCODE_PUBLISH) {
      const decoder = new TextDecoder();
      const json = decoder.decode(frame.slice(1));
      try {
        const msg = JSON.parse(json);
        if (msg.topic && this.subscribers.has(msg.topic)) {
          for (const cb of this.subscribers.get(msg.topic)!) cb(msg.value);
        }
      } catch {}
    }
  }

  onConnectionChange(cb: (connected: boolean) => void) {
    this.connectionListeners.add(cb);
    cb(this.connected);
    return () => this.connectionListeners.delete(cb);
  }

  subscribe<T>(topic: string, cb: SubscriberCallback<T>) {
    let set = this.subscribers.get(topic);
    if (!set) {
      set = new Set();
      this.subscribers.set(topic, set);
    }
    set.add(cb);
    return () => set!.delete(cb);
  }

  publish(topic: string, value: any, type: NTType) {
    if (!this.connected || !this.ws) {
      this.pendingPublishes.push({ topic, value, type });
      return;
    }
    const valueBuf = encodeValue(type, value);
    const frame = new Uint8Array(1 + valueBuf.byteLength);
    frame[0] = OPCODE_PUBLISH;
    frame.set(new Uint8Array(valueBuf), 1);
    this.ws.send(frame);
  }

  private flushPendingPublishes() {
    while (this.pendingPublishes.length > 0) {
      const { topic, value, type } = this.pendingPublishes.shift()!;
      this.publish(topic, value, type);
    }
  }
}

/* ================================
   CSPNTProvider Singleton
================================ */
const CSPNTContext = createContext<CSPNTClient | null>(null);

export const CSPNTProvider: React.FC<{ options: CSPNTOptions; children: ReactNode }> = ({
  options,
  children,
}) => {
  const clientRef = useRef<CSPNTClient | null>(null);
  if (!clientRef.current) {
    clientRef.current = new CSPNTClient(options);
    clientRef.current.connect();
  }
  return <CSPNTContext.Provider value={clientRef.current}>{children}</CSPNTContext.Provider>;
};

function useClient(): CSPNTClient {
  const client = useContext(CSPNTContext);
  if (!client) throw new Error("CSPNTProvider must wrap your component tree!");
  return client;
}

/* ================================
   React Hooks
================================ */
// export function useCSPNTConnection(): boolean {
//   const client = useClient();
//   const [connected, setConnected] = useState(false);
//   useEffect(() => {
//     const unsubscribe = client.onConnectionChange(setConnected);
//     return () => unsubscribe();
//   }, [client]);
//   return connected;
// }

export function useCSPNTValue<T>(topic: string, defaultValue: T, type: NTType): T {
  const client = useClient();
  const [value, setValue] = useState(defaultValue);

  useEffect(() => {
    const unsub = client.subscribe<T>(topic, (v) => setValue(v));
    client.publish(topic, defaultValue, type);
    return () => {
      unsub();
    };
  }, [topic, client, defaultValue, type]);

  return value;
}

export function useCSPNTState<T>(topic: string, defaultValue: T, type: NTType): [T, (v: T) => void] {
  const client = useClient();
  const [value, setValue] = useState(defaultValue);

  useEffect(() => {
    const unsub = client.subscribe<T>(topic, (v) => setValue(v));
    client.publish(topic, defaultValue, type);
    return () => {
      unsub();
    };
  }, [topic]);

  const setAndPublish = (v: T) => {
    setValue(v);
    client.publish(topic, v, type);
  };

  return [value, setAndPublish];
}
