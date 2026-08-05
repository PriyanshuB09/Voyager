/**
 * Copyright (c) 2026 Priyanshu Biswal
 * SPDX-License-Identifier: MIT
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

export type TelemetryTransport = "direct" | "frc-web-components";

export interface TelemetryConfiguration {
  transport: TelemetryTransport;
  driverStationTopic: string;
  odometryTopic: string;
  measuredChassisSpeedsTopic: string | null;
  setpointChassisSpeedsTopic: string | null;
}

export interface TelemetryTopicInfo {
  name: string;
  type: string;
}

export interface Pose2d {
  x: number;
  y: number;
  rotation: number;
}

export interface LiveVelocity {
  vx: number;
  vy: number;
  omega: number;
}

export interface ChassisSpeeds {
  vx: number;
  vy: number;
  omega: number;
}

export interface LiveTrailPoint extends Pose2d {
  anomaly: boolean;
}

export interface TractionAnomaly {
  active: boolean;
  reason: "collision-or-slip" | null;
  linearError: number;
  angularError: number;
}

export interface LiveTelemetryState {
  serverConnected: boolean;
  connected: boolean;
  pose: Pose2d;
  trail: LiveTrailPoint[];
  velocity: LiveVelocity;
  measuredSpeeds: ChassisSpeeds | null;
  setpointSpeeds: ChassisSpeeds | null;
  anomaly: TractionAnomaly;
}

interface TelemetryContextValue extends LiveTelemetryState {
  topics: TelemetryTopicInfo[];
  transportError: string | null;
  configure: (configuration: TelemetryConfiguration) => void;
  publishRoutine: (routineCode: string) => Promise<void>;
}

interface TelemetryProviderProps {
  address: string;
  children: React.ReactNode;
}

interface ActiveTelemetryTransport {
  publishRoutine: (routineCode: string) => Promise<void>;
  dispose: () => void;
}

interface FwcTopic {
  name: string;
  type: string;
  properties: Record<string, unknown>;
}

interface FwcClient {
  connect: () => void;
  disconnect: () => void;
  subscribePeriodic: (topics: string[], prefix: boolean, period: number) => number;
  subscribeTopicsOnly: (topics: string[], prefix: boolean) => number;
  publishNewTopic: (topic: string, type: string) => void;
  setRetained: (topic: string, retained: boolean) => void;
  addSample: (topic: string, value: unknown) => void;
}

type FwcClientConstructor = new (
  address: string,
  applicationName: string,
  onTopicAnnounce: (topic: FwcTopic) => void,
  onTopicUnannounce: (topic: FwcTopic) => void,
  onNewTopicData: (topic: FwcTopic, timestampMicroseconds: number, value: unknown) => void,
  onConnect: () => void,
  onDisconnect: () => void,
) => FwcClient;

const EMPTY_POSE: Pose2d = Object.freeze({ x: 0, y: 0, rotation: 0 });
const EMPTY_VELOCITY: LiveVelocity = Object.freeze({ vx: 0, vy: 0, omega: 0 });
const EMPTY_ANOMALY: TractionAnomaly = Object.freeze({
  active: false,
  reason: null,
  linearError: 0,
  angularError: 0,
});
export const DEFAULT_TELEMETRY_CONFIGURATION: TelemetryConfiguration = Object.freeze({
  transport: "direct",
  driverStationTopic: "/AdvantageKit/DriverStation/DSAttached",
  odometryTopic: "/AdvantageKit/RealOutputs/Odometry/Robot",
  measuredChassisSpeedsTopic: null,
  setpointChassisSpeedsTopic: null,
});
const EMPTY_TELEMETRY: LiveTelemetryState = Object.freeze({
  serverConnected: false,
  connected: false,
  pose: EMPTY_POSE,
  trail: [],
  velocity: EMPTY_VELOCITY,
  measuredSpeeds: null,
  setpointSpeeds: null,
  anomaly: EMPTY_ANOMALY,
});
const LIVE_TRAIL_LIMIT = 700;
const POSE_UPDATE_PERIOD_SECONDS = 0.02;
const ANOMALY_TRIGGER_MS = 140;
const ANOMALY_CLEAR_MS = 320;
const SPEED_STALE_MS = 500;
const SELECTED_AUTO_TOPIC = "/Voyager/SelectedAuto";

const TelemetryContext = createContext<TelemetryContextValue | null>(null);

function normalizeTopicName(topic: string | null | undefined): string | null {
  const trimmed = topic?.trim();
  if (!trimmed) return null;
  return trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
}

function normalizeConfiguration(configuration: TelemetryConfiguration): TelemetryConfiguration {
  return {
    transport: configuration.transport === "frc-web-components" ? "frc-web-components" : "direct",
    driverStationTopic: normalizeTopicName(configuration.driverStationTopic)
      ?? DEFAULT_TELEMETRY_CONFIGURATION.driverStationTopic,
    odometryTopic: normalizeTopicName(configuration.odometryTopic)
      ?? DEFAULT_TELEMETRY_CONFIGURATION.odometryTopic,
    measuredChassisSpeedsTopic: normalizeTopicName(configuration.measuredChassisSpeedsTopic),
    setpointChassisSpeedsTopic: normalizeTopicName(configuration.setpointChassisSpeedsTopic),
  };
}

function configurationsEqual(left: TelemetryConfiguration, right: TelemetryConfiguration): boolean {
  return left.transport === right.transport
    && left.driverStationTopic === right.driverStationTopic
    && left.odometryTopic === right.odometryTopic
    && left.measuredChassisSpeedsTopic === right.measuredChassisSpeedsTopic
    && left.setpointChassisSpeedsTopic === right.setpointChassisSpeedsTopic;
}

function endpointFromAddress(address: string): { host: string; port?: number; team?: number } {
  if (/^\d+$/.test(address)) return { host: address, team: Number(address) };
  const match = address.match(/^(.+):(\d{1,5})$/);
  if (!match) return { host: address };
  return { host: match[1], port: Number(match[2]) };
}

function fwcHostsFromAddress(address: string): string[] {
  const endpoint = endpointFromAddress(address);
  if (!endpoint.team) return [endpoint.host];
  const team = String(endpoint.team).padStart(4, "0").slice(-4);
  const first = Number(team.slice(0, 2));
  const second = Number(team.slice(2));
  return [
    `10.${first}.${second}.2`,
    "172.22.11.2",
    `roborio-${team}-FRC.local`,
    `roborio-${team}-FRC.lan`,
    `roborio-${team}-FRC.frc-field.local`,
  ];
}

function valueAsArrayBuffer(value: unknown): ArrayBuffer | null {
  if (value instanceof ArrayBuffer) return value;
  if (ArrayBuffer.isView(value)) {
    return value.buffer.slice(value.byteOffset, value.byteOffset + value.byteLength) as ArrayBuffer;
  }
  return null;
}

function finiteTriple(values: readonly unknown[]): ChassisSpeeds | null {
  const vx = Number(values[0]);
  const vy = Number(values[1]);
  const omega = Number(values[2]);
  return Number.isFinite(vx) && Number.isFinite(vy) && Number.isFinite(omega)
    ? { vx, vy, omega }
    : null;
}

function decodeThreeDoubles(value: unknown): ChassisSpeeds | null {
  const buffer = valueAsArrayBuffer(value);
  if (!buffer || buffer.byteLength < 24) return null;
  const view = new DataView(buffer);
  return finiteTriple([
    view.getFloat64(0, true),
    view.getFloat64(8, true),
    view.getFloat64(16, true),
  ]);
}

function objectTriple(value: Record<string, unknown>): ChassisSpeeds | null {
  return finiteTriple([
    value.vxMetersPerSecond ?? value.vx ?? value.x,
    value.vyMetersPerSecond ?? value.vy ?? value.y,
    value.omegaRadiansPerSecond ?? value.omega ?? value.rotation,
  ]);
}

export function parseChassisSpeeds(value: unknown): ChassisSpeeds | null {
  const binary = decodeThreeDoubles(value);
  if (binary) return binary;
  if (Array.isArray(value)) return finiteTriple(value);
  if (value && typeof value === "object") return objectTriple(value as Record<string, unknown>);
  if (typeof value !== "string") return null;
  try {
    const parsed: unknown = JSON.parse(value);
    if (Array.isArray(parsed)) return finiteTriple(parsed);
    if (parsed && typeof parsed === "object") return objectTriple(parsed as Record<string, unknown>);
  } catch {
    const match = value.match(/Vx:\s*(-?[\d.eE+]+).*Vy:\s*(-?[\d.eE+]+).*Omega:\s*(-?[\d.eE+]+)/i);
    if (match) return finiteTriple(match.slice(1));
  }
  return null;
}

export function parsePose2d(value: unknown): Pose2d | null {
  const triple = parseChassisSpeeds(value);
  return triple ? { x: triple.vx, y: triple.vy, rotation: triple.omega } : null;
}

function booleanValue(value: unknown): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  return typeof value === "string" && value.toLowerCase() === "true";
}

function angleDeltaRadians(start: number, end: number): number {
  return ((end - start + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
}

function poseMovedEnough(previous: LiveTrailPoint | undefined, next: Pose2d, anomaly: boolean): boolean {
  if (!previous || previous.anomaly !== anomaly) return true;
  return Math.hypot(next.x - previous.x, next.y - previous.y) >= 0.015
    || Math.abs(angleDeltaRadians(previous.rotation, next.rotation)) >= Math.PI / 180;
}

function appendTrailPoint(trail: LiveTrailPoint[], pose: Pose2d, anomaly: boolean): LiveTrailPoint[] {
  if (!poseMovedEnough(trail.at(-1), pose, anomaly)) return trail;
  const point = { ...pose, anomaly };
  if (trail.length < LIVE_TRAIL_LIMIT) return [...trail, point];
  return [...trail.slice(1), point];
}

function calculateAnomaly(measured: ChassisSpeeds, setpoint: ChassisSpeeds): Omit<TractionAnomaly, "active" | "reason"> & { candidate: boolean } {
  const linearError = Math.hypot(setpoint.vx - measured.vx, setpoint.vy - measured.vy);
  const angularError = Math.abs(setpoint.omega - measured.omega);
  const requestedLinear = Math.hypot(setpoint.vx, setpoint.vy);
  const requestedAngular = Math.abs(setpoint.omega);
  const linearCandidate = requestedLinear >= 0.45
    && linearError >= Math.max(0.65, requestedLinear * 0.38);
  const angularCandidate = requestedAngular >= 0.8
    && angularError >= Math.max(1, requestedAngular * 0.42);
  return { candidate: linearCandidate || angularCandidate, linearError, angularError };
}

export function TelemetryProvider({ address, children }: TelemetryProviderProps): React.ReactElement {
  const [configuration, setConfiguration] = useState<TelemetryConfiguration>(DEFAULT_TELEMETRY_CONFIGURATION);
  const [telemetry, setTelemetry] = useState<LiveTelemetryState>(EMPTY_TELEMETRY);
  const [topics, setTopics] = useState<TelemetryTopicInfo[]>([]);
  const [transportError, setTransportError] = useState<string | null>(null);
  const latestServerConnectedRef = useRef(false);
  const latestDsAttachedRef = useRef(false);
  const latestPoseRef = useRef<Pose2d | null>(null);
  const latestMeasuredRef = useRef<{ value: ChassisSpeeds; timestamp: number } | null>(null);
  const latestSetpointRef = useRef<{ value: ChassisSpeeds; timestamp: number } | null>(null);
  const previousPoseRef = useRef<{ pose: Pose2d; timestamp: number } | null>(null);
  const anomalyActiveRef = useRef(false);
  const anomalyCandidateSinceRef = useRef<number | null>(null);
  const anomalyHealthySinceRef = useRef<number | null>(null);
  const frameRef = useRef<number | null>(null);
  const topicCommitTimerRef = useRef<number | null>(null);
  const topicMapRef = useRef(new Map<string, TelemetryTopicInfo>());
  const topicConnectionKeyRef = useRef<string | null>(null);
  const transportReadyRef = useRef<Promise<ActiveTelemetryTransport | null> | null>(null);

  const configure = useCallback((next: TelemetryConfiguration): void => {
    const normalized = normalizeConfiguration(next);
    setConfiguration((current) => configurationsEqual(current, normalized) ? current : normalized);
  }, []);

  const commitTopicsSoon = useCallback((): void => {
    if (topicCommitTimerRef.current !== null) return;
    topicCommitTimerRef.current = window.setTimeout(() => {
      topicCommitTimerRef.current = null;
      setTopics([...topicMapRef.current.values()].sort((left, right) => left.name.localeCompare(right.name)));
    }, 100);
  }, []);

  const upsertTopic = useCallback((name: string, type: string): void => {
    if (!name.startsWith("/")) return;
    const current = topicMapRef.current.get(name);
    if (current?.type === type) return;
    topicMapRef.current.set(name, { name, type });
    commitTopicsSoon();
  }, [commitTopicsSoon]);

  const removeTopic = useCallback((name: string): void => {
    if (!topicMapRef.current.delete(name)) return;
    commitTopicsSoon();
  }, [commitTopicsSoon]);

  const scheduleTelemetryCommit = useCallback((): void => {
    if (frameRef.current !== null) return;
    frameRef.current = window.requestAnimationFrame(() => {
      frameRef.current = null;
      const serverConnected = latestServerConnectedRef.current;
      const connected = serverConnected && latestDsAttachedRef.current;
      const pose = connected ? latestPoseRef.current : null;
      const now = performance.now();
      const measuredSample = latestMeasuredRef.current;
      const setpointSample = latestSetpointRef.current;
      const measuredSpeeds = measuredSample && now - measuredSample.timestamp <= SPEED_STALE_MS ? measuredSample.value : null;
      const setpointSpeeds = setpointSample && now - setpointSample.timestamp <= SPEED_STALE_MS ? setpointSample.value : null;
      let anomaly = EMPTY_ANOMALY;

      if (connected && measuredSpeeds && setpointSpeeds) {
        const calculated = calculateAnomaly(measuredSpeeds, setpointSpeeds);
        if (calculated.candidate) {
          anomalyHealthySinceRef.current = null;
          anomalyCandidateSinceRef.current ??= now;
          if (now - anomalyCandidateSinceRef.current >= ANOMALY_TRIGGER_MS) anomalyActiveRef.current = true;
        } else {
          anomalyCandidateSinceRef.current = null;
          anomalyHealthySinceRef.current ??= now;
          if (now - anomalyHealthySinceRef.current >= ANOMALY_CLEAR_MS) anomalyActiveRef.current = false;
        }
        anomaly = {
          active: anomalyActiveRef.current,
          reason: anomalyActiveRef.current ? "collision-or-slip" : null,
          linearError: calculated.linearError,
          angularError: calculated.angularError,
        };
      } else {
        anomalyActiveRef.current = false;
        anomalyCandidateSinceRef.current = null;
        anomalyHealthySinceRef.current = null;
      }

      if (!connected || !pose) {
        previousPoseRef.current = null;
        setTelemetry((current) => {
          if (!current.connected && current.serverConnected === serverConnected && current.trail.length === 0) return current;
          return { ...EMPTY_TELEMETRY, serverConnected };
        });
        return;
      }

      const previous = previousPoseRef.current;
      let velocity = EMPTY_VELOCITY;
      if (previous) {
        const elapsed = (now - previous.timestamp) / 1000;
        if (elapsed >= 0.005 && elapsed <= 1) {
          velocity = {
            vx: (pose.x - previous.pose.x) / elapsed,
            vy: (pose.y - previous.pose.y) / elapsed,
            omega: angleDeltaRadians(previous.pose.rotation, pose.rotation) / elapsed,
          };
        }
      }
      previousPoseRef.current = { pose, timestamp: now };

      setTelemetry((current) => ({
        serverConnected,
        connected,
        pose,
        velocity,
        measuredSpeeds,
        setpointSpeeds,
        anomaly,
        trail: appendTrailPoint(current.connected ? current.trail : [], pose, anomaly.active),
      }));
    });
  }, []);

  useEffect(() => {
    let disposed = false;
    const topicConnectionKey = `${configuration.transport}\u0000${address}`;
    if (topicConnectionKeyRef.current !== topicConnectionKey) {
      topicConnectionKeyRef.current = topicConnectionKey;
      topicMapRef.current = new Map();
      setTopics([]);
    }
    setTransportError(null);
    latestServerConnectedRef.current = false;
    latestDsAttachedRef.current = false;
    latestPoseRef.current = null;
    latestMeasuredRef.current = null;
    latestSetpointRef.current = null;
    previousPoseRef.current = null;
    anomalyActiveRef.current = false;
    setTelemetry(EMPTY_TELEMETRY);

    const acceptTopicValue = (name: string, value: unknown): void => {
      const now = performance.now();
      if (name === configuration.driverStationTopic) latestDsAttachedRef.current = booleanValue(value);
      if (name === configuration.odometryTopic) latestPoseRef.current = parsePose2d(value);
      if (configuration.measuredChassisSpeedsTopic && name === configuration.measuredChassisSpeedsTopic) {
        const parsed = parseChassisSpeeds(value);
        if (parsed) latestMeasuredRef.current = { value: parsed, timestamp: now };
      }
      if (configuration.setpointChassisSpeedsTopic && name === configuration.setpointChassisSpeedsTopic) {
        const parsed = parseChassisSpeeds(value);
        if (parsed) latestSetpointRef.current = { value: parsed, timestamp: now };
      }
      scheduleTelemetryCommit();
    };

    const createDirectTransport = async (): Promise<ActiveTelemetryTransport | null> => {
      const { DirectNt4Client } = await import("@/nt4-direct-client");
      if (disposed) return null;
      const client = new DirectNt4Client({
        address,
        driverStationTopic: configuration.driverStationTopic,
        odometryTopic: configuration.odometryTopic,
        measuredChassisSpeedsTopic: configuration.measuredChassisSpeedsTopic,
        setpointChassisSpeedsTopic: configuration.setpointChassisSpeedsTopic,
        onConnection: (connected) => {
          latestServerConnectedRef.current = connected;
          if (!connected) latestDsAttachedRef.current = false;
          scheduleTelemetryCommit();
        },
        onTopicAnnounce: (topic) => {
          if (!disposed) upsertTopic(topic.name, topic.type);
        },
        onTopicUnannounce: (topic) => {
          if (!disposed) removeTopic(topic.name);
        },
        onTopicValue: (topic, value) => acceptTopicValue(topic.name, value),
      });
      client.connect();

      return {
        publishRoutine: (routineCode: string) => client.publishRoutine(routineCode),
        dispose: () => client.disconnect(),
      };
    };

    const createFwcTransport = async (): Promise<ActiveTelemetryTransport | null> => {
      const module = await import("@frc-web-components/fwc/source-providers");
      if (disposed) return null;
      const Nt4Client = module.Nt4Client as unknown as FwcClientConstructor;
      const clients: FwcClient[] = [];
      let activeClient: FwcClient | null = null;
      let selectedAutoPublished = false;

      for (const host of fwcHostsFromAddress(address)) {
        let client: FwcClient;
        client = new Nt4Client(
          host,
          "Voyager",
          (topic) => {
            if (!disposed) upsertTopic(topic.name, topic.type);
          },
          (topic) => {
            if (!disposed) removeTopic(topic.name);
          },
          (topic, _timestamp, value) => {
            if (activeClient === client) acceptTopicValue(topic.name, value);
          },
          () => {
            if (disposed) return;
            if (!activeClient) {
              activeClient = client;
              clients.forEach((candidate) => {
                if (candidate !== client) candidate.disconnect();
              });
            }
            if (activeClient === client) {
              latestServerConnectedRef.current = true;
              scheduleTelemetryCommit();
            }
          },
          () => {
            if (activeClient !== client) return;
            latestServerConnectedRef.current = false;
            latestDsAttachedRef.current = false;
            scheduleTelemetryCommit();
          },
        );
        clients.push(client);
        client.subscribeTopicsOnly(["/"], true);
        client.subscribePeriodic([configuration.driverStationTopic], false, 0.1);
        const fastTopics = [
          configuration.odometryTopic,
          configuration.measuredChassisSpeedsTopic,
          configuration.setpointChassisSpeedsTopic,
        ].filter((topic): topic is string => Boolean(topic));
        client.subscribePeriodic([...new Set(fastTopics)], false, POSE_UPDATE_PERIOD_SECONDS);
        client.connect();
      }

      return {
        publishRoutine: async (routineCode: string) => {
          if (!activeClient) throw new Error("FRC Web Components is not connected to an NT4 server.");
          if (!selectedAutoPublished) {
            activeClient.publishNewTopic(SELECTED_AUTO_TOPIC, "string");
            activeClient.setRetained(SELECTED_AUTO_TOPIC, true);
            selectedAutoPublished = true;
          }
          activeClient.addSample(SELECTED_AUTO_TOPIC, routineCode);
        },
        dispose: () => clients.forEach((client) => client.disconnect()),
      };
    };

    const ready = (configuration.transport === "frc-web-components" ? createFwcTransport() : createDirectTransport())
      .catch((error: unknown) => {
        console.error(error);
        if (!disposed) setTransportError(error instanceof Error ? error.message : "Could not start the NT4 client.");
        return null;
      });
    transportReadyRef.current = ready;
    const staleSampleTimer = window.setInterval(scheduleTelemetryCommit, 250);

    return () => {
      disposed = true;
      void ready.then((transport) => transport?.dispose());
      if (transportReadyRef.current === ready) transportReadyRef.current = null;
      if (frameRef.current !== null) window.cancelAnimationFrame(frameRef.current);
      if (topicCommitTimerRef.current !== null) window.clearTimeout(topicCommitTimerRef.current);
      window.clearInterval(staleSampleTimer);
      frameRef.current = null;
      topicCommitTimerRef.current = null;
    };
  }, [address, configuration, removeTopic, scheduleTelemetryCommit, upsertTopic]);

  const publishRoutine = useCallback(async (routineCode: string): Promise<void> => {
    const transport = await transportReadyRef.current;
    if (!transport) throw new Error("NetworkTables is still initializing.");
    await transport.publishRoutine(routineCode);
    const pose = latestDsAttachedRef.current ? latestPoseRef.current : null;
    previousPoseRef.current = pose ? { pose, timestamp: performance.now() } : null;
    setTelemetry((current) => ({
      ...current,
      trail: pose ? [{ ...pose, anomaly: current.anomaly.active }] : [],
      velocity: EMPTY_VELOCITY,
    }));
  }, []);

  const value = useMemo<TelemetryContextValue>(() => ({
    ...telemetry,
    topics,
    transportError,
    configure,
    publishRoutine,
  }), [configure, publishRoutine, telemetry, topics, transportError]);

  return <TelemetryContext.Provider value={value}>{children}</TelemetryContext.Provider>;
}

export function useLiveTelemetry(): TelemetryContextValue {
  const value = useContext(TelemetryContext);
  if (!value) throw new Error("useLiveTelemetry must be used inside TelemetryProvider.");
  return value;
}
