// nt-lowlevel.ts
// Low-level NT publish/subscribe wrapper on top of socket/messenger and socket/socket
// Usage: import { createClient } from './nt-lowlevel'; const client = createClient('ws://10.57.12.2:5810');

import EventEmitter from "events";

/**
 * Replace these imports with the real modules from ntcore-ts-client:
 *
 * import { Messenger } from "ntcore-ts-client/socket/messenger";
 * import { Socket } from "ntcore-ts-client/socket/socket";
 *
 * If names differ, adapt in connect().
 */
import { Socket as NtSocket } from "ntcore-ts-client/socket/socket";
import { Messenger as NtMessenger } from "ntcore-ts-client/socket/messenger";

/* ---------------------------
   Types
   --------------------------- */

export type NTType =
  | "boolean"
  | "double"
  | "string"
  | "string[]"
  | "double[]"
  | "raw"
  | string; // allow extension

export interface PublishOptions {
  persistent?: boolean;
  retained?: boolean;
  id?: number;
}

export interface Subscriber {
  topic: string;
  type: NTType;
  callback: (value: any) => void;
}

/* ---------------------------
   Internal message shapes
   --------------------------- */

/**
 * NOTE:
 * The exact shape of messages depends on the ntcore-ts-client messenger/socket impl.
 * Here we assume a minimal JSON-ish message envelope with {type, topic, payload, pubuid, props}
 * Adjust the serialization/deserialization to match your project's wire formats.
 */

/* ---------------------------
   NTClient implementation
   --------------------------- */

export class NTClient extends EventEmitter {
  private uri: string;
  private socket?: InstanceType<typeof NtSocket>;
  private messenger?: InstanceType<typeof NtMessenger>;

  private connected = false;
  private publishers = new Map<
    string,
    {
      pubuid: number | null;
      pendingAck: boolean;
      resolveAck?: () => void;
      rejectAck?: (err: any) => void;
    }
  >();
  private subscribers = new Map<string, Subscriber[]>();

  // queues messages while disconnected
  private outgoingQueue: any[] = [];
  private nextPubUid = 1;

  constructor(uri: string) {
    super();
    this.uri = uri;
  }

  // connect/start the socket + messenger
  async start() {
    // Construct socket and messenger according to your socket implementation
    this.socket = new NtSocket(this.uri);

    // If your NtSocket has start() or connect() call it:
    if (typeof (this.socket as any).start === "function") {
      (this.socket as any).start();
    } else if (typeof (this.socket as any).connect === "function") {
      (this.socket as any).connect();
    }

    // Create messenger wrapper around the socket
    this.messenger = new NtMessenger(this.socket as any);

    // wire message events
    this.messenger.on("open", () => this.onOpen());
    this.messenger.on("close", () => this.onClose());
    this.messenger.on("error", (e: any) => this.onError(e));
    this.messenger.on("message", (m: any) => this.onMessage(m));

    // If messenger supports start/handshake, call it
    if (typeof (this.messenger as any).start === "function") {
      await (this.messenger as any).start();
    }
  }

  // Close connection and cleanup
  close() {
    if (this.messenger && typeof (this.messenger as any).close === "function")
      (this.messenger as any).close();
    if (this.socket && typeof (this.socket as any).close === "function")
      (this.socket as any).close();
    this.connected = false;
    this.emit("close");
  }

  isConnected() {
    return this.connected;
  }

  /* ---------------------------
     Publish API
     --------------------------- */

  /**
   * publish: announces the topic and waits for server ack.
   * returns a promise that resolves when the server acknowledges and the topic becomes published.
   */
  async publish(
    topic: string,
    type: NTType,
    options: PublishOptions = {}
  ): Promise<number> {
    // ensure leading slash
    if (!topic.startsWith("/")) topic = `/${topic}`;

    const existing = this.publishers.get(topic);
    if (existing && existing.pubuid) return existing.pubuid;

    // create publisher record
    const pubuid = options.id ?? this.nextPubUid++;
    this.publishers.set(topic, {
      pubuid,
      pendingAck: true,
    });

    // send announce message (wire format may differ)
    const announceMsg = {
      type: "announce", // adjust if your messenger expects other name
      topic,
      nt_type: type,
      props: {
        persistent: !!options.persistent,
        retained: options.retained !== false, // default true
      },
      pubuid,
    };

    // queue/send
    this.sendRaw(announceMsg);

    // return promise that resolves when ack received
    return await new Promise<number>((resolve, reject) => {
      const rec = this.publishers.get(topic);
      if (!rec) return reject(new Error("publisher record vanished"));

      rec.resolveAck = () => {
        rec!.pendingAck = false;
        resolve(pubuid);
      };
      rec.rejectAck = (err: any) => {
        rec!.pendingAck = false;
        reject(err);
      };

      // fallback timeout (3s default to mirror library behavior)
      setTimeout(() => {
        const r = this.publishers.get(topic);
        if (r && r.pendingAck) {
          r.rejectAck && r.rejectAck(new Error("announce timed out (3s)"));
        }
      }, 3000);
    });
  }

