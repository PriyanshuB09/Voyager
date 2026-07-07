import { useEntry } from "@frc-web-components/react";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type {
  ChangeEvent,
  CSSProperties,
  MouseEvent as ReactMouseEvent,
  PointerEvent as ReactPointerEvent,
  ReactElement,
  RefObject,
} from "react";

//@ts-ignore
import "./styles/style.css";

type OriginCorner = "bl" | "br" | "tl" | "tr";
type AddElementKind = "waypoint" | "rotationTarget" | "eventTrigger" | "constraintZone";
type TreeKind = "path" | "if" | "loop" | "interrupt" | "event";
type ChildSlot = "next" | "true" | "false" | "forloop" | "interruptable";
type SaveStatusKind = "idle" | "saving" | "saved" | "error";

interface ElectronAPI {
  pickDirectory: () => Promise<string | null>;
  writeTextFile: (folder: string, fileName: string, text: string) => Promise<unknown>;
  readTextFile: (folder: string, fileName: string) => Promise<string | null>;
  makeDirectory?: (folder: string) => Promise<unknown>;
  deleteTextFile?: (folder: string, fileName: string) => Promise<unknown>;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}

interface AppProps {
  nt4Address: string;
  setNt4Address: (address: string) => void;
}

interface Pose2d {
  x: number;
  y: number;
  rotation: number;
}

interface Settings {
  fieldImageDataUrl: string | null;
  robotCodeProjectFolder: string | null;
  fieldWidthMeters: number;
  fieldLengthMeters: number;
  robotLengthMeters: number;
  robotWidthMeters: number;
  originCorner: OriginCorner;
  centerOfRotationX: number;
  centerOfRotationY: number;
  autoSave: boolean;
}

interface Waypoint {
  id: string;
  x: number;
  y: number;
  angle: number;
  handoff: number;
  profiled: boolean;
}

interface RotationTarget {
  id: string;
  angle: number;
  position: number;
  profiled: boolean;
}

interface EventTrigger {
  id: string;
  name: string;
  position: number;
}

interface ConstraintZone {
  id: string;
  maxTranslationalVelocity: number;
  maxTranslationalAcceleration: number;
  maxRotationalVelocity: number;
  maxRotationalAcceleration: number;
  startPosition: number;
  endPosition: number;
}

interface SharedPathData {
  waypoints: Waypoint[];
  rotationTargets: RotationTarget[];
  events: EventTrigger[];
  constraintZones: ConstraintZone[];
}

interface BaseTreeNode {
  id: string;
  kind: TreeKind;
  name: string;
  x: number;
  y: number;
  parentId: string | null;
  selectedForRoutine: boolean;
  editing: boolean;
}

interface PathTreePathNode extends BaseTreeNode {
  kind: "path";
  nextId: string | null;
}

interface PathTreeIfNode extends BaseTreeNode {
  kind: "if";
  trueId: string | null;
  falseId: string | null;
  nextId: string | null;
}

interface PathTreeLoopNode extends BaseTreeNode {
  kind: "loop";
  forloopId: string | null;
  nextId: string | null;
}

interface PathTreeInterruptNode extends BaseTreeNode {
  kind: "interrupt";
  interruptableId: string | null;
  nextId: string | null;
}

interface PathTreeEventNode extends BaseTreeNode {
  kind: "event";
  nextId: string | null;
}

type PathTreeNode = PathTreePathNode | PathTreeIfNode | PathTreeLoopNode | PathTreeInterruptNode | PathTreeEventNode;

interface FieldSize {
  width: number;
  height: number;
}

interface MeterPoint {
  x: number;
  y: number;
}

interface PixelPoint {
  x: number;
  y: number;
}

interface ModalBase {
  x: number;
  y: number;
}

interface WaypointModalState extends ModalBase {
  kind: "waypoint";
  id: string;
}

interface RotationTargetModalState extends ModalBase {
  kind: "rotationTarget";
  id: string;
}

interface EventTriggerModalState extends ModalBase {
  kind: "eventTrigger";
  id: string;
}

interface ConstraintZoneModalState extends ModalBase {
  kind: "constraintZone";
  id: string;
}

type ElementModalState =
  | WaypointModalState
  | RotationTargetModalState
  | EventTriggerModalState
  | ConstraintZoneModalState
  | null;

interface ContextMenuState {
  kind: "canvas" | "node" | "edge";
  x: number;
  y: number;
  canvasX: number;
  canvasY: number;
  nodeId: string | null;
  edgeParentId?: string;
  edgeChildId?: string;
  edgeSlot?: ChildSlot;
  edgeLabel?: string;
}

interface PendingTreeConnection {
  mode: "connectParent" | "connectChild";
  parentId: string | null;
  childId: string | null;
  slot: ChildSlot;
}

interface SaveStatus {
  kind: SaveStatusKind;
  message: string;
}

interface PersistedAppState {
  settings: Settings;
  treeNodes: PathTreeNode[];
  pathDataByName: Record<string, SharedPathData>;
  knownPathFileNames?: string[];
  activePathNodeId: string | null;
  pan: PixelPoint;
}

interface SerializedWaypoint {
  x: number;
  y: number;
  angle: number;
  handoff: number;
  profiled: boolean;
}

interface SerializedRotationTarget {
  angle: number;
  position: number;
}

interface SerializedEventTrigger {
  name: string;
  position: number;
}

interface SerializedConstraintZone {
  max_translational_velocity: number;
  max_translational_acceleration: number;
  max_rotational_velocity: number;
  max_rotational_acceleration: number;
  start_position: number;
  end_position: number;
}

interface SerializedPathFile {
  waypoints: SerializedWaypoint[];
  rotation_targets: SerializedRotationTarget[];
  events: SerializedEventTrigger[];
  constraint_zones: SerializedConstraintZone[];
}

type SerializedAutoElement =
  | { type: "path"; name: string }
  | { type: "event"; name: string }
  | { type: "if"; name: string; ontrue: SerializedAutoElement[]; onfalse: SerializedAutoElement[] }
  | { type: "loop"; name: string; forloop: SerializedAutoElement[] }
  | { type: "interrupt"; name: string; interruptable: SerializedAutoElement[] };

interface SerializedAutoConfig {
  autos: Array<{
    id: string;
    path_sequence: SerializedAutoElement[];
  }>;
}

const DB_NAME = "voyager-autonomous-builder";
const DB_VERSION = 1;
const DB_STORE = "kv";
const APP_STATE_KEY = "app-state";
const NODE_WIDTH = 160;
const NODE_HEIGHT = 62;
const DEFAULT_SETTINGS: Settings = {
  fieldImageDataUrl: null,
  robotCodeProjectFolder: null,
  fieldWidthMeters: 8.21,
  fieldLengthMeters: 16.46,
  robotLengthMeters: 0.9,
  robotWidthMeters: 0.9,
  originCorner: "bl",
  centerOfRotationX: 0.45,
  centerOfRotationY: 0.45,
  autoSave: false,
};

function createId(prefix: string): string {
  const cryptoId = globalThis.crypto && "randomUUID" in globalThis.crypto ? globalThis.crypto.randomUUID() : null;
  if (cryptoId) return `${prefix}_${cryptoId}`;
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

function cleanNumber(value: number, fallback: number): number {
  return Number.isFinite(value) ? value : fallback;
}

function safePositive(value: number, fallback: number): number {
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function formatNumber(value: number, digits = 2): string {
  if (!Number.isFinite(value)) return "0";
  return Number(value.toFixed(digits)).toString();
}

function normalizeCompassDegrees(degrees: number): number {
  if (!Number.isFinite(degrees)) return 0;
  let normalized = ((degrees + 180) % 360 + 360) % 360 - 180;
  if (Math.abs(normalized + 180) < 0.000001) normalized = 180;
  if (Math.abs(normalized) < 0.000001) normalized = 0;
  return normalized;
}

function pointerToCompassDegrees(pointerX: number, pointerY: number, centerX: number, centerY: number): number {
  const dx = pointerX - centerX;
  const dy = centerY - pointerY;
  return normalizeCompassDegrees((Math.atan2(dy, dx) * 180) / Math.PI);
}

function compassDegreesToCssRotation(degrees: number): number {
  return -normalizeCompassDegrees(degrees);
}

function normalizeNt4AddressInput(rawAddress: string): string | null {
  const cleanedAddress = rawAddress.trim();

  if (!cleanedAddress) return null;

  if (cleanedAddress.toLowerCase() === "localhost") {
    return "localhost";
  }

  if (/^\d{1,5}$/.test(cleanedAddress)) {
    const teamNumber = Number(cleanedAddress);
    return teamNumber > 0 ? teamNumber.toString() : null;
  }

  if (/^[a-zA-Z0-9.-]+(?::\d{1,5})?$/.test(cleanedAddress)) {
    return cleanedAddress;
  }

  return null;
}

function describeNt4Address(address: string): string {
  if (/^\d+$/.test(address)) return `Team ${address}`;
  if (address === "localhost") return "Localhost";
  return address;
}

function parsePose2d(data: Uint8Array): Pose2d {
  if (!(data instanceof Uint8Array)) {
    console.warn("parsePose2d: Expected Uint8Array input.");
    return { x: 0, y: 0, rotation: 0 };
  }

  if (data.byteLength < 24) {
    console.warn(`parsePose2d: Invalid length (${data.byteLength}). Expected 24 bytes.`);
    return { x: 0, y: 0, rotation: 0 };
  }

  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const x = view.getFloat64(0, true);
  const y = view.getFloat64(8, true);
  const rotation = view.getFloat64(16, true);
  return { x, y, rotation };
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!globalThis.indexedDB) {
      reject(new Error("IndexedDB is not available in this runtime."));
      return;
    }

    const request = globalThis.indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(DB_STORE)) db.createObjectStore(DB_STORE);
    };
    request.onerror = () => reject(request.error ?? new Error("Failed to open IndexedDB."));
    request.onsuccess = () => resolve(request.result);
  });
}

async function idbGet<T>(key: string): Promise<T | null> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(DB_STORE, "readonly");
    const store = tx.objectStore(DB_STORE);
    const request = store.get(key);
    request.onerror = () => reject(request.error ?? new Error("Failed to read IndexedDB value."));
    request.onsuccess = () => resolve((request.result as T | undefined) ?? null);
    tx.oncomplete = () => db.close();
    tx.onerror = () => {
      db.close();
      reject(tx.error ?? new Error("IndexedDB transaction failed."));
    };
  });
}

async function idbSet<T>(key: string, value: T): Promise<void> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(DB_STORE, "readwrite");
    const store = tx.objectStore(DB_STORE);
    const request = store.put(value, key);
    request.onerror = () => reject(request.error ?? new Error("Failed to write IndexedDB value."));
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error ?? new Error("IndexedDB transaction failed."));
    };
  });
}

function createEmptyPathData(): SharedPathData {
  return { waypoints: [], rotationTargets: [], events: [], constraintZones: [] };
}

function createDefaultWaypoint(settings: Settings): Waypoint {
  return {
    id: createId("waypoint"),
    x: settings.fieldLengthMeters / 2,
    y: settings.fieldWidthMeters / 2,
    angle: 0,
    handoff: 0.2,
    profiled: true,
  };
}

function createDefaultRotationTarget(maxPosition: number): RotationTarget {
  return {
    id: createId("rotation_target"),
    angle: 0,
    position: clamp(0.5, 0, maxPosition),
    profiled: true,
  };
}

function createDefaultEventTrigger(maxPosition: number): EventTrigger {
  return {
    id: createId("event"),
    name: "event",
    position: clamp(0.5, 0, maxPosition),
  };
}

function createDefaultConstraintZone(maxPosition: number): ConstraintZone {
  return {
    id: createId("constraint"),
    maxTranslationalVelocity: 1,
    maxTranslationalAcceleration: 5,
    maxRotationalVelocity: 180,
    maxRotationalAcceleration: 360,
    startPosition: 0,
    endPosition: clamp(1, 0, maxPosition),
  };
}


function treeKindLabel(kind: TreeKind): string {
  if (kind === "path") return "path";
  if (kind === "if") return "if";
  if (kind === "loop") return "loop";
  if (kind === "event") return "event";
  return "interruptable";
}

function treeKindDescription(kind: TreeKind): string {
  if (kind === "path") return "path block";
  if (kind === "if") return "if branch";
  if (kind === "loop") return "loop block";
  if (kind === "event") return "event block";
  return "interruptable";
}

function defaultNameForKind(kind: TreeKind, nodes: PathTreeNode[]): string {
  const base = kind === "path" ? "Path" : kind === "if" ? "If" : kind === "loop" ? "Loop" : kind === "event" ? "event" : "Interrupt";
  let index = 1;
  const names = new Set(nodes.map((node) => node.name));
  while (names.has(`${base}_${index}`)) index += 1;
  return `${base}_${index}`;
}

function createTreeNode(kind: TreeKind, name: string, x: number, y: number, parentId: string | null): PathTreeNode {
  const base: BaseTreeNode = {
    id: createId(kind),
    kind,
    name,
    x,
    y,
    parentId,
    selectedForRoutine: false,
    editing: false,
  };

  if (kind === "path") return { ...base, kind: "path", nextId: null };
  if (kind === "if") return { ...base, kind: "if", trueId: null, falseId: null, nextId: null };
  if (kind === "loop") return { ...base, kind: "loop", forloopId: null, nextId: null };
  if (kind === "event") return { ...base, kind: "event", nextId: null };
  return { ...base, kind: "interrupt", interruptableId: null, nextId: null };
}

