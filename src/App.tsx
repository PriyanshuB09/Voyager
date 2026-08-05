/**
 * Copyright (c) 2026 Priyanshu Biswal
 * SPDX-License-Identifier: MIT
 */

import {
  Activity,
  AlertTriangle,
  Boxes,
  Crop,
  Eye,
  EyeOff,
  GitBranch,
  History,
  LocateFixed,
  Menu,
  Palette,
  Plus,
  Route,
  Save as SaveIcon,
  Settings as SettingsIcon,
  Sparkles,
  Trash2,
} from "lucide-react";
import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
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

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  DEFAULT_TELEMETRY_CONFIGURATION,
  useLiveTelemetry,
} from "@/telemetry";
import type {
  ChassisSpeeds,
  TelemetryConfiguration,
  TelemetryTopicInfo,
  TelemetryTransport,
} from "@/telemetry";
import "./styles/style.css";

type OriginCorner = "bl" | "br" | "tl" | "tr";
type AddElementKind = "waypoint" | "rotationTarget" | "eventTrigger" | "eventZone" | "constraintZone";
type TreeKind = "path" | "if" | "loop" | "interrupt" | "event";
type ChildSlot = "next" | "true" | "false" | "forloop" | "interruptable";
type SaveStatusKind = "idle" | "saving" | "saved" | "error";
type LayoutMode = "default" | "horizontal" | "mirrored" | "focus";
type WorkspaceTab = "auto" | "live";
type PlannerLevel = 0 | 1 | 2 | 3 | 4;
type DesignPresetId = "precision-grid" | "editorial-intelligence" | "prism-console" | "terminal-blocks" | "readme-minimal";
type PreferencesTab = "themes" | "designs";
type ObstacleResizeEdge = "left" | "right" | "top" | "bottom";

interface ThemePalette {
  background: string;
  panel: string;
  panel2: string;
  panel3: string;
  text: string;
  muted: string;
  faint: string;
  accent: string;
  accent2: string;
  border: string;
  borderStrong: string;
  warn: string;
  danger: string;
  success: string;
}

interface ThemePreset {
  id: string;
  name: string;
  description: string;
  palette: ThemePalette;
}

interface DesignPreset {
  id: DesignPresetId;
  name: string;
  source: string;
  description: string;
  bodyFont: string;
  displayFont: string;
  monoFont: string;
  baseFontSize: string;
  navHeight: string;
  controlHeight: string;
  panelPadding: string;
  radiusSmall: string;
  radiusMedium: string;
  radiusLarge: string;
  buttonRadius: string;
  shadow: string;
}

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

interface Settings {
  fieldImageDataUrl: string | null;
  robotCodeProjectFolder: string | null;
  fieldWidthMeters: number;
  fieldLengthMeters: number;
  robotLengthMeters: number;
  robotWidthMeters: number;
  swerveWheelLengthMeters: number;
  swerveWheelWidthMeters: number;
  swerveModuleOffsetXMeters: number;
  swerveModuleOffsetYMeters: number;
  originCorner: OriginCorner;
  centerOfRotationX: number;
  centerOfRotationY: number;
  maxTranslationalVelocity: number;
  maxTranslationalAcceleration: number;
  maxRotationalVelocity: number;
  maxRotationalAcceleration: number;
  endTranslationToleranceMeters: number;
  endRotationToleranceDegrees: number;
  defaultIntermediateHandOffRadiusMeters: number;
  translationalControllerP: number;
  translationalControllerI: number;
  translationalControllerD: number;
  cteControllerP: number;
  cteControllerI: number;
  cteControllerD: number;
  rotationalControllerP: number;
  rotationalControllerI: number;
  rotationalControllerD: number;
  layoutMode: LayoutMode;
  themePreset: string;
  customThemeName: string;
  customTheme: ThemePalette;
  autoSave: boolean;
  autoSaveMetadata: boolean;
  autoPublishOnConnect: boolean;
  plannerWaypointDensity: PlannerLevel;
  plannerSharpness: PlannerLevel;
  designPreset: DesignPresetId;
  showObstacleZones: boolean;
  showHandoffRadii: boolean;
  showLivePathOverlay: boolean;
  telemetryTransport: TelemetryTransport;
  driverStationTopic: string;
  odometryTopic: string;
  measuredChassisSpeedsTopic: string | null;
  setpointChassisSpeedsTopic: string | null;
}

interface FieldObstacle {
  id: string;
  name: string;
  x: number;
  y: number;
  length: number;
  width: number;
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

interface EventZone {
  id: string;
  startName: string;
  endName: string;
  startPosition: number;
  endPosition: number;
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
  eventZones: EventZone[];
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

interface TreeModalRect extends PixelPoint {
  width: number;
  height: number;
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

interface EventZoneModalState extends ModalBase {
  kind: "eventZone";
  id: string;
}

type ElementModalState =
  | WaypointModalState
  | RotationTargetModalState
  | EventTriggerModalState
  | EventZoneModalState
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

interface ActivityLogEntry extends SaveStatus {
  id: string;
  timestamp: number;
}

interface PersistedAppState {
  settings: Settings;
  treeNodes: PathTreeNode[];
  pathDataByName: Record<string, SharedPathData>;
  knownPathFileNames?: string[];
  activePathNodeId: string | null;
  pan: PixelPoint;
  versionHistory?: VersionHistorySnapshot[];
  obstacles?: FieldObstacle[];
  activityLog?: ActivityLogEntry[];
  selectedTreeNodeId?: string | null;
  treeModalRect?: TreeModalRect;
  treeModalMinimized?: boolean;
  playbackModalPosition?: PixelPoint;
}

interface VersionHistorySnapshot extends EditorSnapshot {
  id: string;
  timestamp: number;
  source: "manual" | "auto";
  obstacles?: FieldObstacle[];
}

interface ProjectMetadataFile extends PersistedAppState {
  schemaVersion: 1;
  voyagerVersion: string;
  savedAt: number;
}

interface EditorSnapshot {
  treeNodes: PathTreeNode[];
  pathDataByName: Record<string, SharedPathData>;
  activePathNodeId: string | null;
}

interface EditorHistory {
  past: EditorSnapshot[];
  present: EditorSnapshot;
  future: EditorSnapshot[];
}

interface TreeClipboardSnapshot {
  rootId: string;
  nodes: PathTreeNode[];
  pathDataByNodeId: Record<string, SharedPathData>;
}

interface PlaybackSection {
  startPosition: number;
  endPosition: number;
  startTime: number;
  endTime: number;
  startAngle: number;
  endAngle: number;
}

interface PlaybackPlan {
  sections: PlaybackSection[];
  movementDuration: number;
  settlingDuration: number;
  totalDuration: number;
}

interface PlaybackPose extends MeterPoint {
  angle: number;
}

interface RobotVelocity {
  vx: number;
  vy: number;
  omega: number;
}

interface SwerveModuleState {
  id: string;
  xPercent: number;
  yPercent: number;
  lengthPercent: number;
  widthPercent: number;
  angleDegrees: number;
  speed: number;
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
  max_translational_velocity: number;
  max_translational_acceleration: number;
  max_rotational_velocity: number;
  max_rotational_acceleration: number;
  end_translation_tolerance_meters: number;
  end_rotation_tolerance_deg: number;
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
const VOYAGER_VERSION = "3.3.4";
const PROJECT_METADATA_FILE = "metadata.json";
const NODE_WIDTH = 160;
const NODE_HEIGHT = 62;
const ACTIVITY_LOG_LIMIT = 200;
const LOCAL_PERSIST_DELAY_MS = 800;

type TreeNodeSide = "left" | "right" | "top" | "bottom";

interface TreeNodeAnchor {
  side: TreeNodeSide;
  point: PixelPoint;
  outward: PixelPoint;
}

interface TreeEdgeGeometry {
  start: PixelPoint;
  end: PixelPoint;
  startControl: PixelPoint;
  endControl: PixelPoint;
  label: PixelPoint;
}

function treeNodeAnchors(node: PathTreeNode): TreeNodeAnchor[] {
  return [
    { side: "left", point: { x: node.x, y: node.y + NODE_HEIGHT / 2 }, outward: { x: -1, y: 0 } },
    { side: "right", point: { x: node.x + NODE_WIDTH, y: node.y + NODE_HEIGHT / 2 }, outward: { x: 1, y: 0 } },
    { side: "top", point: { x: node.x + NODE_WIDTH / 2, y: node.y }, outward: { x: 0, y: -1 } },
    { side: "bottom", point: { x: node.x + NODE_WIDTH / 2, y: node.y + NODE_HEIGHT }, outward: { x: 0, y: 1 } },
  ];
}

function nearestTreeEdgeGeometry(parent: PathTreeNode, child: PathTreeNode): TreeEdgeGeometry {
  const parentAnchors = treeNodeAnchors(parent);
  const childAnchors = treeNodeAnchors(child);
  let bestParent = parentAnchors[0];
  let bestChild = childAnchors[0];
  let bestDistance = Number.POSITIVE_INFINITY;

  for (const parentAnchor of parentAnchors) {
    for (const childAnchor of childAnchors) {
      const distance = Math.hypot(
        childAnchor.point.x - parentAnchor.point.x,
        childAnchor.point.y - parentAnchor.point.y,
      );
      if (distance < bestDistance) {
        bestDistance = distance;
        bestParent = parentAnchor;
        bestChild = childAnchor;
      }
    }
  }

  const controlDistance = Math.max(34, Math.min(140, bestDistance * 0.36));
  const startControl = {
    x: bestParent.point.x + bestParent.outward.x * controlDistance,
    y: bestParent.point.y + bestParent.outward.y * controlDistance,
  };
  const endControl = {
    x: bestChild.point.x + bestChild.outward.x * controlDistance,
    y: bestChild.point.y + bestChild.outward.y * controlDistance,
  };
  return {
    start: bestParent.point,
    end: bestChild.point,
    startControl,
    endControl,
    label: {
      x: (bestParent.point.x + 3 * startControl.x + 3 * endControl.x + bestChild.point.x) / 8,
      y: (bestParent.point.y + 3 * startControl.y + 3 * endControl.y + bestChild.point.y) / 8,
    },
  };
}
const THEME_PRESETS: ThemePreset[] = [
  {
    id: "voyager",
    name: "Pathfinder",
    description: "Calm graphite surfaces with a focused periwinkle accent.",
    palette: { background: "#17181c", panel: "#202228", panel2: "#272a31", panel3: "#30343c", text: "#f2f3f5", muted: "#b4bac4", faint: "#7d8592", accent: "#8aa4ff", accent2: "#6f8cff", border: "#363a43", borderStrong: "#505661", warn: "#e5b95c", danger: "#ef7d8d", success: "#6fcf97" },
  },
  {
    id: "neural-violet",
    name: "Neural Violet",
    description: "Electric violet with cool inference-blue highlights.",
    palette: { background: "#0d0a16", panel: "#151022", panel2: "#1b1530", panel3: "#251b3f", text: "#f1eaff", muted: "#ad9cc7", faint: "#73648d", accent: "#c084fc", accent2: "#818cf8", border: "#34264c", borderStrong: "#675080", warn: "#fbbf24", danger: "#fb7185", success: "#86efac" },
  },
  {
    id: "deep-space",
    name: "Deep Space",
    description: "Midnight navy with orbital blue telemetry.",
    palette: { background: "#050914", panel: "#0a1223", panel2: "#0d1930", panel3: "#122440", text: "#e6f0ff", muted: "#8fa6c8", faint: "#56709a", accent: "#60a5fa", accent2: "#22d3ee", border: "#1d3557", borderStrong: "#46668f", warn: "#fcd34d", danger: "#f87171", success: "#6ee7b7" },
  },
  {
    id: "aurora",
    name: "Aurora",
    description: "Green and arctic-blue signals over a polar night.",
    palette: { background: "#07110f", panel: "#0c1a17", panel2: "#10231f", panel3: "#17302a", text: "#e7fff8", muted: "#8eb9ac", faint: "#567d72", accent: "#34d399", accent2: "#67e8f9", border: "#20443b", borderStrong: "#4e766b", warn: "#fde047", danger: "#fb7185", success: "#4ade80" },
  },
  {
    id: "cobalt",
    name: "Cobalt Lab",
    description: "Focused laboratory blues with crisp cyan actions.",
    palette: { background: "#080c18", panel: "#0e1629", panel2: "#14203a", panel3: "#1b2b4c", text: "#e8efff", muted: "#9aabd0", faint: "#60749d", accent: "#3b82f6", accent2: "#06b6d4", border: "#25395f", borderStrong: "#516b99", warn: "#fbbf24", danger: "#f43f5e", success: "#22c55e" },
  },
  {
    id: "ember",
    name: "Ember Drive",
    description: "Warm orange execution states on deep charcoal.",
    palette: { background: "#120b08", panel: "#1d120e", panel2: "#291811", panel3: "#382116", text: "#fff0e6", muted: "#c5a18d", faint: "#896c5d", accent: "#fb923c", accent2: "#facc15", border: "#4a2b1d", borderStrong: "#7e5844", warn: "#fde047", danger: "#fb7185", success: "#86efac" },
  },
  {
    id: "rose-circuit",
    name: "Rose Circuit",
    description: "Magenta and rose accents with a graphite foundation.",
    palette: { background: "#120910", panel: "#1d101a", panel2: "#291523", panel3: "#391d31", text: "#ffeaf8", muted: "#c39ab5", faint: "#86647a", accent: "#f472b6", accent2: "#c084fc", border: "#4b2941", borderStrong: "#7b506e", warn: "#fcd34d", danger: "#fb7185", success: "#6ee7b7" },
  },
  {
    id: "matrix",
    name: "Matrix Ops",
    description: "High-signal green for fast pit-side diagnostics.",
    palette: { background: "#050b07", panel: "#09140d", panel2: "#0d1d13", panel3: "#13291b", text: "#e6ffed", muted: "#8bb99a", faint: "#557d62", accent: "#4ade80", accent2: "#a3e635", border: "#1d3d28", borderStrong: "#477456", warn: "#facc15", danger: "#f87171", success: "#22c55e" },
  },
  {
    id: "graphite",
    name: "Graphite",
    description: "Low-distraction neutral surfaces with silver signals.",
    palette: { background: "#0b0c0e", panel: "#131518", panel2: "#1a1d21", panel3: "#23272c", text: "#f1f3f5", muted: "#a1a7ae", faint: "#6c737c", accent: "#d1d5db", accent2: "#93c5fd", border: "#30353b", borderStrong: "#626a73", warn: "#facc15", danger: "#fb7185", success: "#86efac" },
  },
  {
    id: "high-contrast",
    name: "High Contrast",
    description: "Maximum separation for bright pits and quick scanning.",
    palette: { background: "#020305", panel: "#090b0f", panel2: "#11151b", panel3: "#1b222c", text: "#ffffff", muted: "#cbd5e1", faint: "#94a3b8", accent: "#22d3ee", accent2: "#f8fafc", border: "#475569", borderStrong: "#94a3b8", warn: "#fde047", danger: "#fb7185", success: "#4ade80" },
  },
];
const DEFAULT_THEME = THEME_PRESETS[0];
const DESIGN_PRESETS: DesignPreset[] = [
  {
    id: "precision-grid",
    name: "PathPlanner Calm",
    source: "PathPlanner-inspired workspace",
    description: "Readable system type, clear editor hierarchy, restrained color, and comfortable controls.",
    bodyFont: "'Segoe UI Variable Text', 'Segoe UI', system-ui, -apple-system, sans-serif",
    displayFont: "'Segoe UI Variable Display', 'Segoe UI', system-ui, -apple-system, sans-serif",
    monoFont: "'Cascadia Code', 'SFMono-Regular', Consolas, monospace",
    baseFontSize: "15px",
    navHeight: "56px",
    controlHeight: "38px",
    panelPadding: "16px",
    radiusSmall: "6px",
    radiusMedium: "8px",
    radiusLarge: "10px",
    buttonRadius: "6px",
    shadow: "0 14px 36px rgba(0, 0, 0, 0.24)",
  },
  {
    id: "editorial-intelligence",
    name: "Editorial Intelligence",
    source: "Claude-inspired DESIGN.md",
    description: "Serif section titles, humanist body copy, generous padding, quiet shadows, and composed card rhythm.",
    bodyFont: "'IBM Plex Sans', Inter, system-ui, sans-serif",
    displayFont: "Georgia, 'Times New Roman', serif",
    monoFont: "ui-monospace, SFMono-Regular, Menlo, monospace",
    baseFontSize: "14px",
    navHeight: "58px",
    controlHeight: "38px",
    panelPadding: "18px",
    radiusSmall: "8px",
    radiusMedium: "12px",
    radiusLarge: "16px",
    buttonRadius: "8px",
    shadow: "0 12px 36px rgba(0, 0, 0, 0.16)",
  },
  {
    id: "prism-console",
    name: "Prism Console",
    source: "Raycast-inspired DESIGN.md",
    description: "Roomy eight-pixel spacing, softly rounded surfaces, luminous depth, and highly legible Inter-style controls.",
    bodyFont: "Inter, system-ui, -apple-system, 'Segoe UI', sans-serif",
    displayFont: "'SF Pro', Inter, system-ui, sans-serif",
    monoFont: "ui-monospace, SFMono-Regular, Menlo, monospace",
    baseFontSize: "14px",
    navHeight: "58px",
    controlHeight: "38px",
    panelPadding: "18px",
    radiusSmall: "10px",
    radiusMedium: "15px",
    radiusLarge: "22px",
    buttonRadius: "12px",
    shadow: "0 22px 58px rgba(0, 0, 0, 0.32), 0 0 28px color-mix(in srgb, var(--accent) 8%, transparent)",
  },
  {
    id: "terminal-blocks",
    name: "Terminal Blocks",
    source: "Warp-inspired DESIGN.md",
    description: "Dense technical typography, low radii, compact padding, and block-like surfaces optimized for information throughput.",
    bodyFont: "'IBM Plex Sans', Inter, system-ui, sans-serif",
    displayFont: "'IBM Plex Sans', Inter, system-ui, sans-serif",
    monoFont: "'IBM Plex Mono', ui-monospace, SFMono-Regular, Menlo, monospace",
    baseFontSize: "12px",
    navHeight: "48px",
    controlHeight: "30px",
    panelPadding: "10px",
    radiusSmall: "4px",
    radiusMedium: "6px",
    radiusLarge: "9px",
    buttonRadius: "4px",
    shadow: "0 8px 24px rgba(0, 0, 0, 0.3)",
  },
  {
    id: "readme-minimal",
    name: "README Minimal",
    source: "Ollama-inspired DESIGN.md",
    description: "Documentation-first hierarchy, pill controls, calm spacing, minimal shadows, and rounded system typography.",
    bodyFont: "system-ui, -apple-system, 'Segoe UI', sans-serif",
    displayFont: "'SF Pro', system-ui, -apple-system, 'Segoe UI', sans-serif",
    monoFont: "ui-monospace, SFMono-Regular, Menlo, monospace",
    baseFontSize: "14px",
    navHeight: "56px",
    controlHeight: "36px",
    panelPadding: "16px",
    radiusSmall: "12px",
    radiusMedium: "16px",
    radiusLarge: "20px",
    buttonRadius: "999px",
    shadow: "0 8px 22px rgba(0, 0, 0, 0.12)",
  },
];
const DEFAULT_DESIGN = DESIGN_PRESETS[0];
const CUSTOM_THEME_FIELDS: Array<{ key: keyof ThemePalette; label: string }> = [
  { key: "background", label: "Background" },
  { key: "panel", label: "Panel" },
  { key: "panel2", label: "Raised panel" },
  { key: "panel3", label: "Hover surface" },
  { key: "text", label: "Text" },
  { key: "muted", label: "Muted text" },
  { key: "accent", label: "Primary accent" },
  { key: "accent2", label: "Secondary accent" },
  { key: "border", label: "Border" },
  { key: "danger", label: "Danger" },
  { key: "warn", label: "Warning" },
  { key: "success", label: "Success" },
];
const DEFAULT_SETTINGS: Settings = {
  fieldImageDataUrl: null,
  robotCodeProjectFolder: null,
  fieldWidthMeters: 8.21,
  fieldLengthMeters: 16.46,
  robotLengthMeters: 0.9,
  robotWidthMeters: 0.9,
  swerveWheelLengthMeters: 0.16,
  swerveWheelWidthMeters: 0.04,
  swerveModuleOffsetXMeters: 0.1,
  swerveModuleOffsetYMeters: 0.1,
  originCorner: "bl",
  centerOfRotationX: 0.45,
  centerOfRotationY: 0.45,
  maxTranslationalVelocity: 4.5,
  maxTranslationalAcceleration: 10,
  maxRotationalVelocity: 720,
  maxRotationalAcceleration: 1500,
  endTranslationToleranceMeters: 0.03,
  endRotationToleranceDegrees: 2,
  defaultIntermediateHandOffRadiusMeters: 0.2,
  translationalControllerP: 5,
  translationalControllerI: 0,
  translationalControllerD: 0,
  cteControllerP: 2,
  cteControllerI: 0,
  cteControllerD: 0,
  rotationalControllerP: 3,
  rotationalControllerI: 0,
  rotationalControllerD: 0,
  layoutMode: "default",
  themePreset: DEFAULT_THEME.id,
  customThemeName: "My Voyager Theme",
  customTheme: { ...DEFAULT_THEME.palette },
  autoSave: false,
  autoSaveMetadata: false,
  autoPublishOnConnect: false,
  plannerWaypointDensity: 2,
  plannerSharpness: 2,
  designPreset: DEFAULT_DESIGN.id,
  showObstacleZones: true,
  showHandoffRadii: true,
  showLivePathOverlay: false,
  telemetryTransport: DEFAULT_TELEMETRY_CONFIGURATION.transport,
  driverStationTopic: DEFAULT_TELEMETRY_CONFIGURATION.driverStationTopic,
  odometryTopic: DEFAULT_TELEMETRY_CONFIGURATION.odometryTopic,
  measuredChassisSpeedsTopic: DEFAULT_TELEMETRY_CONFIGURATION.measuredChassisSpeedsTopic,
  setpointChassisSpeedsTopic: DEFAULT_TELEMETRY_CONFIGURATION.setpointChassisSpeedsTopic,
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

function maxHandoffRadiusMeters(fieldLengthMeters: number, fieldWidthMeters: number): number {
  return Math.max(0.01, Math.min(
    safePositive(fieldLengthMeters, DEFAULT_SETTINGS.fieldLengthMeters),
    safePositive(fieldWidthMeters, DEFAULT_SETTINGS.fieldWidthMeters),
  ) / 2);
}

function stabilizeSettings(settings: Settings): Settings {
  const fieldLengthMeters = clamp(safePositive(Number(settings.fieldLengthMeters), DEFAULT_SETTINGS.fieldLengthMeters), 0.1, 100);
  const fieldWidthMeters = clamp(safePositive(Number(settings.fieldWidthMeters), DEFAULT_SETTINGS.fieldWidthMeters), 0.1, 100);
  const robotLengthMeters = clamp(safePositive(Number(settings.robotLengthMeters), DEFAULT_SETTINGS.robotLengthMeters), 0.05, fieldLengthMeters);
  const robotWidthMeters = clamp(safePositive(Number(settings.robotWidthMeters), DEFAULT_SETTINGS.robotWidthMeters), 0.05, fieldWidthMeters);
  return {
    ...settings,
    fieldLengthMeters,
    fieldWidthMeters,
    robotLengthMeters,
    robotWidthMeters,
    swerveWheelLengthMeters: clamp(safePositive(Number(settings.swerveWheelLengthMeters), DEFAULT_SETTINGS.swerveWheelLengthMeters), 0.01, robotLengthMeters),
    swerveWheelWidthMeters: clamp(safePositive(Number(settings.swerveWheelWidthMeters), DEFAULT_SETTINGS.swerveWheelWidthMeters), 0.005, robotWidthMeters),
    swerveModuleOffsetXMeters: clamp(cleanNumber(Number(settings.swerveModuleOffsetXMeters), DEFAULT_SETTINGS.swerveModuleOffsetXMeters), 0, robotLengthMeters / 2),
    swerveModuleOffsetYMeters: clamp(cleanNumber(Number(settings.swerveModuleOffsetYMeters), DEFAULT_SETTINGS.swerveModuleOffsetYMeters), 0, robotWidthMeters / 2),
    centerOfRotationX: clamp(cleanNumber(Number(settings.centerOfRotationX), robotLengthMeters / 2), 0, robotLengthMeters),
    centerOfRotationY: clamp(cleanNumber(Number(settings.centerOfRotationY), robotWidthMeters / 2), 0, robotWidthMeters),
    defaultIntermediateHandOffRadiusMeters: clamp(safePositive(Number(settings.defaultIntermediateHandOffRadiusMeters), DEFAULT_SETTINGS.defaultIntermediateHandOffRadiusMeters), 0.01, maxHandoffRadiusMeters(fieldLengthMeters, fieldWidthMeters)),
    maxTranslationalVelocity: safePositive(Number(settings.maxTranslationalVelocity), DEFAULT_SETTINGS.maxTranslationalVelocity),
    maxTranslationalAcceleration: safePositive(Number(settings.maxTranslationalAcceleration), DEFAULT_SETTINGS.maxTranslationalAcceleration),
    maxRotationalVelocity: safePositive(Number(settings.maxRotationalVelocity), DEFAULT_SETTINGS.maxRotationalVelocity),
    maxRotationalAcceleration: safePositive(Number(settings.maxRotationalAcceleration), DEFAULT_SETTINGS.maxRotationalAcceleration),
    endTranslationToleranceMeters: safePositive(Number(settings.endTranslationToleranceMeters), DEFAULT_SETTINGS.endTranslationToleranceMeters),
    endRotationToleranceDegrees: safePositive(Number(settings.endRotationToleranceDegrees), DEFAULT_SETTINGS.endRotationToleranceDegrees),
  };
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

let databasePromise: Promise<IDBDatabase> | null = null;

function openDatabase(): Promise<IDBDatabase> {
  if (databasePromise) return databasePromise;
  databasePromise = new Promise((resolve, reject) => {
    if (!globalThis.indexedDB) {
      reject(new Error("IndexedDB is not available in this runtime."));
      return;
    }

    const request = globalThis.indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(DB_STORE)) db.createObjectStore(DB_STORE);
    };
    request.onerror = () => {
      databasePromise = null;
      reject(request.error ?? new Error("Failed to open IndexedDB."));
    };
    request.onsuccess = () => {
      request.result.onversionchange = () => {
        request.result.close();
        databasePromise = null;
      };
      resolve(request.result);
    };
  });
  return databasePromise;
}

async function idbGet<T>(key: string): Promise<T | null> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(DB_STORE, "readonly");
    const store = tx.objectStore(DB_STORE);
    const request = store.get(key);
    request.onerror = () => reject(request.error ?? new Error("Failed to read IndexedDB value."));
    request.onsuccess = () => resolve((request.result as T | undefined) ?? null);
    tx.onerror = () => reject(tx.error ?? new Error("IndexedDB transaction failed."));
  });
}

async function idbSet<T>(key: string, value: T): Promise<void> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(DB_STORE, "readwrite");
    const store = tx.objectStore(DB_STORE);
    const request = store.put(value, key);
    request.onerror = () => reject(request.error ?? new Error("Failed to write IndexedDB value."));
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("IndexedDB transaction failed."));
  });
}

function createEmptyPathData(): SharedPathData {
  return { waypoints: [], rotationTargets: [], events: [], eventZones: [], constraintZones: [] };
}

const EMPTY_PATH_DATA = createEmptyPathData();

interface PointerFrameScheduler {
  schedule: (clientX: number, clientY: number) => void;
  flush: (clientX?: number, clientY?: number) => void;
  cancel: () => void;
}

function createPointerFrameScheduler(callback: (clientX: number, clientY: number) => void): PointerFrameScheduler {
  let animationFrame: number | null = null;
  let latestPoint: PixelPoint | null = null;

  const run = (): void => {
    animationFrame = null;
    const point = latestPoint;
    latestPoint = null;
    if (point) callback(point.x, point.y);
  };

  return {
    schedule(clientX, clientY) {
      latestPoint = { x: clientX, y: clientY };
      if (animationFrame === null) animationFrame = globalThis.requestAnimationFrame(run);
    },
    flush(clientX, clientY) {
      if (clientX !== undefined && clientY !== undefined) latestPoint = { x: clientX, y: clientY };
      if (animationFrame !== null) globalThis.cancelAnimationFrame(animationFrame);
      run();
    },
    cancel() {
      if (animationFrame !== null) globalThis.cancelAnimationFrame(animationFrame);
      animationFrame = null;
      latestPoint = null;
    },
  };
}