  /**
   * setValue: publish a new value for a topic. Ensures announce/ack before sending value.
   */
  async setValue(topic: string, value: any, type?: NTType) {
    if (!topic.startsWith("/")) topic = `/${topic}`;

    const p = this.publishers.get(topic);
    if (!p || p.pendingAck) {
      // If not published yet, attempt publish using provided type or default to 'string'
      await this.publish(topic, type ?? inferType(value)).catch((err) => {
        // if publish fails, rethrow
        throw err;
      });
    }

    // send a set_value message
    const msg = {
      type: "set_value",
      topic,
      pubuid: this.publishers.get(topic)!.pubuid,
      value,
    };
    this.sendRaw(msg);
  }

  /* ---------------------------
     Subscribe API
     --------------------------- */

  subscribe(topic: string, type: NTType, callback: (value: any) => void) {
    if (!topic.startsWith("/")) topic = `/${topic}`;
    const arr = this.subscribers.get(topic) ?? [];
    arr.push({ topic, type, callback });
    this.subscribers.set(topic, arr);

    // send subscribe request to server (wire format may differ)
    this.sendRaw({ type: "subscribe", topic, nt_type: type });
    return () => this.unsubscribe(topic, callback);
  }

  unsubscribe(topic: string, callback?: (v: any) => void) {
    if (!topic.startsWith("/")) topic = `/${topic}`;
    const arr = this.subscribers.get(topic);
    if (!arr) return;
    if (!callback) {
      this.subscribers.delete(topic);
    } else {
      const filtered = arr.filter((s) => s.callback !== callback);
      if (filtered.length === 0) this.subscribers.delete(topic);
      else this.subscribers.set(topic, filtered);
    }
    this.sendRaw({ type: "unsubscribe", topic });
  }

  /* ---------------------------
     Internal: message and socket handlers
     --------------------------- */

  private onOpen() {
    this.connected = true;
    this.emit("open");
    // flush queue
    while (this.outgoingQueue.length) {
      const m = this.outgoingQueue.shift();
      this._emitToMessenger(m);
    }

    // re-subscribe all topics (if any)
    for (const [t, subs] of this.subscribers) {
      const nt_type = subs[0].type;
      this.sendRaw({ type: "subscribe", topic: t, nt_type });
    }
  }

  private onClose() {
    this.connected = false;
    this.emit("close");
  }

  private onError(err: any) {
    this.emit("error", err);
  }

  private onMessage(raw: any) {
    // parse raw message, handle ack/announce responses/value updates
    const msg = raw; // assume messenger already gives parsed object
    if (!msg || typeof msg !== "object") return;

    switch (msg.type) {
      case "announce_response": {
        // server acknowledged an announce; msg.topic and msg.pubuid present
        const t = msg.topic;
        const pubuid = msg.pubuid;
        const rec = this.publishers.get(t);
        if (rec) {
          rec.pubuid = pubuid;
          rec.pendingAck = false;
          rec.resolveAck && rec.resolveAck();
        } else {
          // If no rec, create one
          this.publishers.set(t, { pubuid, pendingAck: false });
        }
        break;
      }
      case "announce": {
        // server telling us a topic exists - could be used to populate local state
        // msg.topic, msg.nt_type, msg.props
        this.emit("topicAnnounced", msg.topic, msg.nt_type, msg.props);
        break;
      }
      case "value": {
        // server sending a value update (subscription)
        const t = msg.topic;
        const value = msg.value;
        const subs = this.subscribers.get(t);
        if (subs) {
          for (const s of subs) {
            try {
              s.callback(value);
            } catch (e) {
              console.error("subscriber callback error", e);
            }
          }
        }
        break;
      }
      case "publish_response": {
        // alternative response name - some brokers name it differently
        const t = msg.topic;
        const pubuid = msg.pubuid;
        const rec = this.publishers.get(t);
        if (rec) {
          rec.pubuid = pubuid;
          rec.pendingAck = false;
          rec.resolveAck && rec.resolveAck();
        }
        break;
      }
      default:
        // unknown message types forwarded to user
        this.emit("raw", msg);
    }
  }

  private sendRaw(msg: any) {
    if (!this.messenger) {
      // queue until messenger is ready
      this.outgoingQueue.push(msg);
      return;
    }
    // Messenger likely has a send method
    this._emitToMessenger(msg);
  }

  private _emitToMessenger(msg: any) {
    try {
      if (!this.messenger) throw new Error("messenger missing");
      if (typeof (this.messenger as any).send === "function") {
        (this.messenger as any).send(msg);
      } else if (typeof (this.messenger as any).emit === "function") {
        // fallback: if messenger expects 'message' event
        (this.messenger as any).emit("message", msg);
      } else {
        // last resort: directly use socket
        if (this.socket && typeof (this.socket as any).send === "function") {
          (this.socket as any).send(JSON.stringify(msg));
        } else {
          console.warn("no send method available for messenger/socket");
        }
      }
    } catch (err) {
      console.error("send failed", err);
      // queue if disconnected
      this.outgoingQueue.push(msg);
    }
  }
}

/* ---------------------------
   Helpers
   --------------------------- */

function inferType(v: any): NTType {
  if (typeof v === "boolean") return "boolean";
  if (typeof v === "number") return "double";
  if (typeof v === "string") return "string";
  if (Array.isArray(v)) {
    if (v.length === 0) return "string[]";
    const first = v[0];
    if (typeof first === "string") return "string[]";
    if (typeof first === "number") return "double[]";
    return "string[]";
  }
  return "raw";
}

/* ---------------------------
   Factory
   --------------------------- */

export function createClient(uri: string) {
  const c = new NTClient(uri);
  return c;
}