function childIdForSlot(node: PathTreeNode, slot: ChildSlot): string | null {
  if (slot === "next") return "nextId" in node ? node.nextId : null;
  if (slot === "true" && node.kind === "if") return node.trueId;
  if (slot === "false" && node.kind === "if") return node.falseId;
  if (slot === "forloop" && node.kind === "loop") return node.forloopId;
  if (slot === "interruptable" && node.kind === "interrupt") return node.interruptableId;
  return null;
}

function setChildForSlot(node: PathTreeNode, slot: ChildSlot, childId: string | null): PathTreeNode {
  if (slot === "next" && "nextId" in node) return { ...node, nextId: childId };
  if (slot === "true" && node.kind === "if") return { ...node, trueId: childId };
  if (slot === "false" && node.kind === "if") return { ...node, falseId: childId };
  if (slot === "forloop" && node.kind === "loop") return { ...node, forloopId: childId };
  if (slot === "interruptable" && node.kind === "interrupt") return { ...node, interruptableId: childId };
  return node;
}

function supportsChildSlot(node: PathTreeNode, slot: ChildSlot): boolean {
  if (slot === "next") return "nextId" in node;
  if (slot === "true" || slot === "false") return node.kind === "if";
  if (slot === "forloop") return node.kind === "loop";
  if (slot === "interruptable") return node.kind === "interrupt";
  return false;
}

function defaultSlotForParent(node: PathTreeNode, preferredSlot: ChildSlot): ChildSlot {
  if (supportsChildSlot(node, preferredSlot)) return preferredSlot;
  if (supportsChildSlot(node, "next")) return "next";
  if (node.kind === "if") return "true";
  if (node.kind === "loop") return "forloop";
  return "interruptable";
}

function detachNodeFromParentInList(nodes: PathTreeNode[], childId: string): PathTreeNode[] {
  const child = nodes.find((node) => node.id === childId);
  if (!child?.parentId) return nodes;

  return nodes.map((node) => {
    if (node.id === child.parentId) {
      let nextNode = node;
      for (const childConnection of getNodeChildren(node)) {
        if (childConnection.id === childId) nextNode = setChildForSlot(nextNode, childConnection.slot, null);
      }
      return nextNode;
    }
    if (node.id === childId) return { ...node, parentId: null };
    return node;
  });
}

function getNodeChildren(node: PathTreeNode): Array<{ id: string; slot: ChildSlot; label: string }> {
  const children: Array<{ id: string; slot: ChildSlot; label: string }> = [];
  if ("nextId" in node && node.nextId) children.push({ id: node.nextId, slot: "next", label: "next" });
  if (node.kind === "if") {
    if (node.trueId) children.push({ id: node.trueId, slot: "true", label: "true" });
    if (node.falseId) children.push({ id: node.falseId, slot: "false", label: "false" });
  }
  if (node.kind === "loop" && node.forloopId) children.push({ id: node.forloopId, slot: "forloop", label: "loop" });
  if (node.kind === "interrupt" && node.interruptableId) children.push({ id: node.interruptableId, slot: "interruptable", label: "interrupt" });
  return children;
}

function getParentConnection(nodes: PathTreeNode[], childId: string): { parentId: string; slot: ChildSlot; label: string } | null {
  for (const node of nodes) {
    const connection = getNodeChildren(node).find((child) => child.id === childId);
    if (connection) return { parentId: node.id, slot: connection.slot, label: connection.label };
  }
  return null;
}

function rootNodeFor(nodeId: string, nodes: PathTreeNode[]): PathTreeNode | null {
  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  let current = nodeById.get(nodeId) ?? null;
  const seen = new Set<string>();

  while (current?.parentId && !seen.has(current.id)) {
    seen.add(current.id);
    current = nodeById.get(current.parentId) ?? current;
    if (!current.parentId) break;
  }

  return current;
}

function collectSubtreeNodeIds(rootId: string, nodes: PathTreeNode[]): Set<string> {
  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const collected = new Set<string>();

  const collect = (nodeId: string): void => {
    if (collected.has(nodeId)) return;
    collected.add(nodeId);
    const node = nodeById.get(nodeId);
    if (!node) return;
    for (const child of getNodeChildren(node)) collect(child.id);
  };

  collect(rootId);
  return collected;
}

function routineCodeForRoot(root: PathTreeNode): string {
  const code = root.id.replace(/[^a-zA-Z0-9]/g, "");
  return code.length > 0 ? code : root.name.replace(/[^a-zA-Z0-9]/g, "") || "VoyagerAuto";
}

function selectedRoutineCodeFromNodes(nodes: PathTreeNode[]): string | null {
  const selectedNode = nodes.find((node) => node.selectedForRoutine);
  if (!selectedNode) return null;
  const root = rootNodeFor(selectedNode.id, nodes);
  return root ? routineCodeForRoot(root) : null;
}

function lastWaypointBeforeChild(parentId: string | null, nodes: PathTreeNode[], pathDataByName: Record<string, SharedPathData>): Waypoint | null {
  if (!parentId) return null;
  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  let current = nodeById.get(parentId) ?? null;
  const seen = new Set<string>();

  while (current && !seen.has(current.id)) {
    seen.add(current.id);
    if (current.kind === "path") {
      const pathData = pathDataByName[current.name];
      const waypoint = pathData?.waypoints[pathData.waypoints.length - 1];
      if (waypoint) return waypoint;
    }
    current = current.parentId ? nodeById.get(current.parentId) ?? null : null;
  }

  return null;
}

function cloneWaypointAsPathStart(waypoint: Waypoint): Waypoint {
  return {
    ...waypoint,
    id: createId("waypoint"),
  };
}