function createDefaultWaypoint(settings: Settings): Waypoint {
  return {
    id: createId("waypoint"),
    x: settings.fieldLengthMeters / 2,
    y: settings.fieldWidthMeters / 2,
    angle: 0,
    handoff: settings.defaultIntermediateHandOffRadiusMeters,
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

function createDefaultEventZone(maxPosition: number): EventZone {
  return {
    id: createId("event_zone"),
    startName: "start_event",
    endName: "end_event",
    startPosition: clamp(0.25, 0, maxPosition),
    endPosition: clamp(0.75, 0, maxPosition),
  };
}

function createDefaultConstraintZone(maxPosition: number, settings: Settings): ConstraintZone {
  return {
    id: createId("constraint"),
    maxTranslationalVelocity: settings.maxTranslationalVelocity,
    maxTranslationalAcceleration: settings.maxTranslationalAcceleration,
    maxRotationalVelocity: settings.maxRotationalVelocity,
    maxRotationalAcceleration: settings.maxRotationalAcceleration,
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

function cloneSharedPathData(path: SharedPathData): SharedPathData {
  return {
    waypoints: path.waypoints.map((waypoint) => ({ ...waypoint, id: createId("waypoint") })),
    rotationTargets: path.rotationTargets.map((target) => ({ ...target, id: createId("rotation_target") })),
    events: path.events.map((event) => ({ ...event, id: createId("event") })),
    eventZones: path.eventZones.map((zone) => ({ ...zone, id: createId("event_zone") })),
    constraintZones: path.constraintZones.map((zone) => ({ ...zone, id: createId("constraint") })),
  };
}

function copyTreeSnapshot(
  rootId: string,
  nodes: PathTreeNode[],
  pathDataByName: Record<string, SharedPathData>,
  includeChildren: boolean,
): TreeClipboardSnapshot | null {
  const root = nodes.find((node) => node.id === rootId);
  if (!root) return null;
  const includedIds = includeChildren ? collectSubtreeNodeIds(rootId, nodes) : new Set([rootId]);
  const copiedNodes = nodes
    .filter((node) => includedIds.has(node.id))
    .map((node) => {
      let copied = { ...node, parentId: node.parentId && includedIds.has(node.parentId) ? node.parentId : null } as PathTreeNode;
      for (const slot of ["next", "true", "false", "forloop", "interruptable"] as ChildSlot[]) {
        if (!supportsChildSlot(copied, slot)) continue;
        const childId = childIdForSlot(copied, slot);
        copied = setChildForSlot(copied, slot, childId && includedIds.has(childId) ? childId : null);
      }
      return copied;
    });
  const pathDataByNodeId: Record<string, SharedPathData> = {};
  copiedNodes.forEach((node) => {
    if (node.kind === "path") pathDataByNodeId[node.id] = cloneSharedPathData(pathDataByName[node.name] ?? createEmptyPathData());
  });
  return { rootId, nodes: copiedNodes, pathDataByNodeId };
}

function uniqueCopiedNodeName(originalName: string, usedNames: Set<string>): string {
  const base = `${originalName} Copy`;
  let name = base;
  let index = 2;
  while (usedNames.has(name)) {
    name = `${base} ${index}`;
    index += 1;
  }
  usedNames.add(name);
  return name;
}

function instantiateTreeSnapshot(
  snapshot: TreeClipboardSnapshot,
  existingNodes: PathTreeNode[],
  offset: number,
): { nodes: PathTreeNode[]; pathDataByName: Record<string, SharedPathData>; rootId: string } {
  const idMap = new Map(snapshot.nodes.map((node) => [node.id, createId(node.kind)]));
  const usedNames = new Set(existingNodes.map((node) => node.name));
  const pathDataByName: Record<string, SharedPathData> = {};
  const copiedNodes = snapshot.nodes.map((node) => {
    const name = uniqueCopiedNodeName(node.name, usedNames);
    let copied = {
      ...node,
      id: idMap.get(node.id)!,
      name,
      x: node.x + offset,
      y: node.y + offset,
      parentId: node.parentId ? idMap.get(node.parentId) ?? null : null,
      selectedForRoutine: false,
      editing: false,
    } as PathTreeNode;
    for (const slot of ["next", "true", "false", "forloop", "interruptable"] as ChildSlot[]) {
      if (!supportsChildSlot(copied, slot)) continue;
      const childId = childIdForSlot(node, slot);
      copied = setChildForSlot(copied, slot, childId ? idMap.get(childId) ?? null : null);
    }
    if (node.kind === "path") pathDataByName[name] = cloneSharedPathData(snapshot.pathDataByNodeId[node.id] ?? createEmptyPathData());
    return copied;
  });
  return { nodes: copiedNodes, pathDataByName, rootId: idMap.get(snapshot.rootId)! };
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
  const cleaned = name.trim()
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, "_")
    .replace(/\s+/g, "_")
    .replace(/[. ]+$/g, "")
    .slice(0, 120);
  if (!cleaned) return "Unnamed_Path";
  const stem = cleaned.split(".")[0].toUpperCase();
  return /^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])$/.test(stem) ? `_${cleaned}` : cleaned;
}

function getVoyagerDeployFolder(projectFolder: string): string {
  const trimmed = projectFolder.replace(/[\\/]+$/, "");
  const separator = trimmed.includes("\\") ? "\\" : "/";
  return [trimmed, "src", "main", "deploy", "voyager"].join(separator);
}

function getVoyagerAssetsFolder(projectFolder: string): string {
  const deployFolder = getVoyagerDeployFolder(projectFolder);
  const separator = deployFolder.includes("\\") ? "\\" : "/";
  return [deployFolder, "assets"].join(separator);
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

const PLANNER_LEVEL_LABELS = ["Very low", "Low", "Default", "High", "Very high"] as const;
const PLANNER_GRID_CELL_METERS_BY_LEVEL = [0.16, 0.21, 0.27, 0.34, 0.42] as const;
const PLANNER_CORNER_ROUNDING_BY_LEVEL = [0.06, 0.13, 0.21, 0.28, 0.34] as const;
const PLANNER_TURN_PENALTY_BY_LEVEL = [0.04, 0.2, 0.52, 0.9, 1.4] as const;

function normalizePlannerLevel(value: unknown): PlannerLevel {
  return clamp(Math.round(cleanNumber(Number(value), 2)), 0, 4) as PlannerLevel;
}

function normalizeObstacle(value: Partial<FieldObstacle>, index: number, settings: Settings): FieldObstacle {
  return {
    id: typeof value.id === "string" && value.id ? value.id : createId("obstacle"),
    name: typeof value.name === "string" && value.name.trim() ? value.name.trim() : `Obstacle ${index + 1}`,
    x: clamp(cleanNumber(Number(value.x), settings.fieldLengthMeters / 2), 0, settings.fieldLengthMeters),
    y: clamp(cleanNumber(Number(value.y), settings.fieldWidthMeters / 2), 0, settings.fieldWidthMeters),
    length: clamp(safePositive(Number(value.length), 1), 0.05, settings.fieldLengthMeters),
    width: clamp(safePositive(Number(value.width), 1), 0.05, settings.fieldWidthMeters),
  };
}

function obstacleStyle(settings: Settings, size: FieldSize, obstacle: FieldObstacle): CSSProperties {
  const center = pointToPixels(settings, size, obstacle);
  const width = (obstacle.length / settings.fieldLengthMeters) * size.width;
  const height = (obstacle.width / settings.fieldWidthMeters) * size.height;
  return {
    left: center.x - width / 2,
    top: center.y - height / 2,
    width,
    height,
  };
}

function plannerObstacleStyle(settings: Settings, size: FieldSize, obstacle: FieldObstacle): CSSProperties {
  return obstacleStyle(settings, size, {
    ...obstacle,
    length: obstacle.length + settings.robotLengthMeters + 0.08,
    width: obstacle.width + settings.robotWidthMeters + 0.08,
  });
}

function obstacleContainsRobotCenter(point: MeterPoint, obstacle: FieldObstacle, settings: Settings): boolean {
  const halfLength = obstacle.length / 2 + settings.robotLengthMeters / 2 + 0.04;
  const halfWidth = obstacle.width / 2 + settings.robotWidthMeters / 2 + 0.04;
  return Math.abs(point.x - obstacle.x) <= halfLength && Math.abs(point.y - obstacle.y) <= halfWidth;
}

function plannerPointIsClear(point: MeterPoint, obstacles: FieldObstacle[], settings: Settings): boolean {
  const halfRobotLength = settings.robotLengthMeters / 2;
  const halfRobotWidth = settings.robotWidthMeters / 2;
  if (point.x < halfRobotLength || point.x > settings.fieldLengthMeters - halfRobotLength) return false;
  if (point.y < halfRobotWidth || point.y > settings.fieldWidthMeters - halfRobotWidth) return false;
  return !obstacles.some((obstacle) => obstacleContainsRobotCenter(point, obstacle, settings));
}

function plannerSegmentIsClear(start: MeterPoint, end: MeterPoint, obstacles: FieldObstacle[], settings: Settings, step = 0.08): boolean {
  const distance = Math.hypot(end.x - start.x, end.y - start.y);
  const sampleCount = Math.max(1, Math.ceil(distance / step));
  for (let index = 0; index <= sampleCount; index += 1) {
    const t = index / sampleCount;
    if (!plannerPointIsClear({ x: start.x + (end.x - start.x) * t, y: start.y + (end.y - start.y) * t }, obstacles, settings)) return false;
  }
  return true;
}

class PlannerMinHeap<T> {
  private values: Array<{ priority: number; value: T }> = [];

  get size(): number { return this.values.length; }

  push(value: T, priority: number): void {
    this.values.push({ priority, value });
    let index = this.values.length - 1;
    while (index > 0) {
      const parent = Math.floor((index - 1) / 2);
      if (this.values[parent].priority <= priority) break;
      this.values[index] = this.values[parent];
      index = parent;
    }
    this.values[index] = { priority, value };
  }

  pop(): T | null {
    const first = this.values[0];
    const last = this.values.pop();
    if (!first) return null;
    if (last && this.values.length > 0) {
      let index = 0;
      while (true) {
        const left = index * 2 + 1;
        const right = left + 1;
        if (left >= this.values.length) break;
        const child = right < this.values.length && this.values[right].priority < this.values[left].priority ? right : left;
        if (this.values[child].priority >= last.priority) break;
        this.values[index] = this.values[child];
        index = child;
      }
      this.values[index] = last;
    }
    return first.value;
  }
}

function simplifyPlannerPath(points: MeterPoint[], obstacles: FieldObstacle[], settings: Settings): MeterPoint[] {
  if (points.length <= 2) return points;
  const simplified: MeterPoint[] = [points[0]];
  let anchor = 0;
  while (anchor < points.length - 1) {
    let next = points.length - 1;
    while (next > anchor + 1 && !plannerSegmentIsClear(points[anchor], points[next], obstacles, settings)) next -= 1;
    simplified.push(points[next]);
    anchor = next;
  }
  return simplified;
}

function roundPlannerCorners(points: MeterPoint[], obstacles: FieldObstacle[], settings: Settings): MeterPoint[] {
  if (points.length <= 2) return points;
  const amount = PLANNER_CORNER_ROUNDING_BY_LEVEL[settings.plannerSharpness];
  const rounded: MeterPoint[] = [points[0]];
  for (let index = 1; index < points.length - 1; index += 1) {
    const previous = points[index - 1];
    const corner = points[index];
    const next = points[index + 1];
    const before = { x: corner.x + (previous.x - corner.x) * amount, y: corner.y + (previous.y - corner.y) * amount };
    const after = { x: corner.x + (next.x - corner.x) * amount, y: corner.y + (next.y - corner.y) * amount };
    if (plannerSegmentIsClear(rounded.at(-1) ?? previous, before, obstacles, settings)
      && plannerSegmentIsClear(before, after, obstacles, settings)
      && plannerSegmentIsClear(after, next, obstacles, settings)) {
      rounded.push(before, after);
    } else {
      rounded.push(corner);
    }
  }
  rounded.push(points.at(-1) as MeterPoint);
  return rounded;
}

function removeCollinearPlannerPoints(points: MeterPoint[]): MeterPoint[] {
  if (points.length <= 2) return points;
  const reduced: MeterPoint[] = [points[0]];
  for (let index = 1; index < points.length - 1; index += 1) {
    const previous = reduced.at(-1) as MeterPoint;
    const current = points[index];
    const next = points[index + 1];
    const incoming = { x: current.x - previous.x, y: current.y - previous.y };
    const outgoing = { x: next.x - current.x, y: next.y - current.y };
    const incomingLength = Math.hypot(incoming.x, incoming.y);
    const outgoingLength = Math.hypot(outgoing.x, outgoing.y);
    if (incomingLength < 1e-8 || outgoingLength < 1e-8) continue;
    const normalizedCross = Math.abs(incoming.x * outgoing.y - incoming.y * outgoing.x) / (incomingLength * outgoingLength);
    const continuesForward = incoming.x * outgoing.x + incoming.y * outgoing.y >= 0;
    if (normalizedCross <= 1e-5 && continuesForward) continue;
    reduced.push(current);
  }
  reduced.push(points.at(-1) as MeterPoint);
  return reduced;
}

function planCollisionFreePath(start: MeterPoint, end: MeterPoint, obstacles: FieldObstacle[], settings: Settings): MeterPoint[] | null {
  if (!plannerPointIsClear(start, obstacles, settings) || !plannerPointIsClear(end, obstacles, settings)) return null;
  if (plannerSegmentIsClear(start, end, obstacles, settings)) return [start, end];

  const requestedCell = PLANNER_GRID_CELL_METERS_BY_LEVEL[settings.plannerWaypointDensity];
  const columns = Math.max(3, Math.ceil(settings.fieldLengthMeters / requestedCell) + 1);
  const rows = Math.max(3, Math.ceil(settings.fieldWidthMeters / requestedCell) + 1);
  const cellX = settings.fieldLengthMeters / (columns - 1);
  const cellY = settings.fieldWidthMeters / (rows - 1);
  const toIndex = (column: number, row: number): number => row * columns + column;
  const toPoint = (column: number, row: number): MeterPoint => ({ x: column * cellX, y: row * cellY });
  const nearestCell = (point: MeterPoint): { column: number; row: number } => ({
    column: clamp(Math.round(point.x / cellX), 0, columns - 1),
    row: clamp(Math.round(point.y / cellY), 0, rows - 1),
  });
  const nearestClearCell = (point: MeterPoint): { column: number; row: number } | null => {
    const center = nearestCell(point);
    for (let radius = 0; radius <= Math.max(columns, rows); radius += 1) {
      const candidates: Array<{ column: number; row: number }> = [];
      for (let rowOffset = -radius; rowOffset <= radius; rowOffset += 1) {
        for (let columnOffset = -radius; columnOffset <= radius; columnOffset += 1) {
          if (Math.max(Math.abs(columnOffset), Math.abs(rowOffset)) !== radius) continue;
          const column = center.column + columnOffset;
          const row = center.row + rowOffset;
          if (column < 0 || column >= columns || row < 0 || row >= rows) continue;
          candidates.push({ column, row });
        }
      }
      candidates.sort((left, right) => {
        const leftPoint = toPoint(left.column, left.row);
        const rightPoint = toPoint(right.column, right.row);
        return Math.hypot(leftPoint.x - point.x, leftPoint.y - point.y) - Math.hypot(rightPoint.x - point.x, rightPoint.y - point.y);
      });
      const match = candidates.find((candidate) => {
        const candidatePoint = toPoint(candidate.column, candidate.row);
        return plannerPointIsClear(candidatePoint, obstacles, settings) && plannerSegmentIsClear(point, candidatePoint, obstacles, settings);
      });
      if (match) return match;
    }
    return null;
  };
  const startCell = nearestClearCell(start);
  const endCell = nearestClearCell(end);
  if (!startCell || !endCell) return null;
  const startIndex = toIndex(startCell.column, startCell.row);
  const endIndex = toIndex(endCell.column, endCell.row);
  const g = new Float64Array(columns * rows);
  g.fill(Number.POSITIVE_INFINITY);
  g[startIndex] = 0;
  const parents = new Int32Array(columns * rows);
  parents.fill(-1);
  const closed = new Uint8Array(columns * rows);
  const open = new PlannerMinHeap<number>();
  open.push(startIndex, Math.hypot(end.x - start.x, end.y - start.y));
  const directions = [
    { x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: -1 },
    { x: 1, y: 1 }, { x: 1, y: -1 }, { x: -1, y: 1 }, { x: -1, y: -1 },
  ];
  const turnPenalty = PLANNER_TURN_PENALTY_BY_LEVEL[settings.plannerSharpness];

  while (open.size > 0) {
    const currentIndex = open.pop();
    if (currentIndex === null || closed[currentIndex]) continue;
    if (currentIndex === endIndex) break;
    closed[currentIndex] = 1;
    const column = currentIndex % columns;
    const row = Math.floor(currentIndex / columns);
    const currentPoint = toPoint(column, row);
    const parentIndex = parents[currentIndex];
    const parentColumn = parentIndex >= 0 ? parentIndex % columns : column;
    const parentRow = parentIndex >= 0 ? Math.floor(parentIndex / columns) : row;

    for (const direction of directions) {
      const nextColumn = column + direction.x;
      const nextRow = row + direction.y;
      if (nextColumn < 0 || nextColumn >= columns || nextRow < 0 || nextRow >= rows) continue;
      const nextIndex = toIndex(nextColumn, nextRow);
      if (closed[nextIndex]) continue;
      const nextPoint = toPoint(nextColumn, nextRow);
      if (!plannerSegmentIsClear(currentPoint, nextPoint, obstacles, settings, Math.min(cellX, cellY) / 2)) continue;
      const previousDirection = { x: column - parentColumn, y: row - parentRow };
      const changedDirection = parentIndex >= 0 && (previousDirection.x !== direction.x || previousDirection.y !== direction.y);
      const movementCost = Math.hypot(direction.x * cellX, direction.y * cellY) + (changedDirection ? turnPenalty : 0);
      const nextCost = g[currentIndex] + movementCost;
      if (nextCost >= g[nextIndex]) continue;
      g[nextIndex] = nextCost;
      parents[nextIndex] = currentIndex;
      const heuristic = Math.hypot(end.x - nextPoint.x, end.y - nextPoint.y);
      open.push(nextIndex, nextCost + heuristic);
    }
  }

  if (!Number.isFinite(g[endIndex])) return null;
  const gridPath: MeterPoint[] = [];
  let cursor = endIndex;
  while (cursor >= 0) {
    gridPath.push(toPoint(cursor % columns, Math.floor(cursor / columns)));
    if (cursor === startIndex) break;
    cursor = parents[cursor];
  }
  if (cursor !== startIndex) return null;
  gridPath.reverse();
  gridPath[0] = start;
  gridPath[gridPath.length - 1] = end;
  return removeCollinearPlannerPoints(
    roundPlannerCorners(simplifyPlannerPath(gridPath, obstacles, settings), obstacles, settings),
  );
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

function shortestAngleDelta(startDegrees: number, endDegrees: number): number {
  return normalizeCompassDegrees(endDegrees - startDegrees);
}

function angleAtPathPosition(path: SharedPathData, position: number): number {
  if (path.waypoints.length === 0) return 0;

  const anglesByPosition = new Map<number, number>();
  path.waypoints.forEach((waypoint, index) => anglesByPosition.set(index, normalizeCompassDegrees(waypoint.angle)));
  path.rotationTargets.forEach((target) => {
    anglesByPosition.set(clamp(target.position, 0, maxPathPosition(path)), normalizeCompassDegrees(target.angle));
  });

  const keys = Array.from(anglesByPosition.entries())
    .map(([keyPosition, angle]) => ({ position: keyPosition, angle }))
    .sort((left, right) => left.position - right.position);
  const clampedPosition = clamp(position, 0, maxPathPosition(path));
  const nextIndex = keys.findIndex((key) => key.position >= clampedPosition);
  if (nextIndex <= 0) return keys[0]?.angle ?? 0;
  if (nextIndex < 0) return keys.at(-1)?.angle ?? 0;

  const previous = keys[nextIndex - 1];
  const next = keys[nextIndex];
  const span = next.position - previous.position;
  const progress = span <= 0 ? 1 : clamp((clampedPosition - previous.position) / span, 0, 1);
  return normalizeCompassDegrees(previous.angle + shortestAngleDelta(previous.angle, next.angle) * progress);
}

function distanceBetween(left: MeterPoint, right: MeterPoint): number {
  return Math.hypot(right.x - left.x, right.y - left.y);
}

function minimumMotionTime(distance: number, maxVelocity: number, maxAcceleration: number): number {
  const cleanDistance = Math.max(0, distance);
  const velocity = Math.max(0.001, maxVelocity);
  const acceleration = Math.max(0.001, maxAcceleration);
  const accelerationDistance = (velocity * velocity) / acceleration;

  if (cleanDistance <= accelerationDistance) return 2 * Math.sqrt(cleanDistance / acceleration);
  return (2 * velocity) / acceleration + (cleanDistance - accelerationDistance) / velocity;
}

function controllerEffectiveness(proportional: number, integral: number, derivative: number, nominalProportional: number): number {
  const authority = Math.max(0, proportional) + Math.sqrt(Math.max(0, integral)) * 0.25 + Math.max(0, derivative) * 0.05;
  return clamp(authority / Math.max(0.001, nominalProportional), 0.15, 1);
}

function controllerSettlingTime(referenceError: number, tolerance: number, proportional: number, integral: number, derivative: number): number {
  const cleanTolerance = Math.max(0.0001, tolerance);
  const responseRate = Math.max(0.25, Math.max(0, proportional) + Math.sqrt(Math.max(0, integral)) * 0.5 + Math.max(0, derivative) * 0.1);
  return clamp(Math.log(Math.max(1, referenceError / cleanTolerance)) / responseRate, 0, 3);
}

function buildPlaybackPlan(path: SharedPathData, settings: Settings): PlaybackPlan {
  if (path.waypoints.length < 2) return { sections: [], movementDuration: 0, settlingDuration: 0, totalDuration: 0 };

  const maximumPosition = maxPathPosition(path);
  const boundaryValues = [0, maximumPosition];
  for (let index = 1; index < path.waypoints.length - 1; index += 1) boundaryValues.push(index);
  path.rotationTargets.forEach((target) => boundaryValues.push(clamp(target.position, 0, maximumPosition)));
  path.constraintZones.forEach((zone) => {
    boundaryValues.push(clamp(zone.startPosition, 0, maximumPosition));
    boundaryValues.push(clamp(zone.endPosition, 0, maximumPosition));
  });

  const boundaries = Array.from(new Set(boundaryValues.map((value) => Number(value.toFixed(6)))))
    .sort((left, right) => left - right);
  const translationalEffectiveness = controllerEffectiveness(
    settings.translationalControllerP,
    settings.translationalControllerI,
    settings.translationalControllerD,
    DEFAULT_SETTINGS.translationalControllerP,
  );
  const cteEffectiveness = controllerEffectiveness(
    settings.cteControllerP,
    settings.cteControllerI,
    settings.cteControllerD,
    DEFAULT_SETTINGS.cteControllerP,
  );
  const rotationalEffectiveness = controllerEffectiveness(
    settings.rotationalControllerP,
    settings.rotationalControllerI,
    settings.rotationalControllerD,
    DEFAULT_SETTINGS.rotationalControllerP,
  );
  const sections: PlaybackSection[] = [];
  let elapsed = 0;

  for (let index = 0; index < boundaries.length - 1; index += 1) {
    const startPosition = boundaries[index];
    const endPosition = boundaries[index + 1];
    if (endPosition <= startPosition) continue;
    const startPoint = pointAtPathPosition(path.waypoints, startPosition);
    const endPoint = pointAtPathPosition(path.waypoints, endPosition);
    if (!startPoint || !endPoint) continue;

    const midpoint = (startPosition + endPosition) / 2;
    const activeZones = path.constraintZones.filter((zone) => {
      const start = Math.min(zone.startPosition, zone.endPosition);
      const end = Math.max(zone.startPosition, zone.endPosition);
      return midpoint >= start && midpoint <= end;
    });
    const translationalVelocity = activeZones.reduce(
      (value, zone) => Math.min(value, safePositive(zone.maxTranslationalVelocity, value)),
      settings.maxTranslationalVelocity,
    );
    const translationalAcceleration = activeZones.reduce(
      (value, zone) => Math.min(value, safePositive(zone.maxTranslationalAcceleration, value)),
      settings.maxTranslationalAcceleration,
    );
    const rotationalVelocity = activeZones.reduce(
      (value, zone) => Math.min(value, safePositive(zone.maxRotationalVelocity, value)),
      settings.maxRotationalVelocity,
    );
    const rotationalAcceleration = activeZones.reduce(
      (value, zone) => Math.min(value, safePositive(zone.maxRotationalAcceleration, value)),
      settings.maxRotationalAcceleration,
    );
    const startAngle = angleAtPathPosition(path, startPosition);
    const endAngle = angleAtPathPosition(path, endPosition);
    let translationTime = minimumMotionTime(
      distanceBetween(startPoint, endPoint),
      safePositive(translationalVelocity, DEFAULT_SETTINGS.maxTranslationalVelocity),
      safePositive(translationalAcceleration, DEFAULT_SETTINGS.maxTranslationalAcceleration) * Math.min(translationalEffectiveness, cteEffectiveness),
    );
    const roundedEndPosition = Math.round(endPosition);
    if (roundedEndPosition > 0 && roundedEndPosition < maximumPosition && Math.abs(endPosition - roundedEndPosition) < 0.000001) {
      const previousWaypoint = path.waypoints[roundedEndPosition - 1];
      const waypoint = path.waypoints[roundedEndPosition];
      const nextWaypoint = path.waypoints[roundedEndPosition + 1];
      const adjacentDistance = Math.min(distanceBetween(previousWaypoint, waypoint), distanceBetween(waypoint, nextWaypoint));
      const handoffRadius = safePositive(waypoint.handoff, settings.defaultIntermediateHandOffRadiusMeters);
      const handoffRatio = adjacentDistance > 0 ? clamp(handoffRadius / adjacentDistance, 0, 0.8) : 0;
      translationTime *= 1 - handoffRatio * 0.35;
    }
    const rotationTime = minimumMotionTime(
      Math.abs(shortestAngleDelta(startAngle, endAngle)),
      safePositive(rotationalVelocity, DEFAULT_SETTINGS.maxRotationalVelocity),
      safePositive(rotationalAcceleration, DEFAULT_SETTINGS.maxRotationalAcceleration) * rotationalEffectiveness,
    );
    const duration = Math.max(translationTime, rotationTime, 0.02);

    sections.push({
      startPosition,
      endPosition,
      startTime: elapsed,
      endTime: elapsed + duration,
      startAngle,
      endAngle,
    });
    elapsed += duration;
  }

  const finalSection = sections.at(-1);
  const finalDistanceReference = finalSection
    ? distanceBetween(
        pointAtPathPosition(path.waypoints, finalSection.startPosition) ?? path.waypoints.at(-1)!,
        pointAtPathPosition(path.waypoints, finalSection.endPosition) ?? path.waypoints.at(-1)!,
      )
    : 0;
  const finalRotationReference = finalSection ? Math.abs(shortestAngleDelta(finalSection.startAngle, finalSection.endAngle)) : 0;
  const settlingDuration = Math.max(
    controllerSettlingTime(
      Math.max(settings.endTranslationToleranceMeters, Math.min(1, finalDistanceReference)),
      settings.endTranslationToleranceMeters,
      settings.translationalControllerP,
      settings.translationalControllerI,
      settings.translationalControllerD,
    ),
    controllerSettlingTime(
      Math.max(settings.endTranslationToleranceMeters, Math.min(1, finalDistanceReference * 0.5)),
      settings.endTranslationToleranceMeters,
      settings.cteControllerP,
      settings.cteControllerI,
      settings.cteControllerD,
    ),
    controllerSettlingTime(
      Math.max(settings.endRotationToleranceDegrees, Math.min(90, finalRotationReference)),
      settings.endRotationToleranceDegrees,
      settings.rotationalControllerP,
      settings.rotationalControllerI,
      settings.rotationalControllerD,
    ),
  );

  return {
    sections,
    movementDuration: elapsed,
    settlingDuration,
    totalDuration: elapsed + settlingDuration,
  };
}

function poseAtPlaybackTime(path: SharedPathData, plan: PlaybackPlan, time: number): PlaybackPose | null {
  if (path.waypoints.length === 0) return null;
  if (plan.sections.length === 0) {
    const waypoint = path.waypoints[0];
    return { x: waypoint.x, y: waypoint.y, angle: normalizeCompassDegrees(waypoint.angle) };
  }

  const clampedTime = clamp(time, 0, plan.totalDuration);
  const section = plan.sections.find((candidate) => clampedTime <= candidate.endTime) ?? plan.sections.at(-1)!;
  const duration = section.endTime - section.startTime;
  const progress = clampedTime >= plan.movementDuration || duration <= 0
    ? 1
    : clamp((clampedTime - section.startTime) / duration, 0, 1);
  const position = section.startPosition + (section.endPosition - section.startPosition) * progress;
  const point = pointAtPathPosition(path.waypoints, position) ?? path.waypoints.at(-1)!;
  return {
    x: point.x,
    y: point.y,
    angle: normalizeCompassDegrees(section.startAngle + shortestAngleDelta(section.startAngle, section.endAngle) * progress),
  };
}

function playbackVelocityAtTime(path: SharedPathData, plan: PlaybackPlan, time: number): RobotVelocity {
  if (plan.movementDuration <= 0 || time >= plan.movementDuration) return { vx: 0, vy: 0, omega: 0 };
  const sampleWindow = Math.min(0.04, Math.max(0.005, plan.movementDuration / 200));
  const startTime = clamp(time - sampleWindow, 0, plan.movementDuration);
  const endTime = clamp(time + sampleWindow, 0, plan.movementDuration);
  const elapsed = endTime - startTime;
  if (elapsed <= 0) return { vx: 0, vy: 0, omega: 0 };
  const start = poseAtPlaybackTime(path, plan, startTime);
  const end = poseAtPlaybackTime(path, plan, endTime);
  if (!start || !end) return { vx: 0, vy: 0, omega: 0 };
  return {
    vx: (end.x - start.x) / elapsed,
    vy: (end.y - start.y) / elapsed,
    omega: (shortestAngleDelta(start.angle, end.angle) * Math.PI) / 180 / elapsed,
  };
}

function swerveModuleStates(settings: Settings, velocity: RobotVelocity, headingDegrees: number): SwerveModuleState[] {
  const length = safePositive(settings.robotLengthMeters, DEFAULT_SETTINGS.robotLengthMeters);
  const width = safePositive(settings.robotWidthMeters, DEFAULT_SETTINGS.robotWidthMeters);
  const wheelLength = clamp(settings.swerveWheelLengthMeters, 0.02, length * 0.5);
  const wheelWidth = clamp(settings.swerveWheelWidthMeters, 0.01, width * 0.3);
  const offsetX = clamp(settings.swerveModuleOffsetXMeters, 0, length / 2);
  const offsetY = clamp(settings.swerveModuleOffsetYMeters, 0, width / 2);
  const heading = (headingDegrees * Math.PI) / 180;
  const cos = Math.cos(heading);
  const sin = Math.sin(heading);
  const robotVx = cos * velocity.vx + sin * velocity.vy;
  const robotVy = -sin * velocity.vx + cos * velocity.vy;
  const positions = [
    { id: "front-left", x: length - offsetX, y: offsetY },
    { id: "front-right", x: length - offsetX, y: width - offsetY },
    { id: "rear-left", x: offsetX, y: offsetY },
    { id: "rear-right", x: offsetX, y: width - offsetY },
  ];

  return positions.map((position) => {
    const moduleX = position.x - clamp(settings.centerOfRotationX, 0, length);
    const moduleY = clamp(settings.centerOfRotationY, 0, width) - position.y;
    const moduleVx = robotVx - velocity.omega * moduleY;
    const moduleVy = robotVy + velocity.omega * moduleX;
    const speed = Math.hypot(moduleVx, moduleVy);
    return {
      id: position.id,
      xPercent: (position.x / length) * 100,
      yPercent: (position.y / width) * 100,
      lengthPercent: (wheelLength / length) * 100,
      widthPercent: (wheelWidth / width) * 100,
      angleDegrees: speed < 0.001 ? 0 : (Math.atan2(moduleVy, moduleVx) * 180) / Math.PI,
      speed,
    };
  });
}

function SwerveModules({ settings, velocity, headingDegrees }: { settings: Settings; velocity: RobotVelocity; headingDegrees: number }): ReactElement {
  const modules = swerveModuleStates(settings, velocity, headingDegrees);
  const maxSpeed = Math.max(0.001, ...modules.map((module) => module.speed));
  return (
    <div className="swerve-modules" aria-hidden="true">
      {modules.map((module) => (
        <i
          key={module.id}
          className="swerve-module"
          style={{
            left: `${module.xPercent}%`,
            top: `${module.yPercent}%`,
            width: `${module.lengthPercent}%`,
            height: `${module.widthPercent}%`,
            opacity: 0.62 + (module.speed / maxSpeed) * 0.38,
            transform: `translate(-50%, -50%) rotate(${compassDegreesToCssRotation(module.angleDegrees)}deg)`,
          }}
        />
      ))}
    </div>
  );
}

function updateSwerveModulesElement(
  robotElement: HTMLDivElement,
  settings: Settings,
  velocity: RobotVelocity,
  headingDegrees: number,
): void {
  const modules = swerveModuleStates(settings, velocity, headingDegrees);
  const maxSpeed = Math.max(0.001, ...modules.map((module) => module.speed));
  const elements = robotElement.querySelectorAll<HTMLElement>(".swerve-module");
  modules.forEach((module, index) => {
    const element = elements.item(index);
    if (!element) return;
    element.style.left = `${module.xPercent}%`;
    element.style.top = `${module.yPercent}%`;
    element.style.width = `${module.lengthPercent}%`;
    element.style.height = `${module.widthPercent}%`;
    element.style.opacity = String(0.62 + (module.speed / maxSpeed) * 0.38);
    element.style.transform = `translate(-50%, -50%) rotate(${compassDegreesToCssRotation(module.angleDegrees)}deg)`;
  });
}

function formatPlaybackTime(seconds: number): string {
  const cleanSeconds = Math.max(0, seconds);
  const minutes = Math.floor(cleanSeconds / 60);
  return `${minutes}:${(cleanSeconds % 60).toFixed(1).padStart(4, "0")}`;
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
  const pixelsPerMeter = Math.max(0, Math.min(
    size.width / safePositive(settings.fieldLengthMeters, DEFAULT_SETTINGS.fieldLengthMeters),
    size.height / safePositive(settings.fieldWidthMeters, DEFAULT_SETTINGS.fieldWidthMeters),
  ));
  const width = settings.robotLengthMeters * pixelsPerMeter;
  const height = settings.robotWidthMeters * pixelsPerMeter;
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

function applyRobotRenderStyle(element: HTMLElement, style: CSSProperties): void {
  element.style.width = String(style.width ?? "");
  element.style.height = String(style.height ?? "");
  element.style.left = String(style.left ?? "");
  element.style.top = String(style.top ?? "");
  element.style.transform = String(style.transform ?? "");
  element.style.transformOrigin = String(style.transformOrigin ?? "");
}

function handoffCircleStyle(settings: Settings, size: FieldSize, waypoint: Waypoint): CSSProperties {
  const center = pointToPixels(settings, size, waypoint);
  const pixelsPerMeter = Math.max(0, Math.min(
    size.width / safePositive(settings.fieldLengthMeters, DEFAULT_SETTINGS.fieldLengthMeters),
    size.height / safePositive(settings.fieldWidthMeters, DEFAULT_SETTINGS.fieldWidthMeters),
  ));
  const radius = clamp(safePositive(waypoint.handoff, settings.defaultIntermediateHandOffRadiusMeters), 0.01, maxHandoffRadiusMeters(settings.fieldLengthMeters, settings.fieldWidthMeters));
  const diameter = Math.max(8, radius * 2 * pixelsPerMeter);
  return {
    width: `${diameter}px`,
    height: `${diameter}px`,
    left: `${center.x - diameter / 2}px`,
    top: `${center.y - diameter / 2}px`,
    "--handoff-label-offset": `${Math.max(settings.robotLengthMeters, settings.robotWidthMeters) * pixelsPerMeter * 0.5 + 12}px`,
  } as CSSProperties;
}

function serializePathData(path: SharedPathData, settings: Settings): SerializedPathFile {
  return {
    max_translational_velocity: settings.maxTranslationalVelocity,
    max_translational_acceleration: settings.maxTranslationalAcceleration,
    max_rotational_velocity: settings.maxRotationalVelocity,
    max_rotational_acceleration: settings.maxRotationalAcceleration,
    end_translation_tolerance_meters: settings.endTranslationToleranceMeters,
    end_rotation_tolerance_deg: settings.endRotationToleranceDegrees,
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
    events: [
      ...path.events.map((event) => ({ name: event.name, position: event.position })),
      ...path.eventZones.flatMap((zone) => [
        { name: zone.startName, position: Math.min(zone.startPosition, zone.endPosition) },
        { name: zone.endName, position: Math.max(zone.startPosition, zone.endPosition) },
      ]),
    ],
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
  const storedSettings = value.settings && typeof value.settings === "object" ? value.settings : DEFAULT_SETTINGS;
  const fieldLengthMeters = clamp(safePositive(Number(storedSettings.fieldLengthMeters), DEFAULT_SETTINGS.fieldLengthMeters), 0.1, 100);
  const fieldWidthMeters = clamp(safePositive(Number(storedSettings.fieldWidthMeters), DEFAULT_SETTINGS.fieldWidthMeters), 0.1, 100);
  const maximumHandoffRadius = maxHandoffRadiusMeters(fieldLengthMeters, fieldWidthMeters);
  const robotLengthMeters = clamp(safePositive(Number(storedSettings.robotLengthMeters), DEFAULT_SETTINGS.robotLengthMeters), 0.05, fieldLengthMeters);
  const robotWidthMeters = clamp(safePositive(Number(storedSettings.robotWidthMeters), DEFAULT_SETTINGS.robotWidthMeters), 0.05, fieldWidthMeters);
  const customTheme = Object.fromEntries(Object.entries(DEFAULT_SETTINGS.customTheme).map(([key, fallback]) => {
    const candidate = storedSettings.customTheme?.[key as keyof ThemePalette];
    return [key, typeof candidate === "string" && /^#[0-9a-f]{6}$/i.test(candidate) ? candidate : fallback];
  })) as unknown as ThemePalette;
  const normalizedSettings: Settings = stabilizeSettings({
      ...DEFAULT_SETTINGS,
      ...storedSettings,
      fieldImageDataUrl: typeof storedSettings.fieldImageDataUrl === "string" ? storedSettings.fieldImageDataUrl : null,
      robotCodeProjectFolder: typeof storedSettings.robotCodeProjectFolder === "string" ? storedSettings.robotCodeProjectFolder : null,
      fieldLengthMeters,
      fieldWidthMeters,
      robotLengthMeters,
      robotWidthMeters,
      swerveWheelLengthMeters: clamp(safePositive(Number(storedSettings.swerveWheelLengthMeters), DEFAULT_SETTINGS.swerveWheelLengthMeters), 0.01, robotLengthMeters),
      swerveWheelWidthMeters: clamp(safePositive(Number(storedSettings.swerveWheelWidthMeters), DEFAULT_SETTINGS.swerveWheelWidthMeters), 0.005, robotWidthMeters),
      swerveModuleOffsetXMeters: clamp(cleanNumber(Number(storedSettings.swerveModuleOffsetXMeters), DEFAULT_SETTINGS.swerveModuleOffsetXMeters), 0, robotLengthMeters / 2),
      swerveModuleOffsetYMeters: clamp(cleanNumber(Number(storedSettings.swerveModuleOffsetYMeters), DEFAULT_SETTINGS.swerveModuleOffsetYMeters), 0, robotWidthMeters / 2),
      centerOfRotationX: clamp(cleanNumber(Number(storedSettings.centerOfRotationX), robotLengthMeters / 2), 0, robotLengthMeters),
      centerOfRotationY: clamp(cleanNumber(Number(storedSettings.centerOfRotationY), robotWidthMeters / 2), 0, robotWidthMeters),
      originCorner: (["bl", "br", "tl", "tr"] as OriginCorner[]).includes(storedSettings.originCorner) ? storedSettings.originCorner : DEFAULT_SETTINGS.originCorner,
      maxTranslationalVelocity: safePositive(Number(storedSettings.maxTranslationalVelocity), DEFAULT_SETTINGS.maxTranslationalVelocity),
      maxTranslationalAcceleration: safePositive(Number(storedSettings.maxTranslationalAcceleration), DEFAULT_SETTINGS.maxTranslationalAcceleration),
      maxRotationalVelocity: safePositive(Number(storedSettings.maxRotationalVelocity), DEFAULT_SETTINGS.maxRotationalVelocity),
      maxRotationalAcceleration: safePositive(Number(storedSettings.maxRotationalAcceleration), DEFAULT_SETTINGS.maxRotationalAcceleration),
      endTranslationToleranceMeters: safePositive(Number(storedSettings.endTranslationToleranceMeters), DEFAULT_SETTINGS.endTranslationToleranceMeters),
      endRotationToleranceDegrees: safePositive(Number(storedSettings.endRotationToleranceDegrees), DEFAULT_SETTINGS.endRotationToleranceDegrees),
      defaultIntermediateHandOffRadiusMeters: clamp(safePositive(Number(storedSettings.defaultIntermediateHandOffRadiusMeters), DEFAULT_SETTINGS.defaultIntermediateHandOffRadiusMeters), 0.01, maximumHandoffRadius),
      translationalControllerP: cleanNumber(Number(storedSettings.translationalControllerP), DEFAULT_SETTINGS.translationalControllerP),
      translationalControllerI: cleanNumber(Number(storedSettings.translationalControllerI), DEFAULT_SETTINGS.translationalControllerI),
      translationalControllerD: cleanNumber(Number(storedSettings.translationalControllerD), DEFAULT_SETTINGS.translationalControllerD),
      cteControllerP: cleanNumber(Number(storedSettings.cteControllerP), DEFAULT_SETTINGS.cteControllerP),
      cteControllerI: cleanNumber(Number(storedSettings.cteControllerI), DEFAULT_SETTINGS.cteControllerI),
      cteControllerD: cleanNumber(Number(storedSettings.cteControllerD), DEFAULT_SETTINGS.cteControllerD),
      rotationalControllerP: cleanNumber(Number(storedSettings.rotationalControllerP), DEFAULT_SETTINGS.rotationalControllerP),
      rotationalControllerI: cleanNumber(Number(storedSettings.rotationalControllerI), DEFAULT_SETTINGS.rotationalControllerI),
      rotationalControllerD: cleanNumber(Number(storedSettings.rotationalControllerD), DEFAULT_SETTINGS.rotationalControllerD),
      layoutMode: (["default", "horizontal", "mirrored", "focus"] as LayoutMode[]).includes(storedSettings.layoutMode) ? storedSettings.layoutMode : DEFAULT_SETTINGS.layoutMode,
      themePreset: storedSettings.themePreset === "custom" || THEME_PRESETS.some((preset) => preset.id === storedSettings.themePreset)
        ? storedSettings.themePreset
        : DEFAULT_SETTINGS.themePreset,
      customThemeName: typeof storedSettings.customThemeName === "string" && storedSettings.customThemeName.trim()
        ? storedSettings.customThemeName.slice(0, 80)
        : DEFAULT_SETTINGS.customThemeName,
      customTheme,
      autoSave: Boolean(storedSettings.autoSave),
      autoSaveMetadata: Boolean(storedSettings.autoSaveMetadata),
      autoPublishOnConnect: Boolean(storedSettings.autoPublishOnConnect),
      plannerWaypointDensity: normalizePlannerLevel(storedSettings.plannerWaypointDensity),
      plannerSharpness: normalizePlannerLevel(storedSettings.plannerSharpness),
      designPreset: DESIGN_PRESETS.some((preset) => preset.id === storedSettings.designPreset)
        ? storedSettings.designPreset
        : DEFAULT_DESIGN.id,
      showObstacleZones: typeof storedSettings.showObstacleZones === "boolean"
        ? storedSettings.showObstacleZones
        : DEFAULT_SETTINGS.showObstacleZones,
      showHandoffRadii: typeof storedSettings.showHandoffRadii === "boolean"
        ? storedSettings.showHandoffRadii
        : DEFAULT_SETTINGS.showHandoffRadii,
      showLivePathOverlay: typeof storedSettings.showLivePathOverlay === "boolean"
        ? storedSettings.showLivePathOverlay
        : DEFAULT_SETTINGS.showLivePathOverlay,
      telemetryTransport: storedSettings.telemetryTransport === "frc-web-components"
        ? "frc-web-components"
        : "direct",
      driverStationTopic: typeof storedSettings.driverStationTopic === "string" && storedSettings.driverStationTopic.trim()
        ? storedSettings.driverStationTopic
        : DEFAULT_SETTINGS.driverStationTopic,
      odometryTopic: typeof storedSettings.odometryTopic === "string" && storedSettings.odometryTopic.trim()
        ? storedSettings.odometryTopic
        : DEFAULT_SETTINGS.odometryTopic,
      measuredChassisSpeedsTopic: typeof storedSettings.measuredChassisSpeedsTopic === "string" && storedSettings.measuredChassisSpeedsTopic.trim()
        ? storedSettings.measuredChassisSpeedsTopic
        : null,
      setpointChassisSpeedsTopic: typeof storedSettings.setpointChassisSpeedsTopic === "string" && storedSettings.setpointChassisSpeedsTopic.trim()
        ? storedSettings.setpointChassisSpeedsTopic
        : null,
    });
  const normalizeId = (candidate: unknown, prefix: string, seen: Set<string>): string => {
    const requested = typeof candidate === "string" && candidate.trim() ? candidate : createId(prefix);
    const id = seen.has(requested) ? createId(prefix) : requested;
    seen.add(id);
    return id;
  };
  const normalizePath = (path: Partial<SharedPathData> | null | undefined): SharedPathData => {
    const waypointIds = new Set<string>();
    const waypoints = (Array.isArray(path?.waypoints) ? path.waypoints : []).filter((waypoint) => waypoint && typeof waypoint === "object").map((waypoint) => ({
      id: normalizeId(waypoint.id, "waypoint", waypointIds),
      x: clamp(cleanNumber(Number(waypoint.x), fieldLengthMeters / 2), 0, fieldLengthMeters),
      y: clamp(cleanNumber(Number(waypoint.y), fieldWidthMeters / 2), 0, fieldWidthMeters),
      angle: normalizeCompassDegrees(cleanNumber(Number(waypoint.angle), 0)),
      handoff: clamp(safePositive(Number(waypoint.handoff), normalizedSettings.defaultIntermediateHandOffRadiusMeters), 0.01, maximumHandoffRadius),
      profiled: typeof waypoint.profiled === "boolean" ? waypoint.profiled : true,
    }));
    const maxPositionValue = Math.max(0, waypoints.length - 1);
    const rotationIds = new Set<string>();
    const eventIds = new Set<string>();
    const eventZoneIds = new Set<string>();
    const constraintIds = new Set<string>();
    return {
      waypoints,
      rotationTargets: (Array.isArray(path?.rotationTargets) ? path.rotationTargets : []).filter((target) => target && typeof target === "object").map((target) => ({
        id: normalizeId(target.id, "rotation_target", rotationIds),
        angle: normalizeCompassDegrees(cleanNumber(Number(target.angle), 0)),
        position: clamp(cleanNumber(Number(target.position), 0), 0, maxPositionValue),
        profiled: typeof target.profiled === "boolean" ? target.profiled : true,
      })),
      events: (Array.isArray(path?.events) ? path.events : []).filter((event) => event && typeof event === "object").map((event) => ({
        id: normalizeId(event.id, "event", eventIds),
        name: typeof event.name === "string" && event.name.trim() ? event.name.trim().slice(0, 120) : "event",
        position: clamp(cleanNumber(Number(event.position), 0), 0, maxPositionValue),
      })),
      eventZones: (Array.isArray(path?.eventZones) ? path.eventZones : []).filter((zone) => zone && typeof zone === "object").map((zone) => {
        const startPosition = clamp(cleanNumber(Number(zone.startPosition), 0), 0, maxPositionValue);
        const endPosition = clamp(cleanNumber(Number(zone.endPosition), startPosition), 0, maxPositionValue);
        return {
          id: normalizeId(zone.id, "event_zone", eventZoneIds),
          startName: typeof zone.startName === "string" && zone.startName.trim() ? zone.startName.trim().slice(0, 120) : "start_event",
          endName: typeof zone.endName === "string" && zone.endName.trim() ? zone.endName.trim().slice(0, 120) : "end_event",
          startPosition: Math.min(startPosition, endPosition),
          endPosition: Math.max(startPosition, endPosition),
        };
      }),
      constraintZones: (Array.isArray(path?.constraintZones) ? path.constraintZones : []).filter((zone) => zone && typeof zone === "object").map((zone) => {
        const startPosition = clamp(cleanNumber(Number(zone.startPosition), 0), 0, maxPositionValue);
        const endPosition = clamp(cleanNumber(Number(zone.endPosition), startPosition), 0, maxPositionValue);
        return {
          id: normalizeId(zone.id, "constraint", constraintIds),
          maxTranslationalVelocity: safePositive(Number(zone.maxTranslationalVelocity), normalizedSettings.maxTranslationalVelocity),
          maxTranslationalAcceleration: safePositive(Number(zone.maxTranslationalAcceleration), normalizedSettings.maxTranslationalAcceleration),
          maxRotationalVelocity: safePositive(Number(zone.maxRotationalVelocity), normalizedSettings.maxRotationalVelocity),
          maxRotationalAcceleration: safePositive(Number(zone.maxRotationalAcceleration), normalizedSettings.maxRotationalAcceleration),
          startPosition: Math.min(startPosition, endPosition),
          endPosition: Math.max(startPosition, endPosition),
        };
      }),
    };
  };
  const pathDataByName = value.pathDataByName && typeof value.pathDataByName === "object"
    ? Object.fromEntries(Object.entries(value.pathDataByName).map(([name, path]) => [name, normalizePath(path)]))
    : {};
  const normalizeTreeNodes = (nodes: unknown): PathTreeNode[] => {
    if (!Array.isArray(nodes)) return [];
    const validKinds = new Set<TreeKind>(["path", "if", "loop", "interrupt", "event"]);
    const seenIds = new Set<string>();
    const oldToNewId = new Map<string, string>();
    const candidates = nodes.filter((node): node is PathTreeNode => Boolean(
      node
      && typeof node === "object"
      && validKinds.has((node as Partial<PathTreeNode>).kind as TreeKind),
    ));
    const bases = candidates.map((node, index) => {
      const originalId = typeof node.id === "string" ? node.id : "";
      const id = normalizeId(originalId, "node", seenIds);
      if (originalId && !oldToNewId.has(originalId)) oldToNewId.set(originalId, id);
      return {
        source: node,
        id,
        kind: node.kind,
        name: typeof node.name === "string" && node.name.trim() ? node.name.trim().slice(0, 120) : defaultNameForKind(node.kind, []),
        x: cleanNumber(Number(node.x), 120 + (index % 4) * 190),
        y: cleanNumber(Number(node.y), 90 + Math.floor(index / 4) * 100),
        selectedForRoutine: Boolean(node.selectedForRoutine),
        editing: Boolean(node.editing),
      };
    });
    const validIds = new Set(bases.map((node) => node.id));
    const reference = (candidate: unknown, selfId: string): string | null => {
      if (typeof candidate !== "string") return null;
      const mapped = oldToNewId.get(candidate) ?? candidate;
      return mapped !== selfId && validIds.has(mapped) ? mapped : null;
    };
    return bases.map(({ source, ...base }): PathTreeNode => {
      const shared = { ...base, parentId: reference(source.parentId, base.id) };
      if (base.kind === "if") return {
        ...shared,
        kind: "if",
        trueId: reference((source as PathTreeIfNode).trueId, base.id),
        falseId: reference((source as PathTreeIfNode).falseId, base.id),
        nextId: reference(source.nextId, base.id),
      };
      if (base.kind === "loop") return {
        ...shared,
        kind: "loop",
        forloopId: reference((source as PathTreeLoopNode).forloopId, base.id),
        nextId: reference(source.nextId, base.id),
      };
      if (base.kind === "interrupt") return {
        ...shared,
        kind: "interrupt",
        interruptableId: reference((source as PathTreeInterruptNode).interruptableId, base.id),
        nextId: reference(source.nextId, base.id),
      };
      return { ...shared, kind: base.kind, nextId: reference(source.nextId, base.id) } as PathTreePathNode | PathTreeEventNode;
    });
  };
  const treeNodes = normalizeTreeNodes(value.treeNodes);
  const treeNodeIds = new Set(treeNodes.map((node) => node.id));
  const activePathNodeId = typeof value.activePathNodeId === "string"
    && treeNodes.some((node) => node.id === value.activePathNodeId && node.kind === "path")
    ? value.activePathNodeId
    : null;
  return {
    settings: normalizedSettings,
    treeNodes,
    pathDataByName,
    knownPathFileNames: Array.isArray(value.knownPathFileNames)
      ? value.knownPathFileNames.filter((name): name is string => typeof name === "string" && Boolean(name.trim())).map((name) => name.trim().slice(0, 120))
      : [],
    activePathNodeId,
    pan: {
      x: cleanNumber(Number(value.pan?.x), 0),
      y: cleanNumber(Number(value.pan?.y), 0),
    },
    obstacles: Array.isArray(value.obstacles) ? value.obstacles.map((obstacle, index) => normalizeObstacle(obstacle, index, normalizedSettings)) : [],
    activityLog: Array.isArray(value.activityLog) ? value.activityLog.filter((entry) => entry && typeof entry.id === "string" && typeof entry.message === "string" && Number.isFinite(entry.timestamp) && (["idle", "saving", "saved", "error"] as SaveStatusKind[]).includes(entry.kind)).slice(-ACTIVITY_LOG_LIMIT) : [],
    selectedTreeNodeId: typeof value.selectedTreeNodeId === "string" && treeNodeIds.has(value.selectedTreeNodeId) ? value.selectedTreeNodeId : null,
    treeModalRect: {
      x: cleanNumber(Number(value.treeModalRect?.x), 420),
      y: cleanNumber(Number(value.treeModalRect?.y), 18),
      width: safePositive(Number(value.treeModalRect?.width), 520),
      height: safePositive(Number(value.treeModalRect?.height), 520),
    },
    treeModalMinimized: Boolean(value.treeModalMinimized),
    playbackModalPosition: {
      x: cleanNumber(Number(value.playbackModalPosition?.x), 28),
      y: cleanNumber(Number(value.playbackModalPosition?.y), 84),
    },
    versionHistory: Array.isArray(value.versionHistory) ? value.versionHistory.map((snapshot) => ({
      ...snapshot,
      treeNodes: normalizeTreeNodes(snapshot.treeNodes),
      pathDataByName: Object.fromEntries(Object.entries(snapshot.pathDataByName ?? {}).map(([name, path]) => [name, normalizePath(path)])),
      activePathNodeId: snapshot.activePathNodeId ?? null,
      obstacles: Array.isArray(snapshot.obstacles) ? snapshot.obstacles.map((obstacle, index) => normalizeObstacle(obstacle, index, normalizedSettings)) : [],
    })) : [],
  };
}

function useElementSize<T extends HTMLElement>(observeKey: unknown = true): [RefObject<T | null>, FieldSize] {
  const ref = useRef<T | null>(null);
  const [size, setSize] = useState<FieldSize>({ width: 0, height: 0 });

  useEffect(() => {
    if (observeKey === false) {
      setSize({ width: 0, height: 0 });
      return;
    }
    let animationFrame: number | null = null;
    let observer: ResizeObserver | null = null;
    let update: (() => void) | null = null;
    let resizeFrame: number | null = null;
    const attach = (): void => {
      const element = ref.current;
      if (!element) {
        animationFrame = globalThis.requestAnimationFrame(attach);
        return;
      }
      const measure = (): void => {
        const width = element.clientWidth;
        const height = element.clientHeight;
        setSize((current) => current.width === width && current.height === height ? current : { width, height });
      };
      update = () => {
        if (resizeFrame !== null) return;
        resizeFrame = globalThis.requestAnimationFrame(() => {
          resizeFrame = null;
          measure();
        });
      };
      measure();
      if (globalThis.ResizeObserver) {
        observer = new ResizeObserver(update);
        observer.observe(element);
      } else {
        globalThis.addEventListener("resize", update);
      }
    };
    attach();
    return () => {
      if (animationFrame !== null) globalThis.cancelAnimationFrame(animationFrame);
      if (resizeFrame !== null) globalThis.cancelAnimationFrame(resizeFrame);
      observer?.disconnect();
      if (update && !globalThis.ResizeObserver) globalThis.removeEventListener("resize", update);
    };
  }, [observeKey]);

  return [ref, size];
}

function LayoutGlyph({ mode }: { mode: LayoutMode }): ReactElement {
  return (
    <span className={`layout-glyph layout-glyph-${mode}`} aria-hidden="true">
      <i />
      <i />
      <i />
    </span>
  );
}

interface LiveConnectionActionsProps {
  selectedRoutineCode: string | null;
  className: string;
  onError: (message: string) => void;
  onPublished: (routineCode: string) => void;
}

function LiveStatusText(): ReactElement {
  const { connected, serverConnected } = useLiveTelemetry();
  return <>{connected ? "Driver Station attached" : serverConnected ? "NT4 connected · Driver Station detached" : "NT4 disconnected"}</>;
}

function TelemetrySettingsBridge({ settings }: { settings: Settings }): null {
  const { configure } = useLiveTelemetry();

  useEffect(() => {
    configure({
      transport: settings.telemetryTransport,
      driverStationTopic: settings.driverStationTopic,
      odometryTopic: settings.odometryTopic,
      measuredChassisSpeedsTopic: settings.measuredChassisSpeedsTopic,
      setpointChassisSpeedsTopic: settings.setpointChassisSpeedsTopic,
    });
  }, [
    configure,
    settings.driverStationTopic,
    settings.measuredChassisSpeedsTopic,
    settings.odometryTopic,
    settings.setpointChassisSpeedsTopic,
    settings.telemetryTransport,
  ]);

  return null;
}

function LiveConnectionActions({
  selectedRoutineCode,
  className,
  onError,
  onPublished,
}: LiveConnectionActionsProps): ReactElement {
  const { connected, publishRoutine } = useLiveTelemetry();

  const publish = async (): Promise<void> => {
    if (!selectedRoutineCode) {
      onError("Select a routine in the path tree before publishing.");
      return;
    }
    try {
      await publishRoutine(selectedRoutineCode);
      onPublished(selectedRoutineCode);
    } catch (error) {
      console.error(error);
      onError("Could not publish the selected routine over NetworkTables.");
    }
  };

  return (
    <div className={className}>
      <span className={`connection-pill ${connected ? "connected" : "disconnected"}`}>
        {connected ? "connected" : "offline"}
      </span>
      <button
        className="publish-routine-button"
        type="button"
        disabled={!selectedRoutineCode}
        title={selectedRoutineCode
          ? `Publish ${selectedRoutineCode} to /Voyager/SelectedAuto`
          : "Select a routine in the path tree first"}
        onClick={() => void publish()}
      >
        Publish routine
      </button>
    </div>
  );
}

interface LiveRobotOverlayProps {
  settings: Settings;
  fieldSize: FieldSize;
}

interface ChassisSpeedVectorGeometry {
  translationPath: string | null;
  rotationPath: string | null;
}

function chassisSpeedVectorGeometry(
  settings: Settings,
  fieldSize: FieldSize,
  pose: { x: number; y: number; rotation: number },
  speeds: ChassisSpeeds | null,
  ringIndex: number,
): ChassisSpeedVectorGeometry {
  if (!speeds || fieldSize.width <= 0 || fieldSize.height <= 0) {
    return { translationPath: null, rotationPath: null };
  }

  const anchor = pointToPixels(settings, fieldSize, pose);
  const pixelsPerMeter = Math.max(0, Math.min(
    fieldSize.width / safePositive(settings.fieldLengthMeters, DEFAULT_SETTINGS.fieldLengthMeters),
    fieldSize.height / safePositive(settings.fieldWidthMeters, DEFAULT_SETTINGS.fieldWidthMeters),
  ));
  const robotRadius = Math.max(settings.robotLengthMeters, settings.robotWidthMeters) * pixelsPerMeter * 0.52;
  const linearSpeed = Math.hypot(speeds.vx, speeds.vy);
  const velocityAngle = pose.rotation + Math.atan2(speeds.vy, speeds.vx);
  const screenVelocityAngle = -velocityAngle;
  const maximumArrowLength = Math.max(24, Math.min(fieldSize.width, fieldSize.height) * 0.24);
  const arrowLength = clamp(12 + linearSpeed * pixelsPerMeter * 0.5, 12, maximumArrowLength);
  const arrowStartDistance = robotRadius + 7 + ringIndex * 3;
  const translationPath = linearSpeed > 0.01
    ? `M ${anchor.x + Math.cos(screenVelocityAngle) * arrowStartDistance} ${anchor.y + Math.sin(screenVelocityAngle) * arrowStartDistance} L ${anchor.x + Math.cos(screenVelocityAngle) * (arrowStartDistance + arrowLength)} ${anchor.y + Math.sin(screenVelocityAngle) * (arrowStartDistance + arrowLength)}`
    : null;

  const angularSpeed = Math.abs(speeds.omega);
  if (angularSpeed <= 0.01) return { translationPath, rotationPath: null };
  const radius = robotRadius + 20 + ringIndex * 14;
  const arcSpan = clamp((angularSpeed / 6) * Math.PI * 1.5, Math.PI / 8, Math.PI * 1.5);
  const screenHeading = -pose.rotation;
  const startAngle = screenHeading - Math.PI / 2;
  const arcDirection = speeds.omega >= 0 ? -1 : 1;
  const endAngle = startAngle + arcDirection * arcSpan;
  const start = {
    x: anchor.x + Math.cos(startAngle) * radius,
    y: anchor.y + Math.sin(startAngle) * radius,
  };
  const end = {
    x: anchor.x + Math.cos(endAngle) * radius,
    y: anchor.y + Math.sin(endAngle) * radius,
  };
  const rotationPath = `M ${start.x} ${start.y} A ${radius} ${radius} 0 ${arcSpan > Math.PI ? 1 : 0} ${arcDirection > 0 ? 1 : 0} ${end.x} ${end.y}`;
  return { translationPath, rotationPath };
}

function LiveRobotOverlay({ settings, fieldSize }: LiveRobotOverlayProps): ReactElement {
  const { anomaly, connected, measuredSpeeds, pose, setpointSpeeds, trail, velocity } = useLiveTelemetry();
  const headingDegrees = normalizeCompassDegrees((pose.rotation * 180) / Math.PI);
  const trailPaths = useMemo(() => trail.slice(1).reduce((paths, point, index) => {
    const start = pointToPixels(settings, fieldSize, trail[index]);
    const end = pointToPixels(settings, fieldSize, point);
    const segment = `M ${start.x} ${start.y} L ${end.x} ${end.y} `;
    if (point.anomaly) paths.anomaly += segment;
    else paths.normal += segment;
    return paths;
  }, { normal: "", anomaly: "" }), [fieldSize, settings, trail]);
  const measuredVector = useMemo(
    () => chassisSpeedVectorGeometry(settings, fieldSize, pose, measuredSpeeds, 0),
    [fieldSize, measuredSpeeds, pose, settings],
  );
  const setpointVector = useMemo(
    () => chassisSpeedVectorGeometry(settings, fieldSize, pose, setpointSpeeds, 1),
    [fieldSize, pose, setpointSpeeds, settings],
  );
  const hasSpeedVector = measuredVector.translationPath || measuredVector.rotationPath
    || setpointVector.translationPath || setpointVector.rotationPath;

  return (
    <>
      {trail.length > 1 ? (
        <svg className="field-svg live-trail-svg" viewBox={`0 0 ${Math.max(1, fieldSize.width)} ${Math.max(1, fieldSize.height)}`} aria-hidden="true">
          {trailPaths.normal ? <path className="live-pose-trail" d={trailPaths.normal} /> : null}
          {trailPaths.anomaly ? <path className="live-pose-trail is-anomaly" d={trailPaths.anomaly} /> : null}
        </svg>
      ) : null}
      {hasSpeedVector ? (
        <svg className="field-svg chassis-speed-overlay" viewBox={`0 0 ${Math.max(1, fieldSize.width)} ${Math.max(1, fieldSize.height)}`} aria-hidden="true">
          <defs>
            <marker id="measured-speed-arrow" markerWidth="5" markerHeight="5" refX="4.3" refY="2.5" orient="auto" markerUnits="strokeWidth">
              <path className="measured-speed-arrowhead" d="M 0 0 L 5 2.5 L 0 5 z" />
            </marker>
            <marker id="setpoint-speed-arrow" markerWidth="5" markerHeight="5" refX="4.3" refY="2.5" orient="auto" markerUnits="strokeWidth">
              <path className="setpoint-speed-arrowhead" d="M 0 0 L 5 2.5 L 0 5 z" />
            </marker>
          </defs>
          <g className="chassis-speed-vector is-measured">
            {measuredVector.translationPath ? <path className="translation-vector" d={measuredVector.translationPath} markerEnd="url(#measured-speed-arrow)" /> : null}
            {measuredVector.rotationPath ? <path className="rotation-vector" d={measuredVector.rotationPath} markerEnd="url(#measured-speed-arrow)" /> : null}
          </g>
          <g className="chassis-speed-vector is-setpoint">
            {setpointVector.translationPath ? <path className="translation-vector" d={setpointVector.translationPath} markerEnd="url(#setpoint-speed-arrow)" /> : null}
            {setpointVector.rotationPath ? <path className="rotation-vector" d={setpointVector.rotationPath} markerEnd="url(#setpoint-speed-arrow)" /> : null}
          </g>
        </svg>
      ) : null}
      <div
        className={`robot-marker live-robot-marker ${anomaly.active ? "is-anomaly" : ""}`}
        style={robotRenderStyle(settings, fieldSize, pose.x, pose.y, headingDegrees)}
        aria-label={anomaly.active ? "Live robot pose with a possible collision or wheel slip" : connected ? "Connected live robot pose" : "Disconnected robot pose at 0,0"}
      >
        <SwerveModules settings={settings} velocity={velocity} headingDegrees={headingDegrees} />
      </div>
    </>
  );
}

interface LivePathOverlayProps {
  settings: Settings;
  fieldSize: FieldSize;
  pathName: string;
  path: SharedPathData;
}

function LivePathOverlay({ settings, fieldSize, pathName, path }: LivePathOverlayProps): ReactElement | null {
  const points = useMemo(
    () => path.waypoints.map((waypoint) => pointToPixels(settings, fieldSize, waypoint)),
    [fieldSize, path.waypoints, settings],
  );
  if (fieldSize.width <= 0 || fieldSize.height <= 0 || points.length === 0) return null;

  const viewBox = `0 0 ${Math.max(1, fieldSize.width)} ${Math.max(1, fieldSize.height)}`;
  const polylinePoints = points.map((point) => `${point.x},${point.y}`).join(" ");
  return (
    <svg
      className="field-svg live-planned-path-overlay"
      data-path-overlay="true"
      viewBox={viewBox}
      role="img"
      aria-label={`Planned path overlay for ${pathName}`}
    >
      <defs>
        <marker id="live-planned-path-arrow" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto" markerUnits="strokeWidth">
          <path className="live-planned-path-arrowhead" d="M 0 0 L 6 3 L 0 6 z" />
        </marker>
      </defs>
      {points.length > 1 ? <polyline className="live-planned-path" points={polylinePoints} markerEnd="url(#live-planned-path-arrow)" /> : null}
      {points.map((point, index) => (
        <circle
          key={path.waypoints[index].id}
          className={`live-planned-path-waypoint ${index === 0 ? "is-start" : ""} ${index === points.length - 1 ? "is-end" : ""}`}
          cx={point.x}
          cy={point.y}
          r={index === 0 || index === points.length - 1 ? 4 : 2.75}
        />
      ))}
    </svg>
  );
}

const StableLivePathOverlay = React.memo(LivePathOverlay);

interface TopicTreeNode {
  name: string;
  path: string;
  topic: TelemetryTopicInfo | null;
  children: Map<string, TopicTreeNode>;
}

function buildTopicTree(topics: TelemetryTopicInfo[]): TopicTreeNode {
  const root: TopicTreeNode = { name: "/", path: "/", topic: null, children: new Map() };
  topics.forEach((topic) => {
    const segments = topic.name.split("/").filter(Boolean);
    let current = root;
    segments.forEach((segment, index) => {
      const path = `/${segments.slice(0, index + 1).join("/")}`;
      let child = current.children.get(segment);
      if (!child) {
        child = { name: segment, path, topic: null, children: new Map() };
        current.children.set(segment, child);
      }
      if (index === segments.length - 1) child.topic = topic;
      current = child;
    });
  });
  return root;
}

interface TopicTreeRowsProps {
  node: TopicTreeNode;
  depth: number;
  expanded: Set<string>;
  onToggle: (path: string) => void;
  onSelect: (topic: string) => void;
}

function TopicTreeRows({ node, depth, expanded, onToggle, onSelect }: TopicTreeRowsProps): ReactElement {
  const children = [...node.children.values()].sort((left, right) => {
    if (Boolean(left.children.size) !== Boolean(right.children.size)) return left.children.size ? -1 : 1;
    return left.name.localeCompare(right.name);
  });
  return (
    <>
      {children.map((child) => {
        const hasChildren = child.children.size > 0;
        const isExpanded = expanded.has(child.path);
        return (
          <React.Fragment key={child.path}>
            <div className="topic-tree-row" style={{ paddingLeft: `${8 + depth * 16}px` }}>
              {hasChildren ? (
                <button className="topic-folder-toggle" type="button" aria-expanded={isExpanded} onClick={() => onToggle(child.path)}>
                  <span aria-hidden="true">{isExpanded ? "▾" : "›"}</span>
                  <strong>{child.name}</strong>
                </button>
              ) : <span className="topic-tree-spacer" />}
              {child.topic ? (
                <button className="topic-leaf" type="button" title={child.topic.name} onClick={() => onSelect(child.topic!.name)}>
                  <span>{hasChildren ? "value" : child.name}</span>
                  <small>{child.topic.type}</small>
                </button>
              ) : null}
            </div>
            {hasChildren && isExpanded ? (
              <TopicTreeRows node={child} depth={depth + 1} expanded={expanded} onToggle={onToggle} onSelect={onSelect} />
            ) : null}
          </React.Fragment>
        );
      })}
    </>
  );
}

interface TopicPickerProps {
  label: string;
  description: string;
  value: string | null;
  topics: TelemetryTopicInfo[];
  optional?: boolean;
  onChange: (topic: string | null) => void;
}

function TopicPicker({ label, description, value, topics, optional = false, onChange }: TopicPickerProps): ReactElement {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [draft, setDraft] = useState(value ?? "");
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const tree = useMemo(() => buildTopicTree(topics), [topics]);
  const searchResults = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return [];
    return topics.filter((topic) => topic.name.toLowerCase().includes(query)).slice(0, 150);
  }, [search, topics]);

  useEffect(() => setDraft(value ?? ""), [value]);

  const commitDraft = (): void => {
    const trimmed = draft.trim();
    if (trimmed) onChange(trimmed.startsWith("/") ? trimmed : `/${trimmed}`);
    else if (optional) onChange(null);
    else setDraft(value ?? "");
  };

  const select = (topic: string): void => {
    setDraft(topic);
    onChange(topic);
    setOpen(false);
    setSearch("");
  };

  const toggle = (path: string): void => {
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  };

  return (
    <div className="topic-picker">
      <div className="topic-picker-heading">
        <div><strong>{label}</strong><small>{description}</small></div>
        {optional && value ? <button type="button" onClick={() => onChange(null)}>Clear</button> : null}
      </div>
      <div className="topic-picker-control">
        <input
          value={draft}
          placeholder={optional ? "Optional — choose a topic" : "Enter a topic path"}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={commitDraft}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              commitDraft();
              event.currentTarget.blur();
            }
          }}
        />
        <button type="button" aria-expanded={open} onClick={() => setOpen((current) => !current)}>Browse</button>
      </div>
      {open ? (
        <div className="topic-browser">
          <div className="topic-browser-toolbar">
            <input autoFocus value={search} placeholder={`Search ${topics.length} announced topics`} onChange={(event) => setSearch(event.target.value)} />
            <button type="button" onClick={() => setOpen(false)}>Close</button>
          </div>
          <div className="topic-browser-list">
            {search.trim() ? searchResults.map((topic) => (
              <button key={topic.name} className="topic-search-result" type="button" onClick={() => select(topic.name)}>
                <span>{topic.name}</span><small>{topic.type}</small>
              </button>
            )) : topics.length > 0 ? (
              <TopicTreeRows node={tree} depth={0} expanded={expanded} onToggle={toggle} onSelect={select} />
            ) : (
              <div className="topic-browser-empty">Connect to NT4 to discover topic folders. You can still type a path above.</div>
            )}
            {search.trim() && searchResults.length === 0 ? <div className="topic-browser-empty">No matching topics.</div> : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

const StableTopicPicker = React.memo(TopicPicker, (previous, next) => (
  previous.label === next.label
  && previous.description === next.description
  && previous.value === next.value
  && previous.topics === next.topics
  && previous.optional === next.optional
));

interface LiveTelemetryWorkspaceProps {
  settings: Settings;
  nt4Address: string;
  selectedRoutineCode: string | null;
  activePathName: string | null;
  activePathData: SharedPathData;
  updateSettings: (patch: Partial<Settings>) => void;
  onError: (message: string) => void;
  onPublished: (routineCode: string) => void;
}

function LiveTelemetryWorkspace({
  settings,
  nt4Address,
  selectedRoutineCode,
  activePathName,
  activePathData,
  updateSettings,
  onError,
  onPublished,
}: LiveTelemetryWorkspaceProps): ReactElement {
  const [fieldRef, fieldSize] = useElementSize<HTMLDivElement>(true);
  const telemetry = useLiveTelemetry();
  const fieldBackgroundStyle = useMemo<CSSProperties>(() => ({
    aspectRatio: `${settings.fieldLengthMeters} / ${settings.fieldWidthMeters}`,
    backgroundImage: settings.fieldImageDataUrl ? `url(${settings.fieldImageDataUrl})` : undefined,
  }), [settings.fieldImageDataUrl, settings.fieldLengthMeters, settings.fieldWidthMeters]);
  const speedValue = (value: number): string => Number.isFinite(value) ? value.toFixed(2) : "—";
  const hasActivePathOverlay = Boolean(activePathName && activePathData.waypoints.length > 0);

  return (
    <main className="live-workspace" data-workspace-tab="live">
      <section className="live-visual-panel">
        <div className="live-page-header">
          <div>
            <span className="eyebrow">Live telemetry</span>
            <h1>Robot position</h1>
            <p><LiveStatusText /> · {nt4Address || "no NT4 address"}</p>
          </div>
          <LiveConnectionActions
            className="connection-actions"
            selectedRoutineCode={selectedRoutineCode}
            onError={onError}
            onPublished={onPublished}
          />
        </div>

        <div className={`traction-banner ${telemetry.anomaly.active ? "is-anomaly" : ""}`} role="status">
          <Activity aria-hidden="true" />
          <div>
            <strong>{telemetry.anomaly.active ? "Possible collision or wheel slip" : "Traction monitor"}</strong>
            <span>{settings.measuredChassisSpeedsTopic && settings.setpointChassisSpeedsTopic
              ? `Linear error ${speedValue(telemetry.anomaly.linearError)} m/s · angular error ${speedValue(telemetry.anomaly.angularError)} rad/s`
              : "Select measured and setpoint ChassisSpeeds topics to enable detection."}</span>
          </div>
        </div>

        <div className="live-field-shell">
          <div
            ref={fieldRef}
            className={`field-surface live-tab-field ${settings.fieldImageDataUrl ? "has-field-image" : ""}`}
            data-measured={fieldSize.width > 0 && fieldSize.height > 0}
            style={fieldBackgroundStyle}
          >
            {!settings.fieldImageDataUrl ? <div className="field-placeholder">Live field<br />{formatNumber(settings.fieldLengthMeters)} × {formatNumber(settings.fieldWidthMeters)} m</div> : null}
            <div
              className="origin-label"
              style={{
                left: `${pointToPixels(settings, fieldSize, { x: 0, y: 0 }).x}px`,
                top: `${pointToPixels(settings, fieldSize, { x: 0, y: 0 }).y}px`,
              }}
            >
              (0,0)
            </div>
            {settings.showLivePathOverlay && activePathName && hasActivePathOverlay ? (
              <StableLivePathOverlay
                settings={settings}
                fieldSize={fieldSize}
                pathName={activePathName}
                path={activePathData}
              />
            ) : null}
            <LiveRobotOverlay settings={settings} fieldSize={fieldSize} />
          </div>
        </div>

        <div className="speed-readouts" aria-label="ChassisSpeeds legend and values">
          <article className="speed-readout is-measured">
            <span><i aria-hidden="true" />Measured</span>
            <strong>{telemetry.measuredSpeeds ? `${speedValue(Math.hypot(telemetry.measuredSpeeds.vx, telemetry.measuredSpeeds.vy))} m/s` : "Not selected"}</strong>
            <small>{telemetry.measuredSpeeds ? `vx ${speedValue(telemetry.measuredSpeeds.vx)} m/s · vy ${speedValue(telemetry.measuredSpeeds.vy)} m/s · ω ${speedValue(telemetry.measuredSpeeds.omega)} rad/s` : "Optional ChassisSpeeds input"}</small>
          </article>
          <article className="speed-readout is-setpoint">
            <span><i aria-hidden="true" />Setpoint</span>
            <strong>{telemetry.setpointSpeeds ? `${speedValue(Math.hypot(telemetry.setpointSpeeds.vx, telemetry.setpointSpeeds.vy))} m/s` : "Not selected"}</strong>
            <small>{telemetry.setpointSpeeds ? `vx ${speedValue(telemetry.setpointSpeeds.vx)} m/s · vy ${speedValue(telemetry.setpointSpeeds.vy)} m/s · ω ${speedValue(telemetry.setpointSpeeds.omega)} rad/s` : "Optional ChassisSpeeds input"}</small>
          </article>
        </div>
      </section>

      <aside className="telemetry-config-panel">
        <section className="telemetry-config-card transport-card">
          <div className="config-section-heading">
            <div><span className="eyebrow">Connection</span><h2>NT4 client</h2></div>
            <span className={`connection-dot ${telemetry.serverConnected ? "connected" : ""}`} title={telemetry.serverConnected ? "NT4 connected" : "NT4 disconnected"} />
          </div>
          <div className="transport-switch" role="group" aria-label="NetworkTables client library">
            <button type="button" className={settings.telemetryTransport === "direct" ? "is-active" : ""} onClick={() => updateSettings({ telemetryTransport: "direct" })}>
              Direct client
            </button>
            <button type="button" className={settings.telemetryTransport === "frc-web-components" ? "is-active" : ""} onClick={() => updateSettings({ telemetryTransport: "frc-web-components" })}>
              FRC Web Components
            </button>
          </div>
          <p>{settings.telemetryTransport === "direct"
            ? "Lean startup client with low-rate topic discovery."
            : "Compatibility client using FRC Web Components’ NT4 implementation."}</p>
          {telemetry.transportError ? <div className="transport-error">{telemetry.transportError}</div> : null}
          <div className="topic-count"><strong>{telemetry.topics.length}</strong><span>announced topics discovered</span></div>
        </section>

        <section className="telemetry-config-card live-path-overlay-card">
          <div className="config-section-heading">
            <div><span className="eyebrow">Field view</span><h2>Path overlay</h2></div>
            <button
              type="button"
              className={`live-path-overlay-toggle ${settings.showLivePathOverlay ? "is-active" : ""}`}
              aria-pressed={settings.showLivePathOverlay}
              disabled={!hasActivePathOverlay}
              title={hasActivePathOverlay
                ? `${settings.showLivePathOverlay ? "Hide" : "Show"} the active Auto builder path on the live field`
                : "Open a path in Auto builder to enable its live overlay"}
              onClick={() => updateSettings({ showLivePathOverlay: !settings.showLivePathOverlay })}
            >
              {settings.showLivePathOverlay ? "Hide path" : "Show path"}
            </button>
          </div>
          <p>{hasActivePathOverlay
            ? `Shows ${activePathName} behind the live robot without affecting telemetry or publishing.`
            : "Open a path in Auto builder to compare its planned route with the live robot."}</p>
        </section>

        <section className="telemetry-config-card topic-config-card">
          <div className="config-section-heading"><div><span className="eyebrow">Sources</span><h2>Robot topics</h2></div></div>
          <StableTopicPicker
            label="Driver Station attached"
            description="Boolean controlling the connected state"
            value={settings.driverStationTopic}
            topics={telemetry.topics}
            onChange={(topic) => topic && updateSettings({ driverStationTopic: topic })}
          />
          <StableTopicPicker
            label="Odometry / Robot"
            description="Pose2d struct, array, or JSON value"
            value={settings.odometryTopic}
            topics={telemetry.topics}
            onChange={(topic) => topic && updateSettings({ odometryTopic: topic })}
          />
          <StableTopicPicker
            label="Measured swerve ChassisSpeeds"
            description="Optional actual vx, vy, and omega"
            value={settings.measuredChassisSpeedsTopic}
            topics={telemetry.topics}
            optional
            onChange={(topic) => updateSettings({ measuredChassisSpeedsTopic: topic })}
          />
          <StableTopicPicker
            label="Setpoint swerve ChassisSpeeds"
            description="Optional commanded vx, vy, and omega"
            value={settings.setpointChassisSpeedsTopic}
            topics={telemetry.topics}
            optional
            onChange={(topic) => updateSettings({ setpointChassisSpeedsTopic: topic })}
          />
        </section>
      </aside>
    </main>
  );
}

interface CropBounds {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

interface FieldImageCropDialogProps {
  source: string | null;
  fieldAspectRatio: number;
  onCancel: () => void;
  onApply: (croppedDataUrl: string) => void;
}

function FieldImageCropDialog({ source, fieldAspectRatio, onCancel, onApply }: FieldImageCropDialogProps): ReactElement {
  const imageRef = useRef<HTMLImageElement>(null);
  const [imageSize, setImageSize] = useState({ width: 0, height: 0 });
  const [bounds, setBounds] = useState<CropBounds>({ left: 0, right: 100, top: 0, bottom: 100 });

  const fitFieldRatio = useCallback((width: number, height: number): void => {
    if (width <= 0 || height <= 0 || !Number.isFinite(fieldAspectRatio) || fieldAspectRatio <= 0) return;
    const imageAspect = width / height;
    if (imageAspect > fieldAspectRatio) {
      const cropWidth = (fieldAspectRatio / imageAspect) * 100;
      const inset = (100 - cropWidth) / 2;
      setBounds({ left: inset, right: 100 - inset, top: 0, bottom: 100 });
    } else {
      const cropHeight = (imageAspect / fieldAspectRatio) * 100;
      const inset = (100 - cropHeight) / 2;
      setBounds({ left: 0, right: 100, top: inset, bottom: 100 - inset });
    }
  }, [fieldAspectRatio]);

  const applyCrop = (): void => {
    const image = imageRef.current;
    if (!image || image.naturalWidth <= 0 || image.naturalHeight <= 0) return;
    const sourceX = Math.round((bounds.left / 100) * image.naturalWidth);
    const sourceY = Math.round((bounds.top / 100) * image.naturalHeight);
    const sourceWidth = Math.max(1, Math.round(((bounds.right - bounds.left) / 100) * image.naturalWidth));
    const sourceHeight = Math.max(1, Math.round(((bounds.bottom - bounds.top) / 100) * image.naturalHeight));
    const scale = Math.min(1, 3200 / Math.max(sourceWidth, sourceHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(sourceWidth * scale));
    canvas.height = Math.max(1, Math.round(sourceHeight * scale));
    const context = canvas.getContext("2d");
    if (!context) return;
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    context.drawImage(image, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, canvas.width, canvas.height);
    onApply(canvas.toDataURL("image/webp", 0.92));
  };

  const setEdge = (edge: keyof CropBounds, rawValue: number): void => {
    setBounds((current) => {
      const value = clamp(rawValue, 0, 100);
      if (edge === "left") return { ...current, left: Math.min(value, current.right - 2) };
      if (edge === "right") return { ...current, right: Math.max(value, current.left + 2) };
      if (edge === "top") return { ...current, top: Math.min(value, current.bottom - 2) };
      return { ...current, bottom: Math.max(value, current.top + 2) };
    });
  };

  return (
    <Dialog open={Boolean(source)} onOpenChange={(open) => { if (!open) onCancel(); }}>
      <DialogContent className="field-crop-dialog">
        <DialogHeader className="field-crop-header">
          <div className="preferences-title-icon" aria-hidden="true"><Crop /></div>
          <div>
            <DialogTitle>Crop field image</DialogTitle>
            <DialogDescription>Trim scoreboards, borders, and whitespace so only the playable field remains.</DialogDescription>
          </div>
        </DialogHeader>
        {source ? (
          <div className="field-crop-body">
            <div className="crop-preview-stage">
              <img
                ref={imageRef}
                src={source}
                alt="Uploaded field before cropping"
                onLoad={(event) => {
                  const size = { width: event.currentTarget.naturalWidth, height: event.currentTarget.naturalHeight };
                  setImageSize(size);
                  fitFieldRatio(size.width, size.height);
                }}
              />
              <div
                className="crop-selection"
                style={{
                  left: `${bounds.left}%`,
                  top: `${bounds.top}%`,
                  width: `${bounds.right - bounds.left}%`,
                  height: `${bounds.bottom - bounds.top}%`,
                }}
              ><span>Field area</span></div>
            </div>
            <div className="crop-controls">
              {([
                ["left", "Left edge"],
                ["right", "Right edge"],
                ["top", "Top edge"],
                ["bottom", "Bottom edge"],
              ] as Array<[keyof CropBounds, string]>).map(([edge, label]) => (
                <label key={edge}>
                  <span>{label}<output>{Math.round(bounds[edge])}%</output></span>
                  <input type="range" min="0" max="100" step="0.1" value={bounds[edge]} onChange={(event) => setEdge(edge, Number(event.target.value))} />
                </label>
              ))}
            </div>
            <div className="crop-summary">
              <span>Source {imageSize.width || "—"} × {imageSize.height || "—"} px</span>
              <span>Field ratio {formatNumber(fieldAspectRatio, 3)}:1</span>
            </div>
            <div className="crop-actions">
              <button type="button" onClick={() => setBounds({ left: 0, right: 100, top: 0, bottom: 100 })}>Use full image</button>
              <button type="button" onClick={() => fitFieldRatio(imageSize.width, imageSize.height)}>Fit field ratio</button>
              <span />
              <button type="button" onClick={onCancel}>Cancel</button>
              <button className="is-primary" type="button" onClick={applyCrop}>Apply crop</button>
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

interface AutoPublishOnConnectProps {
  enabled: boolean;
  hydrated: boolean;
  selectedRoutineCode: string | null;
  onError: (message: string) => void;
  onPublished: (routineCode: string) => void;
}

function AutoPublishOnConnect({
  enabled,
  hydrated,
  selectedRoutineCode,
  onError,
  onPublished,
}: AutoPublishOnConnectProps): null {
  const { connected, publishRoutine } = useLiveTelemetry();
  const wasConnectedRef = useRef(false);

  useEffect(() => {
    const justConnected = connected && !wasConnectedRef.current;
    wasConnectedRef.current = connected;
    if (!justConnected || !enabled || !hydrated || !selectedRoutineCode) return;
    void publishRoutine(selectedRoutineCode)
      .then(() => onPublished(selectedRoutineCode))
      .catch((error) => {
        console.error(error);
        onError("Robot connected, but Voyager could not publish the selected routine.");
      });
  }, [connected, enabled, hydrated, onError, onPublished, publishRoutine, selectedRoutineCode]);

  return null;
}

const EDITOR_HISTORY_LIMIT = 100;
const EDITOR_HISTORY_COMMIT_DELAY_MS = 250;
const VERSION_HISTORY_LIMIT = 80;
const versionSnapshotFingerprintCache = new WeakMap<object, { obstacles: FieldObstacle[]; value: string }>();

function versionSnapshotFingerprint(snapshot: EditorSnapshot, obstacles: FieldObstacle[]): string {
  const cached = versionSnapshotFingerprintCache.get(snapshot);
  if (cached?.obstacles === obstacles) return cached.value;
  const value = JSON.stringify([snapshot.activePathNodeId, snapshot.treeNodes, snapshot.pathDataByName, obstacles]);
  versionSnapshotFingerprintCache.set(snapshot, { obstacles, value });
  return value;
}

function editorSnapshotsMatch(left: EditorSnapshot, right: EditorSnapshot): boolean {
  return left.treeNodes === right.treeNodes
    && left.pathDataByName === right.pathDataByName
    && left.activePathNodeId === right.activePathNodeId;
}

function copyEditorSnapshot(snapshot: EditorSnapshot): EditorSnapshot {
  return {
    treeNodes: snapshot.treeNodes.map((node) => ({ ...node })),
    pathDataByName: Object.fromEntries(Object.entries(snapshot.pathDataByName).map(([name, path]) => [name, {
      waypoints: path.waypoints.map((waypoint) => ({ ...waypoint })),
      rotationTargets: path.rotationTargets.map((target) => ({ ...target })),
      events: path.events.map((event) => ({ ...event })),
      eventZones: path.eventZones.map((zone) => ({ ...zone })),
      constraintZones: path.constraintZones.map((zone) => ({ ...zone })),
    }])),
    activePathNodeId: snapshot.activePathNodeId,
  };
}

function isTextEditingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || target.closest("input, textarea, select, [contenteditable='true']") !== null;
}

function App({ nt4Address, setNt4Address }: AppProps): ReactElement {
  const appRef = useRef<HTMLDivElement>(null);
  const workspaceRef = useRef<HTMLElement>(null);
  const leftPanelRef = useRef<HTMLDivElement>(null);
  const [activeWorkspaceTab, setActiveWorkspaceTab] = useState<WorkspaceTab>("auto");
  const [fieldOneRef, fieldOneSize] = useElementSize<HTMLDivElement>(activeWorkspaceTab === "auto");
  const [treeViewportRef, treeViewportSize] = useElementSize<HTMLDivElement>(activeWorkspaceTab === "auto");
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [treeNodes, setTreeNodes] = useState<PathTreeNode[]>([]);
  const [pathDataByName, setPathDataByName] = useState<Record<string, SharedPathData>>({});
  const [knownPathFileNames, setKnownPathFileNames] = useState<string[]>([]);
  const [activePathNodeId, setActivePathNodeId] = useState<string | null>(null);
  const [addElementKind, setAddElementKind] = useState<AddElementKind>("waypoint");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [preferencesOpen, setPreferencesOpen] = useState(false);
  const [preferencesTab, setPreferencesTab] = useState<PreferencesTab>("themes");
  const [saveModalOpen, setSaveModalOpen] = useState(false);
  const [treeAddMenuOpen, setTreeAddMenuOpen] = useState(false);
  const [moreToolsOpen, setMoreToolsOpen] = useState(false);
  const [appMenuOpen, setAppMenuOpen] = useState(false);
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [pendingConnection, setPendingConnection] = useState<PendingTreeConnection | null>(null);
  const [modal, setModal] = useState<ElementModalState>(null);
  const [playbackOpen, setPlaybackOpen] = useState(false);
  const [playbackPlaying, setPlaybackPlaying] = useState(false);
  const [playbackTime, setPlaybackTime] = useState(0);
  const [playbackModalPosition, setPlaybackModalPosition] = useState<PixelPoint>({ x: 28, y: 84 });
  const [saveStatus, setSaveStatusState] = useState<SaveStatus>({ kind: "idle", message: "" });
  const [activityLog, setActivityLog] = useState<ActivityLogEntry[]>([]);
  const [activityLogOpen, setActivityLogOpen] = useState(false);
  const [versionHistoryOpen, setVersionHistoryOpen] = useState(false);
  const [versionHistory, setVersionHistory] = useState<VersionHistorySnapshot[]>([]);
  const [obstaclesOpen, setObstaclesOpen] = useState(false);
  const [obstacleFieldRef, obstacleFieldSize] = useElementSize<HTMLDivElement>(obstaclesOpen);
  const [obstacles, setObstacles] = useState<FieldObstacle[]>([]);
  const [selectedObstacleId, setSelectedObstacleId] = useState<string | null>(null);
  const [pathPlannerActive, setPathPlannerActive] = useState(false);
  const [pathPlannerPoints, setPathPlannerPoints] = useState<MeterPoint[]>([]);
  const [pathPlannerStartWaypointId, setPathPlannerStartWaypointId] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [pan, setPan] = useState<PixelPoint>({ x: 0, y: 0 });
  const [treeModalRect, setTreeModalRect] = useState<TreeModalRect>({ x: 420, y: 18, width: 520, height: 520 });
  const [treeModalMinimized, setTreeModalMinimized] = useState(false);
  const [selectedTreeNodeId, setSelectedTreeNodeId] = useState<string | null>(null);
  const [renamingNodeId, setRenamingNodeId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState("");
  const [activeRotationHandleId, setActiveRotationHandleId] = useState<string | null>(null);
  const [nt4AddressDraft, setNt4AddressDraft] = useState(nt4Address);
  const [fieldCropSource, setFieldCropSource] = useState<string | null>(null);
  const persistTimerRef = useRef<number | null>(null);
  const autoSaveTimerRef = useRef<number | null>(null);
  const metadataAutoSaveTimerRef = useRef<number | null>(null);
  const historyCommitTimerRef = useRef<number | null>(null);
  const contextMenuRef = useRef<HTMLDivElement>(null);
  const elementModalRef = useRef<HTMLDivElement>(null);
  const settingsModalRef = useRef<HTMLDivElement>(null);
  const playbackModalRef = useRef<HTMLDivElement>(null);
  const playbackRobotRef = useRef<HTMLDivElement>(null);
  const playbackTimelineRef = useRef<HTMLInputElement>(null);
  const playbackTimeLabelRef = useRef<HTMLSpanElement>(null);
  const focusTreeModalRef = useRef<HTMLElement>(null);
  const treeSvgRef = useRef<SVGSVGElement>(null);
  const treeNodesLayerRef = useRef<HTMLDivElement>(null);
  const editorHistoryRef = useRef<EditorHistory | null>(null);
  const versionHistoryRef = useRef<VersionHistorySnapshot[]>([]);
  const editorSnapshotRef = useRef<EditorSnapshot>({ treeNodes, pathDataByName, activePathNodeId });
  const applyingHistoryRef = useRef(false);
  const [, setHistoryRevision] = useState(0);
  const playbackAnimationFrameRef = useRef<number | null>(null);
  const playbackTimeRef = useRef(0);
  const treeClipboardRef = useRef<TreeClipboardSnapshot | null>(null);
  const clipboardPasteCountRef = useRef(0);
  const draggingModalRef = useRef<{ offsetX: number; offsetY: number } | null>(null);
  const dragOperationRef = useRef<(() => void) | null>(null);

  versionHistoryRef.current = versionHistory;

  const setSaveStatus = useCallback((status: SaveStatus): void => {
    setSaveStatusState(status);
    if (!status.message.trim()) return;
    setActivityLog((entries) => [...entries, {
      ...status,
      id: createId("activity"),
      timestamp: Date.now(),
    }].slice(-ACTIVITY_LOG_LIMIT));
  }, []);

  useEffect(() => {
    setNt4AddressDraft(nt4Address);
  }, [nt4Address]);

  useEffect(() => {
    if (activeWorkspaceTab !== "live") return;
    dragOperationRef.current?.();
    dragOperationRef.current = null;
    setPlaybackPlaying(false);
    setPlaybackOpen(false);
    setModal(null);
    setContextMenu(null);
    setTreeAddMenuOpen(false);
    setMoreToolsOpen(false);
    setPathPlannerActive(false);
    setPathPlannerPoints([]);
    setPathPlannerStartWaypointId(null);
    setActiveRotationHandleId(null);
  }, [activeWorkspaceTab]);

  useEffect(() => {
    if (!settingsOpen || fieldCropSource) return;
    const focusFrame = window.requestAnimationFrame(() => settingsModalRef.current?.focus());
    const onKeyDown = (event: KeyboardEvent): void => {
      const modalElement = settingsModalRef.current;
      if (!modalElement) return;
      if (event.key === "Escape") {
        event.preventDefault();
        setSettingsOpen(false);
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = Array.from(modalElement.querySelectorAll<HTMLElement>(
        'button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])',
      )).filter((element) => element.offsetParent !== null);
      if (focusable.length === 0) {
        event.preventDefault();
        modalElement.focus();
        return;
      }
      const first = focusable[0];
      const last = focusable.at(-1)!;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.cancelAnimationFrame(focusFrame);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [fieldCropSource, settingsOpen]);

  useLayoutEffect(() => {
    if (!modal) return;
    const appRect = appRef.current?.getBoundingClientRect();
    const modalElement = elementModalRef.current;
    if (!appRect || !modalElement) return;
    const modalRect = modalElement.getBoundingClientRect();
    const nextX = clamp(modal.x, 8, Math.max(8, appRect.width - modalRect.width - 8));
    const nextY = clamp(modal.y, 48, Math.max(48, appRect.height - modalRect.height - 8));
    if (Math.abs(nextX - modal.x) < 0.5 && Math.abs(nextY - modal.y) < 0.5) return;
    setModal((current) => current ? { ...current, x: nextX, y: nextY } : current);
  }, [modal]);

  useEffect(() => {
    if (!modal) return;
    const focusFrame = window.requestAnimationFrame(() => elementModalRef.current?.focus({ preventScroll: true }));
    return () => window.cancelAnimationFrame(focusFrame);
  }, [modal]);

  const activePathNode = useMemo<PathTreePathNode | null>(() => {
    if (!activePathNodeId) return null;
    const node = treeNodes.find((candidate) => candidate.id === activePathNodeId);
    return node?.kind === "path" ? node : null;
  }, [activePathNodeId, treeNodes]);

  const activePathName = activePathNode?.name ?? null;
  const activePathData = activePathName ? pathDataByName[activePathName] ?? EMPTY_PATH_DATA : EMPTY_PATH_DATA;
  const activeMaxPosition = useMemo(() => maxPathPosition(activePathData), [activePathData]);
  const playbackPlan = useMemo(() => buildPlaybackPlan(activePathData, settings), [
    activePathData,
    settings.cteControllerD,
    settings.cteControllerI,
    settings.cteControllerP,
    settings.defaultIntermediateHandOffRadiusMeters,
    settings.endRotationToleranceDegrees,
    settings.endTranslationToleranceMeters,
    settings.maxRotationalAcceleration,
    settings.maxRotationalVelocity,
    settings.maxTranslationalAcceleration,
    settings.maxTranslationalVelocity,
    settings.rotationalControllerD,
    settings.rotationalControllerI,
    settings.rotationalControllerP,
    settings.translationalControllerD,
    settings.translationalControllerI,
    settings.translationalControllerP,
  ]);
  const playbackPose = playbackOpen ? poseAtPlaybackTime(activePathData, playbackPlan, playbackTimeRef.current) : null;
  const playbackVelocity = playbackOpen
    ? playbackVelocityAtTime(activePathData, playbackPlan, playbackTimeRef.current)
    : { vx: 0, vy: 0, omega: 0 };
  const applyPlaybackVisualTime = useCallback((requestedTime: number): void => {
    const nextTime = clamp(requestedTime, 0, playbackPlan.totalDuration);
    playbackTimeRef.current = nextTime;

    if (playbackTimeLabelRef.current) {
      playbackTimeLabelRef.current.textContent = formatPlaybackTime(nextTime);
    }
    if (playbackTimelineRef.current) {
      playbackTimelineRef.current.value = String(nextTime);
    }

    const robotElement = playbackRobotRef.current;
    if (!robotElement) return;
    const pose = poseAtPlaybackTime(activePathData, playbackPlan, nextTime);
    if (!pose) return;
    const style = robotRenderStyle(settings, fieldOneSize, pose.x, pose.y, pose.angle);
    robotElement.style.width = String(style.width);
    robotElement.style.height = String(style.height);
    robotElement.style.left = String(style.left);
    robotElement.style.top = String(style.top);
    robotElement.style.transform = String(style.transform);
    robotElement.style.transformOrigin = String(style.transformOrigin);
    robotElement.setAttribute("aria-label", `Path preview robot at ${formatPlaybackTime(nextTime)}`);
    updateSwerveModulesElement(
      robotElement,
      settings,
      playbackVelocityAtTime(activePathData, playbackPlan, nextTime),
      pose.angle,
    );
  }, [activePathData, fieldOneSize, playbackPlan, settings]);
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

  const activeTheme = useMemo<ThemePalette>(() => {
    if (settings.themePreset === "custom") return settings.customTheme;
    return THEME_PRESETS.find((preset) => preset.id === settings.themePreset)?.palette ?? DEFAULT_THEME.palette;
  }, [settings.customTheme, settings.themePreset]);
  const activeDesign = useMemo<DesignPreset>(
    () => DESIGN_PRESETS.find((preset) => preset.id === settings.designPreset) ?? DEFAULT_DESIGN,
    [settings.designPreset],
  );
  const appThemeStyle = useMemo<CSSProperties>(() => ({
    "--bg": activeTheme.background,
    "--panel": activeTheme.panel,
    "--panel-2": activeTheme.panel2,
    "--panel-3": activeTheme.panel3,
    "--border": activeTheme.border,
    "--border-strong": activeTheme.borderStrong,
    "--text": activeTheme.text,
    "--muted": activeTheme.muted,
    "--faint": activeTheme.faint,
    "--accent": activeTheme.accent,
    "--accent-2": activeTheme.accent2,
    "--warn": activeTheme.warn,
    "--danger": activeTheme.danger,
    "--success": activeTheme.success,
    "--background": activeTheme.background,
    "--foreground": activeTheme.text,
    "--card": activeTheme.panel,
    "--card-foreground": activeTheme.text,
    "--popover": activeTheme.panel2,
    "--popover-foreground": activeTheme.text,
    "--primary": activeTheme.accent,
    "--primary-foreground": activeTheme.background,
    "--secondary": activeTheme.panel3,
    "--secondary-foreground": activeTheme.text,
    "--muted-foreground": activeTheme.muted,
    "--destructive": activeTheme.danger,
    "--input": activeTheme.border,
    "--ring": activeTheme.accent2,
    "--design-font-body": activeDesign.bodyFont,
    "--design-font-display": activeDesign.displayFont,
    "--design-font-mono": activeDesign.monoFont,
    "--design-base-font-size": activeDesign.baseFontSize,
    "--design-nav-height": activeDesign.navHeight,
    "--design-control-height": activeDesign.controlHeight,
    "--design-panel-padding": activeDesign.panelPadding,
    "--design-radius-sm": activeDesign.radiusSmall,
    "--design-radius-md": activeDesign.radiusMedium,
    "--design-radius-lg": activeDesign.radiusLarge,
    "--design-button-radius": activeDesign.buttonRadius,
    "--design-shadow": activeDesign.shadow,
  } as CSSProperties), [activeDesign, activeTheme]);

  useEffect(() => {
    const root = document.documentElement;
    Object.entries(appThemeStyle).forEach(([property, value]) => {
      if (typeof value === "string" || typeof value === "number") root.style.setProperty(property, String(value));
    });
  }, [appThemeStyle]);

  useEffect(() => {
    if (settings.layoutMode !== "focus") return;
    const workspace = workspaceRef.current;
    if (!workspace) return;
    const bounds = workspace.getBoundingClientRect();
    const width = clamp(bounds.width * 0.4, 340, Math.min(560, bounds.width - 36));
    const height = clamp(bounds.height * 0.62, 260, Math.max(260, bounds.height - 36));
    setTreeModalRect({ x: Math.max(18, bounds.width - width - 18), y: 18, width, height });
    setTreeModalMinimized(false);
  }, [settings.layoutMode]);

  const pathTreeNodes = useMemo(
    () => treeNodes.filter((node): node is PathTreePathNode => node.kind === "path"),
    [treeNodes],
  );
  const visiblePathNodeCount = useMemo(() => pathTreeNodes.filter((node) => {
    const screenX = node.x + pan.x;
    const screenY = node.y + pan.y;
    return screenX + NODE_WIDTH > 0
      && screenX < treeViewportSize.width
      && screenY + NODE_HEIGHT > 0
      && screenY < treeViewportSize.height;
  }).length, [pan.x, pan.y, pathTreeNodes, treeViewportSize.height, treeViewportSize.width]);

  useEffect(() => {
    setPlaybackPlaying(false);
    playbackTimeRef.current = 0;
    setPlaybackTime(0);
  }, [activePathName]);

  useEffect(() => {
    const nextTime = clamp(playbackTimeRef.current, 0, playbackPlan.totalDuration);
    playbackTimeRef.current = nextTime;
    setPlaybackTime(nextTime);
    if (playbackPlan.totalDuration <= 0) setPlaybackPlaying(false);
  }, [playbackPlan.totalDuration]);

  useEffect(() => {
    if (!playbackOpen || !playbackPlaying || playbackPlan.totalDuration <= 0) return;

    let previousTimestamp = performance.now();
    const tick = (timestamp: number): void => {
      const elapsedSeconds = Math.max(0, (timestamp - previousTimestamp) / 1000);
      previousTimestamp = timestamp;
      applyPlaybackVisualTime((playbackTimeRef.current + elapsedSeconds) % playbackPlan.totalDuration);
      playbackAnimationFrameRef.current = window.requestAnimationFrame(tick);
    };

    playbackAnimationFrameRef.current = window.requestAnimationFrame(tick);
    return () => {
      if (playbackAnimationFrameRef.current !== null) window.cancelAnimationFrame(playbackAnimationFrameRef.current);
      playbackAnimationFrameRef.current = null;
    };
  }, [applyPlaybackVisualTime, playbackOpen, playbackPlan.totalDuration, playbackPlaying]);

  useLayoutEffect(() => {
    if (!contextMenu) return;
    const menu = contextMenuRef.current;
    const app = appRef.current;
    if (!menu || !app) return;
    const menuRect = menu.getBoundingClientRect();
    const appRect = app.getBoundingClientRect();
    const padding = 8;
    const nextX = clamp(contextMenu.x, padding, Math.max(padding, appRect.width - menuRect.width - padding));
    const nextY = clamp(contextMenu.y, padding, Math.max(padding, appRect.height - menuRect.height - padding));
    if (Math.abs(nextX - contextMenu.x) < 0.5 && Math.abs(nextY - contextMenu.y) < 0.5) return;
    setContextMenu((current) => current ? { ...current, x: nextX, y: nextY } : current);
  }, [contextMenu]);

  const currentEditorSnapshot = useMemo<EditorSnapshot>(() => ({
    treeNodes,
    pathDataByName,
    activePathNodeId,
  }), [activePathNodeId, pathDataByName, treeNodes]);
  editorSnapshotRef.current = currentEditorSnapshot;

  useEffect(() => {
    if (!hydrated) return;

    const history = editorHistoryRef.current;
    if (!history) {
      editorHistoryRef.current = { past: [], present: currentEditorSnapshot, future: [] };
      setHistoryRevision((revision) => revision + 1);
      return;
    }

    if (applyingHistoryRef.current) {
      applyingHistoryRef.current = false;
      history.present = currentEditorSnapshot;
      return;
    }

    if (editorSnapshotsMatch(history.present, currentEditorSnapshot)) return;

    if (history.future.length > 0) {
      history.future = [];
      setHistoryRevision((revision) => revision + 1);
    }

    if (historyCommitTimerRef.current) window.clearTimeout(historyCommitTimerRef.current);
    historyCommitTimerRef.current = window.setTimeout(() => {
      const latest = editorSnapshotRef.current;
      const latestHistory = editorHistoryRef.current;
      historyCommitTimerRef.current = null;
      if (!latestHistory || editorSnapshotsMatch(latestHistory.present, latest)) return;

      latestHistory.past = [...latestHistory.past, latestHistory.present].slice(-EDITOR_HISTORY_LIMIT);
      latestHistory.present = latest;
      latestHistory.future = [];
      setHistoryRevision((revision) => revision + 1);
    }, EDITOR_HISTORY_COMMIT_DELAY_MS);
  }, [currentEditorSnapshot, hydrated]);

  const applyEditorSnapshot = useCallback((snapshot: EditorSnapshot, message: string): void => {
    applyingHistoryRef.current = true;
    setTreeNodes(snapshot.treeNodes);
    setPathDataByName(snapshot.pathDataByName);
    setActivePathNodeId(snapshot.activePathNodeId);
    setModal(null);
    setContextMenu(null);
    setPendingConnection(null);
    setSaveStatus({ kind: "idle", message });
  }, []);

  const restoreVersionSnapshot = useCallback((snapshot: VersionHistorySnapshot): void => {
    applyEditorSnapshot(copyEditorSnapshot(snapshot), `Restored ${snapshot.source === "auto" ? "auto-save" : "manual"} snapshot from ${new Date(snapshot.timestamp).toLocaleString()}.`);
    setObstacles((snapshot.obstacles ?? []).map((obstacle) => ({ ...obstacle })));
    setVersionHistoryOpen(false);
  }, [applyEditorSnapshot]);

  const undo = useCallback((): void => {
    if (historyCommitTimerRef.current) {
      window.clearTimeout(historyCommitTimerRef.current);
      historyCommitTimerRef.current = null;
    }

    const history = editorHistoryRef.current;
    if (!history) return;
    const latest = editorSnapshotRef.current;

    if (!editorSnapshotsMatch(history.present, latest)) {
      history.past = [...history.past, history.present].slice(-EDITOR_HISTORY_LIMIT);
      history.present = latest;
      history.future = [];
    }

    const previous = history.past.at(-1);
    if (!previous) return;

    history.past = history.past.slice(0, -1);
    history.future = [...history.future, history.present];
    history.present = previous;
    applyEditorSnapshot(previous, "Undid the last editor change.");
    setHistoryRevision((revision) => revision + 1);
  }, [applyEditorSnapshot]);

  const redo = useCallback((): void => {
    if (historyCommitTimerRef.current) {
      window.clearTimeout(historyCommitTimerRef.current);
      historyCommitTimerRef.current = null;
    }

    const history = editorHistoryRef.current;
    if (!history || !editorSnapshotsMatch(history.present, editorSnapshotRef.current)) return;
    const next = history.future.at(-1);
    if (!next) return;

    history.future = history.future.slice(0, -1);
    history.past = [...history.past, history.present].slice(-EDITOR_HISTORY_LIMIT);
    history.present = next;
    applyEditorSnapshot(next, "Redid the last editor change.");
    setHistoryRevision((revision) => revision + 1);
  }, [applyEditorSnapshot]);

  const canUndo = Boolean(
    editorHistoryRef.current
      && (editorHistoryRef.current.past.length > 0 || !editorSnapshotsMatch(editorHistoryRef.current.present, currentEditorSnapshot)),
  );
  const canRedo = Boolean(
    editorHistoryRef.current
      && editorSnapshotsMatch(editorHistoryRef.current.present, currentEditorSnapshot)
      && editorHistoryRef.current.future.length > 0,
  );

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (!event.ctrlKey || event.altKey || event.metaKey || isTextEditingTarget(event.target)) return;
      const key = event.key.toLowerCase();
      if (key !== "z" && key !== "y") return;

      event.preventDefault();
      if (key === "z") undo();
      else redo();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [redo, undo]);

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
          setVersionHistory(stored.versionHistory ?? []);
          setObstacles(stored.obstacles ?? []);
          setActivityLog((stored.activityLog ?? []).slice(-ACTIVITY_LOG_LIMIT));
          setSelectedTreeNodeId(stored.selectedTreeNodeId ?? null);
          if (stored.treeModalRect) setTreeModalRect(stored.treeModalRect);
          setTreeModalMinimized(Boolean(stored.treeModalMinimized));
          if (stored.playbackModalPosition) setPlaybackModalPosition(stored.playbackModalPosition);
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
      const state: PersistedAppState = {
        settings,
        treeNodes,
        pathDataByName,
        knownPathFileNames,
        activePathNodeId,
        pan,
        versionHistory,
        obstacles,
        activityLog,
        selectedTreeNodeId,
        treeModalRect,
        treeModalMinimized,
        playbackModalPosition,
      };
      void idbSet(APP_STATE_KEY, state).catch((error) => {
        console.error(error);
        setSaveStatus({ kind: "error", message: "Could not save local IndexedDB state." });
      });
    }, LOCAL_PERSIST_DELAY_MS);
  }, [activePathNodeId, activityLog, hydrated, knownPathFileNames, obstacles, pan, pathDataByName, playbackModalPosition, selectedTreeNodeId, settings, treeModalMinimized, treeModalRect, treeNodes, versionHistory]);

  const updateSettings = useCallback((patch: Partial<Settings>): void => {
    setSettings((previous) => stabilizeSettings({ ...previous, ...patch }));
  }, []);

  const recordVersionSnapshot = useCallback((source: VersionHistorySnapshot["source"], state?: EditorSnapshot): VersionHistorySnapshot[] => {
    const snapshot = copyEditorSnapshot(state ?? { treeNodes, pathDataByName, activePathNodeId });
    const history = versionHistoryRef.current;
    const latest = history.at(-1);
    const sameAsLatest = latest
      && versionSnapshotFingerprint(latest, latest.obstacles ?? []) === versionSnapshotFingerprint(snapshot, obstacles);
    if (sameAsLatest) return history;
    const nextSnapshot = {
      ...snapshot,
      obstacles: obstacles.map((obstacle) => ({ ...obstacle })),
      id: createId("version"),
      timestamp: Date.now(),
      source,
    } as VersionHistorySnapshot;
    versionSnapshotFingerprint(nextSnapshot, nextSnapshot.obstacles ?? []);
    const nextHistory = [...history, nextSnapshot].slice(-VERSION_HISTORY_LIMIT);
    versionHistoryRef.current = nextHistory;
    setVersionHistory(nextHistory);
    return nextHistory;
  }, [activePathNodeId, obstacles, pathDataByName, treeNodes]);

  const updateActivePathData = useCallback(
    (updater: (current: SharedPathData) => SharedPathData): void => {
      if (!activePathName) {
        setError("Select a path block for editing before adding path elements.");
        return;
      }
      setPathDataByName((previous) => {
        const current = previous[activePathName] ?? createEmptyPathData();
        const updated = updater(current);
        return updated === current ? previous : { ...previous, [activePathName]: updated };
      });
    },
    [activePathName, setError],
  );

  const closeMenus = useCallback((): void => {
    setTreeAddMenuOpen(false);
    setMoreToolsOpen(false);
    setAppMenuOpen(false);
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

  const insertTreeSnapshot = useCallback((snapshot: TreeClipboardSnapshot, message: string): void => {
    clipboardPasteCountRef.current += 1;
    const offset = 48 * clipboardPasteCountRef.current;
    const instantiated = instantiateTreeSnapshot(snapshot, treeNodes, offset);
    setTreeNodes((previous) => [...previous, ...instantiated.nodes]);
    setPathDataByName((previous) => ({ ...previous, ...instantiated.pathDataByName }));
    setSelectedTreeNodeId(instantiated.rootId);
    setContextMenu(null);
    setSaveStatus({ kind: "saved", message });
  }, [treeNodes]);

  const copySelectedTree = useCallback((): void => {
    if (!selectedTreeNodeId) {
      setSaveStatus({ kind: "error", message: "Select a path-tree block before copying." });
      return;
    }
    const snapshot = copyTreeSnapshot(selectedTreeNodeId, treeNodes, pathDataByName, true);
    if (!snapshot) {
      setSaveStatus({ kind: "error", message: "The selected path-tree block could not be copied." });
      return;
    }
    treeClipboardRef.current = snapshot;
    clipboardPasteCountRef.current = 0;
    setSaveStatus({
      kind: "saved",
      message: `Copied ${snapshot.nodes.length} path-tree block${snapshot.nodes.length === 1 ? "" : "s"}, including children.`,
    });
  }, [pathDataByName, selectedTreeNodeId, treeNodes]);

  const pasteCopiedTree = useCallback((): void => {
    const snapshot = treeClipboardRef.current;
    if (!snapshot) {
      setSaveStatus({ kind: "error", message: "Copy a path-tree sequence with Ctrl+C before pasting." });
      return;
    }
    insertTreeSnapshot(
      snapshot,
      `Pasted ${snapshot.nodes.length} path-tree block${snapshot.nodes.length === 1 ? "" : "s"} as a new sequence.`,
    );
  }, [insertTreeSnapshot]);

  const duplicateSelectedTreeNode = useCallback((): void => {
    if (!selectedTreeNodeId) {
      setSaveStatus({ kind: "error", message: "Select a path-tree block before duplicating." });
      return;
    }
    const snapshot = copyTreeSnapshot(selectedTreeNodeId, treeNodes, pathDataByName, false);
    if (!snapshot) return;
    clipboardPasteCountRef.current = 0;
    insertTreeSnapshot(snapshot, "Duplicated the selected path-tree block without its children.");
  }, [insertTreeSnapshot, pathDataByName, selectedTreeNodeId, treeNodes]);

  useEffect(() => {
    const onTreeClipboardKeyDown = (event: KeyboardEvent): void => {
      if (!event.ctrlKey || event.altKey || event.metaKey || isTextEditingTarget(event.target)) return;
      const key = event.key.toLowerCase();
      if (key !== "c" && key !== "v" && key !== "d") return;
      event.preventDefault();
      if (key === "c") copySelectedTree();
      else if (key === "v") pasteCopiedTree();
      else duplicateSelectedTreeNode();
    };
    window.addEventListener("keydown", onTreeClipboardKeyDown);
    return () => window.removeEventListener("keydown", onTreeClipboardKeyDown);
  }, [copySelectedTree, duplicateSelectedTreeNode, pasteCopiedTree]);

  const deleteNode = useCallback((nodeId: string): void => {
    const deletedIds = collectSubtreeNodeIds(nodeId, treeNodes);
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
    if (activePathNodeId && deletedIds.has(activePathNodeId)) setActivePathNodeId(null);
    if (selectedTreeNodeId && deletedIds.has(selectedTreeNodeId)) setSelectedTreeNodeId(null);
    setContextMenu(null);
  }, [activePathNodeId, selectedTreeNodeId, treeNodes]);

  useEffect(() => {
    const onDeleteSelectedNode = (event: KeyboardEvent): void => {
      if (
        event.repeat
        || (event.key !== "Delete" && event.key !== "Backspace")
        || isTextEditingTarget(event.target)
        || settingsOpen
        || preferencesOpen
        || activityLogOpen
        || versionHistoryOpen
        || obstaclesOpen
        || !selectedTreeNodeId
      ) return;
      const selectedNode = treeNodes.find((node) => node.id === selectedTreeNodeId);
      if (!selectedNode) return;
      event.preventDefault();
      deleteNode(selectedNode.id);
      setSaveStatus({ kind: "saved", message: `Deleted ${selectedNode.name} and its child sequence.` });
    };
    window.addEventListener("keydown", onDeleteSelectedNode);
    return () => window.removeEventListener("keydown", onDeleteSelectedNode);
  }, [activityLogOpen, deleteNode, obstaclesOpen, preferencesOpen, selectedTreeNodeId, settingsOpen, treeNodes, versionHistoryOpen]);

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
    if (nextName.length > 120) {
      setError("Names must be 120 characters or fewer.");
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
      const nextFileName = sanitizeFileName(nextName).toLocaleLowerCase();
      const conflictingPath = treeNodes.find((node) => (
        node.kind === "path"
        && node.id !== target.id
        && node.name !== nextName
        && sanitizeFileName(node.name).toLocaleLowerCase() === nextFileName
      ));
      if (conflictingPath) {
        setError(`Another path already uses the file name ${sanitizeFileName(nextName)}.json.`);
        return;
      }
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

  const beginNodeConnectAsParent = useCallback((parentId: string): void => {
    const parent = treeNodes.find((node) => node.id === parentId);
    if (!parent) return;
    const slot = defaultSlotForParent(parent, "next");
    beginOverrideConnection("connectChild", parentId, childIdForSlot(parent, slot), slot);
  }, [beginOverrideConnection, treeNodes]);

  const beginNodeConnectAsChild = useCallback((childId: string): void => {
    const parentConnection = getParentConnection(treeNodes, childId);
    beginOverrideConnection("connectParent", parentConnection?.parentId ?? null, childId, parentConnection?.slot ?? "next");
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
      if (addElementKind === "eventZone") {
        return { ...current, eventZones: [...current.eventZones, createDefaultEventZone(currentMaxPosition)] };
      }
      return { ...current, constraintZones: [...current.constraintZones, createDefaultConstraintZone(currentMaxPosition, settings)] };
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

  const updateEventZone = useCallback((id: string, patch: Partial<EventZone>): void => {
    updateActivePathData((current) => ({
      ...current,
      eventZones: current.eventZones.map((zone) => {
        if (zone.id !== id) return zone;
        const updated = { ...zone, ...patch };
        const maxPositionValue = maxPathPosition(current);
        updated.startPosition = clamp(updated.startPosition, 0, maxPositionValue);
        updated.endPosition = clamp(updated.endPosition, 0, maxPositionValue);
        if (updated.startPosition > updated.endPosition) {
          const temporary = updated.startPosition;
          updated.startPosition = updated.endPosition;
          updated.endPosition = temporary;
        }
        return updated;
      }),
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
        eventZones: waypoints.length >= 2
          ? current.eventZones.map((zone) => ({
              ...zone,
              startPosition: clamp(zone.startPosition, 0, nextMaxPosition),
              endPosition: clamp(zone.endPosition, 0, nextMaxPosition),
            }))
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

  const deleteEventZone = useCallback((id: string): void => {
    updateActivePathData((current) => ({
      ...current,
      eventZones: current.eventZones.filter((zone) => zone.id !== id),
    }));
    setModal((current) => (current?.kind === "eventZone" && current.id === id ? null : current));
  }, [updateActivePathData]);

  const mirrorActivePath = useCallback((axis: "x" | "y"): void => {
    if (!activePathName) {
      setError("Select a path block before mirroring it.");
      return;
    }
    updateActivePathData((current) => ({
      ...current,
      waypoints: current.waypoints.map((waypoint) => axis === "x"
        ? { ...waypoint, x: settings.fieldLengthMeters - waypoint.x, angle: normalizeCompassDegrees(180 - waypoint.angle) }
        : { ...waypoint, y: settings.fieldWidthMeters - waypoint.y, angle: normalizeCompassDegrees(-waypoint.angle) }),
      rotationTargets: current.rotationTargets.map((target) => ({
        ...target,
        angle: normalizeCompassDegrees(axis === "x" ? 180 - target.angle : -target.angle),
      })),
    }));
    setSaveStatus({ kind: "saved", message: `Mirrored ${activePathName} across the ${axis.toUpperCase()} coordinate axis.` });
  }, [activePathName, setError, setSaveStatus, settings.fieldLengthMeters, settings.fieldWidthMeters, updateActivePathData]);

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

  const modalPositionFromElement = useCallback((element: HTMLElement): PixelPoint => {
    const appRect = appRef.current?.getBoundingClientRect();
    const elementRect = element.getBoundingClientRect();
    if (!appRect) return { x: 80, y: 80 };
    return {
      x: clamp(elementRect.right - appRect.left + 12, 8, Math.max(8, appRect.width - 260)),
      y: clamp(elementRect.top - appRect.top + 12, 48, Math.max(48, appRect.height - 260)),
    };
  }, []);

  const beginWaypointDrag = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>, waypoint: Waypoint): void => {
      event.preventDefault();
      if (fieldOneSize.width <= 0 || fieldOneSize.height <= 0) return;
      const fieldElement = fieldOneRef.current;
      if (!fieldElement) return;
      const waypointIndex = activePathData.waypoints.findIndex((candidate) => candidate.id === waypoint.id);
      const previousLine = waypointIndex > 0
        ? fieldElement.querySelector<SVGLineElement>(`[data-path-segment-index="${waypointIndex - 1}"]`)
        : null;
      const nextLine = waypointIndex >= 0
        ? fieldElement.querySelector<SVGLineElement>(`[data-path-segment-index="${waypointIndex}"]`)
        : null;
      const markerElement = event.currentTarget;
      const startMouse = { x: event.clientX, y: event.clientY };
      const startPoint = pointToPixels(settings, fieldOneSize, waypoint);
      let nextPoint = { x: waypoint.x, y: waypoint.y };
      let moved = false;

      const renderPoint = (point: MeterPoint): void => {
        const pixel = pointToPixels(settings, fieldOneSize, point);
        applyRobotRenderStyle(markerElement, robotRenderStyle(settings, fieldOneSize, point.x, point.y, waypoint.angle));
        previousLine?.setAttribute("x2", String(pixel.x));
        previousLine?.setAttribute("y2", String(pixel.y));
        nextLine?.setAttribute("x1", String(pixel.x));
        nextLine?.setAttribute("y1", String(pixel.y));
      };

      const pointerFrame = createPointerFrameScheduler((clientX, clientY) => {
        const dx = clientX - startMouse.x;
        const dy = clientY - startMouse.y;
        if (Math.abs(dx) > 2 || Math.abs(dy) > 2) moved = true;
        nextPoint = clampMeterPoint(settings, pixelsToPoint(settings, fieldOneSize, { x: startPoint.x + dx, y: startPoint.y + dy }));
        renderPoint(nextPoint);
      });
      const onPointerMove = (moveEvent: PointerEvent): void => pointerFrame.schedule(moveEvent.clientX, moveEvent.clientY);

      const onPointerUp = (upEvent: PointerEvent): void => {
        pointerFrame.flush();
        window.removeEventListener("pointermove", onPointerMove);
        window.removeEventListener("pointerup", onPointerUp);
        dragOperationRef.current = null;
        if (moved) {
          updateWaypoint(waypoint.id, nextPoint);
        } else {
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
        pointerFrame.cancel();
        renderPoint(waypoint);
        window.removeEventListener("pointermove", onPointerMove);
        window.removeEventListener("pointerup", onPointerUp);
      };
    },
    [activePathData.waypoints, fieldOneRef, fieldOneSize, settings, updateWaypoint],
  );

  const beginWaypointRotate = useCallback(
    (event: ReactPointerEvent<HTMLButtonElement>, waypoint: Waypoint): void => {
      event.preventDefault();
      event.stopPropagation();
      if (fieldOneSize.width <= 0 || fieldOneSize.height <= 0) return;
      const fieldRect = fieldOneRef.current?.getBoundingClientRect();
      if (!fieldRect) return;
      const markerElement = event.currentTarget.closest<HTMLElement>(".robot-marker");
      let nextAngle = waypoint.angle;
      setActiveRotationHandleId(`waypoint-${waypoint.id}`);

      const pointerFrame = createPointerFrameScheduler((clientX, clientY) => {
        const center = pointToPixels(settings, fieldOneSize, waypoint);
        const angle = pointerToCompassDegrees(
          clientX,
          clientY,
          fieldRect.left + center.x,
          fieldRect.top + center.y,
        );
        nextAngle = Number(angle.toFixed(2));
        if (markerElement) markerElement.style.transform = `rotate(${compassDegreesToCssRotation(nextAngle)}deg)`;
      });
      const onPointerMove = (moveEvent: PointerEvent): void => pointerFrame.schedule(moveEvent.clientX, moveEvent.clientY);

      const onPointerUp = (): void => {
        pointerFrame.flush();
        updateWaypoint(waypoint.id, { angle: nextAngle });
        setActiveRotationHandleId(null);
        window.removeEventListener("pointermove", onPointerMove);
        window.removeEventListener("pointerup", onPointerUp);
        dragOperationRef.current = null;
      };

      window.addEventListener("pointermove", onPointerMove);
      window.addEventListener("pointerup", onPointerUp);
      dragOperationRef.current = () => {
        pointerFrame.cancel();
        if (markerElement) markerElement.style.transform = `rotate(${compassDegreesToCssRotation(waypoint.angle)}deg)`;
        setActiveRotationHandleId(null);
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
      const markerElement = event.currentTarget.closest<HTMLElement>(".robot-marker");
      let nextAngle = target.angle;
      setActiveRotationHandleId(`target-${target.id}`);

      const pointerFrame = createPointerFrameScheduler((clientX, clientY) => {
        const center = pointToPixels(settings, fieldOneSize, point);
        const angle = pointerToCompassDegrees(
          clientX,
          clientY,
          fieldRect.left + center.x,
          fieldRect.top + center.y,
        );
        nextAngle = Number(angle.toFixed(2));
        if (markerElement) markerElement.style.transform = `rotate(${compassDegreesToCssRotation(nextAngle)}deg)`;
      });
      const onPointerMove = (moveEvent: PointerEvent): void => pointerFrame.schedule(moveEvent.clientX, moveEvent.clientY);

      const onPointerUp = (): void => {
        pointerFrame.flush();
        updateRotationTarget(target.id, { angle: nextAngle });
        setActiveRotationHandleId(null);
        window.removeEventListener("pointermove", onPointerMove);
        window.removeEventListener("pointerup", onPointerUp);
        dragOperationRef.current = null;
      };

      window.addEventListener("pointermove", onPointerMove);
      window.addEventListener("pointerup", onPointerUp);
      dragOperationRef.current = () => {
        pointerFrame.cancel();
        if (markerElement) markerElement.style.transform = `rotate(${compassDegreesToCssRotation(target.angle)}deg)`;
        setActiveRotationHandleId(null);
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
      const markerElement = event.currentTarget;
      let nextPosition = 0;

      const moveTo = (clientX: number, clientY: number): void => {
        const position = nearestPathPositionFromPixel(settings, fieldOneSize, activePathData.waypoints, {
          x: clientX - fieldRect.left,
          y: clientY - fieldRect.top,
        });
        nextPosition = Number(position.toFixed(2));
        const point = pointAtPathPosition(activePathData.waypoints, nextPosition);
        if (!point) return;
        const pixel = pointToPixels(settings, fieldOneSize, point);
        if (markerElement.classList.contains("robot-marker")) {
          const style = robotRenderStyle(settings, fieldOneSize, point.x, point.y, 0);
          markerElement.style.left = String(style.left);
          markerElement.style.top = String(style.top);
        } else {
          markerElement.style.left = `${pixel.x}px`;
          markerElement.style.top = `${pixel.y}px`;
        }
      };

      moveTo(event.clientX, event.clientY);

      const pointerFrame = createPointerFrameScheduler(moveTo);
      const onPointerMove = (moveEvent: PointerEvent): void => pointerFrame.schedule(moveEvent.clientX, moveEvent.clientY);
      const onPointerUp = (): void => {
        pointerFrame.flush();
        updatePosition(nextPosition);
        window.removeEventListener("pointermove", onPointerMove);
        window.removeEventListener("pointerup", onPointerUp);
        dragOperationRef.current = null;
      };

      window.addEventListener("pointermove", onPointerMove);
      window.addEventListener("pointerup", onPointerUp);
      dragOperationRef.current = () => {
        pointerFrame.cancel();
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
    const svgElement = treeSvgRef.current;
    const nodesElement = treeNodesLayerRef.current;
    if (!svgElement || !nodesElement) return;
    event.preventDefault();
    const start = { x: event.clientX - pan.x, y: event.clientY - pan.y };
    let nextPan = pan;
    svgElement.classList.add("is-panning");
    nodesElement.classList.add("is-panning");

    const pointerFrame = createPointerFrameScheduler((clientX, clientY) => {
      nextPan = { x: clientX - start.x, y: clientY - start.y };
      const transform = `translate3d(${nextPan.x}px, ${nextPan.y}px, 0)`;
      svgElement.style.transform = transform;
      nodesElement.style.transform = transform;
    });
    const onPointerMove = (moveEvent: PointerEvent): void => pointerFrame.schedule(moveEvent.clientX, moveEvent.clientY);

    const onPointerUp = (): void => {
      pointerFrame.flush();
      svgElement.classList.remove("is-panning");
      nodesElement.classList.remove("is-panning");
      setPan((current) => current.x === nextPan.x && current.y === nextPan.y ? current : nextPan);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      dragOperationRef.current = null;
    };

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    dragOperationRef.current = () => {
      pointerFrame.cancel();
      svgElement.classList.remove("is-panning");
      nodesElement.classList.remove("is-panning");
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
    };
  }, [pan]);

  const beginTreeModalDrag = useCallback((event: ReactPointerEvent<HTMLDivElement>): void => {
    if (settings.layoutMode !== "focus" || (event.target as HTMLElement).closest("button, input, .tree-add-wrapper")) return;
    const workspace = workspaceRef.current;
    const modalElement = focusTreeModalRef.current;
    if (!workspace || !modalElement) return;
    event.preventDefault();
    modalElement.classList.add("is-dragging");
    const bounds = workspace.getBoundingClientRect();
    const startPointer = { x: event.clientX, y: event.clientY };
    const startRect = treeModalRect;
    let nextX = startRect.x;
    let nextY = startRect.y;

    const pointerFrame = createPointerFrameScheduler((clientX, clientY) => {
      nextX = clamp(startRect.x + clientX - startPointer.x, 0, Math.max(0, bounds.width - startRect.width));
      nextY = clamp(startRect.y + clientY - startPointer.y, 0, Math.max(0, bounds.height - 42));
      modalElement.style.transform = `translate3d(${nextX - startRect.x}px, ${nextY - startRect.y}px, 0)`;
    });
    const onPointerMove = (moveEvent: PointerEvent): void => pointerFrame.schedule(moveEvent.clientX, moveEvent.clientY);
    const onPointerUp = (): void => {
      pointerFrame.flush();
      modalElement.style.left = `${nextX}px`;
      modalElement.style.top = `${nextY}px`;
      modalElement.style.transform = "";
      modalElement.classList.remove("is-dragging");
      setTreeModalRect((current) => ({ ...current, x: nextX, y: nextY }));
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      dragOperationRef.current = null;
    };
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    dragOperationRef.current = () => {
      pointerFrame.cancel();
      modalElement.style.transform = "";
      modalElement.classList.remove("is-dragging");
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
    };
  }, [settings.layoutMode, treeModalRect]);

  const beginTreeModalResize = useCallback((event: ReactPointerEvent<HTMLButtonElement>): void => {
    if (settings.layoutMode !== "focus" || treeModalMinimized) return;
    const workspace = workspaceRef.current;
    const modalElement = focusTreeModalRef.current;
    if (!workspace || !modalElement) return;
    event.preventDefault();
    event.stopPropagation();
    modalElement.classList.add("is-resizing");
    const bounds = workspace.getBoundingClientRect();
    const startPointer = { x: event.clientX, y: event.clientY };
    const startRect = treeModalRect;
    let nextWidth = startRect.width;
    let nextHeight = startRect.height;

    const pointerFrame = createPointerFrameScheduler((clientX, clientY) => {
      nextWidth = clamp(startRect.width + clientX - startPointer.x, 320, Math.max(320, bounds.width - startRect.x));
      nextHeight = clamp(startRect.height + clientY - startPointer.y, 230, Math.max(230, bounds.height - startRect.y));
      modalElement.style.width = `${nextWidth}px`;
      modalElement.style.height = `${nextHeight}px`;
    });
    const onPointerMove = (moveEvent: PointerEvent): void => pointerFrame.schedule(moveEvent.clientX, moveEvent.clientY);
    const onPointerUp = (): void => {
      pointerFrame.flush();
      modalElement.classList.remove("is-resizing");
      setTreeModalRect((current) => ({ ...current, width: nextWidth, height: nextHeight }));
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      dragOperationRef.current = null;
    };
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    dragOperationRef.current = () => {
      pointerFrame.cancel();
      modalElement.classList.remove("is-resizing");
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
    };
  }, [settings.layoutMode, treeModalMinimized, treeModalRect]);

  const toggleTreeModalMinimized = useCallback((): void => {
    setTreeModalMinimized((minimized) => {
      if (minimized) {
        const workspace = workspaceRef.current;
        if (workspace) {
          const bounds = workspace.getBoundingClientRect();
          setTreeModalRect((rect) => ({
            ...rect,
            x: clamp(rect.x, 0, Math.max(0, bounds.width - rect.width)),
            y: clamp(rect.y, 0, Math.max(0, bounds.height - rect.height)),
          }));
        }
      }
      return !minimized;
    });
  }, []);

  const resetTreePan = useCallback((event: ReactMouseEvent<HTMLDivElement>): void => {
    const target = event.target as HTMLElement;
    if (target.closest(".tree-node, .tree-menu, .tree-add-menu, .tree-edge-label")) return;
    event.stopPropagation();
    setPan({ x: 0, y: 0 });
    setSaveStatus({ kind: "saved", message: "Returned the path tree canvas to the origin." });
  }, []);

  const focusNearestPathNode = useCallback((): void => {
    if (pathTreeNodes.length === 0) {
      setSaveStatus({ kind: "error", message: "Add a path block before using path recovery." });
      return;
    }

    const viewportCenter = {
      x: treeViewportSize.width / 2 - pan.x,
      y: treeViewportSize.height / 2 - pan.y,
    };
    const nearest = pathTreeNodes.reduce((best, node) => {
      const bestDistance = Math.hypot(best.x + NODE_WIDTH / 2 - viewportCenter.x, best.y + NODE_HEIGHT / 2 - viewportCenter.y);
      const nodeDistance = Math.hypot(node.x + NODE_WIDTH / 2 - viewportCenter.x, node.y + NODE_HEIGHT / 2 - viewportCenter.y);
      return nodeDistance < bestDistance ? node : best;
    });

    setPan({
      x: treeViewportSize.width / 2 - nearest.x - NODE_WIDTH / 2,
      y: treeViewportSize.height / 2 - nearest.y - NODE_HEIGHT / 2,
    });
    setContextMenu(null);
    setSaveStatus({ kind: "saved", message: `Centered the nearest path block: ${nearest.name}.` });
  }, [pan.x, pan.y, pathTreeNodes, treeViewportSize.height, treeViewportSize.width]);

  const beginNodeDrag = useCallback((event: ReactPointerEvent<HTMLDivElement>, node: PathTreeNode): void => {
    event.stopPropagation();
    const nodeElement = event.currentTarget;
    const startMouse = { x: event.clientX, y: event.clientY };
    const startNode = { x: node.x, y: node.y };
    const nodesById = new Map(treeNodes.map((candidate) => [candidate.id, candidate]));
    const connectedEdges = treeNodes.flatMap((parent) => getNodeChildren(parent).map((child) => ({
      parent,
      child: nodesById.get(child.id),
      slot: child.slot,
    }))).filter((edge): edge is { parent: PathTreeNode; child: PathTreeNode; slot: ChildSlot } => (
      Boolean(edge.child) && (edge.parent.id === node.id || edge.child?.id === node.id)
    ));
    const edgeElements = new Map<string, SVGGElement>();
    treeSvgRef.current?.querySelectorAll<SVGGElement>("[data-tree-edge-key]").forEach((element) => {
      const key = element.dataset.treeEdgeKey;
      if (key) edgeElements.set(key, element);
    });
    let nextX = startNode.x;
    let nextY = startNode.y;
    let moved = false;

    nodeElement.classList.add("is-dragging");
    const renderDrag = (clientX: number, clientY: number): void => {
      const dx = clientX - startMouse.x;
      const dy = clientY - startMouse.y;
      if (Math.abs(dx) > 2 || Math.abs(dy) > 2) moved = true;
      nextX = startNode.x + dx;
      nextY = startNode.y + dy;
      nodeElement.style.transform = `translate3d(${dx}px, ${dy}px, 0)`;

      connectedEdges.forEach(({ parent, child, slot }) => {
        const movedParent = parent.id === node.id ? { ...parent, x: nextX, y: nextY } : parent;
        const movedChild = child.id === node.id ? { ...child, x: nextX, y: nextY } : child;
        const geometry = nearestTreeEdgeGeometry(movedParent, movedChild);
        const edgeElement = edgeElements.get(`${parent.id}::${child.id}::${slot}`);
        const pathElement = edgeElement?.querySelector("path");
        const labelElement = edgeElement?.querySelector("text");
        pathElement?.setAttribute("d", `M ${geometry.start.x} ${geometry.start.y} C ${geometry.startControl.x} ${geometry.startControl.y}, ${geometry.endControl.x} ${geometry.endControl.y}, ${geometry.end.x} ${geometry.end.y}`);
        labelElement?.setAttribute("x", String(geometry.label.x));
        labelElement?.setAttribute("y", String(geometry.label.y - 7));
      });
    };
    const pointerFrame = createPointerFrameScheduler(renderDrag);
    const onPointerMove = (moveEvent: PointerEvent): void => pointerFrame.schedule(moveEvent.clientX, moveEvent.clientY);

    const onPointerUp = (): void => {
      pointerFrame.flush();
      if (!moved) renderDrag(startMouse.x, startMouse.y);
      nodeElement.classList.remove("is-dragging");
      nodeElement.style.left = `${nextX}px`;
      nodeElement.style.top = `${nextY}px`;
      nodeElement.style.transform = "";
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      dragOperationRef.current = null;
      if (moved) {
        setTreeNodes((previous) => previous.map((candidate) => (
          candidate.id === node.id ? { ...candidate, x: nextX, y: nextY } : candidate
        )));
        return;
      }
      if (!moved && pendingConnection) {
        connectPendingToNode(node.id);
        return;
      }
      if (!moved) {
        setSelectedTreeNodeId(node.id);
        if (node.kind === "path") activatePathNode(node.id);
      }
    };

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    dragOperationRef.current = () => {
      pointerFrame.cancel();
      nodeElement.classList.remove("is-dragging");
      nodeElement.style.transform = "";
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
    };
  }, [activatePathNode, connectPendingToNode, pendingConnection, treeNodes]);

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
    setSelectedTreeNodeId(nodeId);
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
    const modalElement = elementModalRef.current;
    if (!appRect || !modalElement) return;
    event.preventDefault();
    modalElement.classList.add("is-dragging");
    draggingModalRef.current = { offsetX: event.clientX - appRect.left - modal.x, offsetY: event.clientY - appRect.top - modal.y };
    let nextX = modal.x;
    let nextY = modal.y;

    const pointerFrame = createPointerFrameScheduler((clientX, clientY) => {
      const offset = draggingModalRef.current;
      if (!offset) return;
      nextX = clamp(clientX - appRect.left - offset.offsetX, 4, Math.max(4, appRect.width - modalElement.offsetWidth - 4));
      nextY = clamp(clientY - appRect.top - offset.offsetY, 44, Math.max(44, appRect.height - modalElement.offsetHeight - 4));
      modalElement.style.transform = `translate3d(${nextX - modal.x}px, ${nextY - modal.y}px, 0)`;
    });
    const onPointerMove = (moveEvent: PointerEvent): void => pointerFrame.schedule(moveEvent.clientX, moveEvent.clientY);

    const onPointerUp = (): void => {
      pointerFrame.flush();
      modalElement.style.left = `${nextX}px`;
      modalElement.style.top = `${nextY}px`;
      modalElement.style.transform = "";
      modalElement.classList.remove("is-dragging");
      setModal((current) => (current ? { ...current, x: nextX, y: nextY } : current));
      draggingModalRef.current = null;
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      dragOperationRef.current = null;
    };

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    dragOperationRef.current = () => {
      pointerFrame.cancel();
      modalElement.style.transform = "";
      modalElement.classList.remove("is-dragging");
      draggingModalRef.current = null;
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
    };
  }, [modal]);

  const togglePlaybackModal = useCallback((): void => {
    if (playbackOpen) {
      setPlaybackPlaying(false);
      setPlaybackTime(playbackTimeRef.current);
    }
    setPlaybackOpen((open) => !open);
  }, [playbackOpen]);

  const beginPlaybackModalDrag = useCallback((event: ReactPointerEvent<HTMLDivElement>): void => {
    if ((event.target as HTMLElement).closest("button, input")) return;
    const appRect = appRef.current?.getBoundingClientRect();
    const modalElement = playbackModalRef.current;
    if (!appRect || !modalElement) return;
    event.preventDefault();
    event.stopPropagation();
    modalElement.classList.add("is-dragging");
    const offset = {
      x: event.clientX - appRect.left - playbackModalPosition.x,
      y: event.clientY - appRect.top - playbackModalPosition.y,
    };
    let nextX = playbackModalPosition.x;
    let nextY = playbackModalPosition.y;

    const pointerFrame = createPointerFrameScheduler((clientX, clientY) => {
      nextX = clamp(clientX - appRect.left - offset.x, 4, Math.max(4, appRect.width - 564));
      nextY = clamp(clientY - appRect.top - offset.y, 44, Math.max(44, appRect.height - 190));
      modalElement.style.transform = `translate3d(${nextX - playbackModalPosition.x}px, ${nextY - playbackModalPosition.y}px, 0)`;
    });
    const onPointerMove = (moveEvent: PointerEvent): void => pointerFrame.schedule(moveEvent.clientX, moveEvent.clientY);
    const onPointerUp = (): void => {
      pointerFrame.flush();
      modalElement.style.left = `${nextX}px`;
      modalElement.style.top = `${nextY}px`;
      modalElement.style.transform = "";
      modalElement.classList.remove("is-dragging");
      setPlaybackModalPosition({ x: nextX, y: nextY });
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      dragOperationRef.current = null;
    };

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    dragOperationRef.current = () => {
      pointerFrame.cancel();
      modalElement.style.transform = "";
      modalElement.classList.remove("is-dragging");
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
    };
  }, [playbackModalPosition.x, playbackModalPosition.y]);

  const readImageFile = useCallback((event: ChangeEvent<HTMLInputElement>): void => {
    const file = event.currentTarget.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onerror = () => setError("Could not read the selected field image.");
    reader.onload = () => {
      const result = reader.result;
      if (typeof result === "string") setFieldCropSource(result);
    };
    reader.readAsDataURL(file);
    event.currentTarget.value = "";
  }, [setError]);

  const selectRobotCodeProject = useCallback(async (): Promise<void> => {
    if (!window.electronAPI) {
      setError("Electron preload API is unavailable. Check that preload.js exposes window.electronAPI.");
      return;
    }

    try {
      const folder = await window.electronAPI.pickDirectory();
      if (!folder) return;
      updateSettings({ robotCodeProjectFolder: folder });
      const metadataText = await window.electronAPI.readTextFile(getVoyagerAssetsFolder(folder), PROJECT_METADATA_FILE);
      if (metadataText) {
        const metadata = normalizePersistedState(JSON.parse(metadataText) as PersistedAppState);
        if (metadata) {
          setVersionHistory((current) => {
            const merged = [...current, ...(metadata.versionHistory ?? [])]
              .filter((snapshot, index, all) => all.findIndex((candidate) => candidate.id === snapshot.id) === index)
              .sort((left, right) => left.timestamp - right.timestamp)
              .slice(-VERSION_HISTORY_LIMIT);
            versionHistoryRef.current = merged;
            return merged;
          });
          setSaveStatus({ kind: "saved", message: `Selected robot project and found ${(metadata.versionHistory ?? []).length} project snapshot${(metadata.versionHistory ?? []).length === 1 ? "" : "s"}.` });
          return;
        }
      }
      setSaveStatus({ kind: "saved", message: "Selected robot project. Project metadata will be created on the next save." });
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

  const writeProjectMetadata = useCallback(async (overrides: Partial<PersistedAppState> = {}): Promise<void> => {
    if (!settings.robotCodeProjectFolder) throw new Error("Select a robot code project before saving metadata.");
    if (!window.electronAPI) throw new Error("Electron preload API is unavailable.");
    const folder = getVoyagerAssetsFolder(settings.robotCodeProjectFolder);
    if (window.electronAPI.makeDirectory) await window.electronAPI.makeDirectory(folder);
    const metadata: ProjectMetadataFile = {
      schemaVersion: 1,
      voyagerVersion: VOYAGER_VERSION,
      savedAt: Date.now(),
      settings,
      treeNodes,
      pathDataByName,
      knownPathFileNames,
      activePathNodeId,
      pan,
      versionHistory: versionHistoryRef.current,
      obstacles,
      activityLog,
      selectedTreeNodeId,
      treeModalRect,
      treeModalMinimized,
      playbackModalPosition,
      ...overrides,
    };
    await window.electronAPI.writeTextFile(folder, PROJECT_METADATA_FILE, `${JSON.stringify(metadata, null, 2)}\n`);
  }, [activePathNodeId, activityLog, knownPathFileNames, obstacles, pan, pathDataByName, playbackModalPosition, selectedTreeNodeId, settings, treeModalMinimized, treeModalRect, treeNodes]);

  const importProjectMetadata = useCallback(async (): Promise<void> => {
    if (!settings.robotCodeProjectFolder || !window.electronAPI) {
      setError("Select a robot code project before loading project metadata.");
      return;
    }
    try {
      const text = await window.electronAPI.readTextFile(getVoyagerAssetsFolder(settings.robotCodeProjectFolder), PROJECT_METADATA_FILE);
      if (!text) throw new Error("No voyager/assets/metadata.json file exists in this project yet.");
      const projectState = normalizePersistedState(JSON.parse(text) as PersistedAppState);
      if (!projectState) throw new Error("The project metadata file is not valid Voyager metadata.");
      const selectedFolder = settings.robotCodeProjectFolder;
      setSettings({ ...projectState.settings, robotCodeProjectFolder: selectedFolder });
      setTreeNodes(projectState.treeNodes);
      setPathDataByName(projectState.pathDataByName);
      setKnownPathFileNames(projectState.knownPathFileNames ?? []);
      setActivePathNodeId(projectState.activePathNodeId);
      setPan(projectState.pan);
      setObstacles(projectState.obstacles ?? []);
      setActivityLog((projectState.activityLog ?? []).slice(-ACTIVITY_LOG_LIMIT));
      setSelectedTreeNodeId(projectState.selectedTreeNodeId ?? null);
      if (projectState.treeModalRect) setTreeModalRect(projectState.treeModalRect);
      setTreeModalMinimized(Boolean(projectState.treeModalMinimized));
      if (projectState.playbackModalPosition) setPlaybackModalPosition(projectState.playbackModalPosition);
      setVersionHistory(projectState.versionHistory ?? []);
      versionHistoryRef.current = projectState.versionHistory ?? [];
      setVersionHistoryOpen(false);
      setSaveStatus({ kind: "saved", message: "Loaded the complete Voyager workspace from project metadata." });
    } catch (error) {
      setError(error instanceof Error ? error.message : "Could not load project metadata.");
    }
  }, [setError, settings.robotCodeProjectFolder]);

  const deleteTextFile = useCallback(async (fileName: string): Promise<void> => {
    if (!settings.robotCodeProjectFolder) throw new Error("Select a robot code project before deleting old path files.");
    if (!window.electronAPI) throw new Error("Electron preload API is unavailable.");
    if (!window.electronAPI.deleteTextFile) throw new Error("Electron preload API is missing deleteTextFile. Add the fs:delete-text-file bridge before deleting stale path files.");
    const folder = getVoyagerDeployFolder(settings.robotCodeProjectFolder);
    await window.electronAPI.deleteTextFile(folder, fileName);
  }, [settings.robotCodeProjectFolder]);

  const handleRoutinePublished = useCallback((routineCode: string): void => {
    setSaveStatus({ kind: "saved", message: `Published routine ${routineCode} to /Voyager/SelectedAuto.` });
  }, [setSaveStatus]);

  const savePathByName = useCallback(async (pathName: string): Promise<void> => {
    const data = pathDataByName[pathName] ?? createEmptyPathData();
    await writeTextFile(`${sanitizeFileName(pathName)}.json`, `${JSON.stringify(serializePathData(data, settings), null, 2)}\n`);
    setKnownPathFileNames((current) => current.includes(pathName) ? current : [...current, pathName]);
  }, [pathDataByName, settings, writeTextFile]);

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
      const nextHistory = recordVersionSnapshot("manual");
      const nextKnownPaths = knownPathFileNames.includes(activePathName) ? knownPathFileNames : [...knownPathFileNames, activePathName];
      await writeProjectMetadata({ versionHistory: nextHistory, knownPathFileNames: nextKnownPaths });
      setSaveStatus({ kind: "saved", message: `Saved ${activePathName}.` });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not save the current path.";
      setSaveStatus({ kind: "error", message });
    }
  }, [activePathName, knownPathFileNames, recordVersionSnapshot, savePathByName, setError, writeProjectMetadata]);

  const saveAll = useCallback(async (snapshotSource: VersionHistorySnapshot["source"] = "manual"): Promise<void> => {
    try {
      setSaveStatus({ kind: "saving", message: "Saving all Voyager files..." });
      const pathNamesFromNodes = Array.from(new Set(treeNodes.filter((node): node is PathTreePathNode => node.kind === "path").map((node) => node.name)));
      const pathNameSet = new Set(pathNamesFromNodes);
      const stalePathNames = Array.from(new Set([...Object.keys(pathDataByName), ...knownPathFileNames])).filter((pathName) => !pathNameSet.has(pathName));

      for (const pathName of stalePathNames) await deletePathFileByName(pathName);
      for (const pathName of pathNamesFromNodes) await savePathByName(pathName);
      await writeTextFile("auto_config.json", `${JSON.stringify(serializeAutoConfig(treeNodes), null, 2)}\n`);

      const savedPathDataByName = Object.fromEntries(Object.entries(pathDataByName).filter(([pathName]) => pathNameSet.has(pathName)));
      setPathDataByName((current) => {
        const currentNames = Object.keys(current);
        const nextNames = Object.keys(savedPathDataByName);
        return currentNames.length === nextNames.length && nextNames.every((name) => current[name] === savedPathDataByName[name])
          ? current
          : savedPathDataByName;
      });
      setKnownPathFileNames((current) => current.length === pathNamesFromNodes.length && current.every((name, index) => name === pathNamesFromNodes[index])
        ? current
        : pathNamesFromNodes);
      const nextHistory = recordVersionSnapshot(snapshotSource, { treeNodes, pathDataByName: savedPathDataByName, activePathNodeId });
      await writeProjectMetadata({
        pathDataByName: savedPathDataByName,
        knownPathFileNames: pathNamesFromNodes,
        versionHistory: nextHistory,
      });
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
  }, [activePathNodeId, deletePathFileByName, knownPathFileNames, pathDataByName, recordVersionSnapshot, savePathByName, treeNodes, writeProjectMetadata, writeTextFile]);

  const saveMetadataNow = useCallback(async (): Promise<void> => {
    try {
      setSaveStatus({ kind: "saving", message: "Saving Voyager project metadata..." });
      const nextHistory = recordVersionSnapshot("manual");
      await writeProjectMetadata({ versionHistory: nextHistory });
      setSaveStatus({ kind: "saved", message: "Saved Voyager project metadata." });
    } catch (error) {
      setSaveStatus({
        kind: "error",
        message: error instanceof Error ? error.message : "Could not save Voyager project metadata.",
      });
    }
  }, [recordVersionSnapshot, writeProjectMetadata]);

  useEffect(() => {
    if (autoSaveTimerRef.current) window.clearTimeout(autoSaveTimerRef.current);
    autoSaveTimerRef.current = null;
    if (!hydrated || !settings.autoSave) return;
    autoSaveTimerRef.current = window.setTimeout(() => {
      autoSaveTimerRef.current = null;
      if (settings.robotCodeProjectFolder) void saveAll("auto");
      else recordVersionSnapshot("auto");
    }, 900);
    return () => {
      if (autoSaveTimerRef.current) window.clearTimeout(autoSaveTimerRef.current);
      autoSaveTimerRef.current = null;
    };
  }, [hydrated, obstacles, pathDataByName, recordVersionSnapshot, saveAll, settings.autoSave, settings.robotCodeProjectFolder, treeNodes]);

  useEffect(() => {
    if (metadataAutoSaveTimerRef.current) window.clearTimeout(metadataAutoSaveTimerRef.current);
    metadataAutoSaveTimerRef.current = null;
    if (!hydrated || !settings.autoSaveMetadata || settings.autoSave || !settings.robotCodeProjectFolder) return;
    metadataAutoSaveTimerRef.current = window.setTimeout(() => {
      metadataAutoSaveTimerRef.current = null;
      void writeProjectMetadata().catch((error: unknown) => {
        console.error("Could not automatically save Voyager metadata.", error);
      });
    }, 1_000);
    return () => {
      if (metadataAutoSaveTimerRef.current) window.clearTimeout(metadataAutoSaveTimerRef.current);
      metadataAutoSaveTimerRef.current = null;
    };
  }, [hydrated, settings.autoSave, settings.autoSaveMetadata, settings.robotCodeProjectFolder, writeProjectMetadata]);

  useEffect(() => {
    return () => {
      if (persistTimerRef.current) window.clearTimeout(persistTimerRef.current);
      if (autoSaveTimerRef.current) window.clearTimeout(autoSaveTimerRef.current);
      if (metadataAutoSaveTimerRef.current) window.clearTimeout(metadataAutoSaveTimerRef.current);
      if (historyCommitTimerRef.current) window.clearTimeout(historyCommitTimerRef.current);
      if (dragOperationRef.current) dragOperationRef.current();
    };
  }, []);

  const selectedObstacle = useMemo(
    () => obstacles.find((obstacle) => obstacle.id === selectedObstacleId) ?? null,
    [obstacles, selectedObstacleId],
  );

  const addObstacle = useCallback((): void => {
    const obstacle: FieldObstacle = {
      id: createId("obstacle"),
      name: `Obstacle ${obstacles.length + 1}`,
      x: settings.fieldLengthMeters / 2,
      y: settings.fieldWidthMeters / 2,
      length: Math.min(1.2, settings.fieldLengthMeters),
      width: Math.min(1.2, settings.fieldWidthMeters),
    };
    setObstacles((current) => [...current, obstacle]);
    setSelectedObstacleId(obstacle.id);
    setSaveStatus({ kind: "saved", message: `Added ${obstacle.name} to the field map.` });
  }, [obstacles.length, settings.fieldLengthMeters, settings.fieldWidthMeters]);

  const updateObstacle = useCallback((id: string, patch: Partial<FieldObstacle>): void => {
    setObstacles((current) => current.map((obstacle, index) => {
      if (obstacle.id !== id) return obstacle;
      const normalized = normalizeObstacle({ ...obstacle, ...patch, id: obstacle.id }, index, settings);
      return patch.name === undefined ? normalized : { ...normalized, name: patch.name };
    }));
  }, [settings]);

  const deleteObstacle = useCallback((id: string): void => {
    const name = obstacles.find((obstacle) => obstacle.id === id)?.name ?? "obstacle";
    setObstacles((current) => current.filter((obstacle) => obstacle.id !== id));
    setSelectedObstacleId((current) => current === id ? null : current);
    setSaveStatus({ kind: "saved", message: `Removed ${name} from the field map.` });
  }, [obstacles]);

  const beginObstacleMove = useCallback((event: ReactPointerEvent<HTMLDivElement>, obstacle: FieldObstacle): void => {
    if ((event.target as HTMLElement).closest("button")) return;
    const field = obstacleFieldRef.current;
    if (!field || obstacleFieldSize.width <= 0 || obstacleFieldSize.height <= 0) return;
    event.preventDefault();
    event.stopPropagation();
    setSelectedObstacleId(obstacle.id);
    const bounds = field.getBoundingClientRect();
    const initialCenter = pointToPixels(settings, obstacleFieldSize, obstacle);
    const pointerOffset = {
      x: event.clientX - bounds.left - initialCenter.x,
      y: event.clientY - bounds.top - initialCenter.y,
    };
    const move = (clientX: number, clientY: number): void => {
      const point = pixelsToPoint(settings, obstacleFieldSize, {
        x: clamp(clientX - bounds.left - pointerOffset.x, 0, bounds.width),
        y: clamp(clientY - bounds.top - pointerOffset.y, 0, bounds.height),
      });
      updateObstacle(obstacle.id, {
        x: clamp(point.x, obstacle.length / 2, settings.fieldLengthMeters - obstacle.length / 2),
        y: clamp(point.y, obstacle.width / 2, settings.fieldWidthMeters - obstacle.width / 2),
      });
    };
    move(event.clientX, event.clientY);
    const pointerFrame = createPointerFrameScheduler(move);
    const onPointerMove = (moveEvent: PointerEvent): void => pointerFrame.schedule(moveEvent.clientX, moveEvent.clientY);
    const onPointerUp = (): void => {
      pointerFrame.flush();
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      dragOperationRef.current = null;
    };
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    dragOperationRef.current = () => {
      pointerFrame.cancel();
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
    };
  }, [obstacleFieldRef, obstacleFieldSize, settings, updateObstacle]);

  const beginObstacleResize = useCallback((event: ReactPointerEvent<HTMLButtonElement>, obstacle: FieldObstacle, edge: ObstacleResizeEdge): void => {
    const field = obstacleFieldRef.current;
    if (!field || obstacleFieldSize.width <= 0 || obstacleFieldSize.height <= 0) return;
    event.preventDefault();
    event.stopPropagation();
    setSelectedObstacleId(obstacle.id);
    const bounds = field.getBoundingClientRect();
    const initial = obstacleStyle(settings, obstacleFieldSize, obstacle);
    let left = Number(initial.left);
    let top = Number(initial.top);
    let right = left + Number(initial.width);
    let bottom = top + Number(initial.height);
    const minimumWidth = Math.max(3, (0.05 / settings.fieldLengthMeters) * obstacleFieldSize.width);
    const minimumHeight = Math.max(3, (0.05 / settings.fieldWidthMeters) * obstacleFieldSize.height);
    const resize = (clientX: number, clientY: number): void => {
      const x = clamp(clientX - bounds.left, 0, obstacleFieldSize.width);
      const y = clamp(clientY - bounds.top, 0, obstacleFieldSize.height);
      if (edge === "left") left = clamp(x, 0, right - minimumWidth);
      if (edge === "right") right = clamp(x, left + minimumWidth, obstacleFieldSize.width);
      if (edge === "top") top = clamp(y, 0, bottom - minimumHeight);
      if (edge === "bottom") bottom = clamp(y, top + minimumHeight, obstacleFieldSize.height);
      const center = pixelsToPoint(settings, obstacleFieldSize, {
        x: (left + right) / 2,
        y: (top + bottom) / 2,
      });
      updateObstacle(obstacle.id, {
        x: center.x,
        y: center.y,
        length: clamp(((right - left) / obstacleFieldSize.width) * settings.fieldLengthMeters, 0.05, settings.fieldLengthMeters),
        width: clamp(((bottom - top) / obstacleFieldSize.height) * settings.fieldWidthMeters, 0.05, settings.fieldWidthMeters),
      });
    };
    resize(event.clientX, event.clientY);
    const pointerFrame = createPointerFrameScheduler(resize);
    const onPointerMove = (moveEvent: PointerEvent): void => pointerFrame.schedule(moveEvent.clientX, moveEvent.clientY);
    const onPointerUp = (): void => {
      pointerFrame.flush();
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      dragOperationRef.current = null;
    };
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    dragOperationRef.current = () => {
      pointerFrame.cancel();
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
    };
  }, [obstacleFieldRef, obstacleFieldSize, settings, updateObstacle]);

  const togglePathPlanner = useCallback((): void => {
    if (!activePathName) {
      setError("Select a path block before using the obstacle-aware planner.");
      return;
    }
    setPathPlannerActive((active) => {
      const next = !active;
      setPathPlannerPoints([]);
      setPathPlannerStartWaypointId(null);
      setSaveStatus({ kind: "idle", message: next ? "Path planner ready: click an existing waypoint or an empty start point, then choose the destination." : "Path planner cancelled." });
      return next;
    });
  }, [activePathName, setError]);

  const finishPlannedPath = useCallback((destination: MeterPoint): void => {
    const start = pathPlannerPoints[0];
    if (!start) return;
    if (!plannerPointIsClear(destination, obstacles, settings)) {
      setError("That destination collides with an inflated obstacle. Choose a clear location.");
      return;
    }
    const planned = planCollisionFreePath(start, destination, obstacles, settings);
    if (!planned) {
      setError("No collision-free path was found. Move an endpoint or adjust the obstacle map.");
      return;
    }
    const generatedWaypoints: Waypoint[] = planned.map((plannedPoint, index) => {
      const next = planned[Math.min(index + 1, planned.length - 1)];
      const previous = planned[Math.max(0, index - 1)];
      const direction = index < planned.length - 1
        ? { x: next.x - plannedPoint.x, y: next.y - plannedPoint.y }
        : { x: plannedPoint.x - previous.x, y: plannedPoint.y - previous.y };
      return {
        id: createId("waypoint"),
        x: Number(plannedPoint.x.toFixed(3)),
        y: Number(plannedPoint.y.toFixed(3)),
        angle: normalizeCompassDegrees((Math.atan2(direction.y, direction.x) * 180) / Math.PI),
        handoff: settings.defaultIntermediateHandOffRadiusMeters,
        profiled: true,
      };
    });

    updateActivePathData((current) => {
      const startIndex = pathPlannerStartWaypointId
        ? current.waypoints.findIndex((waypoint) => waypoint.id === pathPlannerStartWaypointId)
        : -1;
      const preserved = startIndex >= 0 ? current.waypoints.slice(0, startIndex + 1) : [];
      if (preserved.length > 0 && generatedWaypoints[0]) {
        preserved[preserved.length - 1] = {
          ...preserved[preserved.length - 1],
          angle: generatedWaypoints[0].angle,
        };
      }
      const waypoints = preserved.length > 0
        ? [...preserved, ...generatedWaypoints.slice(1)]
        : generatedWaypoints;
      const maxPosition = Math.max(0, waypoints.length - 1);
      return {
        ...current,
        waypoints,
        rotationTargets: current.rotationTargets.map((item) => ({ ...item, position: clamp(item.position, 0, maxPosition) })),
        events: current.events.map((item) => ({ ...item, position: clamp(item.position, 0, maxPosition) })),
        eventZones: current.eventZones.map((item) => ({ ...item, startPosition: clamp(item.startPosition, 0, maxPosition), endPosition: clamp(item.endPosition, 0, maxPosition) })),
        constraintZones: current.constraintZones.map((item) => ({ ...item, startPosition: clamp(item.startPosition, 0, maxPosition), endPosition: clamp(item.endPosition, 0, maxPosition) })),
      };
    });
    setPathPlannerPoints([]);
    setPathPlannerStartWaypointId(null);
    setPathPlannerActive(false);
    const appendedWaypointCount = Math.max(0, generatedWaypoints.length - 1);
    setSaveStatus({
      kind: "saved",
      message: pathPlannerStartWaypointId
        ? `Extended the path from the selected waypoint with ${appendedWaypointCount} optimized waypoint${appendedWaypointCount === 1 ? "" : "s"}.`
        : `Generated a smooth collision-aware path with ${generatedWaypoints.length} optimized waypoints.`,
    });
  }, [obstacles, pathPlannerPoints, pathPlannerStartWaypointId, setError, settings, updateActivePathData]);

  const selectPlannerPoint = useCallback((event: ReactMouseEvent<HTMLDivElement>): void => {
    if (!pathPlannerActive) return;
    const target = event.target as HTMLElement;
    if (target.closest(".robot-marker, .event-trigger-marker, .event-zone-handle, .constraint-handle")) return;
    const field = fieldOneRef.current;
    if (!field || fieldOneSize.width <= 0 || fieldOneSize.height <= 0) return;
    event.preventDefault();
    event.stopPropagation();
    const bounds = field.getBoundingClientRect();
    const rawPoint = pixelsToPoint(settings, fieldOneSize, { x: event.clientX - bounds.left, y: event.clientY - bounds.top });
    const point = {
      x: clamp(rawPoint.x, settings.robotLengthMeters / 2, settings.fieldLengthMeters - settings.robotLengthMeters / 2),
      y: clamp(rawPoint.y, settings.robotWidthMeters / 2, settings.fieldWidthMeters - settings.robotWidthMeters / 2),
    };
    if (pathPlannerPoints.length === 0) {
      if (!plannerPointIsClear(point, obstacles, settings)) {
        setError("That start point collides with an inflated obstacle. Choose a clear location.");
        return;
      }
      setPathPlannerStartWaypointId(null);
      setPathPlannerPoints([point]);
      setSaveStatus({ kind: "idle", message: "Start point selected. Click the destination point." });
      return;
    }
    finishPlannedPath(point);
  }, [fieldOneRef, fieldOneSize, finishPlannedPath, obstacles, pathPlannerActive, pathPlannerPoints, setError, settings]);

  const selectPlannerWaypoint = useCallback((event: ReactPointerEvent<HTMLDivElement>, waypoint: Waypoint): void => {
    if (!pathPlannerActive) return;
    event.preventDefault();
    event.stopPropagation();
    const point = { x: waypoint.x, y: waypoint.y };
    if (pathPlannerPoints.length > 0) {
      finishPlannedPath(point);
      return;
    }
    if (!plannerPointIsClear(point, obstacles, settings)) {
      setError("That waypoint overlaps an inflated obstacle. Choose a different start waypoint.");
      return;
    }
    setPathPlannerStartWaypointId(waypoint.id);
    setPathPlannerPoints([point]);
    setSaveStatus({ kind: "idle", message: "Waypoint selected as the pathfinding start. Click the destination point." });
  }, [finishPlannedPath, obstacles, pathPlannerActive, pathPlannerPoints.length, setError, settings]);

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

  const treeEdgeElements = useMemo(() => treeEdges.map(({ parent, child, label, slot }) => {
    const geometry = nearestTreeEdgeGeometry(parent, child);
    const d = `M ${geometry.start.x} ${geometry.start.y} C ${geometry.startControl.x} ${geometry.startControl.y}, ${geometry.endControl.x} ${geometry.endControl.y}, ${geometry.end.x} ${geometry.end.y}`;
    return (
      <g key={`${parent.id}-${child.id}-${slot}`} data-tree-edge-key={`${parent.id}::${child.id}::${slot}`}>
        <path className={`tree-edge tree-edge-${slot}`} d={d} style={{ pointerEvents: "none" }} />
        <text
          className="tree-edge-label"
          x={geometry.label.x}
          y={geometry.label.y - 7}
          style={{ cursor: "context-menu", pointerEvents: "auto" }}
          onPointerDown={(event) => event.stopPropagation()}
          onContextMenu={(event) => showEdgeMenu(event, parent.id, child.id, slot, label)}
        >
          {label}
        </text>
      </g>
    );
  }), [showEdgeMenu, treeEdges]);

  const treeNodeElements = useMemo(() => treeNodes.map((node) => (
    <div
      key={node.id}
      data-tree-node-id={node.id}
      className={`tree-node tree-node-${node.kind} ${node.editing ? "is-editing" : ""} ${node.selectedForRoutine ? "is-routine" : ""} ${selectedTreeNodeId === node.id ? "is-selected" : ""}`}
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
      role={renamingNodeId === node.id ? undefined : "button"}
      tabIndex={renamingNodeId === node.id ? -1 : 0}
      aria-label={renamingNodeId === node.id ? undefined : `${node.name}, ${treeKindDescription(node.kind)}`}
      onKeyDown={(event) => {
        if (event.target !== event.currentTarget) return;
        if (event.key === "F2") {
          event.preventDefault();
          startRename(node);
          return;
        }
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        setSelectedTreeNodeId(node.id);
        if (node.kind === "path") activatePathNode(node.id);
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
  )), [activatePathNode, beginNodeDrag, commitRename, renameDraft, renamingNodeId, selectedTreeNodeId, showNodeMenu, startRename, treeNodes]);

  const activeWaypointModal = modal?.kind === "waypoint" ? activePathData.waypoints.find((waypoint) => waypoint.id === modal.id) ?? null : null;
  const activeRotationTargetModal = modal?.kind === "rotationTarget" ? activePathData.rotationTargets.find((target) => target.id === modal.id) ?? null : null;
  const activeEventTriggerModal = modal?.kind === "eventTrigger" ? activePathData.events.find((event) => event.id === modal.id) ?? null : null;
  const activeEventZoneModal = modal?.kind === "eventZone" ? activePathData.eventZones.find((zone) => zone.id === modal.id) ?? null : null;
  const activeConstraintZoneModal = modal?.kind === "constraintZone" ? activePathData.constraintZones.find((zone) => zone.id === modal.id) ?? null : null;
  const versionHistoryRows = useMemo(() => {
    return versionHistory.map((snapshot) => {
      const paths = Object.keys(snapshot.pathDataByName).length;
      const waypoints = Object.values(snapshot.pathDataByName).reduce((total, path) => total + path.waypoints.length, 0);
      return { snapshot, paths, nodes: snapshot.treeNodes.length, waypoints };
    }).reverse();
  }, [versionHistory]);

  return (
    <div ref={appRef} className={`voyager-app layout-${settings.layoutMode} design-${settings.designPreset}`} style={appThemeStyle} onClick={closeMenus}>
      <TelemetrySettingsBridge settings={settings} />
      <AutoPublishOnConnect
        enabled={settings.autoPublishOnConnect}
        hydrated={hydrated}
        selectedRoutineCode={selectedRoutineCode}
        onError={setError}
        onPublished={handleRoutinePublished}
      />
      <header className="voyager-nav">
        <div className="nav-brand">
          <div className="app-icon" aria-hidden="true">V</div>
          <div className="brand-copy">
            <strong className="app-name">Voyager</strong>
            <span className="version-chip">{VOYAGER_VERSION}</span>
          </div>
        </div>
        <nav className="workspace-tabs" aria-label="Voyager workspace">
          <button type="button" className={activeWorkspaceTab === "auto" ? "is-active" : ""} aria-current={activeWorkspaceTab === "auto" ? "page" : undefined} onClick={() => setActiveWorkspaceTab("auto")}>Auto builder</button>
          <button type="button" className={activeWorkspaceTab === "live" ? "is-active" : ""} aria-current={activeWorkspaceTab === "live" ? "page" : undefined} onClick={() => setActiveWorkspaceTab("live")}>Live robot</button>
        </nav>
        <div className="nav-actions">
          {activeWorkspaceTab === "auto" ? <div className="layout-switcher" aria-label="Workspace layout" onClick={(event) => event.stopPropagation()}>
            {([
              { mode: "default", title: "Fields left, path tree right" },
              { mode: "horizontal", title: "Fields top, path tree bottom" },
              { mode: "mirrored", title: "Path tree left, fields right" },
              { mode: "focus", title: "Auto focus with floating live field and path tree" },
            ] as Array<{ mode: LayoutMode; title: string }>).map(({ mode, title }) => (
              <button
                key={mode}
                type="button"
                className={`layout-button ${settings.layoutMode === mode ? "is-active" : ""}`}
                aria-label={title}
                aria-pressed={settings.layoutMode === mode}
                title={title}
                onClick={() => updateSettings({ layoutMode: mode })}
              >
                <LayoutGlyph mode={mode} />
              </button>
            ))}
          </div> : null}
          <button className="nav-save-button" type="button" onClick={(event) => { event.stopPropagation(); setSaveModalOpen(true); }}>
            <SaveIcon aria-hidden="true" /> Save
          </button>
          <div className="app-menu" onClick={(event) => event.stopPropagation()}>
            <button
              className={`nav-tools-button ${appMenuOpen ? "is-active" : ""}`}
              type="button"
              aria-haspopup="menu"
              aria-expanded={appMenuOpen}
              onClick={() => setAppMenuOpen((open) => !open)}
            >
              <Menu aria-hidden="true" /> Tools
            </button>
            {appMenuOpen ? (
              <div className="dropdown-menu app-menu-panel" role="menu" aria-label="Voyager tools">
                <button type="button" role="menuitem" onClick={() => { setSettingsOpen(true); setAppMenuOpen(false); }}>
                  <SettingsIcon aria-hidden="true" /><span><strong>Settings</strong><small>Robot, field, and controls</small></span>
                </button>
                <button type="button" role="menuitem" onClick={() => { setObstaclesOpen(true); setAppMenuOpen(false); }}>
                  <Boxes aria-hidden="true" /><span><strong>Obstacle map</strong><small>Edit field collision zones</small></span>
                </button>
                <button type="button" role="menuitem" disabled={!settings.fieldImageDataUrl} onClick={() => { setFieldCropSource(settings.fieldImageDataUrl); setAppMenuOpen(false); }}>
                  <Crop aria-hidden="true" /><span><strong>Crop field image</strong><small>Trim the current field artwork</small></span>
                </button>
                <button type="button" role="menuitem" onClick={() => { setVersionHistoryOpen(true); setAppMenuOpen(false); }}>
                  <History aria-hidden="true" /><span><strong>Version history</strong><small>Restore saved snapshots</small></span>
                </button>
                <button type="button" role="menuitem" onClick={() => { setPreferencesOpen(true); setAppMenuOpen(false); }}>
                  <Palette aria-hidden="true" /><span><strong>Appearance</strong><small>Theme and workspace design</small></span>
                </button>
              </div>
            ) : null}
          </div>
          <div className={`status-activity ${saveStatus.message ? "has-message" : ""}`} onClick={(event) => event.stopPropagation()}>
            <span className={`save-status save-status-${saveStatus.kind}`} title={saveStatus.message}>{saveStatus.message}</span>
            <button
              className="activity-log-reveal"
              type="button"
              aria-label="Open activity log"
              title="Open activity log"
              onClick={() => setActivityLogOpen(true)}
            >
              <History aria-hidden="true" />
            </button>
          </div>
        </div>
      </header>

      {activeWorkspaceTab === "auto" ? <main ref={workspaceRef} className="workspace" data-workspace-tab="auto">
        <section ref={leftPanelRef} className="left-panel">
          <section className="field-card auto-field-card">
            <div className="field-toolbar">
              <div>
                <h2>Auto maker field</h2>
                <p>{activePathName ? `Editing ${activePathName}` : "Select a path block to edit"}</p>
              </div>
              <div className="field-actions">
                <div className="history-actions" aria-label="Editor history controls">
                  <button type="button" onClick={undo} disabled={!canUndo} title="Undo (Ctrl+Z)">Undo</button>
                  <button type="button" onClick={redo} disabled={!canRedo} title="Redo (Ctrl+Y)">Redo</button>
                  <div className="field-more-tools" onClick={(event) => event.stopPropagation()}>
                    <button
                      type="button"
                      className={moreToolsOpen ? "is-active" : ""}
                      aria-haspopup="menu"
                      aria-expanded={moreToolsOpen}
                      onClick={() => setMoreToolsOpen((open) => !open)}
                      title="Open mirroring and obstacle visibility tools"
                    >
                      <Sparkles aria-hidden="true" /> More Tools <span className="more-tools-chevron" aria-hidden="true">▾</span>
                    </button>
                    {moreToolsOpen ? (
                      <div className="dropdown-menu field-tools-menu" role="menu" aria-label="More field tools">
                        <button
                          type="button"
                          role="menuitem"
                          disabled={!activePathName}
                          onClick={() => {
                            mirrorActivePath("x");
                            setMoreToolsOpen(false);
                          }}
                          title="Mirror selected path across the X coordinate"
                        >
                          Mirror X
                        </button>
                        <button
                          type="button"
                          role="menuitem"
                          disabled={!activePathName}
                          onClick={() => {
                            mirrorActivePath("y");
                            setMoreToolsOpen(false);
                          }}
                          title="Mirror selected path across the Y coordinate"
                        >
                          Mirror Y
                        </button>
                        <button
                          type="button"
                          role="menuitemcheckbox"
                          aria-checked={settings.showObstacleZones}
                          className={settings.showObstacleZones ? "is-checked" : ""}
                          onClick={() => {
                            updateSettings({ showObstacleZones: !settings.showObstacleZones });
                            setMoreToolsOpen(false);
                          }}
                          title={settings.showObstacleZones ? "Hide obstacle clearance zones" : "Show obstacle clearance zones"}
                        >
                          {settings.showObstacleZones ? <Eye aria-hidden="true" /> : <EyeOff aria-hidden="true" />}
                          <span>{settings.showObstacleZones ? "Hide obstacles" : "Show obstacles"}</span>
                        </button>
                        <button
                          type="button"
                          role="menuitemcheckbox"
                          aria-checked={settings.showHandoffRadii}
                          className={settings.showHandoffRadii ? "is-checked" : ""}
                          onClick={() => {
                            updateSettings({ showHandoffRadii: !settings.showHandoffRadii });
                            setMoreToolsOpen(false);
                          }}
                          title={settings.showHandoffRadii ? "Hide waypoint handoff radius labels" : "Show waypoint handoff radius labels"}
                        >
                          {settings.showHandoffRadii ? <Eye aria-hidden="true" /> : <EyeOff aria-hidden="true" />}
                          <span>{settings.showHandoffRadii ? "Hide handoff radii" : "Show handoff radii"}</span>
                        </button>
                      </div>
                    ) : null}
                  </div>
                  <button
                    type="button"
                    className={pathPlannerActive ? "is-active" : ""}
                    aria-pressed={pathPlannerActive}
                    onClick={togglePathPlanner}
                    disabled={!activePathName}
                    title="Select two field points and generate a collision-aware path"
                  >
                    <Route aria-hidden="true" /> Plan path
                  </button>
                  <button
                    type="button"
                    className={playbackOpen ? "is-active" : ""}
                    aria-pressed={playbackOpen}
                    onClick={togglePlaybackModal}
                    title="Toggle looping path playback"
                  >
                    Playback
                  </button>
                </div>
                <select aria-label="Path element type" value={addElementKind} onChange={(event) => setAddElementKind(event.target.value as AddElementKind)}>
                  <option value="waypoint">Waypoint</option>
                  <option value="rotationTarget">Rotation Target</option>
                  <option value="eventTrigger">Event Trigger</option>
                  <option value="eventZone">Event Zone</option>
                  <option value="constraintZone">Constraint Zone</option>
                </select>
                <button type="button" onClick={addPathElement}>Add</button>
              </div>
            </div>

            <div className="field-scroll-shell" aria-label="Scrollable autonomous field">
              <div
                ref={fieldOneRef}
                className={`field-surface ${settings.fieldImageDataUrl ? "has-field-image" : ""} ${pathPlannerActive ? "is-planning" : ""}`}
                data-measured={fieldOneSize.width > 0 && fieldOneSize.height > 0}
                style={fieldBackgroundStyle}
                onClick={selectPlannerPoint}
              >
              {!settings.fieldImageDataUrl ? <div className="field-placeholder">Field image<br />{formatNumber(settings.fieldLengthMeters)} × {formatNumber(settings.fieldWidthMeters)} m</div> : null}
              {settings.showObstacleZones ? obstacles.map((obstacle) => (
                <div key={`auto-${obstacle.id}`} className="field-obstacle-overlay" style={plannerObstacleStyle(settings, fieldOneSize, obstacle)} title={`${obstacle.name} robot-clearance envelope`}>
                  <span>{obstacle.name}</span>
                </div>
              )) : null}
              {pathPlannerPoints.map((point, index) => {
                const pixel = pointToPixels(settings, fieldOneSize, point);
                return <i key={`${point.x}-${point.y}-${index}`} className="planner-point-marker" style={{ left: pixel.x, top: pixel.y }}>{index === 0 ? "A" : "B"}</i>;
              })}
              <svg className="field-svg" viewBox={`0 0 ${Math.max(1, fieldOneSize.width)} ${Math.max(1, fieldOneSize.height)}`}>
                {activePathData.waypoints.slice(1).map((waypoint, index) => {
                  const previous = activePathData.waypoints[index];
                  const a = pointToPixels(settings, fieldOneSize, previous);
                  const b = pointToPixels(settings, fieldOneSize, waypoint);
                  return <line key={`${previous.id}-${waypoint.id}`} data-path-segment-index={index} className="path-line" x1={a.x} y1={a.y} x2={b.x} y2={b.y} />;
                })}
                {activePathData.constraintZones.map((zone) => {
                  const points = pathPixelsBetween(settings, fieldOneSize, activePathData.waypoints, zone.startPosition, zone.endPosition);
                  if (points.length < 2) return null;
                  return <polyline key={zone.id} className="constraint-zone-line" points={points.map((point) => `${point.x},${point.y}`).join(" ")} />;
                })}
                {activePathData.eventZones.map((zone) => {
                  const points = pathPixelsBetween(settings, fieldOneSize, activePathData.waypoints, zone.startPosition, zone.endPosition);
                  if (points.length < 2) return null;
                  return <polyline key={zone.id} className="event-zone-line" points={points.map((point) => `${point.x},${point.y}`).join(" ")} />;
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

              {settings.showHandoffRadii ? activePathData.waypoints.map((waypoint) => (
                <div key={`circle-${waypoint.id}`} className="handoff-circle" style={handoffCircleStyle(settings, fieldOneSize, waypoint)}>
                  <span>{formatNumber(waypoint.handoff, 2)}m</span>
                </div>
              )) : null}

              {activePathData.waypoints.map((waypoint, index) => (
                <div
                  key={waypoint.id}
                  className="robot-marker waypoint-marker"
                  style={robotRenderStyle(settings, fieldOneSize, waypoint.x, waypoint.y, waypoint.angle)}
                  role="button"
                  tabIndex={0}
                  aria-label={`Waypoint ${index + 1}. Press Enter to edit; drag to move.`}
                  onPointerDown={(event) => {
                    if (pathPlannerActive) selectPlannerWaypoint(event, waypoint);
                    else beginWaypointDrag(event, waypoint);
                  }}
                  onDoubleClick={(event) => {
                    event.stopPropagation();
                    addWaypointAfterIfLast(waypoint);
                  }}
                  onKeyDown={(event) => {
                    if (event.target !== event.currentTarget || (event.key !== "Enter" && event.key !== " ")) return;
                    event.preventDefault();
                    const pos = modalPositionFromElement(event.currentTarget);
                    setModal({ kind: "waypoint", id: waypoint.id, x: pos.x, y: pos.y });
                  }}
                >
                  <span>{index + 1}</span>
                  <button className={`rotation-handle ${activeRotationHandleId === `waypoint-${waypoint.id}` ? "is-elevated" : ""}`} type="button" aria-label="Rotate waypoint" onPointerDown={(event) => beginWaypointRotate(event, waypoint)} />
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
                    role="button"
                    tabIndex={0}
                    aria-label="Rotation target. Press Enter to edit; drag to reposition."
                    onPointerDown={(event) => beginPathPositionDrag(event, (position) => updateRotationTarget(target.id, { position }))}
                    onClick={(event) => {
                      event.stopPropagation();
                      const pos = modalPositionFromEvent(event);
                      setModal({ kind: "rotationTarget", id: target.id, x: pos.x, y: pos.y });
                    }}
                    onKeyDown={(event) => {
                      if (event.target !== event.currentTarget || (event.key !== "Enter" && event.key !== " ")) return;
                      event.preventDefault();
                      const pos = modalPositionFromElement(event.currentTarget);
                      setModal({ kind: "rotationTarget", id: target.id, x: pos.x, y: pos.y });
                    }}
                  >
                    <span>RT</span>
                    <button className={`rotation-handle ${activeRotationHandleId === `target-${target.id}` ? "is-elevated" : ""}`} type="button" aria-label="Rotate rotation target" onPointerDown={(event) => beginRotationTargetRotate(event, target)} />
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
                    aria-label={`Event trigger ${eventTrigger.name}. Drag to reposition or activate to edit.`}
                    onPointerDown={(event) => beginPathPositionDrag(event, (position) => updateEventTrigger(eventTrigger.id, { position }))}
                    onClick={(event) => {
                      event.stopPropagation();
                      const pos = modalPositionFromEvent(event);
                      setModal({ kind: "eventTrigger", id: eventTrigger.id, x: pos.x, y: pos.y });
                    }}
                  />
                );
              })}

              {activePathData.eventZones.map((zone) => {
                const start = pointAtPathPosition(activePathData.waypoints, zone.startPosition);
                const end = pointAtPathPosition(activePathData.waypoints, zone.endPosition);
                if (!start || !end) return null;
                const startPixel = pointToPixels(settings, fieldOneSize, start);
                const endPixel = pointToPixels(settings, fieldOneSize, end);
                return (
                  <React.Fragment key={zone.id}>
                    <button
                      className="event-zone-handle event-zone-handle-start"
                      type="button"
                      style={{ left: `${startPixel.x}px`, top: `${startPixel.y}px` }}
                      title={`Start ${zone.startName}`}
                      aria-label={`Event zone start ${zone.startName}. Drag to reposition or activate to edit.`}
                      onPointerDown={(event) => beginPathPositionDrag(event, (position) => updateEventZone(zone.id, { startPosition: position }))}
                      onClick={(event) => {
                        event.stopPropagation();
                        const pos = modalPositionFromEvent(event);
                        setModal({ kind: "eventZone", id: zone.id, x: pos.x, y: pos.y });
                      }}
                    >S</button>
                    <button
                      className="event-zone-handle event-zone-handle-end"
                      type="button"
                      style={{ left: `${endPixel.x}px`, top: `${endPixel.y}px` }}
                      title={`End ${zone.endName}`}
                      aria-label={`Event zone end ${zone.endName}. Drag to reposition or activate to edit.`}
                      onPointerDown={(event) => beginPathPositionDrag(event, (position) => updateEventZone(zone.id, { endPosition: position }))}
                      onClick={(event) => {
                        event.stopPropagation();
                        const pos = modalPositionFromEvent(event);
                        setModal({ kind: "eventZone", id: zone.id, x: pos.x, y: pos.y });
                      }}
                    >E</button>
                  </React.Fragment>
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
                      aria-label="Constraint zone start. Drag to reposition or activate to edit."
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
                      aria-label="Constraint zone end. Drag to reposition or activate to edit."
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

              {playbackOpen && playbackPose ? (
                <div
                  ref={playbackRobotRef}
                  className="robot-marker playback-robot-marker"
                  style={robotRenderStyle(settings, fieldOneSize, playbackPose.x, playbackPose.y, playbackPose.angle)}
                  aria-label={`Path preview robot at ${formatPlaybackTime(playbackTime)}`}
                >
                  <SwerveModules settings={settings} velocity={playbackVelocity} headingDegrees={playbackPose.angle} />
                </div>
              ) : null}
              </div>
            </div>
          </section>

        </section>

        <div
          className="panel-divider"
          role="separator"
          tabIndex={settings.layoutMode === "focus" ? -1 : 0}
          aria-label="Resize the Auto Builder and path tree panels"
          aria-orientation={settings.layoutMode === "horizontal" ? "horizontal" : "vertical"}
          onKeyDown={(event) => {
            if (settings.layoutMode === "focus") return;
            const panel = leftPanelRef.current;
            const workspace = panel?.parentElement;
            if (!panel || !workspace) return;
            const step = event.shiftKey ? 40 : 12;
            if (settings.layoutMode === "horizontal" && (event.key === "ArrowUp" || event.key === "ArrowDown")) {
              event.preventDefault();
              const direction = event.key === "ArrowDown" ? 1 : -1;
              const workspaceHeight = workspace.getBoundingClientRect().height;
              const nextHeight = clamp(panel.getBoundingClientRect().height + direction * step, 240, workspaceHeight - 220);
              workspace.style.gridTemplateRows = `${nextHeight}px 8px minmax(220px, 1fr)`;
            } else if (settings.layoutMode !== "horizontal" && (event.key === "ArrowLeft" || event.key === "ArrowRight")) {
              event.preventDefault();
              const visualDirection = event.key === "ArrowRight" ? 1 : -1;
              const direction = settings.layoutMode === "mirrored" ? -visualDirection : visualDirection;
              const workspaceWidth = workspace.getBoundingClientRect().width;
              panel.style.width = `${clamp(panel.getBoundingClientRect().width + direction * step, 260, workspaceWidth - 320)}px`;
            }
          }}
          onPointerDown={(event) => {
            if (settings.layoutMode === "focus") return;
            event.preventDefault();
            const startX = event.clientX;
            const startY = event.clientY;
            const panel = leftPanelRef.current;
            const workspace = panel?.parentElement;
            if (!panel || !workspace) return;
            const startWidth = panel.getBoundingClientRect().width;
            const startHeight = panel.getBoundingClientRect().height;
            const workspaceBounds = workspace.getBoundingClientRect();
            const pointerFrame = createPointerFrameScheduler((clientX, clientY) => {
              if (settings.layoutMode === "horizontal") {
                const nextHeight = clamp(startHeight + clientY - startY, 240, workspaceBounds.height - 220);
                workspace.style.gridTemplateRows = `${nextHeight}px 8px minmax(220px, 1fr)`;
                return;
              }
              const direction = settings.layoutMode === "mirrored" ? -1 : 1;
              const nextWidth = clamp(startWidth + (clientX - startX) * direction, 260, workspaceBounds.width - 320);
              panel.style.width = `${nextWidth}px`;
            });
            const onPointerMove = (moveEvent: PointerEvent): void => pointerFrame.schedule(moveEvent.clientX, moveEvent.clientY);
            const onPointerUp = (): void => {
              pointerFrame.flush();
              window.removeEventListener("pointermove", onPointerMove);
              window.removeEventListener("pointerup", onPointerUp);
            };
            window.addEventListener("pointermove", onPointerMove);
            window.addEventListener("pointerup", onPointerUp);
          }}
        >
          <span aria-hidden="true">⋮</span>
        </div>

        <section
          ref={focusTreeModalRef}
          className={`right-panel ${settings.layoutMode === "focus" ? "focus-tree-modal" : ""} ${treeModalMinimized ? "is-minimized" : ""}`}
          style={settings.layoutMode === "focus" ? {
            left: `${treeModalRect.x}px`,
            top: `${treeModalRect.y}px`,
            width: `${treeModalRect.width}px`,
            height: `${treeModalRect.height}px`,
          } : undefined}
        >
          <div className="tree-toolbar" onPointerDown={beginTreeModalDrag}>
            <div className="tree-legend">
              <strong className="tree-modal-title">Path tree</strong>
              <span><i className="legend-box saved" />saved</span>
              <span><i className="legend-box editing" />editing</span>
              <span><i className="legend-box routine" />selected for routine</span>
            </div>
            <div className="tree-toolbar-actions">
              {settings.layoutMode === "focus" ? (
                <button
                  className="tree-minimize-button"
                  type="button"
                  aria-label={treeModalMinimized ? "Restore path tree" : "Minimize path tree"}
                  title={treeModalMinimized ? "Restore path tree" : "Minimize path tree"}
                  onClick={toggleTreeModalMinimized}
                >
                  {treeModalMinimized ? "□" : "−"}
                </button>
              ) : null}
              <Tooltip>
                <TooltipTrigger render={<Button variant="outline" size="sm" className="tree-locate-button" />} onClick={focusNearestPathNode}>
                  <LocateFixed data-icon="inline-start" />
                  Nearest path
                </TooltipTrigger>
                <TooltipContent>Center the closest path block in the viewport.</TooltipContent>
              </Tooltip>
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
          </div>

          <div
            ref={treeViewportRef}
            className="tree-viewport"
            data-measured={treeViewportSize.width > 0 && treeViewportSize.height > 0}
            onPointerDown={beginTreePan}
            onDoubleClick={resetTreePan}
            onContextMenu={showCanvasMenu}
          >
            {treeViewportSize.width > 0 && treeViewportSize.height > 0 && visiblePathNodeCount === 0 ? (
              <div className="tree-visibility-warning" role="status">
                <AlertTriangle aria-hidden="true" />
                <span>{pathTreeNodes.length === 0 ? "No path blocks exist yet." : "No path blocks are visible."}</span>
                {pathTreeNodes.length > 0 ? <button type="button" onClick={(event) => { event.stopPropagation(); focusNearestPathNode(); }}>Recover</button> : null}
              </div>
            ) : null}
            <svg ref={treeSvgRef} className="tree-svg" style={{ transform: `translate3d(${pan.x}px, ${pan.y}px, 0)`, pointerEvents: "auto" }} width="3200" height="2200">
              {treeEdgeElements}
            </svg>
            <div ref={treeNodesLayerRef} className="tree-nodes-layer" style={{ transform: `translate3d(${pan.x}px, ${pan.y}px, 0)` }}>
              {treeNodeElements}
            </div>
          </div>
          {settings.layoutMode === "focus" && !treeModalMinimized ? (
            <button className="tree-resize-handle" type="button" aria-label="Resize path tree" onPointerDown={beginTreeModalResize} />
          ) : null}
        </section>
      </main> : (
        <LiveTelemetryWorkspace
          settings={settings}
          nt4Address={nt4Address}
          selectedRoutineCode={selectedRoutineCode}
          activePathName={activePathName}
          activePathData={activePathData}
          updateSettings={updateSettings}
          onError={setError}
          onPublished={handleRoutinePublished}
        />
      )}

      <FieldImageCropDialog
        source={fieldCropSource}
        fieldAspectRatio={settings.fieldLengthMeters / settings.fieldWidthMeters}
        onCancel={() => setFieldCropSource(null)}
        onApply={(croppedDataUrl) => {
          updateSettings({ fieldImageDataUrl: croppedDataUrl });
          setFieldCropSource(null);
          setSaveStatus({ kind: "saved", message: "Cropped and optimized the field image." });
        }}
      />

      <Dialog open={saveModalOpen} onOpenChange={setSaveModalOpen}>
        <DialogContent className="save-dialog">
          <DialogHeader className="save-dialog-header">
            <div className="preferences-title-icon" aria-hidden="true"><GitBranch /></div>
            <div>
              <DialogTitle>Save Voyager project</DialogTitle>
              <DialogDescription>Save routine files and control project-backed metadata from one place.</DialogDescription>
            </div>
          </DialogHeader>
          <div className="save-dialog-body">
            <section className="save-action-grid" aria-label="Save actions">
              <button type="button" className="save-action-card" disabled={!activePathName} onClick={() => void saveCurrentPath()}>
                <strong>Save this path</strong>
                <span>{activePathName ? `Write ${activePathName}.json and a version snapshot.` : "Select a path block to enable this action."}</span>
              </button>
              <button type="button" className="save-action-card is-primary" onClick={() => void saveAll()}>
                <strong>Save all paths</strong>
                <span>Write every path, auto_config.json, metadata, and a version snapshot.</span>
              </button>
              <button type="button" className="save-action-card" onClick={() => void saveMetadataNow()}>
                <strong>Save metadata now</strong>
                <span>Write the full workspace and version history without exporting routine files.</span>
              </button>
            </section>
            <section className="save-options" aria-label="Automatic save and publish options">
              <label className="save-option-row">
                <input type="checkbox" checked={settings.autoSave} onChange={(event) => updateSettings({ autoSave: event.target.checked })} />
                <span><strong>Save paths automatically</strong><small>Export routine files and capture snapshots after edits.</small></span>
              </label>
              <label className="save-option-row">
                <input type="checkbox" checked={settings.autoSaveMetadata} onChange={(event) => updateSettings({ autoSaveMetadata: event.target.checked })} />
                <span><strong>Save metadata automatically</strong><small>Keep voyager/assets/metadata.json synchronized after workspace edits.</small></span>
              </label>
              <label className="save-option-row">
                <input type="checkbox" checked={settings.autoPublishOnConnect} onChange={(event) => updateSettings({ autoPublishOnConnect: event.target.checked })} />
                <span><strong>Publish selected auto on connect</strong><small>Send the current selected routine to /Voyager/SelectedAuto when the robot connects.</small></span>
              </label>
            </section>
            <div className="save-project-location">
              <strong>Project target</strong>
              <span>{settings.robotCodeProjectFolder ? getVoyagerDeployFolder(settings.robotCodeProjectFolder) : "No robot project selected. Choose one in Settings before saving."}</span>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={versionHistoryOpen} onOpenChange={setVersionHistoryOpen}>
        <DialogContent className="version-history-dialog">
          <DialogHeader className="version-history-header">
            <div className="preferences-title-icon" aria-hidden="true"><GitBranch /></div>
            <div>
              <DialogTitle>Version History</DialogTitle>
              <DialogDescription>Project-backed auto-save and manual snapshots of both path data and the path tree.</DialogDescription>
            </div>
          </DialogHeader>
          <div className="version-history-toolbar">
            <div className="history-timeline-legend"><GitBranch aria-hidden="true" /><span>Snapshot timeline · newest first</span></div>
            <button type="button" onClick={() => void importProjectMetadata()} disabled={!settings.robotCodeProjectFolder}>Load project metadata</button>
          </div>
          <div className="version-history-scroll">
            {versionHistoryRows.length === 0 ? (
              <div className="version-history-empty">No snapshots yet. Enable Save paths automatically or save a path to create one.</div>
            ) : (
              <div className="version-history-timeline">
                {versionHistoryRows.map(({ snapshot, paths, nodes, waypoints }) => (
                  <article key={snapshot.id} className={`version-history-entry ${snapshot.source}`}>
                    <div className={`version-history-node ${snapshot.source}`} aria-hidden="true"><i /></div>
                    <div className="version-history-entry-card">
                      <div className="version-history-entry-head">
                        <div>
                          <strong>{snapshot.source === "auto" ? "Auto-save snapshot" : "Manual save snapshot"}</strong>
                          <time dateTime={new Date(snapshot.timestamp).toISOString()}>{new Date(snapshot.timestamp).toLocaleString()}</time>
                        </div>
                        <button type="button" onClick={() => restoreVersionSnapshot(snapshot)}>Restore</button>
                      </div>
                      <div className="version-history-stats" aria-label={`${paths} paths, ${nodes} tree blocks, and ${waypoints} waypoints`}>
                        <span><strong>{paths}</strong> path{paths === 1 ? "" : "s"}</span>
                        <span><strong>{nodes}</strong> tree block{nodes === 1 ? "" : "s"}</span>
                        <span><strong>{waypoints}</strong> waypoint{waypoints === 1 ? "" : "s"}</span>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={obstaclesOpen} onOpenChange={setObstaclesOpen}>
        <DialogContent className="obstacle-dialog">
          <DialogHeader className="obstacle-dialog-header">
            <div className="preferences-title-icon" aria-hidden="true"><Boxes /></div>
            <div>
              <DialogTitle>Field obstacle map</DialogTitle>
              <DialogDescription>Move and resize measured field obstacles. Coordinates use the configured field origin and dimensions.</DialogDescription>
            </div>
          </DialogHeader>
          <div className="obstacle-toolbar">
            <div><strong>{obstacles.length}</strong> obstacle{obstacles.length === 1 ? "" : "s"} · robot clearance is included by the planner</div>
            <button type="button" className="primary-tool-button" onClick={addObstacle}><Plus aria-hidden="true" /> Add obstacle</button>
          </div>
          <div className="obstacle-workspace">
            <div className="obstacle-field-scroll" aria-label="Scrollable obstacle field editor">
              <div
                ref={obstacleFieldRef}
                className={`obstacle-field-surface ${settings.fieldImageDataUrl ? "has-field-image" : ""}`}
                style={fieldBackgroundStyle}
                onClick={() => setSelectedObstacleId(null)}
              >
                {!settings.fieldImageDataUrl ? <div className="field-placeholder">Field image<br />{formatNumber(settings.fieldLengthMeters)} × {formatNumber(settings.fieldWidthMeters)} m</div> : null}
                {obstacles.map((obstacle) => (
                  <div
                    key={obstacle.id}
                    className={`editable-obstacle ${selectedObstacleId === obstacle.id ? "is-selected" : ""}`}
                    style={obstacleStyle(settings, obstacleFieldSize, obstacle)}
                    onPointerDown={(event) => beginObstacleMove(event, obstacle)}
                    onClick={(event) => {
                      event.stopPropagation();
                      setSelectedObstacleId(obstacle.id);
                    }}
                  >
                    <span>{obstacle.name}</span>
                    <small>{formatNumber(obstacle.x, 2)}, {formatNumber(obstacle.y, 2)} m</small>
                    {(["left", "right", "top", "bottom"] as ObstacleResizeEdge[]).map((edge) => (
                      <button
                        key={edge}
                        type="button"
                        tabIndex={-1}
                        className={`obstacle-resize-edge edge-${edge}`}
                        aria-label={`Resize ${obstacle.name} from the ${edge} side`}
                        onPointerDown={(event) => beginObstacleResize(event, obstacle, edge)}
                      />
                    ))}
                  </div>
                ))}
              </div>
            </div>
            <aside className="obstacle-inspector">
              <section className="obstacle-list" aria-label="All field obstacles">
                <div className="obstacle-list-heading"><strong>All obstacles</strong><span>{obstacles.length}</span></div>
                <div className="obstacle-list-scroll">
                  {obstacles.length === 0 ? <p>Add an obstacle to begin mapping the field.</p> : obstacles.map((obstacle, index) => (
                    <div key={`list-${obstacle.id}`} className={`obstacle-list-row ${selectedObstacleId === obstacle.id ? "is-selected" : ""}`}>
                      <button type="button" aria-label={`Select ${obstacle.name || `Obstacle ${index + 1}`}`} onClick={() => setSelectedObstacleId(obstacle.id)}>
                        <i aria-hidden="true" />
                      </button>
                      <label>
                        <span className="sr-only">Obstacle name</span>
                        <input
                          type="text"
                          value={obstacle.name}
                          onFocus={() => setSelectedObstacleId(obstacle.id)}
                          onChange={(event) => updateObstacle(obstacle.id, { name: event.target.value })}
                          onBlur={(event) => updateObstacle(obstacle.id, { name: event.target.value.trim() || `Obstacle ${index + 1}` })}
                        />
                        <small>{formatNumber(obstacle.x, 2)}, {formatNumber(obstacle.y, 2)} · {formatNumber(obstacle.length, 2)} × {formatNumber(obstacle.width, 2)} m</small>
                      </label>
                    </div>
                  ))}
                </div>
              </section>
              {selectedObstacle ? (
                <>
                  <div className="obstacle-inspector-title"><strong>Obstacle geometry</strong><button type="button" className="icon-danger-button" aria-label={`Delete ${selectedObstacle.name}`} onClick={() => deleteObstacle(selectedObstacle.id)}><Trash2 /></button></div>
                  <label>Name<input type="text" value={selectedObstacle.name} onChange={(event) => updateObstacle(selectedObstacle.id, { name: event.target.value })} onBlur={(event) => updateObstacle(selectedObstacle.id, { name: event.target.value.trim() || "Obstacle" })} /></label>
                  <div className="two-column-inputs">
                    <label>Center X (m)<input type="number" step="0.01" value={formatNumber(selectedObstacle.x, 3)} onChange={(event) => updateObstacle(selectedObstacle.id, { x: Number(event.target.value) })} /></label>
                    <label>Center Y (m)<input type="number" step="0.01" value={formatNumber(selectedObstacle.y, 3)} onChange={(event) => updateObstacle(selectedObstacle.id, { y: Number(event.target.value) })} /></label>
                    <label>Length X (m)<input type="number" min="0.05" step="0.01" value={formatNumber(selectedObstacle.length, 3)} onChange={(event) => updateObstacle(selectedObstacle.id, { length: Number(event.target.value) })} /></label>
                    <label>Width Y (m)<input type="number" min="0.05" step="0.01" value={formatNumber(selectedObstacle.width, 3)} onChange={(event) => updateObstacle(selectedObstacle.id, { width: Number(event.target.value) })} /></label>
                  </div>
                  <p>The shaded clearance preview on the Auto maker field includes half the robot dimensions around this measured rectangle.</p>
                </>
              ) : (
                <div className="obstacle-empty-selection"><Boxes /><strong>Select an obstacle</strong><span>Choose a rectangle to inspect exact meter coordinates, move it, or resize it.</span></div>
              )}
              <div className="metadata-location"><strong>Project metadata</strong><span>{settings.robotCodeProjectFolder ? `${getVoyagerAssetsFolder(settings.robotCodeProjectFolder)}\\${PROJECT_METADATA_FILE}` : "Select a robot project in Settings to save this map with the routine."}</span></div>
            </aside>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={preferencesOpen} onOpenChange={setPreferencesOpen}>
        <DialogContent className="preferences-dialog">
          <DialogHeader className="preferences-header">
            <div className="preferences-title-icon" aria-hidden="true"><Sparkles /></div>
            <div>
              <DialogTitle>Appearance preferences</DialogTitle>
              <DialogDescription>Choose a color theme, build a custom palette, or apply a complete interface design. Changes save automatically.</DialogDescription>
            </div>
          </DialogHeader>

          <div className="preferences-tabs" role="tablist" aria-label="Appearance preference categories">
            <button type="button" role="tab" aria-selected={preferencesTab === "themes"} className={preferencesTab === "themes" ? "is-active" : ""} onClick={() => setPreferencesTab("themes")}>Themes</button>
            <button type="button" role="tab" aria-selected={preferencesTab === "designs"} className={preferencesTab === "designs" ? "is-active" : ""} onClick={() => setPreferencesTab("designs")}>Custom Designs</button>
          </div>
          <div className="preferences-scroll">
            {preferencesTab === "themes" ? (
              <>
            <section className="preferences-section">
              <div className="preferences-section-heading">
                <div>
                  <strong>Theme presets</strong>
                  <span>Ten tuned palettes with the same Voyager layout and contrast hierarchy.</span>
                </div>
                <span className="theme-count">10 presets</span>
              </div>
              <div className="theme-preset-grid">
                {THEME_PRESETS.map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    className={`theme-preset-card ${settings.themePreset === preset.id ? "is-selected" : ""}`}
                    aria-pressed={settings.themePreset === preset.id}
                    onClick={() => updateSettings({ themePreset: preset.id })}
                  >
                    <span className="theme-preset-preview" style={{ background: preset.palette.background }}>
                      <i style={{ background: preset.palette.panel2 }} />
                      <i style={{ background: preset.palette.accent }} />
                      <i style={{ background: preset.palette.accent2 }} />
                    </span>
                    <span className="theme-preset-copy">
                      <strong>{preset.name}</strong>
                      <small>{preset.description}</small>
                    </span>
                    {settings.themePreset === preset.id ? <span className="theme-selected-dot" aria-label="Selected" /> : null}
                  </button>
                ))}
              </div>
            </section>

            <section className="preferences-section custom-theme-section">
              <div className="preferences-section-heading">
                <div>
                  <strong>Custom theme</strong>
                  <span>Start from the current palette, then tune the semantic colors.</span>
                </div>
                <Button
                  variant={settings.themePreset === "custom" ? "default" : "outline"}
                  size="sm"
                  onClick={() => updateSettings({ themePreset: "custom" })}
                >
                  <Palette data-icon="inline-start" />
                  {settings.themePreset === "custom" ? "Custom active" : "Use custom"}
                </Button>
              </div>
              <div className="custom-theme-toolbar">
                <label>
                  Theme name
                  <input type="text" value={settings.customThemeName} onChange={(event) => updateSettings({ customThemeName: event.target.value })} />
                </label>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => updateSettings({
                    customTheme: { ...activeTheme },
                    customThemeName: settings.themePreset === "custom"
                      ? settings.customThemeName
                      : `${THEME_PRESETS.find((preset) => preset.id === settings.themePreset)?.name ?? "Voyager"} Custom`,
                    themePreset: "custom",
                  })}
                >
                  Clone current palette
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => updateSettings({ customTheme: { ...DEFAULT_THEME.palette }, customThemeName: "My Voyager Theme", themePreset: "custom" })}
                >
                  Reset custom
                </Button>
              </div>
              <div className="custom-color-grid">
                {CUSTOM_THEME_FIELDS.map(({ key, label }) => (
                  <label key={key} className="custom-color-control">
                    <span>{label}</span>
                    <span className="custom-color-input-wrap">
                      <input
                        type="color"
                        value={settings.customTheme[key]}
                        onChange={(event) => updateSettings({
                          customTheme: { ...settings.customTheme, [key]: event.target.value },
                          themePreset: "custom",
                        })}
                      />
                      <code>{settings.customTheme[key].toUpperCase()}</code>
                    </span>
                  </label>
                ))}
              </div>
            </section>
              </>
            ) : (
              <section className="preferences-section design-presets-section">
                <div className="preferences-section-heading">
                  <div>
                    <strong>Custom Designs</strong>
                    <span>Five validated interface systems that change typography, density, padding, radii, control sizing, and elevation without replacing your color theme.</span>
                  </div>
                  <span className="theme-count">5 designs</span>
                </div>
                <div className="design-preset-grid">
                  {DESIGN_PRESETS.map((preset) => (
                    <button
                      key={preset.id}
                      type="button"
                      className={`design-preset-card ${settings.designPreset === preset.id ? "is-selected" : ""}`}
                      aria-pressed={settings.designPreset === preset.id}
                      onClick={() => updateSettings({ designPreset: preset.id })}
                    >
                      <span
                        className="design-preset-preview"
                        style={{
                          fontFamily: preset.bodyFont,
                          borderRadius: preset.radiusMedium,
                          padding: preset.panelPadding,
                          boxShadow: preset.shadow,
                        }}
                      >
                        <i className="design-preview-nav"><b>Voyager</b><em /></i>
                        <i className="design-preview-layout"><em /><em /><em /></i>
                        <i className="design-preview-control" style={{ minHeight: preset.controlHeight, borderRadius: preset.buttonRadius }}>Plan Path</i>
                      </span>
                      <span className="design-preset-copy">
                        <span><strong style={{ fontFamily: preset.displayFont }}>{preset.name}</strong>{settings.designPreset === preset.id ? <i>Active</i> : null}</span>
                        <small>{preset.description}</small>
                        <code>{preset.source}</code>
                      </span>
                    </button>
                  ))}
                </div>
                <div className="design-validation-note">
                  <Sparkles aria-hidden="true" />
                  <span><strong>Voyager-safe adaptation</strong>Each design keeps minimum target sizes, scrolling behavior, field proportions, modal bounds, and contrast roles intact across aspect ratios.</span>
                </div>
              </section>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={activityLogOpen} onOpenChange={setActivityLogOpen}>
        <DialogContent className="activity-log-dialog">
          <DialogHeader className="activity-log-header">
            <div className="preferences-title-icon" aria-hidden="true"><History /></div>
            <div>
              <DialogTitle>Activity log</DialogTitle>
              <DialogDescription>Voyager notifications recorded during this session, with local timestamps.</DialogDescription>
            </div>
          </DialogHeader>
          <div className="activity-log-list" role="log" aria-live="polite">
            {activityLog.length === 0 ? (
              <div className="activity-log-empty">No activity has been recorded yet.</div>
            ) : activityLog.map((entry) => (
              <article key={entry.id} className={`activity-log-entry activity-log-entry-${entry.kind}`}>
                <time dateTime={new Date(entry.timestamp).toISOString()}>
                  {new Date(entry.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                </time>
                <span className="activity-log-kind">{entry.kind}</span>
                <p>{entry.message}</p>
              </article>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {contextMenu ? (
        <div ref={contextMenuRef} className="tree-menu" style={{ left: `${contextMenu.x}px`, top: `${contextMenu.y}px` }} onClick={(event) => event.stopPropagation()}>
          {contextMenu.kind === "canvas" ? (
            <>
              <button type="button" onClick={() => addTreeNode("path", contextMenu.canvasX, contextMenu.canvasY)}>New path block</button>
              <button type="button" onClick={() => addTreeNode("if", contextMenu.canvasX, contextMenu.canvasY)}>New if block</button>
              <button type="button" onClick={() => addTreeNode("loop", contextMenu.canvasX, contextMenu.canvasY)}>New loop block</button>
              <button type="button" onClick={() => addTreeNode("interrupt", contextMenu.canvasX, contextMenu.canvasY)}>New interruptable block</button>
              <button type="button" onClick={() => addTreeNode("event", contextMenu.canvasX, contextMenu.canvasY)}>New event block</button>
              <button type="button" onClick={() => { setTreeNodes((nodes) => nodes.map((node) => ({ ...node, selectedForRoutine: false, editing: false }))); setActivePathNodeId(null); setSelectedTreeNodeId(null); setContextMenu(null); }}>Deselect all</button>
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
                <button type="button" onClick={() => beginNodeConnectAsParent(node.id)}>Connect this block as parent</button>
                <button type="button" onClick={() => beginNodeConnectAsChild(node.id)}>Connect this block as child</button>
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

      {playbackOpen ? (
        <div
          ref={playbackModalRef}
          className="playback-modal"
          role="dialog"
          aria-label="Path playback"
          tabIndex={-1}
          style={{ left: `${playbackModalPosition.x}px`, top: `${playbackModalPosition.y}px` }}
          onClick={(event) => event.stopPropagation()}
          onKeyDown={(event) => {
            if (event.key !== "Escape") return;
            event.preventDefault();
            setPlaybackPlaying(false);
            setPlaybackOpen(false);
          }}
        >
          <div className="modal-titlebar draggable" onPointerDown={beginPlaybackModalDrag}>
            <div>
              <strong>Path playback</strong>
              <span>{activePathName ? `${activePathName} · looping preview` : "Select a path block to preview"}</span>
            </div>
            <button
              type="button"
              aria-label="Close path playback"
              onClick={() => {
                setPlaybackPlaying(false);
                setPlaybackTime(playbackTimeRef.current);
                setPlaybackOpen(false);
              }}
            >
              ×
            </button>
          </div>
          <div className="playback-body">
            <div className="playback-controls">
              <button
                type="button"
                disabled={playbackPlan.totalDuration <= 0}
                onClick={() => {
                  if (playbackPlan.totalDuration <= 0) return;
                  if (playbackPlaying) {
                    setPlaybackTime(playbackTimeRef.current);
                    setPlaybackPlaying(false);
                    return;
                  }
                  if (playbackTimeRef.current >= playbackPlan.totalDuration) {
                    playbackTimeRef.current = 0;
                    setPlaybackTime(0);
                    applyPlaybackVisualTime(0);
                  }
                  setPlaybackPlaying(true);
                }}
              >
                {playbackPlaying ? "Pause" : "Play"}
              </button>
              <button
                type="button"
                disabled={playbackPlan.totalDuration <= 0 && playbackTimeRef.current === 0}
                onClick={() => {
                  setPlaybackPlaying(false);
                  playbackTimeRef.current = 0;
                  setPlaybackTime(0);
                  applyPlaybackVisualTime(0);
                }}
              >
                Reset
              </button>
              <span ref={playbackTimeLabelRef} className="playback-time-current">{formatPlaybackTime(playbackTime)}</span>
            </div>
            <input
              ref={playbackTimelineRef}
              key={`${activePathName ?? "none"}-${playbackPlan.totalDuration}`}
              className="playback-timeline"
              type="range"
              min="0"
              max={Math.max(0.01, playbackPlan.totalDuration)}
              step="0.01"
              defaultValue={clamp(playbackTime, 0, Math.max(0.01, playbackPlan.totalDuration))}
              disabled={playbackPlan.totalDuration <= 0}
              aria-label="Path playback timeline"
              onInput={(event) => applyPlaybackVisualTime(clamp(Number(event.currentTarget.value), 0, playbackPlan.totalDuration))}
              onPointerUp={() => setPlaybackTime(playbackTimeRef.current)}
              onKeyUp={() => setPlaybackTime(playbackTimeRef.current)}
            />
            <div className="playback-summary">
              <span>Estimated total: <strong>{formatPlaybackTime(playbackPlan.totalDuration)}</strong></span>
              <span>Motion {formatPlaybackTime(playbackPlan.movementDuration)} · settle {formatPlaybackTime(playbackPlan.settlingDuration)}</span>
            </div>
            <p>Estimate uses trapezoidal motion limits, constraint zones, rotation targets, waypoint handoffs, controller gains, and end tolerances.</p>
          </div>
        </div>
      ) : null}

      {settingsOpen ? (
        <div className="settings-overlay" onClick={() => setSettingsOpen(false)}>
          <div
            ref={settingsModalRef}
            className="settings-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="settings-dialog-title"
            tabIndex={-1}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="modal-titlebar">
              <div>
                <strong id="settings-dialog-title">Settings</strong>
                <span>Field, robot, path constraints, controllers, storage, and save target.</span>
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
                <p className="path-preview">Every new image opens the crop tool before it is saved.</p>
                {settings.fieldImageDataUrl ? <button className="full-button" type="button" onClick={() => setFieldCropSource(settings.fieldImageDataUrl)}>Crop current field image</button> : null}
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
                <p className="path-preview">Current NT4 endpoint: {describeNt4Address(nt4Address)}</p>
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

              <div className="settings-column">
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
                      const pointerFrame = createPointerFrameScheduler(updateCenter);
                      const onPointerMove = (moveEvent: PointerEvent): void => pointerFrame.schedule(moveEvent.clientX, moveEvent.clientY);
                      const onPointerUp = (): void => {
                        pointerFrame.flush();
                        window.removeEventListener("pointermove", onPointerMove);
                        window.removeEventListener("pointerup", onPointerUp);
                      };
                      window.addEventListener("pointermove", onPointerMove);
                      window.addEventListener("pointerup", onPointerUp);
                    }}
                  >
                    <SwerveModules settings={settings} velocity={{ vx: 0, vy: 0, omega: 0 }} headingDegrees={0} />
                    <i
                      className="robot-center-dot"
                      style={{
                        left: `${(clamp(settings.centerOfRotationX, 0, settings.robotLengthMeters) / settings.robotLengthMeters) * 100}%`,
                        top: `${(clamp(settings.centerOfRotationY, 0, settings.robotWidthMeters) / settings.robotWidthMeters) * 100}%`,
                      }}
                    />
                  </div>
                </div>
                <div className="swerve-geometry-controls">
                  <label className="slider-setting">
                    <span>Wheel length <output>{formatNumber(clamp(settings.swerveWheelLengthMeters, 0.04, settings.robotLengthMeters * 0.45), 2)} m</output></span>
                    <input
                      type="range"
                      min="0.04"
                      max={Math.max(0.04, settings.robotLengthMeters * 0.45)}
                      step="0.01"
                      value={clamp(settings.swerveWheelLengthMeters, 0.04, settings.robotLengthMeters * 0.45)}
                      onChange={(event) => updateSettings({ swerveWheelLengthMeters: Number(event.target.value) })}
                    />
                  </label>
                  <label className="slider-setting">
                    <span>Wheel width <output>{formatNumber(clamp(settings.swerveWheelWidthMeters, 0.01, settings.robotWidthMeters * 0.2), 2)} m</output></span>
                    <input
                      type="range"
                      min="0.01"
                      max={Math.max(0.01, settings.robotWidthMeters * 0.2)}
                      step="0.005"
                      value={clamp(settings.swerveWheelWidthMeters, 0.01, settings.robotWidthMeters * 0.2)}
                      onChange={(event) => updateSettings({ swerveWheelWidthMeters: Number(event.target.value) })}
                    />
                  </label>
                  <label className="slider-setting">
                    <span>Longitudinal offset <output>{formatNumber(clamp(settings.swerveModuleOffsetXMeters, 0, settings.robotLengthMeters / 2), 2)} m</output></span>
                    <input
                      type="range"
                      min="0"
                      max={Math.max(0.01, settings.robotLengthMeters / 2)}
                      step="0.01"
                      value={clamp(settings.swerveModuleOffsetXMeters, 0, settings.robotLengthMeters / 2)}
                      onChange={(event) => updateSettings({ swerveModuleOffsetXMeters: Number(event.target.value) })}
                    />
                  </label>
                  <label className="slider-setting">
                    <span>Lateral offset <output>{formatNumber(clamp(settings.swerveModuleOffsetYMeters, 0, settings.robotWidthMeters / 2), 2)} m</output></span>
                    <input
                      type="range"
                      min="0"
                      max={Math.max(0.01, settings.robotWidthMeters / 2)}
                      step="0.01"
                      value={clamp(settings.swerveModuleOffsetYMeters, 0, settings.robotWidthMeters / 2)}
                      onChange={(event) => updateSettings({ swerveModuleOffsetYMeters: Number(event.target.value) })}
                    />
                  </label>
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

                <section className="settings-section settings-section-divided">
                  <h3>Path constraints</h3>
                  <div className="two-column-inputs">
                    <label>
                      Max translational velocity (m/s)
                      <input type="number" min="0.01" step="0.01" value={settings.maxTranslationalVelocity} onChange={(event) => updateSettings({ maxTranslationalVelocity: safePositive(Number(event.target.value), DEFAULT_SETTINGS.maxTranslationalVelocity) })} />
                    </label>
                    <label>
                      Max translational acceleration (m/s²)
                      <input type="number" min="0.01" step="0.01" value={settings.maxTranslationalAcceleration} onChange={(event) => updateSettings({ maxTranslationalAcceleration: safePositive(Number(event.target.value), DEFAULT_SETTINGS.maxTranslationalAcceleration) })} />
                    </label>
                    <label>
                      Max rotational velocity (°/s)
                      <input type="number" min="0.01" step="1" value={settings.maxRotationalVelocity} onChange={(event) => updateSettings({ maxRotationalVelocity: safePositive(Number(event.target.value), DEFAULT_SETTINGS.maxRotationalVelocity) })} />
                    </label>
                    <label>
                      Max rotational acceleration (°/s²)
                      <input type="number" min="0.01" step="1" value={settings.maxRotationalAcceleration} onChange={(event) => updateSettings({ maxRotationalAcceleration: safePositive(Number(event.target.value), DEFAULT_SETTINGS.maxRotationalAcceleration) })} />
                    </label>
                    <label>
                      End translation tolerance (m)
                      <input type="number" min="0.001" step="0.01" value={settings.endTranslationToleranceMeters} onChange={(event) => updateSettings({ endTranslationToleranceMeters: safePositive(Number(event.target.value), DEFAULT_SETTINGS.endTranslationToleranceMeters) })} />
                    </label>
                    <label>
                      End rotation tolerance (°)
                      <input type="number" min="0.01" step="0.1" value={settings.endRotationToleranceDegrees} onChange={(event) => updateSettings({ endRotationToleranceDegrees: safePositive(Number(event.target.value), DEFAULT_SETTINGS.endRotationToleranceDegrees) })} />
                    </label>
                  </div>
                  <label>
                    Default intermediate handoff radius (m)
                    <input type="number" min="0.01" max={maxHandoffRadiusMeters(settings.fieldLengthMeters, settings.fieldWidthMeters)} step="0.01" value={settings.defaultIntermediateHandOffRadiusMeters} onChange={(event) => updateSettings({ defaultIntermediateHandOffRadiusMeters: clamp(safePositive(Number(event.target.value), DEFAULT_SETTINGS.defaultIntermediateHandOffRadiusMeters), 0.01, maxHandoffRadiusMeters(settings.fieldLengthMeters, settings.fieldWidthMeters)) })} />
                  </label>
                  <p className="settings-help">New waypoints use this radius. Each waypoint’s Handoff field can override it.</p>

                  <div className="planner-settings-group">
                    <div>
                      <strong>Obstacle-aware path planner</strong>
                      <span>A* inflates obstacles by the robot footprint, penalizes turns, prunes line-of-sight nodes, rounds safe corners, and removes unchanged-direction waypoints.</span>
                    </div>
                    <label className="slider-setting planner-level-slider">
                      <span>Relative waypoint amount <output>{PLANNER_LEVEL_LABELS[settings.plannerWaypointDensity]}</output></span>
                      <input type="range" min="0" max="4" step="1" value={settings.plannerWaypointDensity} onChange={(event) => updateSettings({ plannerWaypointDensity: normalizePlannerLevel(event.target.value) })} />
                      <i className="planner-level-labels" aria-hidden="true">{PLANNER_LEVEL_LABELS.map((label) => <small key={label}>{label}</small>)}</i>
                    </label>
                    <label className="slider-setting planner-level-slider">
                      <span>Relative path sharpness <output>{PLANNER_LEVEL_LABELS[settings.plannerSharpness]}</output></span>
                      <input type="range" min="0" max="4" step="1" value={settings.plannerSharpness} onChange={(event) => updateSettings({ plannerSharpness: normalizePlannerLevel(event.target.value) })} />
                      <i className="planner-level-labels" aria-hidden="true">{PLANNER_LEVEL_LABELS.map((label) => <small key={label}>{label}</small>)}</i>
                    </label>
                  </div>

                  <div className="controller-group">
                    <strong>Translational controller PID</strong>
                    <div className="three-column-inputs">
                      <label>P<input type="number" min="0" step="0.01" value={settings.translationalControllerP} onChange={(event) => updateSettings({ translationalControllerP: Math.max(0, cleanNumber(Number(event.target.value), DEFAULT_SETTINGS.translationalControllerP)) })} /></label>
                      <label>I<input type="number" min="0" step="0.01" value={settings.translationalControllerI} onChange={(event) => updateSettings({ translationalControllerI: Math.max(0, cleanNumber(Number(event.target.value), DEFAULT_SETTINGS.translationalControllerI)) })} /></label>
                      <label>D<input type="number" min="0" step="0.01" value={settings.translationalControllerD} onChange={(event) => updateSettings({ translationalControllerD: Math.max(0, cleanNumber(Number(event.target.value), DEFAULT_SETTINGS.translationalControllerD)) })} /></label>
                    </div>
                  </div>

                  <div className="controller-group">
                    <strong>CTE controller PID</strong>
                    <div className="three-column-inputs">
                      <label>P<input type="number" min="0" step="0.01" value={settings.cteControllerP} onChange={(event) => updateSettings({ cteControllerP: Math.max(0, cleanNumber(Number(event.target.value), DEFAULT_SETTINGS.cteControllerP)) })} /></label>
                      <label>I<input type="number" min="0" step="0.01" value={settings.cteControllerI} onChange={(event) => updateSettings({ cteControllerI: Math.max(0, cleanNumber(Number(event.target.value), DEFAULT_SETTINGS.cteControllerI)) })} /></label>
                      <label>D<input type="number" min="0" step="0.01" value={settings.cteControllerD} onChange={(event) => updateSettings({ cteControllerD: Math.max(0, cleanNumber(Number(event.target.value), DEFAULT_SETTINGS.cteControllerD)) })} /></label>
                    </div>
                  </div>

                  <div className="controller-group">
                    <strong>Rotational controller PID</strong>
                    <div className="three-column-inputs">
                      <label>P<input type="number" min="0" step="0.01" value={settings.rotationalControllerP} onChange={(event) => updateSettings({ rotationalControllerP: Math.max(0, cleanNumber(Number(event.target.value), DEFAULT_SETTINGS.rotationalControllerP)) })} /></label>
                      <label>I<input type="number" min="0" step="0.01" value={settings.rotationalControllerI} onChange={(event) => updateSettings({ rotationalControllerI: Math.max(0, cleanNumber(Number(event.target.value), DEFAULT_SETTINGS.rotationalControllerI)) })} /></label>
                      <label>D<input type="number" min="0" step="0.01" value={settings.rotationalControllerD} onChange={(event) => updateSettings({ rotationalControllerD: Math.max(0, cleanNumber(Number(event.target.value), DEFAULT_SETTINGS.rotationalControllerD)) })} /></label>
                    </div>
                  </div>
                  <p className="settings-help">Playback time is an estimate derived from the motion limits, zone overrides, controller response, handoff radii, and end tolerances.</p>
                </section>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {modal ? (
        <div
          ref={elementModalRef}
          className="element-modal"
          role="dialog"
          aria-label={`${modal.kind === "waypoint" ? "Waypoint" : modal.kind === "rotationTarget" ? "Rotation target" : modal.kind === "eventTrigger" ? "Event trigger" : modal.kind === "eventZone" ? "Event zone" : "Constraint zone"} editor`}
          tabIndex={-1}
          style={{ left: `${modal.x}px`, top: `${modal.y}px` }}
          onClick={(event) => event.stopPropagation()}
          onKeyDown={(event) => {
            if (event.key !== "Escape") return;
            event.preventDefault();
            setModal(null);
          }}
        >
          <div className="modal-titlebar draggable" onPointerDown={beginModalDrag}>
            <div>
              <strong>{modal.kind === "waypoint" ? "Waypoint" : modal.kind === "rotationTarget" ? "Rotation Target" : modal.kind === "eventTrigger" ? "Event Trigger" : modal.kind === "eventZone" ? "Event Zone" : "Constraint Zone"}</strong>
              <span>{activePathName ?? "No active path"}</span>
            </div>
            <button type="button" aria-label="Close modal" onClick={() => setModal(null)}>×</button>
          </div>

          {activeWaypointModal ? (
            <div className="modal-body grid-two">
              <label>X (m)<input type="number" step="0.01" value={formatNumber(activeWaypointModal.x, 3)} onChange={(event) => updateWaypoint(activeWaypointModal.id, { x: clamp(cleanNumber(Number(event.target.value), 0), 0, settings.fieldLengthMeters) })} /></label>
              <label>Y (m)<input type="number" step="0.01" value={formatNumber(activeWaypointModal.y, 3)} onChange={(event) => updateWaypoint(activeWaypointModal.id, { y: clamp(cleanNumber(Number(event.target.value), 0), 0, settings.fieldWidthMeters) })} /></label>
              <label>Rotation (°)<input type="number" step="1" value={formatNumber(normalizeCompassDegrees(activeWaypointModal.angle), 2)} onChange={(event) => updateWaypoint(activeWaypointModal.id, { angle: normalizeCompassDegrees(cleanNumber(Number(event.target.value), 0)) })} /></label>
              <label>Handoff (m)<input type="number" min="0.01" max={maxHandoffRadiusMeters(settings.fieldLengthMeters, settings.fieldWidthMeters)} step="0.01" value={formatNumber(activeWaypointModal.handoff, 3)} onChange={(event) => updateWaypoint(activeWaypointModal.id, { handoff: clamp(safePositive(Number(event.target.value), settings.defaultIntermediateHandOffRadiusMeters), 0.01, maxHandoffRadiusMeters(settings.fieldLengthMeters, settings.fieldWidthMeters)) })} /></label>
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

          {activeEventZoneModal ? (
            <div className="modal-body grid-two">
              <label>Start event name<input type="text" value={activeEventZoneModal.startName} onChange={(event) => updateEventZone(activeEventZoneModal.id, { startName: event.target.value })} /></label>
              <label>End event name<input type="text" value={activeEventZoneModal.endName} onChange={(event) => updateEventZone(activeEventZoneModal.id, { endName: event.target.value })} /></label>
              <label>Start: {formatNumber(activeEventZoneModal.startPosition, 2)}
                <input type="range" min="0" max={activeMaxPosition} step="0.01" value={activeEventZoneModal.startPosition} onChange={(event) => updateEventZone(activeEventZoneModal.id, { startPosition: Number(event.target.value) })} />
              </label>
              <label>End: {formatNumber(activeEventZoneModal.endPosition, 2)}
                <input type="range" min="0" max={activeMaxPosition} step="0.01" value={activeEventZoneModal.endPosition} onChange={(event) => updateEventZone(activeEventZoneModal.id, { endPosition: Number(event.target.value) })} />
              </label>
              <p className="event-zone-help">Voyager exports this zone as two standard event triggers. Use the end event to cancel or stop the start event on the robot.</p>
              <button className="danger full-button" type="button" onClick={() => deleteEventZone(activeEventZoneModal.id)}>Delete event zone</button>
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
