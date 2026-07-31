import { useEntry } from "@frc-web-components/react";
import {
  AlertTriangle,
  Boxes,
  Eye,
  EyeOff,
  GitBranch,
  History,
  LocateFixed,
  Palette,
  Plus,
  Route,
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
import "./styles/style.css";

type OriginCorner = "bl" | "br" | "tl" | "tr";
type AddElementKind = "waypoint" | "rotationTarget" | "eventTrigger" | "eventZone" | "constraintZone";
type TreeKind = "path" | "if" | "loop" | "interrupt" | "event";
type ChildSlot = "next" | "true" | "false" | "forloop" | "interruptable";
type SaveStatusKind = "idle" | "saving" | "saved" | "error";
type LayoutMode = "default" | "horizontal" | "mirrored" | "focus";
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
const VOYAGER_VERSION = "3.1.1-alpha";
const PROJECT_METADATA_FILE = "metadata.json";
const NODE_WIDTH = 160;
const NODE_HEIGHT = 62;

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
    name: "Voyager Core",
    description: "The familiar teal and cyan command-center palette.",
    palette: { background: "#090d14", panel: "#0f1521", panel2: "#121a2a", panel3: "#172033", text: "#e5ecf7", muted: "#94a3b8", faint: "#64748b", accent: "#5eead4", accent2: "#38bdf8", border: "#263447", borderStrong: "#52647b", warn: "#facc15", danger: "#fb7185", success: "#86efac" },
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
    name: "Precision Grid",
    source: "Vercel-inspired DESIGN.md",
    description: "Tight geometric type, four-pixel rhythm, restrained elevation, and compact six-pixel controls.",
    bodyFont: "Inter, system-ui, -apple-system, 'Segoe UI', sans-serif",
    displayFont: "Inter, system-ui, -apple-system, 'Segoe UI', sans-serif",
    monoFont: "'IBM Plex Mono', ui-monospace, SFMono-Regular, Menlo, monospace",
    baseFontSize: "13px",
    navHeight: "52px",
    controlHeight: "32px",
    panelPadding: "12px",
    radiusSmall: "6px",
    radiusMedium: "8px",
    radiusLarge: "12px",
    buttonRadius: "6px",
    shadow: "0 10px 32px rgba(0, 0, 0, 0.2)",
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
  return { waypoints: [], rotationTargets: [], events: [], eventZones: [], constraintZones: [] };
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
  const cleaned = name.trim().replace(/[<>:"/\\|?*\x00-\x1F]/g, "_").replace(/\s+/g, "_");
  return cleaned.length > 0 ? cleaned : "Unnamed_Path";
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
  const amount = [0.34, 0.28, 0.21, 0.13, 0.06][settings.plannerSharpness];
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

  const requestedCell = [0.42, 0.34, 0.27, 0.21, 0.16][settings.plannerWaypointDensity];
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
  const turnPenalty = [1.4, 0.9, 0.52, 0.2, 0.04][settings.plannerSharpness];

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

function handoffCircleStyle(settings: Settings, size: FieldSize, waypoint: Waypoint): CSSProperties {
  const center = pointToPixels(settings, size, waypoint);
  const pixelsPerMeter = Math.max(0, Math.min(
    size.width / safePositive(settings.fieldLengthMeters, DEFAULT_SETTINGS.fieldLengthMeters),
    size.height / safePositive(settings.fieldWidthMeters, DEFAULT_SETTINGS.fieldWidthMeters),
  ));
  const diameter = Math.max(8, waypoint.handoff * 2 * pixelsPerMeter);
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
  const normalizePath = (path: Partial<SharedPathData> | null | undefined): SharedPathData => ({
    waypoints: Array.isArray(path?.waypoints) ? path.waypoints : [],
    rotationTargets: Array.isArray(path?.rotationTargets) ? path.rotationTargets : [],
    events: Array.isArray(path?.events) ? path.events : [],
    eventZones: Array.isArray(path?.eventZones) ? path.eventZones : [],
    constraintZones: Array.isArray(path?.constraintZones) ? path.constraintZones : [],
  });
  const pathDataByName = value.pathDataByName && typeof value.pathDataByName === "object"
    ? Object.fromEntries(Object.entries(value.pathDataByName).map(([name, path]) => [name, normalizePath(path)]))
    : {};
  const normalizedSettings: Settings = {
      ...DEFAULT_SETTINGS,
      ...value.settings,
      customTheme: { ...DEFAULT_SETTINGS.customTheme, ...value.settings?.customTheme },
      plannerWaypointDensity: normalizePlannerLevel(value.settings?.plannerWaypointDensity),
      plannerSharpness: normalizePlannerLevel(value.settings?.plannerSharpness),
      designPreset: DESIGN_PRESETS.some((preset) => preset.id === value.settings?.designPreset)
        ? value.settings.designPreset
        : DEFAULT_DESIGN.id,
      showObstacleZones: typeof value.settings?.showObstacleZones === "boolean"
        ? value.settings.showObstacleZones
        : DEFAULT_SETTINGS.showObstacleZones,
    };
  return {
    settings: normalizedSettings,
    treeNodes: Array.isArray(value.treeNodes) ? value.treeNodes : [],
    pathDataByName,
    knownPathFileNames: Array.isArray(value.knownPathFileNames) ? value.knownPathFileNames.filter((name): name is string => typeof name === "string") : [],
    activePathNodeId: value.activePathNodeId ?? null,
    pan: value.pan ?? { x: 0, y: 0 },
    obstacles: Array.isArray(value.obstacles) ? value.obstacles.map((obstacle, index) => normalizeObstacle(obstacle, index, normalizedSettings)) : [],
    activityLog: Array.isArray(value.activityLog) ? value.activityLog.filter((entry) => entry && typeof entry.id === "string" && typeof entry.message === "string" && Number.isFinite(entry.timestamp)) : [],
    selectedTreeNodeId: typeof value.selectedTreeNodeId === "string" ? value.selectedTreeNodeId : null,
    treeModalRect: value.treeModalRect ?? { x: 420, y: 18, width: 520, height: 520 },
    treeModalMinimized: Boolean(value.treeModalMinimized),
    playbackModalPosition: value.playbackModalPosition ?? { x: 28, y: 84 },
    versionHistory: Array.isArray(value.versionHistory) ? value.versionHistory.map((snapshot) => ({
      ...snapshot,
      treeNodes: Array.isArray(snapshot.treeNodes) ? snapshot.treeNodes : [],
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
    const attach = (): void => {
      const element = ref.current;
      if (!element) {
        animationFrame = globalThis.requestAnimationFrame(attach);
        return;
      }
      update = () => setSize({ width: element.clientWidth, height: element.clientHeight });
      update();
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

const EDITOR_HISTORY_LIMIT = 100;
const EDITOR_HISTORY_COMMIT_DELAY_MS = 250;
const VERSION_HISTORY_LIMIT = 80;

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
  const [fieldOneRef, fieldOneSize] = useElementSize<HTMLDivElement>();
  const [fieldTwoRef, fieldTwoSize] = useElementSize<HTMLDivElement>();
  const [treeViewportRef, treeViewportSize] = useElementSize<HTMLDivElement>();
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
  const [liveVelocity, setLiveVelocity] = useState<RobotVelocity>({ vx: 0, vy: 0, omega: 0 });
  const [livePoseTrail, setLivePoseTrail] = useState<Pose2d[]>([]);
  const [renamingNodeId, setRenamingNodeId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState("");
  const [activeRotationHandleId, setActiveRotationHandleId] = useState<string | null>(null);
  const [nt4AddressDraft, setNt4AddressDraft] = useState(nt4Address);
  const persistTimerRef = useRef<number | null>(null);
  const autoSaveTimerRef = useRef<number | null>(null);
  const metadataAutoSaveTimerRef = useRef<number | null>(null);
  const historyCommitTimerRef = useRef<number | null>(null);
  const contextMenuRef = useRef<HTMLDivElement>(null);
  const elementModalRef = useRef<HTMLDivElement>(null);
  const playbackModalRef = useRef<HTMLDivElement>(null);
  const playbackRobotRef = useRef<HTMLDivElement>(null);
  const playbackTimelineRef = useRef<HTMLInputElement>(null);
  const playbackTimeLabelRef = useRef<HTMLSpanElement>(null);
  const focusTreeModalRef = useRef<HTMLElement>(null);
  const editorHistoryRef = useRef<EditorHistory | null>(null);
  const versionHistoryRef = useRef<VersionHistorySnapshot[]>([]);
  const editorSnapshotRef = useRef<EditorSnapshot>({ treeNodes, pathDataByName, activePathNodeId });
  const applyingHistoryRef = useRef(false);
  const [, setHistoryRevision] = useState(0);
  const playbackAnimationFrameRef = useRef<number | null>(null);
  const playbackTimeRef = useRef(0);
  const treeClipboardRef = useRef<TreeClipboardSnapshot | null>(null);
  const clipboardPasteCountRef = useRef(0);
  const previousLivePoseRef = useRef<{ pose: Pose2d; timestamp: number } | null>(null);
  const wasRobotConnectedRef = useRef(false);
  const draggingModalRef = useRef<{ offsetX: number; offsetY: number } | null>(null);
  const dragOperationRef = useRef<(() => void) | null>(null);
  const [connected] = useEntry<boolean>("/AdvantageKit/DriverStation/DSAttached", false);
  const [poseStruct] = useEntry<Uint8Array>(
    "/AdvantageKit/RealOutputs/Odometry/Robot",
    new Uint8Array([...new Array(24).fill(0)]),
  );
  const [, setSelectedAutoEntry] = useEntry<string>("/Voyager/SelectedAuto", "");

  versionHistoryRef.current = versionHistory;

  const setSaveStatus = useCallback((status: SaveStatus): void => {
    setSaveStatusState(status);
    if (!status.message.trim()) return;
    setActivityLog((entries) => [...entries, {
      ...status,
      id: createId("activity"),
      timestamp: Date.now(),
    }]);
  }, []);

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
  const playbackPlan = useMemo(() => buildPlaybackPlan(activePathData, settings), [activePathData, settings]);
  const playbackPose = poseAtPlaybackTime(activePathData, playbackPlan, playbackTimeRef.current);
  const playbackVelocity = playbackVelocityAtTime(activePathData, playbackPlan, playbackTimeRef.current);
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
  const livePose: Pose2d = connected ? parsePose2d(poseStruct) : { x: 0, y: 0, rotation: 0 };
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

  useEffect(() => {
    if (!connected || !Number.isFinite(livePose.x) || !Number.isFinite(livePose.y) || !Number.isFinite(livePose.rotation)) {
      previousLivePoseRef.current = null;
      setLiveVelocity({ vx: 0, vy: 0, omega: 0 });
      return;
    }

    const timestamp = performance.now();
    const previous = previousLivePoseRef.current;
    if (previous) {
      const elapsed = (timestamp - previous.timestamp) / 1000;
      if (elapsed >= 0.005 && elapsed <= 1) {
        setLiveVelocity({
          vx: (livePose.x - previous.pose.x) / elapsed,
          vy: (livePose.y - previous.pose.y) / elapsed,
          omega: (shortestAngleDelta(
            (previous.pose.rotation * 180) / Math.PI,
            (livePose.rotation * 180) / Math.PI,
          ) * Math.PI) / 180 / elapsed,
        });
      }
    }
    previousLivePoseRef.current = { pose: livePose, timestamp };
    setLivePoseTrail((trail) => {
      const last = trail.at(-1);
      if (last && distanceBetween(last, livePose) < 0.01 && Math.abs(shortestAngleDelta(
        (last.rotation * 180) / Math.PI,
        (livePose.rotation * 180) / Math.PI,
      )) < 0.5) return trail;
      return [...trail, livePose];
    });
  }, [connected, livePose.rotation, livePose.x, livePose.y]);

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
          setActivityLog(stored.activityLog ?? []);
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
    }, 250);
  }, [activePathNodeId, activityLog, hydrated, knownPathFileNames, obstacles, pan, pathDataByName, playbackModalPosition, selectedTreeNodeId, settings, treeModalMinimized, treeModalRect, treeNodes, versionHistory]);

  const updateSettings = useCallback((patch: Partial<Settings>): void => {
    setSettings((previous) => ({ ...previous, ...patch }));
  }, []);

  const recordVersionSnapshot = useCallback((source: VersionHistorySnapshot["source"], state?: EditorSnapshot): VersionHistorySnapshot[] => {
    const snapshot = copyEditorSnapshot(state ?? { treeNodes, pathDataByName, activePathNodeId });
    const history = versionHistoryRef.current;
    const latest = history.at(-1);
    const sameAsLatest = latest
      && JSON.stringify(latest.treeNodes) === JSON.stringify(snapshot.treeNodes)
      && JSON.stringify(latest.pathDataByName) === JSON.stringify(snapshot.pathDataByName)
      && latest.activePathNodeId === snapshot.activePathNodeId
      && JSON.stringify(latest.obstacles ?? []) === JSON.stringify(obstacles);
    if (sameAsLatest) return history;
    const nextHistory = [...history, { ...snapshot, obstacles: obstacles.map((obstacle) => ({ ...obstacle })), id: createId("version"), timestamp: Date.now(), source } as VersionHistorySnapshot].slice(-VERSION_HISTORY_LIMIT);
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
      setActiveRotationHandleId(`waypoint-${waypoint.id}`);

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
        setActiveRotationHandleId(null);
        window.removeEventListener("pointermove", onPointerMove);
        window.removeEventListener("pointerup", onPointerUp);
        dragOperationRef.current = null;
      };

      window.addEventListener("pointermove", onPointerMove);
      window.addEventListener("pointerup", onPointerUp);
      dragOperationRef.current = () => {
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
      setActiveRotationHandleId(`target-${target.id}`);

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
        setActiveRotationHandleId(null);
        window.removeEventListener("pointermove", onPointerMove);
        window.removeEventListener("pointerup", onPointerUp);
        dragOperationRef.current = null;
      };

      window.addEventListener("pointermove", onPointerMove);
      window.addEventListener("pointerup", onPointerUp);
      dragOperationRef.current = () => {
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

    const onPointerMove = (moveEvent: PointerEvent): void => {
      nextX = clamp(startRect.x + moveEvent.clientX - startPointer.x, 0, Math.max(0, bounds.width - startRect.width));
      nextY = clamp(startRect.y + moveEvent.clientY - startPointer.y, 0, Math.max(0, bounds.height - 42));
      modalElement.style.transform = `translate3d(${nextX - startRect.x}px, ${nextY - startRect.y}px, 0)`;
    };
    const onPointerUp = (): void => {
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

    const onPointerMove = (moveEvent: PointerEvent): void => {
      nextWidth = clamp(startRect.width + moveEvent.clientX - startPointer.x, 320, Math.max(320, bounds.width - startRect.x));
      nextHeight = clamp(startRect.height + moveEvent.clientY - startPointer.y, 230, Math.max(230, bounds.height - startRect.y));
      modalElement.style.width = `${nextWidth}px`;
      modalElement.style.height = `${nextHeight}px`;
    };
    const onPointerUp = (): void => {
      modalElement.classList.remove("is-resizing");
      setTreeModalRect((current) => ({ ...current, width: nextWidth, height: nextHeight }));
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      dragOperationRef.current = null;
    };
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    dragOperationRef.current = () => {
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
      if (!moved) {
        setSelectedTreeNodeId(node.id);
        if (node.kind === "path") activatePathNode(node.id);
      }
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

    const onPointerMove = (moveEvent: PointerEvent): void => {
      const offset = draggingModalRef.current;
      if (!offset) return;
      nextX = clamp(moveEvent.clientX - appRect.left - offset.offsetX, 4, appRect.width - 260);
      nextY = clamp(moveEvent.clientY - appRect.top - offset.offsetY, 44, appRect.height - 120);
      modalElement.style.transform = `translate3d(${nextX - modal.x}px, ${nextY - modal.y}px, 0)`;
    };

    const onPointerUp = (): void => {
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

    const onPointerMove = (moveEvent: PointerEvent): void => {
      nextX = clamp(moveEvent.clientX - appRect.left - offset.x, 4, Math.max(4, appRect.width - 564));
      nextY = clamp(moveEvent.clientY - appRect.top - offset.y, 44, Math.max(44, appRect.height - 190));
      modalElement.style.transform = `translate3d(${nextX - playbackModalPosition.x}px, ${nextY - playbackModalPosition.y}px, 0)`;
    };
    const onPointerUp = (): void => {
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
      setActivityLog(projectState.activityLog ?? []);
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

  const publishSelectedRoutine = useCallback((): void => {
    if (!selectedRoutineCode) {
      setError("Select a routine in the path tree before publishing.");
      return;
    }

    setLivePoseTrail(connected ? [livePose] : []);
    previousLivePoseRef.current = connected ? { pose: livePose, timestamp: performance.now() } : null;
    setSelectedAutoEntry(selectedRoutineCode);
    setSaveStatus({ kind: "saved", message: `Published routine ${selectedRoutineCode} to /Voyager/SelectedAuto.` });
  }, [connected, livePose.rotation, livePose.x, livePose.y, selectedRoutineCode, setError, setSelectedAutoEntry]);

  useEffect(() => {
    if (!hydrated) return;
    const justConnected = connected && !wasRobotConnectedRef.current;
    wasRobotConnectedRef.current = connected;
    if (justConnected && settings.autoPublishOnConnect && selectedRoutineCode) publishSelectedRoutine();
  }, [connected, hydrated, publishSelectedRoutine, selectedRoutineCode, settings.autoPublishOnConnect]);

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
    if (!hydrated || !settings.autoSave) return;
    if (autoSaveTimerRef.current) window.clearTimeout(autoSaveTimerRef.current);
    autoSaveTimerRef.current = window.setTimeout(() => {
      if (settings.robotCodeProjectFolder) void saveAll("auto");
      else recordVersionSnapshot("auto");
    }, 900);
  }, [hydrated, obstacles, pathDataByName, recordVersionSnapshot, saveAll, settings.autoSave, settings.robotCodeProjectFolder, treeNodes]);

  useEffect(() => {
    if (!hydrated || !settings.autoSaveMetadata || settings.autoSave || !settings.robotCodeProjectFolder) return;
    if (metadataAutoSaveTimerRef.current) window.clearTimeout(metadataAutoSaveTimerRef.current);
    metadataAutoSaveTimerRef.current = window.setTimeout(() => {
      void writeProjectMetadata().catch((error: unknown) => {
        console.error("Could not automatically save Voyager metadata.", error);
      });
    }, 1_000);
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
    const onPointerMove = (moveEvent: PointerEvent): void => move(moveEvent.clientX, moveEvent.clientY);
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
    const onPointerMove = (moveEvent: PointerEvent): void => resize(moveEvent.clientX, moveEvent.clientY);
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
      <header className="voyager-nav">
        <div className="nav-left">
          <div className="app-icon" aria-hidden="true">V</div>
          <strong className="app-name">Voyager</strong>
          <span className="version-chip">{VOYAGER_VERSION}</span>
          <button className="nav-button" type="button" onClick={(event) => { event.stopPropagation(); setSaveModalOpen(true); }}>
            Save
          </button>
          <button className="nav-button" type="button" onClick={(event) => { event.stopPropagation(); setSettingsOpen(true); }}>
            Settings
          </button>
          <button className="nav-button" type="button" onClick={(event) => { event.stopPropagation(); setVersionHistoryOpen(true); }}>
            Version History
          </button>
          <Button
            variant="outline"
            size="sm"
            className="nav-button obstacle-map-button"
            onClick={(event) => {
              event.stopPropagation();
              setObstaclesOpen(true);
            }}
          >
            <Boxes data-icon="inline-start" />
            Obstacle Map
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="nav-button preferences-button"
            onClick={(event) => {
              event.stopPropagation();
              setPreferencesOpen(true);
            }}
          >
            <Palette data-icon="inline-start" />
            Preferences
          </Button>
          <div className="layout-switcher" aria-label="Workspace layout" onClick={(event) => event.stopPropagation()}>
            <span className="layout-switcher-label">Layout</span>
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

      <main ref={workspaceRef} className="workspace">
        <section ref={leftPanelRef} className="left-panel">
          <section className="field-card auto-field-card">
            <div className="field-toolbar">
              <div>
                <h2>Auto maker field</h2>
                <p>{activePathName ? `Editing ${activePathName}` : "Select a path block to edit"}</p>
              </div>
              <div className="field-actions">
                {settings.layoutMode === "focus" ? (
                  <div className="focus-connection-actions">
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
                ) : null}
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
                <select value={addElementKind} onChange={(event) => setAddElementKind(event.target.value as AddElementKind)}>
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
                  return <line key={`${previous.id}-${waypoint.id}`} className="path-line" x1={a.x} y1={a.y} x2={b.x} y2={b.y} />;
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
                  onPointerDown={(event) => {
                    if (pathPlannerActive) selectPlannerWaypoint(event, waypoint);
                    else beginWaypointDrag(event, waypoint);
                  }}
                  onDoubleClick={(event) => {
                    event.stopPropagation();
                    addWaypointAfterIfLast(waypoint);
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
                    onPointerDown={(event) => beginPathPositionDrag(event, (position) => updateRotationTarget(target.id, { position }))}
                    onClick={(event) => {
                      event.stopPropagation();
                      const pos = modalPositionFromEvent(event);
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

              {settings.layoutMode === "focus" ? (
                <>
                  {livePoseTrail.length > 1 ? (
                    <svg className="field-svg live-trail-svg" viewBox={`0 0 ${Math.max(1, fieldOneSize.width)} ${Math.max(1, fieldOneSize.height)}`} aria-hidden="true">
                      <polyline
                        className="live-pose-trail"
                        points={livePoseTrail.map((pose) => {
                          const point = pointToPixels(settings, fieldOneSize, pose);
                          return `${point.x},${point.y}`;
                        }).join(" ")}
                      />
                    </svg>
                  ) : null}
                  <div
                    className="robot-marker live-robot-marker focus-live-robot-marker"
                    style={robotRenderStyle(settings, fieldOneSize, livePose.x, livePose.y, normalizeCompassDegrees((livePose.rotation * 180) / Math.PI))}
                    aria-label={connected ? "Connected live robot pose" : "Disconnected robot pose at 0,0"}
                  >
                    <SwerveModules
                      settings={settings}
                      velocity={liveVelocity}
                      headingDegrees={normalizeCompassDegrees((livePose.rotation * 180) / Math.PI)}
                    />
                  </div>
                </>
              ) : null}

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

          <section className="field-card live-field-card">
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
            <div className="field-scroll-shell" aria-label="Scrollable live robot field">
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
              {livePoseTrail.length > 1 ? (
                <svg className="field-svg live-trail-svg" viewBox={`0 0 ${Math.max(1, fieldTwoSize.width)} ${Math.max(1, fieldTwoSize.height)}`} aria-hidden="true">
                  <polyline
                    className="live-pose-trail"
                    points={livePoseTrail.map((pose) => {
                      const point = pointToPixels(settings, fieldTwoSize, pose);
                      return `${point.x},${point.y}`;
                    }).join(" ")}
                  />
                </svg>
              ) : null}
              <div
                className="robot-marker live-robot-marker"
                style={robotRenderStyle(settings, fieldTwoSize, livePose.x, livePose.y, normalizeCompassDegrees((livePose.rotation * 180) / Math.PI))}
              >
                <SwerveModules
                  settings={settings}
                  velocity={liveVelocity}
                  headingDegrees={normalizeCompassDegrees((livePose.rotation * 180) / Math.PI)}
                />
              </div>
              </div>
            </div>
          </section>
        </section>

        <div
          className="panel-divider"
          role="separator"
          aria-orientation={settings.layoutMode === "horizontal" ? "horizontal" : "vertical"}
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
            const onPointerMove = (moveEvent: PointerEvent): void => {
              if (settings.layoutMode === "horizontal") {
                const nextHeight = clamp(startHeight + moveEvent.clientY - startY, 240, workspaceBounds.height - 220);
                workspace.style.gridTemplateRows = `${nextHeight}px 8px minmax(220px, 1fr)`;
                return;
              }
              const direction = settings.layoutMode === "mirrored" ? -1 : 1;
              const nextWidth = clamp(startWidth + (moveEvent.clientX - startX) * direction, 260, workspaceBounds.width - 320);
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

          <div ref={treeViewportRef} className="tree-viewport" onPointerDown={beginTreePan} onDoubleClick={resetTreePan} onContextMenu={showCanvasMenu}>
            {visiblePathNodeCount === 0 ? (
              <div className="tree-visibility-warning" role="status">
                <AlertTriangle aria-hidden="true" />
                <span>{pathTreeNodes.length === 0 ? "No path blocks exist yet." : "No path blocks are visible."}</span>
                {pathTreeNodes.length > 0 ? <button type="button" onClick={(event) => { event.stopPropagation(); focusNearestPathNode(); }}>Recover</button> : null}
              </div>
            ) : null}
            <svg className="tree-svg" style={{ transform: `translate(${pan.x}px, ${pan.y}px)`, pointerEvents: "auto" }} width="3200" height="2200">
              {treeEdges.map(({ parent, child, label, slot }) => {
                const geometry = nearestTreeEdgeGeometry(parent, child);
                const d = `M ${geometry.start.x} ${geometry.start.y} C ${geometry.startControl.x} ${geometry.startControl.y}, ${geometry.endControl.x} ${geometry.endControl.y}, ${geometry.end.x} ${geometry.end.y}`;
                return (
                  <g key={`${parent.id}-${child.id}-${slot}`}>
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
              })}
            </svg>
            <div className="tree-nodes-layer" style={{ transform: `translate(${pan.x}px, ${pan.y}px)` }}>
              {treeNodes.map((node) => (
                <div
                  key={node.id}
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
          {settings.layoutMode === "focus" && !treeModalMinimized ? (
            <button className="tree-resize-handle" type="button" aria-label="Resize path tree" onPointerDown={beginTreeModalResize} />
          ) : null}
        </section>
      </main>

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
          style={{ left: `${playbackModalPosition.x}px`, top: `${playbackModalPosition.y}px` }}
          onClick={(event) => event.stopPropagation()}
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
          <div className="settings-modal" onClick={(event) => event.stopPropagation()}>
            <div className="modal-titlebar">
              <div>
                <strong>Settings</strong>
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
                      const onPointerMove = (moveEvent: PointerEvent): void => updateCenter(moveEvent.clientX, moveEvent.clientY);
                      const onPointerUp = (): void => {
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
                    <input type="number" min="0.001" step="0.01" value={settings.defaultIntermediateHandOffRadiusMeters} onChange={(event) => updateSettings({ defaultIntermediateHandOffRadiusMeters: safePositive(Number(event.target.value), DEFAULT_SETTINGS.defaultIntermediateHandOffRadiusMeters) })} />
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
        <div ref={elementModalRef} className="element-modal" style={{ left: `${modal.x}px`, top: `${modal.y}px` }} onClick={(event) => event.stopPropagation()}>
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
              <label>Handoff (m)<input type="number" step="0.01" value={formatNumber(activeWaypointModal.handoff, 3)} onChange={(event) => updateWaypoint(activeWaypointModal.id, { handoff: safePositive(Number(event.target.value), settings.defaultIntermediateHandOffRadiusMeters) })} /></label>
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