function sanitizeFileName(name: string): string {
  const cleaned = name.trim().replace(/[<>:"/\\|?*\x00-\x1F]/g, "_").replace(/\s+/g, "_");
  return cleaned.length > 0 ? cleaned : "Unnamed_Path";
}

function getVoyagerDeployFolder(projectFolder: string): string {
  const trimmed = projectFolder.replace(/[\\/]+$/, "");
  const separator = trimmed.includes("\\") ? "\\" : "/";
  return [trimmed, "src", "main", "deploy", "voyager"].join(separator);
}

function pointToPixels(settings: Settings, size: FieldSize, point: MeterPoint): PixelPoint {
  const pxPerMeterX = size.width / settings.fieldLengthMeters;
  const pxPerMeterY = size.height / settings.fieldWidthMeters;

  if (settings.originCorner === "bl") return { x: point.x * pxPerMeterX, y: size.height - point.y * pxPerMeterY };
  if (settings.originCorner === "br") return { x: size.width - point.x * pxPerMeterX, y: size.height - point.y * pxPerMeterY };
  if (settings.originCorner === "tl") return { x: point.x * pxPerMeterX, y: point.y * pxPerMeterY };
  return { x: size.width - point.x * pxPerMeterX, y: point.y * pxPerMeterY };
}

function pixelsToPoint(settings: Settings, size: FieldSize, point: PixelPoint): MeterPoint {
  const pxPerMeterX = size.width / settings.fieldLengthMeters;
  const pxPerMeterY = size.height / settings.fieldWidthMeters;

  if (settings.originCorner === "bl") return { x: point.x / pxPerMeterX, y: (size.height - point.y) / pxPerMeterY };
  if (settings.originCorner === "br") return { x: (size.width - point.x) / pxPerMeterX, y: (size.height - point.y) / pxPerMeterY };
  if (settings.originCorner === "tl") return { x: point.x / pxPerMeterX, y: point.y / pxPerMeterY };
  return { x: (size.width - point.x) / pxPerMeterX, y: point.y / pxPerMeterY };
}

function clampMeterPoint(settings: Settings, point: MeterPoint): MeterPoint {
  return {
    x: clamp(point.x, 0, settings.fieldLengthMeters),
    y: clamp(point.y, 0, settings.fieldWidthMeters),
  };
}

function maxPathPosition(path: SharedPathData): number {
  return Math.max(0, path.waypoints.length - 1);
}

function pointAtPathPosition(waypoints: Waypoint[], position: number): MeterPoint | null {
  if (waypoints.length === 0) return null;
  if (waypoints.length === 1) return { x: waypoints[0].x, y: waypoints[0].y };

  const clamped = clamp(position, 0, waypoints.length - 1);
  const startIndex = Math.min(Math.floor(clamped), waypoints.length - 2);
  const t = clamp(clamped - startIndex, 0, 1);
  const start = waypoints[startIndex];
  const end = waypoints[startIndex + 1];

  return {
    x: start.x + (end.x - start.x) * t,
    y: start.y + (end.y - start.y) * t,
  };
}

function nearestPathPositionFromPixel(settings: Settings, size: FieldSize, waypoints: Waypoint[], point: PixelPoint): number {
  if (waypoints.length <= 1) return 0;

  let bestPosition = 0;
  let bestDistance = Number.POSITIVE_INFINITY;

  for (let index = 0; index < waypoints.length - 1; index += 1) {
    const a = pointToPixels(settings, size, waypoints[index]);
    const b = pointToPixels(settings, size, waypoints[index + 1]);
    const vx = b.x - a.x;
    const vy = b.y - a.y;
    const lenSquared = vx * vx + vy * vy;
    const t = lenSquared === 0 ? 0 : clamp(((point.x - a.x) * vx + (point.y - a.y) * vy) / lenSquared, 0, 1);
    const projected = { x: a.x + vx * t, y: a.y + vy * t };
    const dx = point.x - projected.x;
    const dy = point.y - projected.y;
    const distance = dx * dx + dy * dy;
    if (distance < bestDistance) {
      bestDistance = distance;
      bestPosition = index + t;
    }
  }

  return bestPosition;
}

function pathPixelsBetween(settings: Settings, size: FieldSize, waypoints: Waypoint[], startPosition: number, endPosition: number): PixelPoint[] {
  if (waypoints.length === 0) return [];
  const maxPositionValue = waypoints.length - 1;
  const start = clamp(Math.min(startPosition, endPosition), 0, maxPositionValue);
  const end = clamp(Math.max(startPosition, endPosition), 0, maxPositionValue);
  const points: PixelPoint[] = [];
  const startPoint = pointAtPathPosition(waypoints, start);
  if (startPoint) points.push(pointToPixels(settings, size, startPoint));

  const firstInterior = Math.floor(start) + 1;
  const lastInterior = Math.floor(end);
  for (let index = firstInterior; index <= lastInterior; index += 1) {
    if (index > start && index < end && waypoints[index]) {
      points.push(pointToPixels(settings, size, waypoints[index]));
    }
  }

  const endPoint = pointAtPathPosition(waypoints, end);
  if (endPoint) points.push(pointToPixels(settings, size, endPoint));
  return points;
}

function robotRenderStyle(settings: Settings, size: FieldSize, x: number, y: number, angleDegrees: number): CSSProperties {
  const point = pointToPixels(settings, size, { x, y });
  const width = settings.robotLengthMeters * (size.width / settings.fieldLengthMeters);
  const height = settings.robotWidthMeters * (size.height / settings.fieldWidthMeters);
  const originX = (clamp(settings.centerOfRotationX, 0, settings.robotLengthMeters) / settings.robotLengthMeters) * width;
  const originY = (clamp(settings.centerOfRotationY, 0, settings.robotWidthMeters) / settings.robotWidthMeters) * height;

  return {
    width: `${width}px`,
    height: `${height}px`,
    left: `${point.x - originX}px`,
    top: `${point.y - originY}px`,
    transform: `rotate(${compassDegreesToCssRotation(angleDegrees)}deg)`,
    transformOrigin: `${originX}px ${originY}px`,
  };
}

function handoffCircleStyle(settings: Settings, size: FieldSize, waypoint: Waypoint): CSSProperties {
  const center = pointToPixels(settings, size, waypoint);
  const diameter = Math.max(8, waypoint.handoff * 2 * (size.width / settings.fieldLengthMeters));
  return {
    width: `${diameter}px`,
    height: `${diameter}px`,
    left: `${center.x - diameter / 2}px`,
    top: `${center.y - diameter / 2}px`,
  };
}

function serializePathData(path: SharedPathData): SerializedPathFile {
  return {
    waypoints: path.waypoints.map((waypoint) => ({
      x: waypoint.x,
      y: waypoint.y,
      angle: normalizeCompassDegrees(waypoint.angle),
      handoff: waypoint.handoff,
      profiled: waypoint.profiled,
    })),
    rotation_targets: path.rotationTargets.map((target) => ({
      angle: normalizeCompassDegrees(target.angle),
      position: target.position,
    })),
    events: path.events.map((event) => ({
      name: event.name,
      position: event.position,
    })),
    constraint_zones: path.constraintZones.map((zone) => ({
      max_translational_velocity: zone.maxTranslationalVelocity,
      max_translational_acceleration: zone.maxTranslationalAcceleration,
      max_rotational_velocity: zone.maxRotationalVelocity,
      max_rotational_acceleration: zone.maxRotationalAcceleration,
      start_position: Math.min(zone.startPosition, zone.endPosition),
      end_position: Math.max(zone.startPosition, zone.endPosition),
    })),
  };
}

function serializeAutoConfig(nodes: PathTreeNode[]): SerializedAutoConfig {
  const nodeById = new Map(nodes.map((node) => [node.id, node]));

  function rootFor(node: PathTreeNode): PathTreeNode {
    let current = node;
    const seen = new Set<string>();
    while (current.parentId && !seen.has(current.id)) {
      seen.add(current.id);
      const parent = nodeById.get(current.parentId);
      if (!parent) break;
      current = parent;
    }
    return current;
  }

  const roots = nodes
    .filter((node) => node.parentId === null)
    .map((node) => rootFor(node))
    .filter((node, index, array) => array.findIndex((candidate) => candidate.id === node.id) === index);

  function serializeChain(startId: string | null, seen = new Set<string>()): SerializedAutoElement[] {
    const sequence: SerializedAutoElement[] = [];
    let currentId = startId;

    while (currentId && !seen.has(currentId)) {
      seen.add(currentId);
      const node = nodeById.get(currentId);
      if (!node) break;

      if (node.kind === "path") {
        sequence.push({ type: "path", name: node.name });
        currentId = node.nextId;
      } else if (node.kind === "if") {
        sequence.push({
          type: "if",
          name: node.name,
          ontrue: serializeChain(node.trueId, new Set(seen)),
          onfalse: serializeChain(node.falseId, new Set(seen)),
        });
        currentId = node.nextId;
      } else if (node.kind === "loop") {
        sequence.push({
          type: "loop",
          name: node.name,
          forloop: serializeChain(node.forloopId, new Set(seen)),
        });
        currentId = node.nextId;
      } else if (node.kind === "interrupt") {
        sequence.push({
          type: "interrupt",
          name: node.name,
          interruptable: serializeChain(node.interruptableId, new Set(seen)),
        });
        currentId = node.nextId;
      } else {
        sequence.push({ type: "event", name: node.name });
        currentId = node.nextId;
      }
    }

    return sequence;
  }

  return {
    autos: roots.map((root) => ({
      id: routineCodeForRoot(root),
      path_sequence: serializeChain(root.id),
    })),
  };
}

function normalizePersistedState(value: PersistedAppState | null): PersistedAppState | null {
  if (!value || typeof value !== "object") return null;
  return {
    settings: { ...DEFAULT_SETTINGS, ...value.settings },
    treeNodes: Array.isArray(value.treeNodes) ? value.treeNodes : [],
    pathDataByName: value.pathDataByName && typeof value.pathDataByName === "object" ? value.pathDataByName : {},
    activePathNodeId: value.activePathNodeId ?? null,
    pan: value.pan ?? { x: 0, y: 0 },
  };
}

function useElementSize<T extends HTMLElement>(): [RefObject<T | null>, FieldSize] {
  const ref = useRef<T | null>(null);
  const [size, setSize] = useState<FieldSize>({ width: 0, height: 0 });

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const update = (): void => {
      setSize({ width: element.clientWidth, height: element.clientHeight });
    };

    update();

    if (!globalThis.ResizeObserver) {
      globalThis.addEventListener("resize", update);
      return () => globalThis.removeEventListener("resize", update);
    }

    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return [ref, size];
}

function App({ nt4Address, setNt4Address }: AppProps): ReactElement {
  const appRef = useRef<HTMLDivElement>(null);
  const leftPanelRef = useRef<HTMLDivElement>(null);
  const treeViewportRef = useRef<HTMLDivElement>(null);
  const [fieldOneRef, fieldOneSize] = useElementSize<HTMLDivElement>();
  const [fieldTwoRef, fieldTwoSize] = useElementSize<HTMLDivElement>();
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [treeNodes, setTreeNodes] = useState<PathTreeNode[]>([]);
  const [pathDataByName, setPathDataByName] = useState<Record<string, SharedPathData>>({});
  const [knownPathFileNames, setKnownPathFileNames] = useState<string[]>([]);
  const [activePathNodeId, setActivePathNodeId] = useState<string | null>(null);
  const [addElementKind, setAddElementKind] = useState<AddElementKind>("waypoint");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [saveMenuOpen, setSaveMenuOpen] = useState(false);
  const [treeAddMenuOpen, setTreeAddMenuOpen] = useState(false);
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [pendingConnection, setPendingConnection] = useState<PendingTreeConnection | null>(null);
  const [modal, setModal] = useState<ElementModalState>(null);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>({ kind: "idle", message: "" });
  const [hydrated, setHydrated] = useState(false);
  const [pan, setPan] = useState<PixelPoint>({ x: 0, y: 0 });
  const [renamingNodeId, setRenamingNodeId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState("");
  const [nt4AddressDraft, setNt4AddressDraft] = useState(nt4Address);
  const persistTimerRef = useRef<number | null>(null);
  const autoSaveTimerRef = useRef<number | null>(null);
  const draggingModalRef = useRef<{ offsetX: number; offsetY: number } | null>(null);
  const dragOperationRef = useRef<(() => void) | null>(null);
  const [connected] = useEntry<boolean>("/AdvantageKit/DriverStation/DSAttached", false);
  const [poseStruct] = useEntry<Uint8Array>(
    "/AdvantageKit/RealOutputs/Odometry/Robot",
    new Uint8Array([...new Array(24).fill(0)]),
  );
  const [, setSelectedAutoEntry] = useEntry<string>("/Voyager/SelectedAuto", "");

  useEffect(() => {
    setNt4AddressDraft(nt4Address);
  }, [nt4Address]);

  const activePathNode = useMemo<PathTreePathNode | null>(() => {
    if (!activePathNodeId) return null;
    const node = treeNodes.find((candidate) => candidate.id === activePathNodeId);
    return node?.kind === "path" ? node : null;
  }, [activePathNodeId, treeNodes]);

  const activePathName = activePathNode?.name ?? null;
  const activePathData = activePathName ? pathDataByName[activePathName] ?? createEmptyPathData() : createEmptyPathData();
  const activeMaxPosition = maxPathPosition(activePathData);
  const livePose = connected ? parsePose2d(poseStruct) : { x: 0, y: 0, rotation: 0 };
  const pxPerMeter = fieldOneSize.width > 0 ? fieldOneSize.width / settings.fieldLengthMeters : 0;
  const selectedRoutineCode = useMemo(() => selectedRoutineCodeFromNodes(treeNodes), [treeNodes]);
  const selectedRoutineWaypointPreviews = useMemo(() => {
    const selectedPathNodes = treeNodes.filter((node): node is PathTreePathNode => node.kind === "path" && node.selectedForRoutine);

    return selectedPathNodes.flatMap((node) => {
      const pathData = pathDataByName[node.name];
      if (!pathData) return [];

      return pathData.waypoints.map((waypoint, index) => ({
        key: `${node.id}-${waypoint.id}-${index}`,
        pathName: node.name,
        waypoint,
        index,
      }));
    });
  }, [pathDataByName, treeNodes]);

  const setError = useCallback((message: string): void => {
    setSaveStatus({ kind: "error", message });
  }, []);

  const applyNt4Address = useCallback((): void => {
    const normalizedAddress = normalizeNt4AddressInput(nt4AddressDraft);

    if (!normalizedAddress) {
      setError("Enter any valid FRC team number, localhost, IP address, or hostname before applying the NT4 address.");
      return;
    }

    setNt4AddressDraft(normalizedAddress);
    setNt4Address(normalizedAddress);
    setSaveStatus({ kind: "saved", message: `NT4 address set to ${describeNt4Address(normalizedAddress)}.` });
  }, [nt4AddressDraft, setError, setNt4Address]);

  useEffect(() => {
    let cancelled = false;

    async function loadState(): Promise<void> {
      try {
        const stored = normalizePersistedState(await idbGet<PersistedAppState>(APP_STATE_KEY));
        if (!cancelled && stored) {
          setSettings(stored.settings);
          setTreeNodes(stored.treeNodes);
          setPathDataByName(stored.pathDataByName);
          setKnownPathFileNames(Array.isArray(stored.knownPathFileNames) ? stored.knownPathFileNames.filter((name): name is string => typeof name === "string") : []);
          setActivePathNodeId(stored.activePathNodeId);
          setPan(stored.pan);
        }
      } catch (error) {
        console.error(error);
        if (!cancelled) setSaveStatus({ kind: "error", message: "Could not load saved IndexedDB state." });
      } finally {
        if (!cancelled) setHydrated(true);
      }
    }

    void loadState();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    if (persistTimerRef.current) window.clearTimeout(persistTimerRef.current);
    persistTimerRef.current = window.setTimeout(() => {
      const state: PersistedAppState = { settings, treeNodes, pathDataByName, knownPathFileNames, activePathNodeId, pan };
      void idbSet(APP_STATE_KEY, state).catch((error) => {
        console.error(error);
        setSaveStatus({ kind: "error", message: "Could not save local IndexedDB state." });
      });
    }, 250);
  }, [activePathNodeId, hydrated, knownPathFileNames, pan, pathDataByName, settings, treeNodes]);

  const updateSettings = useCallback((patch: Partial<Settings>): void => {
    setSettings((previous) => ({ ...previous, ...patch }));
  }, []);

  const updateActivePathData = useCallback(
    (updater: (current: SharedPathData) => SharedPathData): void => {
      if (!activePathName) {
        setError("Select a path block for editing before adding path elements.");
        return;
      }
      setPathDataByName((previous) => {
        const current = previous[activePathName] ?? createEmptyPathData();
        return { ...previous, [activePathName]: updater(current) };
      });
    },
    [activePathName, setError],
  );

  const closeMenus = useCallback((): void => {
    setSaveMenuOpen(false);
    setTreeAddMenuOpen(false);
    setContextMenu(null);
  }, []);

  const activatePathNode = useCallback((nodeId: string): void => {
    setActivePathNodeId(nodeId);
    setTreeNodes((previous) => previous.map((node) => ({ ...node, editing: node.id === nodeId && node.kind === "path" })));
    const node = treeNodes.find((candidate) => candidate.id === nodeId);
    if (node?.kind === "path") {
      setPathDataByName((previous) => (previous[node.name] ? previous : { ...previous, [node.name]: createEmptyPathData() }));
    }
  }, [treeNodes]);

  const addTreeNode = useCallback(
    (kind: TreeKind, x: number, y: number, parentId: string | null = null, slot: ChildSlot | null = null): void => {
      const parent = parentId ? treeNodes.find((node) => node.id === parentId) : null;
      if (parent && slot && childIdForSlot(parent, slot)) {
        setSaveStatus({ kind: "error", message: `That ${slot} connection already has a child.` });
        return;
      }

      const node = createTreeNode(kind, defaultNameForKind(kind, treeNodes), x, y, parentId);
      const inheritedStartWaypoint = kind === "path" && parentId ? lastWaypointBeforeChild(parentId, treeNodes, pathDataByName) : null;

      setTreeNodes((previous) => [
        ...previous.map((candidate) => {
          if (!parent || candidate.id !== parent.id || !slot) return candidate;
          return setChildForSlot(candidate, slot, node.id);
        }),
        node,
      ]);

      if (node.kind === "path") {
        setPathDataByName((current) => {
          if (current[node.name]) return current;
          return {
            ...current,
            [node.name]: inheritedStartWaypoint
              ? { ...createEmptyPathData(), waypoints: [cloneWaypointAsPathStart(inheritedStartWaypoint)] }
              : createEmptyPathData(),
          };
        });
      }

      setContextMenu(null);
      setTreeAddMenuOpen(false);
    },
    [pathDataByName, treeNodes],
  );

  const deleteNode = useCallback((nodeId: string): void => {
    setTreeNodes((previous) => {
      const nodeToDelete = previous.find((node) => node.id === nodeId);
      if (!nodeToDelete) return previous;
      const descendantIds = new Set<string>();
      const byId = new Map(previous.map((node) => [node.id, node]));
      const collect = (id: string): void => {
        if (descendantIds.has(id)) return;
        descendantIds.add(id);
        const node = byId.get(id);
        if (!node) return;
        for (const child of getNodeChildren(node)) collect(child.id);
      };
      collect(nodeId);

      return previous
        .filter((node) => !descendantIds.has(node.id))
        .map((node) => {
          let next = node;
          for (const child of getNodeChildren(node)) {
            if (descendantIds.has(child.id)) next = setChildForSlot(next, child.slot, null);
          }
          return next;
        });
    });
    if (activePathNodeId === nodeId) setActivePathNodeId(null);
    setContextMenu(null);
  }, [activePathNodeId]);

  const startRename = useCallback((node: PathTreeNode): void => {
    setRenamingNodeId(node.id);
    setRenameDraft(node.name);
    setContextMenu(null);
  }, []);

  const commitRename = useCallback((): void => {
    if (!renamingNodeId) return;
    const nextName = renameDraft.trim();
    if (!nextName) {
      setError("Name cannot be empty.");
      return;
    }

    const target = treeNodes.find((node) => node.id === renamingNodeId);
    if (!target) {
      setRenamingNodeId(null);
      setRenameDraft("");
      return;
    }

    if (target.kind === "path") {
      const oldName = target.name;
      const pathNodeCountWithOldName = treeNodes.filter((node) => node.kind === "path" && node.name === oldName).length;
      if (oldName !== nextName) {
        setKnownPathFileNames((current) => current.includes(oldName) ? current : [...current, oldName]);
      }
      setPathDataByName((current) => {
        if (current[nextName]) return current;
        const oldData = current[oldName] ?? createEmptyPathData();
        if (pathNodeCountWithOldName <= 1) {
          const { [oldName]: _removed, ...rest } = current;
          return { ...rest, [nextName]: oldData };
        }
        return { ...current, [nextName]: oldData };
      });
    }

    setTreeNodes((previous) => previous.map((node) => (node.id === renamingNodeId ? { ...node, name: nextName } : node)));
    setRenamingNodeId(null);
    setRenameDraft("");
  }, [renameDraft, renamingNodeId, setError, treeNodes]);

  const setNodeSelectedForRoutine = useCallback((nodeId: string): void => {
    const root = rootNodeFor(nodeId, treeNodes);
    if (!root) {
      setContextMenu(null);
      return;
    }

    const routineNodeIds = collectSubtreeNodeIds(root.id, treeNodes);
    const isAlreadySelected = treeNodes.some((node) => routineNodeIds.has(node.id) && node.selectedForRoutine);
    const routineCode = routineCodeForRoot(root);

    setTreeNodes((previous) => previous.map((node) => {
      if (!routineNodeIds.has(node.id)) return { ...node, selectedForRoutine: false };
      return { ...node, selectedForRoutine: !isAlreadySelected };
    }));

    setSaveStatus({
      kind: "saved",
      message: isAlreadySelected
        ? "Cleared selected routine."
        : `Selected routine code ${routineCode}; selected the parent auto and all children.`,
    });
    setContextMenu(null);
  }, [treeNodes]);

  const detachEdge = useCallback((parentId: string, childId: string, slot: ChildSlot, source: "parent" | "child"): void => {
    setTreeNodes((previous) => previous.map((node) => {
      if (node.id === parentId) return setChildForSlot(node, slot, null);
      if (node.id === childId && node.parentId === parentId) return { ...node, parentId: null };
      return node;
    }));
    setPendingConnection(null);
    setContextMenu(null);
    setSaveStatus({
      kind: "saved",
      message: source === "parent" ? "Removed the parent from that block." : "Removed the child from that block.",
    });
  }, []);

  const removeNodeParent = useCallback((childId: string): void => {
    const node = treeNodes.find((candidate) => candidate.id === childId);
    const parentConnection = getParentConnection(treeNodes, childId);
    if (!node || !parentConnection) {
      setSaveStatus({ kind: "error", message: "That block does not currently have a parent." });
      setContextMenu(null);
      return;
    }

    setTreeNodes((previous) => detachNodeFromParentInList(previous, childId));
    setPendingConnection(null);
    setContextMenu(null);
    setSaveStatus({ kind: "saved", message: `Removed ${node.name} from its parent connection.` });
  }, [treeNodes]);

  const removeNodeChildren = useCallback((parentId: string): void => {
    const parent = treeNodes.find((candidate) => candidate.id === parentId);
    if (!parent) {
      setContextMenu(null);
      return;
    }

    const children = getNodeChildren(parent);
    if (children.length === 0) {
      setSaveStatus({ kind: "error", message: "That block does not currently have a child." });
      setContextMenu(null);
      return;
    }

    setTreeNodes((previous) => previous.map((node) => {
      if (node.id === parentId) {
        return children.reduce<PathTreeNode>((current, child) => setChildForSlot(current, child.slot, null), node);
      }
      if (children.some((child) => child.id === node.id && node.parentId === parentId)) return { ...node, parentId: null };
      return node;
    }));
    setPendingConnection(null);
    setContextMenu(null);
    setSaveStatus({ kind: "saved", message: `Removed ${children.length === 1 ? "the child" : "all direct children"} from ${parent.name}.` });
  }, [treeNodes]);

  const beginOverrideConnection = useCallback((mode: PendingTreeConnection["mode"], parentId: string | null, childId: string | null, slot: ChildSlot): void => {
    setPendingConnection({ mode, parentId, childId, slot });
    setContextMenu(null);
    setSaveStatus({
      kind: "idle",
      message: mode === "connectParent"
        ? "Click the block that should become the new parent. Existing parent/child links will be overwritten."
        : "Click the block that should become the new child. Existing parent/child links will be overwritten.",
    });
  }, []);

  const beginNodeConnectAsParent = useCallback((childId: string): void => {
    const parentConnection = getParentConnection(treeNodes, childId);
    beginOverrideConnection("connectParent", parentConnection?.parentId ?? null, childId, parentConnection?.slot ?? "next");
  }, [beginOverrideConnection, treeNodes]);

  const beginNodeConnectAsChild = useCallback((parentId: string): void => {
    const parent = treeNodes.find((node) => node.id === parentId);
    if (!parent) return;
    const slot = defaultSlotForParent(parent, "next");
    beginOverrideConnection("connectChild", parentId, childIdForSlot(parent, slot), slot);
  }, [beginOverrideConnection, treeNodes]);

  const connectPendingToNode = useCallback((targetId: string): boolean => {
    if (!pendingConnection) return false;

    const edgeParent = pendingConnection.parentId ? treeNodes.find((node) => node.id === pendingConnection.parentId) ?? null : null;
    const edgeChild = pendingConnection.childId ? treeNodes.find((node) => node.id === pendingConnection.childId) ?? null : null;
    const target = treeNodes.find((node) => node.id === targetId) ?? null;

    if (!target) {
      setPendingConnection(null);
      setSaveStatus({ kind: "error", message: "Could not find the clicked block." });
      return true;
    }

    if (pendingConnection.mode === "connectChild") {
      if (!edgeParent) {
        setPendingConnection(null);
        setSaveStatus({ kind: "error", message: "Could not find the parent block for that connection." });
        return true;
      }
      if (target.id === edgeParent.id) {
        setSaveStatus({ kind: "error", message: "A block cannot connect to itself." });
        return true;
      }
      if (collectSubtreeNodeIds(target.id, treeNodes).has(edgeParent.id)) {
        setSaveStatus({ kind: "error", message: "That connection would create a loop in the path tree." });
        return true;
      }

      const previousChildId = childIdForSlot(edgeParent, pendingConnection.slot);
      setTreeNodes((previous) => {
        let next = previous;
        next = detachNodeFromParentInList(next, target.id);

        return next.map((node) => {
          if (node.id === edgeParent.id) return setChildForSlot(node, pendingConnection.slot, target.id);
          if (previousChildId && previousChildId !== target.id && node.id === previousChildId && node.parentId === edgeParent.id) return { ...node, parentId: null };
          if (node.id === target.id) return { ...node, parentId: edgeParent.id };
          return node;
        });
      });
      setPendingConnection(null);
      setContextMenu(null);
      setSaveStatus({ kind: "saved", message: `Connected ${target.name} as the ${pendingConnection.slot} child of ${edgeParent.name}.` });
      return true;
    }

    if (!edgeChild) {
      setPendingConnection(null);
      setSaveStatus({ kind: "error", message: "Could not find the child block for that connection." });
      return true;
    }
    if (target.id === edgeChild.id) {
      setSaveStatus({ kind: "error", message: "A block cannot connect to itself." });
      return true;
    }
    if (collectSubtreeNodeIds(edgeChild.id, treeNodes).has(target.id)) {
      setSaveStatus({ kind: "error", message: "That connection would create a loop in the path tree." });
      return true;
    }

    const targetSlot = defaultSlotForParent(target, pendingConnection.slot);
    const previousTargetChildId = childIdForSlot(target, targetSlot);

    setTreeNodes((previous) => {
      let next = previous;
      if (pendingConnection.parentId) {
        next = next.map((node) => (node.id === pendingConnection.parentId ? setChildForSlot(node, pendingConnection.slot, null) : node));
      }
      next = detachNodeFromParentInList(next, target.id);
      next = detachNodeFromParentInList(next, edgeChild.id);

      return next.map((node) => {
        if (node.id === target.id) return setChildForSlot(node, targetSlot, edgeChild.id);
        if (previousTargetChildId && previousTargetChildId !== edgeChild.id && node.id === previousTargetChildId && node.parentId === target.id) return { ...node, parentId: null };
        if (node.id === edgeChild.id) return { ...node, parentId: target.id };
        return node;
      });
    });

    setPendingConnection(null);
    setContextMenu(null);
    setSaveStatus({ kind: "saved", message: `Connected ${target.name} as the parent of ${edgeChild.name}.` });
    return true;
  }, [pendingConnection, treeNodes]);

  const addPathElement = useCallback((): void => {
    if (!activePathName) {
      setError("Select a path block for editing before adding path elements.");
      return;
    }

    updateActivePathData((current) => {
      const currentMaxPosition = maxPathPosition(current);
      if (addElementKind !== "waypoint" && current.waypoints.length < 2) {
        setSaveStatus({ kind: "error", message: "Add at least two waypoints before adding path-position elements." });
        return current;
      }

      if (addElementKind === "waypoint") {
        return { ...current, waypoints: [...current.waypoints, createDefaultWaypoint(settings)] };
      }
      if (addElementKind === "rotationTarget") {
        return { ...current, rotationTargets: [...current.rotationTargets, createDefaultRotationTarget(currentMaxPosition)] };
      }
      if (addElementKind === "eventTrigger") {
        return { ...current, events: [...current.events, createDefaultEventTrigger(currentMaxPosition)] };
      }
      return { ...current, constraintZones: [...current.constraintZones, createDefaultConstraintZone(currentMaxPosition)] };
    });
  }, [activePathName, addElementKind, settings, setError, updateActivePathData]);

  const updateWaypoint = useCallback((id: string, patch: Partial<Waypoint>): void => {
    updateActivePathData((current) => ({
      ...current,
      waypoints: current.waypoints.map((waypoint) => (waypoint.id === id ? { ...waypoint, ...patch } : waypoint)),
    }));
  }, [updateActivePathData]);

  const updateRotationTarget = useCallback((id: string, patch: Partial<RotationTarget>): void => {
    updateActivePathData((current) => ({
      ...current,
      rotationTargets: current.rotationTargets.map((target) => (target.id === id ? { ...target, ...patch } : target)),
    }));
  }, [updateActivePathData]);

  const updateEventTrigger = useCallback((id: string, patch: Partial<EventTrigger>): void => {
    updateActivePathData((current) => ({
      ...current,
      events: current.events.map((event) => (event.id === id ? { ...event, ...patch } : event)),
    }));
  }, [updateActivePathData]);

  const updateConstraintZone = useCallback((id: string, patch: Partial<ConstraintZone>): void => {
    updateActivePathData((current) => ({
      ...current,
      constraintZones: current.constraintZones.map((zone) => {
        if (zone.id !== id) return zone;
        const updated = { ...zone, ...patch };
        const maxPositionValue = maxPathPosition(current);
        updated.startPosition = clamp(updated.startPosition, 0, maxPositionValue);
        updated.endPosition = clamp(updated.endPosition, 0, maxPositionValue);
        if (updated.startPosition > updated.endPosition) {
          const temp = updated.startPosition;
          updated.startPosition = updated.endPosition;
          updated.endPosition = temp;
        }
        return updated;
      }),
    }));
  }, [updateActivePathData]);

  const deleteWaypoint = useCallback((id: string): void => {
    updateActivePathData((current) => {
      const waypoints = current.waypoints.filter((waypoint) => waypoint.id !== id);
      const nextMaxPosition = Math.max(0, waypoints.length - 1);

      return {
        ...current,
        waypoints,
        rotationTargets: waypoints.length >= 2
          ? current.rotationTargets.map((target) => ({ ...target, position: clamp(target.position, 0, nextMaxPosition) }))
          : [],
        events: waypoints.length >= 2
          ? current.events.map((event) => ({ ...event, position: clamp(event.position, 0, nextMaxPosition) }))
          : [],
        constraintZones: waypoints.length >= 2
          ? current.constraintZones.map((zone) => ({
              ...zone,
              startPosition: clamp(zone.startPosition, 0, nextMaxPosition),
              endPosition: clamp(zone.endPosition, 0, nextMaxPosition),
            }))
          : [],
      };
    });
    setModal((current) => (current?.kind === "waypoint" && current.id === id ? null : current));
  }, [updateActivePathData]);

  const deleteRotationTarget = useCallback((id: string): void => {
    updateActivePathData((current) => ({
      ...current,
      rotationTargets: current.rotationTargets.filter((target) => target.id !== id),
    }));
    setModal((current) => (current?.kind === "rotationTarget" && current.id === id ? null : current));
  }, [updateActivePathData]);

  const deleteEventTrigger = useCallback((id: string): void => {
    updateActivePathData((current) => ({
      ...current,
      events: current.events.filter((event) => event.id !== id),
    }));
    setModal((current) => (current?.kind === "eventTrigger" && current.id === id ? null : current));
  }, [updateActivePathData]);

  const deleteConstraintZone = useCallback((id: string): void => {
    updateActivePathData((current) => ({
      ...current,
      constraintZones: current.constraintZones.filter((zone) => zone.id !== id),
    }));
    setModal((current) => (current?.kind === "constraintZone" && current.id === id ? null : current));
  }, [updateActivePathData]);

  const modalPositionFromEvent = useCallback((event: ReactMouseEvent<HTMLElement>): PixelPoint => {
    const appRect = appRef.current?.getBoundingClientRect();
    if (!appRect) return { x: 80, y: 80 };
    return {
      x: clamp(event.clientX - appRect.left + 12, 8, Math.max(8, appRect.width - 260)),
      y: clamp(event.clientY - appRect.top + 12, 48, Math.max(48, appRect.height - 260)),
    };
  }, []);

  const beginWaypointDrag = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>, waypoint: Waypoint): void => {
      if (fieldOneSize.width <= 0 || fieldOneSize.height <= 0) return;
      const fieldRect = fieldOneRef.current?.getBoundingClientRect();
      if (!fieldRect) return;
      const startMouse = { x: event.clientX, y: event.clientY };
      const startPoint = pointToPixels(settings, fieldOneSize, waypoint);
      let moved = false;

      const onPointerMove = (moveEvent: PointerEvent): void => {
        const dx = moveEvent.clientX - startMouse.x;
        const dy = moveEvent.clientY - startMouse.y;
        if (Math.abs(dx) > 2 || Math.abs(dy) > 2) moved = true;
        const nextPoint = clampMeterPoint(settings, pixelsToPoint(settings, fieldOneSize, { x: startPoint.x + dx, y: startPoint.y + dy }));
        updateWaypoint(waypoint.id, nextPoint);
      };

      const onPointerUp = (upEvent: PointerEvent): void => {
        window.removeEventListener("pointermove", onPointerMove);
        window.removeEventListener("pointerup", onPointerUp);
        dragOperationRef.current = null;
        if (!moved) {
          const appRect = appRef.current?.getBoundingClientRect();
          setModal({
            kind: "waypoint",
            id: waypoint.id,
            x: appRect ? clamp(upEvent.clientX - appRect.left + 12, 8, appRect.width - 260) : 80,
            y: appRect ? clamp(upEvent.clientY - appRect.top + 12, 48, appRect.height - 220) : 80,
          });
        }
      };

      window.addEventListener("pointermove", onPointerMove);
      window.addEventListener("pointerup", onPointerUp);
      dragOperationRef.current = () => {
        window.removeEventListener("pointermove", onPointerMove);
        window.removeEventListener("pointerup", onPointerUp);
      };
    },
    [fieldOneRef, fieldOneSize, settings, updateWaypoint],
  );

  const beginWaypointRotate = useCallback(
    (event: ReactPointerEvent<HTMLButtonElement>, waypoint: Waypoint): void => {
      event.stopPropagation();
      if (fieldOneSize.width <= 0 || fieldOneSize.height <= 0) return;
      const fieldRect = fieldOneRef.current?.getBoundingClientRect();
      if (!fieldRect) return;

      const onPointerMove = (moveEvent: PointerEvent): void => {
        const center = pointToPixels(settings, fieldOneSize, waypoint);
        const angle = pointerToCompassDegrees(
          moveEvent.clientX,
          moveEvent.clientY,
          fieldRect.left + center.x,
          fieldRect.top + center.y,
        );
        updateWaypoint(waypoint.id, { angle: Number(angle.toFixed(2)) });
      };

      const onPointerUp = (): void => {
        window.removeEventListener("pointermove", onPointerMove);
        window.removeEventListener("pointerup", onPointerUp);
        dragOperationRef.current = null;
      };

      window.addEventListener("pointermove", onPointerMove);
      window.addEventListener("pointerup", onPointerUp);
      dragOperationRef.current = () => {
        window.removeEventListener("pointermove", onPointerMove);
        window.removeEventListener("pointerup", onPointerUp);
      };
    },
    [fieldOneRef, fieldOneSize, settings, updateWaypoint],
  );

  const beginRotationTargetRotate = useCallback(
    (event: ReactPointerEvent<HTMLButtonElement>, target: RotationTarget): void => {
      event.stopPropagation();
      if (fieldOneSize.width <= 0 || fieldOneSize.height <= 0) return;
      const fieldRect = fieldOneRef.current?.getBoundingClientRect();
      const point = pointAtPathPosition(activePathData.waypoints, target.position);
      if (!fieldRect || !point) return;

      const onPointerMove = (moveEvent: PointerEvent): void => {
        const center = pointToPixels(settings, fieldOneSize, point);
        const angle = pointerToCompassDegrees(
          moveEvent.clientX,
          moveEvent.clientY,
          fieldRect.left + center.x,
          fieldRect.top + center.y,
        );
        updateRotationTarget(target.id, { angle: Number(angle.toFixed(2)) });
      };

      const onPointerUp = (): void => {
        window.removeEventListener("pointermove", onPointerMove);
        window.removeEventListener("pointerup", onPointerUp);
        dragOperationRef.current = null;
      };

      window.addEventListener("pointermove", onPointerMove);
      window.addEventListener("pointerup", onPointerUp);
      dragOperationRef.current = () => {
        window.removeEventListener("pointermove", onPointerMove);
        window.removeEventListener("pointerup", onPointerUp);
      };
    },
    [activePathData.waypoints, fieldOneRef, fieldOneSize, settings, updateRotationTarget],
  );

  const beginPathPositionDrag = useCallback(
    (event: ReactPointerEvent<HTMLElement>, updatePosition: (position: number) => void): void => {
      event.stopPropagation();
      if (fieldOneSize.width <= 0 || fieldOneSize.height <= 0 || activePathData.waypoints.length < 2) return;
      const fieldRect = fieldOneRef.current?.getBoundingClientRect();
      if (!fieldRect) return;

      const moveTo = (clientX: number, clientY: number): void => {
        const position = nearestPathPositionFromPixel(settings, fieldOneSize, activePathData.waypoints, {
          x: clientX - fieldRect.left,
          y: clientY - fieldRect.top,
        });
        updatePosition(Number(position.toFixed(2)));
      };

      moveTo(event.clientX, event.clientY);

      const onPointerMove = (moveEvent: PointerEvent): void => moveTo(moveEvent.clientX, moveEvent.clientY);
      const onPointerUp = (): void => {
        window.removeEventListener("pointermove", onPointerMove);
        window.removeEventListener("pointerup", onPointerUp);
        dragOperationRef.current = null;
      };

      window.addEventListener("pointermove", onPointerMove);
      window.addEventListener("pointerup", onPointerUp);
      dragOperationRef.current = () => {
        window.removeEventListener("pointermove", onPointerMove);
        window.removeEventListener("pointerup", onPointerUp);
      };
    },
    [activePathData.waypoints, fieldOneRef, fieldOneSize, settings],
  );

  const addWaypointAfterIfLast = useCallback((waypoint: Waypoint): void => {
    const last = activePathData.waypoints[activePathData.waypoints.length - 1];
    if (!last || last.id !== waypoint.id) return;
    updateActivePathData((current) => ({
      ...current,
      waypoints: [
        ...current.waypoints,
        {
          ...createDefaultWaypoint(settings),
          x: clamp(waypoint.x + 0.75, 0, settings.fieldLengthMeters),
          y: waypoint.y,
          angle: waypoint.angle,
          handoff: waypoint.handoff,
          profiled: waypoint.profiled,
        },
      ],
    }));
  }, [activePathData.waypoints, settings, updateActivePathData]);

  const beginTreePan = useCallback((event: ReactPointerEvent<HTMLDivElement>): void => {
    if ((event.target as HTMLElement).closest(".tree-node, .tree-menu, .tree-add-menu")) return;
    const start = { x: event.clientX - pan.x, y: event.clientY - pan.y };

    const onPointerMove = (moveEvent: PointerEvent): void => {
      setPan({ x: moveEvent.clientX - start.x, y: moveEvent.clientY - start.y });
    };

    const onPointerUp = (): void => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      dragOperationRef.current = null;
    };

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    dragOperationRef.current = () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
    };
  }, [pan.x, pan.y]);

  const resetTreePan = useCallback((event: ReactMouseEvent<HTMLDivElement>): void => {
    const target = event.target as HTMLElement;
    if (target.closest(".tree-node, .tree-menu, .tree-add-menu, .tree-edge-label")) return;
    event.stopPropagation();
    setPan({ x: 0, y: 0 });
    setSaveStatus({ kind: "saved", message: "Returned the path tree canvas to the origin." });
  }, []);

  const beginNodeDrag = useCallback((event: ReactPointerEvent<HTMLDivElement>, node: PathTreeNode): void => {
    event.stopPropagation();
    const startMouse = { x: event.clientX, y: event.clientY };
    const startNode = { x: node.x, y: node.y };
    let moved = false;

    const onPointerMove = (moveEvent: PointerEvent): void => {
      const dx = moveEvent.clientX - startMouse.x;
      const dy = moveEvent.clientY - startMouse.y;
      if (Math.abs(dx) > 2 || Math.abs(dy) > 2) moved = true;
      setTreeNodes((previous) => previous.map((candidate) => (candidate.id === node.id ? { ...candidate, x: startNode.x + dx, y: startNode.y + dy } : candidate)));
    };

    const onPointerUp = (): void => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      dragOperationRef.current = null;
      if (!moved && pendingConnection) {
        connectPendingToNode(node.id);
        return;
      }
      if (!moved && node.kind === "path") activatePathNode(node.id);
    };

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    dragOperationRef.current = () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
    };
  }, [activatePathNode, connectPendingToNode, pendingConnection]);

  const showCanvasMenu = useCallback((event: ReactMouseEvent<HTMLDivElement>): void => {
    if ((event.target as HTMLElement).closest(".tree-node, .tree-edge-label")) return;
    event.preventDefault();
    const appRect = appRef.current?.getBoundingClientRect();
    const treeRect = treeViewportRef.current?.getBoundingClientRect();
    if (!appRect || !treeRect) return;
    setContextMenu({
      kind: "canvas",
      x: event.clientX - appRect.left,
      y: event.clientY - appRect.top,
      canvasX: event.clientX - treeRect.left - pan.x,
      canvasY: event.clientY - treeRect.top - pan.y,
      nodeId: null,
    });
  }, [pan.x, pan.y]);

  const showNodeMenu = useCallback((event: ReactMouseEvent<HTMLDivElement>, nodeId: string): void => {
    event.preventDefault();
    event.stopPropagation();
    const appRect = appRef.current?.getBoundingClientRect();
    const treeRect = treeViewportRef.current?.getBoundingClientRect();
    if (!appRect || !treeRect) return;
    setContextMenu({
      kind: "node",
      x: event.clientX - appRect.left,
      y: event.clientY - appRect.top,
      canvasX: event.clientX - treeRect.left - pan.x,
      canvasY: event.clientY - treeRect.top - pan.y,
      nodeId,
    });
  }, [pan.x, pan.y]);

  const showEdgeMenu = useCallback((event: ReactMouseEvent<SVGTextElement>, parentId: string, childId: string, slot: ChildSlot, label: string): void => {
    event.preventDefault();
    event.stopPropagation();
    const appRect = appRef.current?.getBoundingClientRect();
    const treeRect = treeViewportRef.current?.getBoundingClientRect();
    if (!appRect || !treeRect) return;
    setContextMenu({
      kind: "edge",
      x: event.clientX - appRect.left,
      y: event.clientY - appRect.top,
      canvasX: event.clientX - treeRect.left - pan.x,
      canvasY: event.clientY - treeRect.top - pan.y,
      nodeId: null,
      edgeParentId: parentId,
      edgeChildId: childId,
      edgeSlot: slot,
      edgeLabel: label,
    });
  }, [pan.x, pan.y]);

  const beginModalDrag = useCallback((event: ReactPointerEvent<HTMLDivElement>): void => {
    if (!modal) return;
    const appRect = appRef.current?.getBoundingClientRect();
    if (!appRect) return;
    draggingModalRef.current = { offsetX: event.clientX - appRect.left - modal.x, offsetY: event.clientY - appRect.top - modal.y };

    const onPointerMove = (moveEvent: PointerEvent): void => {
      const offset = draggingModalRef.current;
      if (!offset) return;
      const nextX = moveEvent.clientX - appRect.left - offset.offsetX;
      const nextY = moveEvent.clientY - appRect.top - offset.offsetY;
      setModal((current) => (current ? { ...current, x: clamp(nextX, 4, appRect.width - 260), y: clamp(nextY, 44, appRect.height - 120) } : current));
    };

    const onPointerUp = (): void => {
      draggingModalRef.current = null;
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      dragOperationRef.current = null;
    };

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    dragOperationRef.current = () => {
      draggingModalRef.current = null;
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
    };
  }, [modal]);

  const readImageFile = useCallback((event: ChangeEvent<HTMLInputElement>): void => {
    const file = event.currentTarget.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onerror = () => setError("Could not read the selected field image.");
    reader.onload = () => {
      const result = reader.result;
      if (typeof result === "string") updateSettings({ fieldImageDataUrl: result });
    };
    reader.readAsDataURL(file);
  }, [setError, updateSettings]);

  const selectRobotCodeProject = useCallback(async (): Promise<void> => {
    if (!window.electronAPI) {
      setError("Electron preload API is unavailable. Check that preload.js exposes window.electronAPI.");
      return;
    }

    try {
      const folder = await window.electronAPI.pickDirectory();
      if (folder) updateSettings({ robotCodeProjectFolder: folder });
    } catch (error) {
      console.error(error);
      setError("Could not select a robot code project folder.");
    }
  }, [setError, updateSettings]);

  const writeTextFile = useCallback(async (fileName: string, text: string): Promise<void> => {
    if (!settings.robotCodeProjectFolder) throw new Error("Select a robot code project before saving.");
    if (!window.electronAPI) throw new Error("Electron preload API is unavailable.");
    const folder = getVoyagerDeployFolder(settings.robotCodeProjectFolder);
    if (window.electronAPI.makeDirectory) await window.electronAPI.makeDirectory(folder);
    await window.electronAPI.writeTextFile(folder, fileName, text);
  }, [settings.robotCodeProjectFolder]);

  const deleteTextFile = useCallback(async (fileName: string): Promise<void> => {
    if (!settings.robotCodeProjectFolder) throw new Error("Select a robot code project before deleting old path files.");
    if (!window.electronAPI) throw new Error("Electron preload API is unavailable.");
    if (!window.electronAPI.deleteTextFile) throw new Error("Electron preload API is missing deleteTextFile. Add the fs:delete-text-file bridge before deleting stale path files.");
    const folder = getVoyagerDeployFolder(settings.robotCodeProjectFolder);
    await window.electronAPI.deleteTextFile(folder, fileName);
  }, [settings.robotCodeProjectFolder]);

  const publishSelectedRoutine = useCallback((): void => {
    if (!selectedRoutineCode) {
      setError("Select a routine in the path tree before publishing.");
      return;
    }

    setSelectedAutoEntry(selectedRoutineCode);
    setSaveStatus({ kind: "saved", message: `Published routine ${selectedRoutineCode} to /Voyager/SelectedAuto.` });
  }, [selectedRoutineCode, setError, setSelectedAutoEntry]);

  const savePathByName = useCallback(async (pathName: string): Promise<void> => {
    const data = pathDataByName[pathName] ?? createEmptyPathData();
    await writeTextFile(`${sanitizeFileName(pathName)}.json`, `${JSON.stringify(serializePathData(data), null, 2)}\n`);
    setKnownPathFileNames((current) => current.includes(pathName) ? current : [...current, pathName]);
  }, [pathDataByName, writeTextFile]);

  const deletePathFileByName = useCallback(async (pathName: string): Promise<void> => {
    await deleteTextFile(`${sanitizeFileName(pathName)}.json`);
  }, [deleteTextFile]);

  const saveCurrentPath = useCallback(async (): Promise<void> => {
    if (!activePathName) {
      setError("No path block is currently selected for editing.");
      return;
    }
    try {
      setSaveStatus({ kind: "saving", message: `Saving ${activePathName}...` });
      await savePathByName(activePathName);
      setSaveStatus({ kind: "saved", message: `Saved ${activePathName}.` });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not save the current path.";
      setSaveStatus({ kind: "error", message });
    }
  }, [activePathName, savePathByName, setError]);

  const saveAll = useCallback(async (): Promise<void> => {
    try {
      setSaveStatus({ kind: "saving", message: "Saving all Voyager files..." });
      const pathNamesFromNodes = Array.from(new Set(treeNodes.filter((node): node is PathTreePathNode => node.kind === "path").map((node) => node.name)));
      const pathNameSet = new Set(pathNamesFromNodes);
      const stalePathNames = Array.from(new Set([...Object.keys(pathDataByName), ...knownPathFileNames])).filter((pathName) => !pathNameSet.has(pathName));

      for (const pathName of stalePathNames) await deletePathFileByName(pathName);
      for (const pathName of pathNamesFromNodes) await savePathByName(pathName);
      await writeTextFile("auto_config.json", `${JSON.stringify(serializeAutoConfig(treeNodes), null, 2)}\n`);

      setPathDataByName((current) => Object.fromEntries(Object.entries(current).filter(([pathName]) => pathNameSet.has(pathName))));
      setKnownPathFileNames(pathNamesFromNodes);
      setSaveStatus({
        kind: "saved",
        message: stalePathNames.length > 0
          ? `Saved all paths and auto_config.json. Deleted ${stalePathNames.length} stale path file${stalePathNames.length === 1 ? "" : "s"}.`
          : "Saved all paths and auto_config.json.",
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not save Voyager files.";
      setSaveStatus({ kind: "error", message });
    }
  }, [deletePathFileByName, knownPathFileNames, pathDataByName, savePathByName, treeNodes, writeTextFile]);

  useEffect(() => {
    if (!hydrated || !settings.autoSave || !settings.robotCodeProjectFolder) return;
    if (autoSaveTimerRef.current) window.clearTimeout(autoSaveTimerRef.current);
    autoSaveTimerRef.current = window.setTimeout(() => {
      void saveAll();
    }, 900);
  }, [hydrated, pathDataByName, saveAll, settings.autoSave, settings.robotCodeProjectFolder, treeNodes]);

  useEffect(() => {
    return () => {
      if (persistTimerRef.current) window.clearTimeout(persistTimerRef.current);
      if (autoSaveTimerRef.current) window.clearTimeout(autoSaveTimerRef.current);
      if (dragOperationRef.current) dragOperationRef.current();
    };
  }, []);

  const fieldBackgroundStyle = useMemo<CSSProperties>(() => ({
    aspectRatio: `${settings.fieldLengthMeters} / ${settings.fieldWidthMeters}`,
    backgroundImage: settings.fieldImageDataUrl ? `url(${settings.fieldImageDataUrl})` : undefined,
  }), [settings.fieldImageDataUrl, settings.fieldLengthMeters, settings.fieldWidthMeters]);

  const treeEdges = useMemo(() => {
    const byId = new Map(treeNodes.map((node) => [node.id, node]));
    return treeNodes
      .flatMap((node) => getNodeChildren(node).map((child) => ({ parent: node, child: byId.get(child.id), label: child.label, slot: child.slot })))
      .filter((edge): edge is { parent: PathTreeNode; child: PathTreeNode; label: string; slot: ChildSlot } => Boolean(edge.child));
  }, [treeNodes]);

  const activeWaypointModal = modal?.kind === "waypoint" ? activePathData.waypoints.find((waypoint) => waypoint.id === modal.id) ?? null : null;
  const activeRotationTargetModal = modal?.kind === "rotationTarget" ? activePathData.rotationTargets.find((target) => target.id === modal.id) ?? null : null;
  const activeEventTriggerModal = modal?.kind === "eventTrigger" ? activePathData.events.find((event) => event.id === modal.id) ?? null : null;
  const activeConstraintZoneModal = modal?.kind === "constraintZone" ? activePathData.constraintZones.find((zone) => zone.id === modal.id) ?? null : null;

  return (
    <div ref={appRef} className="voyager-app" onClick={closeMenus}>
      <header className="voyager-nav">
        <div className="nav-left">
          <div className="app-icon" aria-hidden="true">V</div>
          <strong className="app-name">Voyager</strong>
          <div className="save-control" onClick={(event) => event.stopPropagation()}>
            <button className="nav-button" type="button" onClick={() => setSaveMenuOpen((open) => !open)}>
              Save <span aria-hidden="true">▾</span>
            </button>
            {saveMenuOpen ? (
              <div className="dropdown-menu save-menu">
                <button type="button" onClick={() => void saveCurrentPath()}>Save this path</button>
                <button type="button" onClick={() => void saveAll()}>Save all paths</button>
                <label className="dropdown-check">
                  <input
                    type="checkbox"
                    checked={settings.autoSave}
                    onChange={(event) => updateSettings({ autoSave: event.target.checked })}
                  />
                  Save automatically
                </label>
              </div>
            ) : null}
          </div>
          <button className="nav-button" type="button" onClick={(event) => { event.stopPropagation(); setSettingsOpen(true); }}>
            Settings
          </button>
          <span className={`save-status save-status-${saveStatus.kind}`} title={saveStatus.message}>{saveStatus.message}</span>
        </div>
      </header>

      <main className="workspace">
        <section ref={leftPanelRef} className="left-panel">
          <section className="field-card">
            <div className="field-toolbar">
              <div>
                <h2>Auto maker field</h2>
                <p>{activePathName ? `Editing ${activePathName}` : "Select a path block to edit"}</p>
              </div>
              <div className="field-actions">
                <select value={addElementKind} onChange={(event) => setAddElementKind(event.target.value as AddElementKind)}>
                  <option value="waypoint">Waypoint</option>
                  <option value="rotationTarget">Rotation Target</option>
                  <option value="eventTrigger">Event Trigger</option>
                  <option value="constraintZone">Constraint Zone</option>
                </select>
                <button type="button" onClick={addPathElement}>Add</button>
              </div>
            </div>

            <div ref={fieldOneRef} className={`field-surface ${settings.fieldImageDataUrl ? "has-field-image" : ""}`} style={fieldBackgroundStyle}>
              {!settings.fieldImageDataUrl ? <div className="field-placeholder">Field image<br />{formatNumber(settings.fieldLengthMeters)} × {formatNumber(settings.fieldWidthMeters)} m</div> : null}
              <svg className="field-svg" viewBox={`0 0 ${Math.max(1, fieldOneSize.width)} ${Math.max(1, fieldOneSize.height)}`}>
                {activePathData.waypoints.slice(1).map((waypoint, index) => {
                  const previous = activePathData.waypoints[index];
                  const a = pointToPixels(settings, fieldOneSize, previous);
                  const b = pointToPixels(settings, fieldOneSize, waypoint);
                  return <line key={`${previous.id}-${waypoint.id}`} className="path-line" x1={a.x} y1={a.y} x2={b.x} y2={b.y} />;
                })}
                {activePathData.constraintZones.map((zone) => {
                  const points = pathPixelsBetween(settings, fieldOneSize, activePathData.waypoints, zone.startPosition, zone.endPosition);
                  if (points.length < 2) return null;
                  return <polyline key={zone.id} className="constraint-zone-line" points={points.map((point) => `${point.x},${point.y}`).join(" ")} />;
                })}
              </svg>

              {selectedRoutineWaypointPreviews.map((preview) => (
                <div
                  key={preview.key}
                  className="robot-marker waypoint-marker"
                  style={{
                    ...robotRenderStyle(settings, fieldOneSize, preview.waypoint.x, preview.waypoint.y, preview.waypoint.angle),
                    border: "1.5px solid rgba(107, 114, 128, 0.95)",
                    background: "rgba(156, 163, 175, 0.38)",
                    color: "#e5e7eb",
                    opacity: 0.62,
                    pointerEvents: "none",
                    zIndex: 8,
                  }}
                  title={`${preview.pathName} waypoint ${preview.index + 1}`}
                >
                  <span>{preview.index + 1}</span>
                </div>
              ))}

              {activePathData.waypoints.map((waypoint, index) => (
                <div key={`circle-${waypoint.id}`} className="handoff-circle" style={handoffCircleStyle(settings, fieldOneSize, waypoint)}>
                  <span>{formatNumber(waypoint.handoff, 2)}m</span>
                </div>
              ))}

              {activePathData.waypoints.map((waypoint, index) => (
                <div
                  key={waypoint.id}
                  className="robot-marker waypoint-marker"
                  style={robotRenderStyle(settings, fieldOneSize, waypoint.x, waypoint.y, waypoint.angle)}
                  onPointerDown={(event) => beginWaypointDrag(event, waypoint)}
                  onDoubleClick={(event) => {
                    event.stopPropagation();
                    addWaypointAfterIfLast(waypoint);
                  }}
                >
                  <span>{index + 1}</span>
                  <button className="rotation-handle" type="button" aria-label="Rotate waypoint" onPointerDown={(event) => beginWaypointRotate(event, waypoint)} />
                </div>
              ))}

              {activePathData.rotationTargets.map((target) => {
                const point = pointAtPathPosition(activePathData.waypoints, target.position);
                if (!point) return null;
                return (
                  <div
                    key={target.id}
                    className="robot-marker rotation-target-marker"
                    style={robotRenderStyle(settings, fieldOneSize, point.x, point.y, target.angle)}
                    onPointerDown={(event) => beginPathPositionDrag(event, (position) => updateRotationTarget(target.id, { position }))}
                    onClick={(event) => {
                      event.stopPropagation();
                      const pos = modalPositionFromEvent(event);
                      setModal({ kind: "rotationTarget", id: target.id, x: pos.x, y: pos.y });
                    }}
                  >
                    <span>RT</span>
                    <button className="rotation-handle" type="button" aria-label="Rotate rotation target" onPointerDown={(event) => beginRotationTargetRotate(event, target)} />
                  </div>
                );
              })}

              {activePathData.events.map((eventTrigger) => {
                const point = pointAtPathPosition(activePathData.waypoints, eventTrigger.position);
                if (!point) return null;
                const pixel = pointToPixels(settings, fieldOneSize, point);
                return (
                  <button
                    key={eventTrigger.id}
                    className="event-trigger-marker"
                    type="button"
                    style={{ left: `${pixel.x}px`, top: `${pixel.y}px` }}
                    title={eventTrigger.name}
                    onPointerDown={(event) => beginPathPositionDrag(event, (position) => updateEventTrigger(eventTrigger.id, { position }))}
                    onClick={(event) => {
                      event.stopPropagation();
                      const pos = modalPositionFromEvent(event);
                      setModal({ kind: "eventTrigger", id: eventTrigger.id, x: pos.x, y: pos.y });
                    }}
                  />
                );
              })}

              {activePathData.constraintZones.map((zone) => {
                const start = pointAtPathPosition(activePathData.waypoints, zone.startPosition);
                const end = pointAtPathPosition(activePathData.waypoints, zone.endPosition);
                if (!start || !end) return null;
                const startPixel = pointToPixels(settings, fieldOneSize, start);
                const endPixel = pointToPixels(settings, fieldOneSize, end);
                return (
                  <React.Fragment key={zone.id}>
                    <button
                      className="constraint-handle constraint-handle-start"
                      type="button"
                      style={{ left: `${startPixel.x}px`, top: `${startPixel.y}px` }}
                      onPointerDown={(event) => beginPathPositionDrag(event, (position) => updateConstraintZone(zone.id, { startPosition: position }))}
                      onClick={(event) => {
                        event.stopPropagation();
                        const pos = modalPositionFromEvent(event);
                        setModal({ kind: "constraintZone", id: zone.id, x: pos.x, y: pos.y });
                      }}
                    />
                    <button
                      className="constraint-handle constraint-handle-end"
                      type="button"
                      style={{ left: `${endPixel.x}px`, top: `${endPixel.y}px` }}
                      onPointerDown={(event) => beginPathPositionDrag(event, (position) => updateConstraintZone(zone.id, { endPosition: position }))}
                      onClick={(event) => {
                        event.stopPropagation();
                        const pos = modalPositionFromEvent(event);
                        setModal({ kind: "constraintZone", id: zone.id, x: pos.x, y: pos.y });
                      }}
                    />
                  </React.Fragment>
                );
              })}
            </div>
          </section>

          <section className="field-card">
            <div className="field-toolbar">
              <div>
                <h2>Live robot position</h2>
                <p>{connected ? "Robot connected" : "Robot disconnected — showing origin"}</p>
              </div>
              <div className="connection-actions" style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span className={`connection-pill ${connected ? "connected" : "disconnected"}`}>{connected ? "connected" : "offline"}</span>
                <button
                  className="publish-routine-button"
                  type="button"
                  title={selectedRoutineCode ? `Publish ${selectedRoutineCode} to /Voyager/SelectedAuto` : "Select a routine in the path tree first"}
                  onClick={publishSelectedRoutine}
                >
                  Publish Routine
                </button>
              </div>
            </div>
            <div ref={fieldTwoRef} className={`field-surface ${settings.fieldImageDataUrl ? "has-field-image" : ""}`} style={fieldBackgroundStyle}>
              {!settings.fieldImageDataUrl ? <div className="field-placeholder">Live field<br />{formatNumber(settings.fieldLengthMeters)} × {formatNumber(settings.fieldWidthMeters)} m</div> : null}
              <div
                className="origin-label"
                style={{
                  left: `${pointToPixels(settings, fieldTwoSize, { x: 0, y: 0 }).x}px`,
                  top: `${pointToPixels(settings, fieldTwoSize, { x: 0, y: 0 }).y}px`,
                }}
              >
                (0,0)
              </div>
              <div
                className="robot-marker live-robot-marker"
                style={robotRenderStyle(settings, fieldTwoSize, livePose.x, livePose.y, normalizeCompassDegrees((livePose.rotation * 180) / Math.PI))}
              >
                <span>robot</span>
              </div>
            </div>
          </section>
        </section>

        <div
          className="panel-divider"
          role="separator"
          aria-orientation="vertical"
          onPointerDown={(event) => {
            event.preventDefault();
            const startX = event.clientX;
            const panel = leftPanelRef.current;
            const workspace = panel?.parentElement;
            if (!panel || !workspace) return;
            const startWidth = panel.getBoundingClientRect().width;
            const workspaceWidth = workspace.getBoundingClientRect().width;
            const onPointerMove = (moveEvent: PointerEvent): void => {
              const nextWidth = clamp(startWidth + moveEvent.clientX - startX, 260, workspaceWidth - 320);
              panel.style.width = `${nextWidth}px`;
            };
            const onPointerUp = (): void => {
              window.removeEventListener("pointermove", onPointerMove);
              window.removeEventListener("pointerup", onPointerUp);
            };
            window.addEventListener("pointermove", onPointerMove);
            window.addEventListener("pointerup", onPointerUp);
          }}
        >
          <span aria-hidden="true">⋮</span>
        </div>

        <section className="right-panel">
          <div className="tree-toolbar">
            <div className="tree-legend">
              <span><i className="legend-box saved" />saved</span>
              <span><i className="legend-box editing" />editing</span>
              <span><i className="legend-box routine" />selected for routine</span>
            </div>
            <div className="tree-add-wrapper" onClick={(event) => event.stopPropagation()}>
              <button className="tree-add-button" type="button" onClick={() => setTreeAddMenuOpen((open) => !open)}>+</button>
              {treeAddMenuOpen ? (
                <div className="dropdown-menu tree-add-menu">
                  <button type="button" onClick={() => addTreeNode("path", 120 - pan.x, 90 - pan.y)}>Path block</button>
                  <button type="button" onClick={() => addTreeNode("if", 120 - pan.x, 90 - pan.y)}>If block</button>
                  <button type="button" onClick={() => addTreeNode("loop", 120 - pan.x, 90 - pan.y)}>Loop block</button>
                  <button type="button" onClick={() => addTreeNode("interrupt", 120 - pan.x, 90 - pan.y)}>Interruptable block</button>
                  <button type="button" onClick={() => addTreeNode("event", 120 - pan.x, 90 - pan.y)}>Event block</button>
                </div>
              ) : null}
            </div>
          </div>

          <div ref={treeViewportRef} className="tree-viewport" onPointerDown={beginTreePan} onDoubleClick={resetTreePan} onContextMenu={showCanvasMenu}>
            <svg className="tree-svg" style={{ transform: `translate(${pan.x}px, ${pan.y}px)`, pointerEvents: "auto" }} width="3200" height="2200">
              {treeEdges.map(({ parent, child, label, slot }) => {
                const start = { x: parent.x + NODE_WIDTH, y: parent.y + NODE_HEIGHT / 2 };
                const end = { x: child.x, y: child.y + NODE_HEIGHT / 2 };
                const controlOffset = Math.max(60, Math.abs(end.x - start.x) / 2);
                const d = `M ${start.x} ${start.y} C ${start.x + controlOffset} ${start.y}, ${end.x - controlOffset} ${end.y}, ${end.x} ${end.y}`;
                return (
                  <g key={`${parent.id}-${child.id}-${slot}`}>
                    <path className={`tree-edge tree-edge-${slot}`} d={d} style={{ pointerEvents: "none" }} />
                    <text
                      className="tree-edge-label"
                      x={(start.x + end.x) / 2}
                      y={(start.y + end.y) / 2 - 7}
                      style={{ cursor: "context-menu", pointerEvents: "auto" }}
                      onPointerDown={(event) => event.stopPropagation()}
                      onContextMenu={(event) => showEdgeMenu(event, parent.id, child.id, slot, label)}
                    >
                      {label}
                    </text>
                  </g>
                );
              })}
            </svg>
            <div className="tree-nodes-layer" style={{ transform: `translate(${pan.x}px, ${pan.y}px)` }}>
              {treeNodes.map((node) => (
                <div
                  key={node.id}
                  className={`tree-node tree-node-${node.kind} ${node.editing ? "is-editing" : ""} ${node.selectedForRoutine ? "is-routine" : ""}`}
                  style={{
                    left: `${node.x}px`,
                    top: `${node.y}px`,
                    width: `${NODE_WIDTH}px`,
                    height: `${NODE_HEIGHT}px`,
                    ...(node.selectedForRoutine
                      ? { background: "rgba(56, 189, 248, 0.22)", borderColor: "rgba(125, 211, 252, 0.92)" }
                      : {}),
                  }}
                  onPointerDown={(event) => beginNodeDrag(event, node)}
                  onContextMenu={(event) => showNodeMenu(event, node.id)}
                  onDoubleClick={(event) => {
                    event.stopPropagation();
                    startRename(node);
                  }}
                >
                  {renamingNodeId === node.id ? (
                    <input
                      className="rename-input"
                      autoFocus
                      value={renameDraft}
                      onChange={(event) => setRenameDraft(event.target.value)}
                      onPointerDown={(event) => event.stopPropagation()}
                      onBlur={commitRename}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") commitRename();
                        if (event.key === "Escape") {
                          setRenamingNodeId(null);
                          setRenameDraft("");
                        }
                      }}
                    />
                  ) : (
                    <>
                      <strong>{node.name}</strong>
                      <span>{treeKindDescription(node.kind)}</span>
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>

      {contextMenu ? (
        <div className="tree-menu" style={{ left: `${contextMenu.x}px`, top: `${contextMenu.y}px` }} onClick={(event) => event.stopPropagation()}>
          {contextMenu.kind === "canvas" ? (
            <>
              <button type="button" onClick={() => addTreeNode("path", contextMenu.canvasX, contextMenu.canvasY)}>New path block</button>
              <button type="button" onClick={() => addTreeNode("if", contextMenu.canvasX, contextMenu.canvasY)}>New if block</button>
              <button type="button" onClick={() => addTreeNode("loop", contextMenu.canvasX, contextMenu.canvasY)}>New loop block</button>
              <button type="button" onClick={() => addTreeNode("interrupt", contextMenu.canvasX, contextMenu.canvasY)}>New interruptable block</button>
              <button type="button" onClick={() => addTreeNode("event", contextMenu.canvasX, contextMenu.canvasY)}>New event block</button>
              <button type="button" onClick={() => { setTreeNodes((nodes) => nodes.map((node) => ({ ...node, selectedForRoutine: false, editing: false }))); setActivePathNodeId(null); setContextMenu(null); }}>Deselect all</button>
            </>
          ) : contextMenu.kind === "edge" ? (
            <>
              <div className="menu-section-label">{contextMenu.edgeLabel ?? "connection"} connection</div>
              <button
                type="button"
                onClick={() => {
                  if (contextMenu.edgeParentId && contextMenu.edgeChildId && contextMenu.edgeSlot) {
                    detachEdge(contextMenu.edgeParentId, contextMenu.edgeChildId, contextMenu.edgeSlot, "parent");
                  }
                }}
              >
                Remove parent
              </button>
              <button
                type="button"
                onClick={() => {
                  if (contextMenu.edgeParentId && contextMenu.edgeChildId && contextMenu.edgeSlot) {
                    detachEdge(contextMenu.edgeParentId, contextMenu.edgeChildId, contextMenu.edgeSlot, "child");
                  }
                }}
              >
                Remove child
              </button>
              <button
                type="button"
                onClick={() => {
                  if (contextMenu.edgeParentId && contextMenu.edgeChildId && contextMenu.edgeSlot) {
                    beginOverrideConnection("connectParent", contextMenu.edgeParentId, contextMenu.edgeChildId, contextMenu.edgeSlot);
                  }
                }}
              >
                Connect as parent
              </button>
              <button
                type="button"
                onClick={() => {
                  if (contextMenu.edgeParentId && contextMenu.edgeChildId && contextMenu.edgeSlot) {
                    beginOverrideConnection("connectChild", contextMenu.edgeParentId, contextMenu.edgeChildId, contextMenu.edgeSlot);
                  }
                }}
              >
                Connect as child
              </button>
            </>
          ) : (() => {
            const node = treeNodes.find((candidate) => candidate.id === contextMenu.nodeId);
            if (!node) return null;
            const x = node.x + 220;
            const y = node.y;
            const addConnectedButton = (label: string, kind: TreeKind, slot: ChildSlot): ReactElement => (
              <button key={`${label}-${kind}`} type="button" onClick={() => addTreeNode(kind, x, y, node.id, slot)}>{label}</button>
            );
            const directChildren = getNodeChildren(node);
            const nodeParentConnection = getParentConnection(treeNodes, node.id);
            return (
              <>
                <div className="menu-section-label">Relationships</div>
                <button type="button" disabled={!nodeParentConnection} onClick={() => removeNodeParent(node.id)}>Remove parent</button>
                <button type="button" disabled={directChildren.length === 0} onClick={() => removeNodeChildren(node.id)}>Remove child</button>
                <button type="button" onClick={() => beginNodeConnectAsParent(node.id)}>Connect as parent</button>
                <button type="button" onClick={() => beginNodeConnectAsChild(node.id)}>Connect as child</button>
                {node.kind === "path" ? (
                  <>
                    <button type="button" onClick={() => addTreeNode("path", x, y, node.id, "next")}>Connect new path</button>
                    <button type="button" onClick={() => { activatePathNode(node.id); setContextMenu(null); }}>Toggle editing</button>
                    <button type="button" onClick={() => setNodeSelectedForRoutine(node.id)}>Toggle selected</button>
                    <button type="button" onClick={() => startRename(node)}>Rename</button>
                    <button type="button" onClick={() => addTreeNode("if", x, y, node.id, "next")}>Add if block</button>
                    <button type="button" onClick={() => addTreeNode("loop", x, y, node.id, "next")}>Add loop block</button>
                    <button type="button" onClick={() => addTreeNode("interrupt", x, y, node.id, "next")}>Add interruptable block</button>
                    <button type="button" onClick={() => addTreeNode("event", x, y, node.id, "next")}>Add event block</button>
                    <button className="danger" type="button" onClick={() => deleteNode(node.id)}>Delete</button>
                  </>
                ) : null}
                {node.kind === "event" ? (
                  <>
                    <button type="button" onClick={() => addTreeNode("path", x, y, node.id, "next")}>Connect new path</button>
                    <button type="button" onClick={() => addTreeNode("event", x, y, node.id, "next")}>Connect new event</button>
                    <button type="button" onClick={() => addTreeNode("if", x, y, node.id, "next")}>Add if block</button>
                    <button type="button" onClick={() => addTreeNode("loop", x, y, node.id, "next")}>Add loop block</button>
                    <button type="button" onClick={() => addTreeNode("interrupt", x, y, node.id, "next")}>Add interruptable block</button>
                    <button type="button" onClick={() => setNodeSelectedForRoutine(node.id)}>Toggle selected</button>
                    <button type="button" onClick={() => startRename(node)}>Rename</button>
                    <button className="danger" type="button" onClick={() => deleteNode(node.id)}>Delete</button>
                  </>
                ) : null}
                {node.kind === "if" ? (
                  <>
                    <div className="menu-section-label">Add on true</div>
                    {(["path", "if", "loop", "interrupt", "event"] as TreeKind[]).map((kind) => addConnectedButton(`New ${treeKindLabel(kind)} block`, kind, "true"))}
                    <div className="menu-section-label">Add on false</div>
                    {(["path", "if", "loop", "interrupt", "event"] as TreeKind[]).map((kind) => addConnectedButton(`New ${treeKindLabel(kind)} block`, kind, "false"))}
                    <button type="button" onClick={() => setNodeSelectedForRoutine(node.id)}>Toggle select for routine</button>
                    <button className="danger" type="button" onClick={() => deleteNode(node.id)}>Delete</button>
                  </>
                ) : null}
                {node.kind === "loop" ? (
                  <>
                    <div className="menu-section-label">Add for loop</div>
                    {(["path", "if", "loop", "interrupt", "event"] as TreeKind[]).map((kind) => addConnectedButton(`New ${treeKindLabel(kind)} block`, kind, "forloop"))}
                    <div className="menu-section-label">Add after loop</div>
                    {(["path", "if", "loop", "interrupt", "event"] as TreeKind[]).map((kind) => addConnectedButton(`New ${treeKindLabel(kind)} block`, kind, "next"))}
                    <button type="button" onClick={() => setNodeSelectedForRoutine(node.id)}>Toggle select for routine</button>
                    <button className="danger" type="button" onClick={() => deleteNode(node.id)}>Delete</button>
                  </>
                ) : null}
                {node.kind === "interrupt" ? (
                  <>
                    <div className="menu-section-label">Add interruptable</div>
                    {(["path", "if", "loop", "interrupt", "event"] as TreeKind[]).map((kind) => addConnectedButton(`New ${treeKindLabel(kind)} block`, kind, "interruptable"))}
                    <div className="menu-section-label">Add after interrupt</div>
                    {(["path", "if", "loop", "interrupt", "event"] as TreeKind[]).map((kind) => addConnectedButton(`New ${treeKindLabel(kind)} block`, kind, "next"))}
                    <button type="button" onClick={() => setNodeSelectedForRoutine(node.id)}>Toggle select for routine</button>
                    <button className="danger" type="button" onClick={() => deleteNode(node.id)}>Delete</button>
                  </>
                ) : null}
              </>
            );
          })()}
        </div>
      ) : null}

      {settingsOpen ? (
        <div className="settings-overlay" onClick={() => setSettingsOpen(false)}>
          <div className="settings-modal" onClick={(event) => event.stopPropagation()}>
            <div className="modal-titlebar">
              <div>
                <strong>Settings</strong>
                <span>Field, robot, origin, storage, and save target.</span>
              </div>
              <button type="button" aria-label="Close settings" onClick={() => setSettingsOpen(false)}>×</button>
            </div>

            <div className="settings-grid">
              <section className="settings-section">
                <h3>Field and project</h3>
                <label>
                  Field image
                  <input type="file" accept="image/*" onChange={readImageFile} />
                </label>
                <button className="full-button" type="button" onClick={() => void selectRobotCodeProject()}>Select robot code project</button>
                <p className="path-preview">{settings.robotCodeProjectFolder ? getVoyagerDeployFolder(settings.robotCodeProjectFolder) : "No robot code project selected"}</p>
                <label>
                  NT4 address
                  <input
                    type="text"
                    value={nt4AddressDraft}
                    placeholder="Any team number, localhost, IP, or hostname"
                    onChange={(event) => setNt4AddressDraft(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") applyNt4Address();
                    }}
                  />
                </label>
                <div className="two-column-inputs">
                  <button className="full-button" type="button" onClick={() => setNt4AddressDraft("")}>Clear</button>
                  <button className="full-button" type="button" onClick={() => setNt4AddressDraft("localhost")}>Localhost</button>
                </div>
                <button className="full-button" type="button" onClick={applyNt4Address}>Apply NT4 address</button>
                <p className="path-preview">Examples: 4188, 1678, localhost, 10.41.88.2, roboRIO-4188-FRC.local</p>
                <p className="path-preview">Current NT4 provider: {describeNt4Address(nt4Address)}</p>
                <label>
                  Field width (m)
                  <input type="number" step="0.01" value={settings.fieldWidthMeters} onChange={(event) => updateSettings({ fieldWidthMeters: safePositive(Number(event.target.value), DEFAULT_SETTINGS.fieldWidthMeters) })} />
                </label>
                <label>
                  Field length (m)
                  <input type="number" step="0.01" value={settings.fieldLengthMeters} onChange={(event) => updateSettings({ fieldLengthMeters: safePositive(Number(event.target.value), DEFAULT_SETTINGS.fieldLengthMeters) })} />
                </label>
                <div className="scale-readout">Scale: {pxPerMeter > 0 ? formatNumber(pxPerMeter, 1) : "—"} px/m</div>
                <label>
                  Field origin (0,0) corner
                  <select value={settings.originCorner} onChange={(event) => updateSettings({ originCorner: event.target.value as OriginCorner })}>
                    <option value="bl">Bottom-left</option>
                    <option value="br">Bottom-right</option>
                    <option value="tl">Top-left</option>
                    <option value="tr">Top-right</option>
                  </select>
                </label>
              </section>

              <section className="settings-section">
                <h3>Robot</h3>
                <label>
                  Robot length (m)
                  <input type="number" step="0.01" value={settings.robotLengthMeters} onChange={(event) => updateSettings({ robotLengthMeters: safePositive(Number(event.target.value), DEFAULT_SETTINGS.robotLengthMeters) })} />
                </label>
                <label>
                  Robot width (m)
                  <input type="number" step="0.01" value={settings.robotWidthMeters} onChange={(event) => updateSettings({ robotWidthMeters: safePositive(Number(event.target.value), DEFAULT_SETTINGS.robotWidthMeters) })} />
                </label>
                <div className="robot-preview-shell">
                  <div
                    className="robot-preview"
                    style={{ aspectRatio: `${settings.robotLengthMeters} / ${settings.robotWidthMeters}` }}
                    onPointerDown={(event) => {
                      const rect = event.currentTarget.getBoundingClientRect();
                      const updateCenter = (clientX: number, clientY: number): void => {
                        const px = clamp(clientX - rect.left, 0, rect.width);
                        const py = clamp(clientY - rect.top, 0, rect.height);
                        updateSettings({
                          centerOfRotationX: Number(((px / rect.width) * settings.robotLengthMeters).toFixed(3)),
                          centerOfRotationY: Number(((py / rect.height) * settings.robotWidthMeters).toFixed(3)),
                        });
                      };
                      updateCenter(event.clientX, event.clientY);
                      const onPointerMove = (moveEvent: PointerEvent): void => updateCenter(moveEvent.clientX, moveEvent.clientY);
                      const onPointerUp = (): void => {
                        window.removeEventListener("pointermove", onPointerMove);
                        window.removeEventListener("pointerup", onPointerUp);
                      };
                      window.addEventListener("pointermove", onPointerMove);
                      window.addEventListener("pointerup", onPointerUp);
                    }}
                  >
                    <span>robot</span>
                    <i
                      className="robot-center-dot"
                      style={{
                        left: `${(clamp(settings.centerOfRotationX, 0, settings.robotLengthMeters) / settings.robotLengthMeters) * 100}%`,
                        top: `${(clamp(settings.centerOfRotationY, 0, settings.robotWidthMeters) / settings.robotWidthMeters) * 100}%`,
                      }}
                    />
                  </div>
                </div>
                <div className="two-column-inputs">
                  <label>
                    Center X (m)
                    <input type="number" step="0.01" value={settings.centerOfRotationX} onChange={(event) => updateSettings({ centerOfRotationX: clamp(cleanNumber(Number(event.target.value), 0), 0, settings.robotLengthMeters) })} />
                  </label>
                  <label>
                    Center Y (m)
                    <input type="number" step="0.01" value={settings.centerOfRotationY} onChange={(event) => updateSettings({ centerOfRotationY: clamp(cleanNumber(Number(event.target.value), 0), 0, settings.robotWidthMeters) })} />
                  </label>
                </div>
              </section>
            </div>
          </div>
        </div>
      ) : null}

      {modal ? (
        <div className="element-modal" style={{ left: `${modal.x}px`, top: `${modal.y}px` }} onClick={(event) => event.stopPropagation()}>
          <div className="modal-titlebar draggable" onPointerDown={beginModalDrag}>
            <div>
              <strong>{modal.kind === "waypoint" ? "Waypoint" : modal.kind === "rotationTarget" ? "Rotation Target" : modal.kind === "eventTrigger" ? "Event Trigger" : "Constraint Zone"}</strong>
              <span>{activePathName ?? "No active path"}</span>
            </div>
            <button type="button" aria-label="Close modal" onClick={() => setModal(null)}>×</button>
          </div>

          {activeWaypointModal ? (
            <div className="modal-body grid-two">
              <label>X (m)<input type="number" step="0.01" value={formatNumber(activeWaypointModal.x, 3)} onChange={(event) => updateWaypoint(activeWaypointModal.id, { x: clamp(cleanNumber(Number(event.target.value), 0), 0, settings.fieldLengthMeters) })} /></label>
              <label>Y (m)<input type="number" step="0.01" value={formatNumber(activeWaypointModal.y, 3)} onChange={(event) => updateWaypoint(activeWaypointModal.id, { y: clamp(cleanNumber(Number(event.target.value), 0), 0, settings.fieldWidthMeters) })} /></label>
              <label>Rotation (°)<input type="number" step="1" value={formatNumber(normalizeCompassDegrees(activeWaypointModal.angle), 2)} onChange={(event) => updateWaypoint(activeWaypointModal.id, { angle: normalizeCompassDegrees(cleanNumber(Number(event.target.value), 0)) })} /></label>
              <label>Handoff (m)<input type="number" step="0.01" value={formatNumber(activeWaypointModal.handoff, 3)} onChange={(event) => updateWaypoint(activeWaypointModal.id, { handoff: safePositive(Number(event.target.value), 0.2) })} /></label>
              <label className="checkbox-row"><input type="checkbox" checked={activeWaypointModal.profiled} onChange={(event) => updateWaypoint(activeWaypointModal.id, { profiled: event.target.checked })} />Profiled</label>
              <button className="danger full-button" type="button" onClick={() => deleteWaypoint(activeWaypointModal.id)}>Delete waypoint</button>
            </div>
          ) : null}

          {activeRotationTargetModal ? (
            <div className="modal-body">
              <label>Rotation (°)<input type="number" step="1" value={formatNumber(normalizeCompassDegrees(activeRotationTargetModal.angle), 2)} onChange={(event) => updateRotationTarget(activeRotationTargetModal.id, { angle: normalizeCompassDegrees(cleanNumber(Number(event.target.value), 0)) })} /></label>
              <label>Position: {formatNumber(activeRotationTargetModal.position, 2)}
                <input type="range" min="0" max={activeMaxPosition} step="0.01" value={activeRotationTargetModal.position} onChange={(event) => updateRotationTarget(activeRotationTargetModal.id, { position: clamp(Number(event.target.value), 0, activeMaxPosition) })} />
              </label>
              <label className="checkbox-row"><input type="checkbox" checked={activeRotationTargetModal.profiled} onChange={(event) => updateRotationTarget(activeRotationTargetModal.id, { profiled: event.target.checked })} />Profiled</label>
              <button className="danger full-button" type="button" onClick={() => deleteRotationTarget(activeRotationTargetModal.id)}>Delete rotation target</button>
            </div>
          ) : null}

          {activeEventTriggerModal ? (
            <div className="modal-body">
              <label>Command name<input type="text" value={activeEventTriggerModal.name} onChange={(event) => updateEventTrigger(activeEventTriggerModal.id, { name: event.target.value })} /></label>
              <label>Position: {formatNumber(activeEventTriggerModal.position, 2)}
                <input type="range" min="0" max={activeMaxPosition} step="0.01" value={activeEventTriggerModal.position} onChange={(event) => updateEventTrigger(activeEventTriggerModal.id, { position: clamp(Number(event.target.value), 0, activeMaxPosition) })} />
              </label>
              <button className="danger full-button" type="button" onClick={() => deleteEventTrigger(activeEventTriggerModal.id)}>Delete event trigger</button>
            </div>
          ) : null}

          {activeConstraintZoneModal ? (
            <div className="modal-body grid-two">
              <label>Max translation velocity<input type="number" step="0.01" value={activeConstraintZoneModal.maxTranslationalVelocity} onChange={(event) => updateConstraintZone(activeConstraintZoneModal.id, { maxTranslationalVelocity: cleanNumber(Number(event.target.value), 0) })} /></label>
              <label>Max translation acceleration<input type="number" step="0.01" value={activeConstraintZoneModal.maxTranslationalAcceleration} onChange={(event) => updateConstraintZone(activeConstraintZoneModal.id, { maxTranslationalAcceleration: cleanNumber(Number(event.target.value), 0) })} /></label>
              <label>Max rotation velocity<input type="number" step="0.01" value={activeConstraintZoneModal.maxRotationalVelocity} onChange={(event) => updateConstraintZone(activeConstraintZoneModal.id, { maxRotationalVelocity: cleanNumber(Number(event.target.value), 0) })} /></label>
              <label>Max rotation acceleration<input type="number" step="0.01" value={activeConstraintZoneModal.maxRotationalAcceleration} onChange={(event) => updateConstraintZone(activeConstraintZoneModal.id, { maxRotationalAcceleration: cleanNumber(Number(event.target.value), 0) })} /></label>
              <div className="range-pair">
                <span>Start {formatNumber(activeConstraintZoneModal.startPosition, 2)} · End {formatNumber(activeConstraintZoneModal.endPosition, 2)}</span>
                <input type="range" min="0" max={activeMaxPosition} step="0.01" value={activeConstraintZoneModal.startPosition} onChange={(event) => updateConstraintZone(activeConstraintZoneModal.id, { startPosition: Number(event.target.value) })} />
                <input type="range" min="0" max={activeMaxPosition} step="0.01" value={activeConstraintZoneModal.endPosition} onChange={(event) => updateConstraintZone(activeConstraintZoneModal.id, { endPosition: Number(event.target.value) })} />
              </div>
              <button className="danger full-button" type="button" onClick={() => deleteConstraintZone(activeConstraintZoneModal.id)}>Delete constraint zone</button>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export default App;
