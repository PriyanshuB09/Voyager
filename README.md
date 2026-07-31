<p align="center">
  <img src="assets/icons/icon.png" alt="Voyager logo" width="128" />
</p>

<h1 align="center">Voyager</h1>

<p align="center">
  A visual desktop autonomous builder for FIRST Robotics Competition teams.
</p>

Voyager lets an FRC team build an autonomous routine as a branching tree, draw and tune each path on a field, plan collision-free routes around measured obstacles, preview the robot's motion, save the complete workspace into a WPILib project, and publish the selected routine to the robot over NT4. This guide covers the Voyager 3.1.3-alpha workflow.

## Contents

- [Install Voyager](#install-voyager)
- [Install the robot-side library](#install-the-robot-side-library)
- [Understand the workspace](#understand-the-workspace)
- [First-time configuration](#first-time-configuration)
- [Build an autonomous routine](#build-an-autonomous-routine)
- [Edit a path](#edit-a-path)
- [Map obstacles and generate a path](#map-obstacles-and-generate-a-path)
- [Preview a path](#preview-a-path)
- [Use live robot telemetry](#use-live-robot-telemetry)
- [Select and publish a routine](#select-and-publish-a-routine)
- [Save and export](#save-and-export)
- [Version history](#version-history)
- [Layouts and appearance](#layouts-and-appearance)
- [Notifications and activity history](#notifications-and-activity-history)
- [Keyboard shortcuts](#keyboard-shortcuts)
- [Generated file format](#generated-file-format)
- [Development](#development)

## Install Voyager

Download Voyager from the repository's [GitHub Releases](https://github.com/PriyanshuB09/Voyager/releases).

| Package | Best for |
| --- | --- |
| `Voyager Setup 3.1.3-alpha.exe` | Normal Windows installation |
| `Voyager 3.1.3-alpha.exe` | Running Voyager without installing it |

The Windows packages are not digitally code-signed, so SmartScreen may show an **Unknown publisher** warning. Only run packages obtained from the official repository.

## Install the robot-side library

Voyager is designed to work with [VoyagerLib](https://github.com/PriyanshuB09/VoyagerLib-Public), the companion WPILib vendor dependency that reads Voyager's generated autonomous configuration.

In the robot project:

1. Open the WPILib Command Palette.
2. Choose **WPILib: Manage Vendor Libraries**.
3. Choose the option to install a new library from an online URL.
4. Enter:

   ```text
   https://priyanshub09.github.io/VoyagerLib-Public/VoyagerLib.json
   ```

The current public vendordep targets the 2026 FRC season and provides the Java artifact `com.team4188:voyager`.

### Powered by BLine

VoyagerLib's backend pathing and autonomous execution logic is powered by BLine, an open-source robotics library created by Edan Liahovetsky and Rebel Robotics (FRC 2638). BLine is a dependency of VoyagerLib and is licensed under the BSD 3-Clause License.

Copyright (c) 2025, Edan Liahovetsky<br>
Copyright (c) 2025, Rebel Robotics (FRC 2638)

VoyagerLib is not endorsed by, sponsored by, or officially affiliated with Edan Liahovetsky or Rebel Robotics unless otherwise stated. See [`THIRD_PARTY_NOTICES.md`](./THIRD_PARTY_NOTICES.md) for the complete license and attribution text.

## Understand the workspace

Voyager has three primary work areas and a top navigation bar.

### Top navigation

The top bar contains:

- **Save**, which opens a centered, background-blurring modal for path export, metadata saving, automatic saving, and publishing on robot connect.
- **Version History**, which opens restorable snapshots of the full path tree and path collection.
- **Obstacle Map**, a full-field measured obstacle editor used by the path planner.
- **Settings**, for the field, robot, constraints, controllers, NT4, and robot-project destination.
- **Preferences**, for built-in/custom color themes and five complete interface designs.
- **Layout**, with four ways to arrange the workspace.
- A status message. Hover a visible message to reveal the activity-log button.

Drag an unoccupied part of the top navigation bar to move the desktop window. Buttons and inputs remain interactive and do not initiate window dragging.

Application chrome, labels, field elements, and tree content cannot be accidentally text-highlighted while operating Voyager. Text selection remains available inside text and number inputs.

### Auto maker field

This is where the selected path is edited and simulated. Its toolbar contains:

- **Undo** and **Redo**.
- **More Tools**, a dropdown containing **Mirror X**, **Mirror Y**, obstacle-overlay visibility, and waypoint handoff-radius visibility.
- **Playback**, which toggles the path timeline window.
- **Plan path**, which collects a start and destination click and creates a collision-aware route.
- A path-element selector for **Waypoint**, **Rotation Target**, **Event Trigger**, **Event Zone**, or **Constraint Zone**.
- **Add**, which adds the selected element type.

The field keeps its configured aspect ratio. If a panel becomes narrower than its content, the field is preserved at full size and the panel becomes scrollable instead of cropping the field image.

### Live robot position

In the first three layouts, this field displays the live NT4 robot pose, connection state, persistent autonomous trail, and **Publish Routine** button. When disconnected, the robot is shown at `(0,0)`.

In Auto focus layout, there is no small picture-in-picture live field. The live robot pose and its white trail are drawn directly on the Auto maker field. The connection indicator and **Publish Routine** button move into the Auto maker toolbar.

### Path tree

The path tree describes the order and branching structure of the routine. Drag nodes to arrange them and drag the canvas to pan. Double-click the canvas to reset its pan. Connection curves automatically attach to the nearest left, right, top, or bottom side center on each node, so links approach from outside rather than crossing through a node when children are arranged in another direction. A node selected for keyboard actions receives a selection outline; nodes belonging to the routine selected for publishing use the routine highlight.

## First-time configuration

Open **Settings** before building the first routine.

### Field and project

1. Use **Field image** to choose the field background.
2. Choose **Select robot code project** and select the WPILib project root. Voyager shows the derived deploy destination below the button.
3. Enter the field **width** and **length** in meters.
4. Choose the corner representing field origin `(0,0)`: bottom-left, bottom-right, top-left, or top-right.

Voyager uses the dimensions and origin to convert all field pixels to meters. Both field views and every robot frame use the same physical scale, so the configured robot dimensions remain accurate in meters.

### NT4 connection

The NT4 address accepts any of the following:

- An FRC team number, such as `4188`.
- `localhost` for local testing.
- A direct address, such as `10.41.88.2`.
- A hostname, such as `roboRIO-4188-FRC.local`.

Enter the value and press Enter or select **Apply NT4 address**. **Localhost** fills the local address and **Clear** clears the draft. The current normalized provider appears beneath the controls.

### Robot dimensions and swerve geometry

Set **Robot length** and **Robot width** in meters. These values control the exact rendered frame size in the Auto maker field, Live robot position field, and Settings preview.

Use the robot preview or numeric inputs to set the center of rotation:

- Drag the dot in the preview to position it visually.
- Enter **Center X** and **Center Y** for precise values.

Use the four sliders to tune the swerve visualization:

- **Wheel length**.
- **Wheel width**.
- **Longitudinal offset**, the front/back module distance from the robot reference.
- **Lateral offset**, the left/right module distance from the robot reference.

The preview, simulated robot, and live robot all display four swerve modules. Wheel steering uses inverse kinematics based on translational velocity, rotational velocity, heading, center of rotation, and configured module positions.

### Global path constraints

Configure the default motion limits:

| Setting | Unit | Meaning |
| --- | --- | --- |
| Max translational velocity | m/s | Global linear speed limit |
| Max translational acceleration | m/s² | Global linear acceleration limit |
| Max rotational velocity | °/s | Global angular speed limit |
| Max rotational acceleration | °/s² | Global angular acceleration limit |
| End translation tolerance | m | Allowed final positional error |
| End rotation tolerance | ° | Allowed final heading error |
| Default intermediate handoff radius | m | Default distance for handing off between intermediate waypoints |

The default handoff radius is assigned to new waypoints. Each waypoint can override it later.

### Controllers

Enter independent `P`, `I`, and `D` gains for:

- The **translational controller**.
- The **CTE controller**, which handles cross-track error.
- The **rotational controller**.

These values are included in Voyager's playback-time model along with motion limits, local constraint zones, handoff radii, end tolerances, and rotation targets. The displayed duration is an estimate for planning and visualization; real robot timing still depends on the drivetrain, control loop, battery, traction, and robot-side implementation.

The **Obstacle-aware path planner** section has two five-position sliders:

- **Relative waypoint amount** controls A* search-grid spacing across five levels. The low and high endpoints map to their intended planner extremes, while straight runs are still collapsed to their endpoints instead of receiving spacing-only waypoints.
- **Relative path sharpness** controls turn penalties and safe corner rounding. Its low and high endpoints use the same corrected direction as the waypoint control, so the displayed level matches the generated-route behavior.

## Build an autonomous routine

### Add blocks

Use the **+** button in the path-tree toolbar, or right-click empty tree space, to create:

| Block | Purpose |
| --- | --- |
| Path | Runs a named path drawn in the Auto maker field |
| If | Splits execution into true and false branches |
| Loop | Runs a nested loop sequence, then continues afterward |
| Interruptable | Defines an interruptible nested sequence, then continues afterward |
| Event | Runs a named routine event between other blocks |

Right-click a block to add an appropriately connected child. If blocks already exist, the relationship controls can remove a parent or child and reconnect blocks. **Connect this block as parent** keeps the selected block as the parent and asks you to click its new child; **Connect this block as child** keeps it as the child and asks you to click its new parent. Voyager rejects connections that would create a cycle.

### Work with nodes

- Click a node to select it for keyboard operations.
- Drag a node to reposition it.
- Double-click a node to rename it. Press Enter to accept or Escape to cancel.
- Right-click a path and choose **Toggle editing** to open that path in the Auto maker field.
- Right-click a node and use **Toggle selected** or **Toggle select for routine** to select its root routine and descendants for publishing.
- Use the context menu's **Delete** command, or press Delete/Backspace, to delete the selected node and its child sequence.

Context menus automatically reposition to stay within the application window. If a menu is taller than the available space, it scrolls internally, so nodes near the bottom of the screen remain fully manageable.

### Copy and duplicate tree content

With a node selected:

- `Ctrl+C` copies the node and its entire child sequence.
- `Ctrl+V` pastes the copied content as a new independent sequence. Path data and names are cloned rather than shared.
- `Ctrl+D` duplicates only the selected node, without its children.

### Recover a lost tree

If no path nodes are visible, Voyager shows a warning at the upper-left of the tree. Select **Recover**, or use **Nearest path** in the tree toolbar, to center the closest path block. The resulting notification identifies the block that was centered.

## Edit a path

Select a path block for editing, then use the Auto maker toolbar to choose an element and press **Add**.

### Waypoints

A waypoint defines a robot position and heading.

- Drag the waypoint frame to change its X/Y position.
- Hold the rotation handle to lift it away from the frame, then drag it around the waypoint to change heading with a larger control radius. It returns to the frame perimeter when released.
- Double-click the last waypoint to append another waypoint after it.
- Open the waypoint editor to enter exact **X**, **Y**, **Rotation**, and **Handoff** values, toggle **Profiled**, or delete the waypoint.

The handoff circle around each waypoint shows its radius in meters. Choose **Hide handoff radii** from **More Tools** when those labels obstruct the field; choose **Show handoff radii** to restore them. Visibility does not change the saved radius values. A newly connected path can inherit the final waypoint of the preceding path as its starting waypoint.

### Rotation targets

A rotation target sets a desired heading at a fractional position along the path.

- Drag it along the path to change its position.
- Hold its rotation handle to lift it away from the frame, then drag it to set the angle. It returns to the frame perimeter when released.
- Open its editor to enter the rotation, adjust its position slider, toggle **Profiled**, or delete it.

Rotation targets affect the playback robot's orientation, swerve state, and estimated duration.

### Event triggers

An event trigger associates a robot command name with a position along the path. Drag the marker along the path, then use its editor to set the **Command name**, fine-tune the position, or delete the event.

### Event zones

An Event Zone has a named start event and end event. Drag its **S** and **E** handles along the path, then use its editor to configure both names and positions. Voyager exports it as two standard event triggers, so the end event can cancel or stop the start event according to robot-side behavior.

### Constraint zones

A constraint zone overrides motion limits for part of a path. Drag its start and end handles along the path, then edit:

- Maximum translational velocity.
- Maximum translational acceleration.
- Maximum rotational velocity.
- Maximum rotational acceleration.
- Start and end path positions.

Constraint zones are drawn over the affected path section and are included in both serialization and playback-time estimation.

### Undo and redo

Use the Auto maker toolbar or `Ctrl+Z` and `Ctrl+Y`. Voyager keeps up to 100 editor-history snapshots. Shortcuts are ignored while typing in an input, select, or editable text control.

## Map obstacles and generate a path

Open **Obstacle Map** from the top navigation. The editor displays the complete field at its configured meter scale and remains scrollable when the window is narrower than the field.

1. Press **Add obstacle**.
2. Drag the obstacle rectangle so it covers the physical field obstacle.
3. Drag inside the rectangle to move it. Drag its left, right, top, or bottom edge to pull that side independently, or use the inspector for exact **Center X**, **Center Y**, **Length X**, and **Width Y** values in meters.
4. Repeat for every obstacle that the generated route must avoid.

The right-side obstacle list shows every obstacle, its coordinates and dimensions, and an inline editable name. Select a row to locate its matching rectangle. Obstacle coordinates follow the origin selected in Settings, and Voyager saves the map with the project workspace.

Open **More Tools** in the Auto maker toolbar and choose **Hide obstacles** when the clearance overlays obscure path editing. The planner continues honoring every mapped obstacle while the overlays are hidden; reopen the menu and choose **Show obstacles** to reveal them again.

To generate a route, select a path block and press **Plan path** beside Undo/Redo. Either click an empty start point or click an existing waypoint to use that waypoint as the pathfinding start, then click the destination. The optimized A* planner:

- Inflates every obstacle by the configured robot length and width so the robot frame does not clip it.
- Searches eight directions with a tunable turn penalty.
- Removes redundant grid nodes using collision-checked line of sight.
- Rounds safe corners, then removes forward-collinear points so uninterrupted straight sections contain only the required endpoints.
- Clamps existing rotation targets, event triggers, Event Zones, and constraint zones to the generated path range.

Starting from empty field space replaces the selected path's waypoint list. Starting from an existing waypoint preserves the routine through that waypoint and replaces only the remaining segment with the generated route. All generated waypoints remain fully editable. If either endpoint is in collision or no route exists, Voyager leaves the path unchanged and reports the problem.

## Preview a path

Press **Playback** beside Undo and Redo. The playback window is draggable by its title bar, remains open when clicking elsewhere, and closes only when **Playback** is toggled again or its close button is pressed.

The playback controls provide:

- **Play/Pause** for looping playback.
- **Reset** to pause and return to the start.
- A draggable video-style timeline for seeking to any time.
- Current time and total time.
- Separate motion and controller-settling estimates.

The simulated robot moves only on the Auto maker field. It displays the configured robot frame and four swerve modules; their steering angles respond to the simulated translational and rotational velocity through inverse kinematics.

The estimated total uses trapezoidal translational and rotational motion limits and accounts for local constraint zones, rotation targets, intermediate waypoint handoffs, controller gains, and final tolerances. Playback repeats continuously while playing.

## Use live robot telemetry

Voyager displays the robot's NT4 pose when connected. The live robot uses the same dimensions, center of rotation, wheel geometry, and field scale as the simulated robot. Its swerve modules respond to velocity inferred from consecutive live poses.

When a routine is published, Voyager begins a solid white pose trail at the current robot pose. The trail does not fade and remains visible throughout the autonomous routine.

- In default, horizontal, and mirrored layouts, the pose and trail appear in **Live robot position**.
- In Auto focus layout, the live pose and trail are overlaid directly on the **Auto maker field**.
- When disconnected, Voyager shows the live pose at `(0,0)` and labels the connection as offline.

The playback robot and live robot are separate overlays: playback visualizes the planned path, while the live pose represents robot telemetry.

## Select and publish a routine

1. Right-click a block in the intended routine.
2. Choose **Toggle selected** or **Toggle select for routine**. Voyager selects the root auto and its descendants and displays the routine highlight.
3. Verify the connection indicator.
4. Press **Publish Routine**.

Voyager publishes the selected routine code to:

```text
/Voyager/SelectedAuto
```

Publishing while connected also resets the persistent live trail to the robot's current pose. The computer and robot must be reachable on the same network for live NT4 communication.

## Save and export

First choose the robot project in **Settings**. Voyager writes files to:

```text
<robot-project>/src/main/deploy/voyager/
```

Open **Save** in the top navigation. The screen-centered modal blurs the workspace behind it and offers:

- **Save this path** to write only the path currently open for editing.
- **Save all paths** to write every path plus `auto_config.json`.
- **Save paths automatically** to export all content shortly after a tree or path edit.
- **Save metadata now** to write the complete workspace without exporting the path files.
- **Save metadata automatically** to keep the project metadata synchronized independently of automatic path export.
- **Publish selected auto on connect** to publish the selected routine whenever a robot connection is detected.

Path names are converted to safe filenames. **Save all paths** also deletes stale generated path files that no longer correspond to a path-tree block. Voyager's editor state and preferences are additionally persisted locally between application sessions.

Every save also writes the portable workspace file:

```text
<robot-project>/src/main/deploy/voyager/assets/metadata.json
```

This metadata contains the current settings, field image, obstacle map, paths, path tree, active selection, canvas position, generated-file inventory, and complete snapshot history. Selecting a robot project discovers its saved snapshots. Use **Load project metadata** in Version History when you intentionally want to replace the open workspace with the project copy.

Generated files should normally be committed with the robot project so autonomous definitions are version-controlled beside the code that executes them.

Open **More Tools** in the Auto maker toolbar and choose **Mirror X** or **Mirror Y** to reflect the selected path over that coordinate. Waypoint and rotation-target headings are mirrored too, while event and constraint positions remain on the same path positions.

## Version history

**Version History** contains restorable manual and auto-save snapshots of the entire path tree, all paths, and the obstacle map. The scrollable modal uses one continuous Git-style timeline on the left, with a checkpoint for every timestamped snapshot. Counts for paths, tree blocks, and waypoints are shown as readable values instead of compressed comparison bars.

- Saving creates a manual snapshot.
- Enabling **Save paths automatically** creates auto-save snapshots after edits, even before selecting a robot project folder.
- **Restore** replaces the active tree and path data with the selected snapshot.
- Voyager retains the newest 80 snapshots locally and mirrors them into the robot project's `voyager/assets/metadata.json` file on save.

## Layouts and appearance

### Workspace layouts

Use the four diagram buttons under **Layout**:

1. **Default**: Auto maker and Live robot position are stacked on the left; the path tree fills the right.
2. **Horizontal**: both field views are across the top; the path tree spans the bottom.
3. **Mirrored**: the path tree fills the left; both field views are stacked on the right.
4. **Auto focus**: the Auto maker fills the workspace, the live pose is overlaid on that same field, and the path tree becomes a floating window.

Drag the dividers in the first three layouts to resize their sections. Field containers scroll when necessary, preserving the complete field image and its meter scale.

The 3.0 workspace removes the old fixed desktop minimum. Navigation scrolls without covering native window controls, panels stack at narrow widths, modal editors reflow vertically, and field canvases use contained scrolling. This keeps every control reachable across tall, ultrawide, compact, and unusual aspect ratios without cropping the field image.

In Auto focus layout, drag the path tree by its toolbar, resize it from its corner handle, or minimize and restore it. The floating tree does not replace the live pose: live telemetry is rendered directly on the Auto maker field.

### Themes and Custom Designs

Open **Preferences** to choose one of ten presets. The modal keeps its header visible and scrolls its appearance content within the available window height:

- Voyager Core
- Neural Violet
- Deep Space
- Aurora
- Cobalt Lab
- Ember Drive
- Rose Circuit
- Matrix Ops
- Graphite
- High Contrast

To create a personal theme, copy the current palette into **Custom theme**, give it a name, and edit its semantic colors. Theme changes apply immediately and save automatically.

The **Custom Designs** tab provides five independently selectable interface systems: Precision Grid, Editorial Intelligence, Prism Console, Terminal Blocks, and README Minimal. These designs change font families, base type scale, navigation and control height, panel padding, corner radius, and elevation while keeping the chosen color theme independent. The adaptations preserve field scale, minimum interaction targets, modal scrolling, contrast roles, and responsive behavior. Voyager's ShadCN-style controls are implemented with Base UI rather than Radix.

## Notifications and activity history

Actions such as saving, publishing, undoing, reconnecting, editing the path tree, or centering a lost path produce a status message in the top navigation.

Hover the message to reveal the activity-history button. The button stays visible while the pointer remains over either the message or button. Select it to open the **Activity log**, which records the session's notices with local timestamps and status types.

## Keyboard shortcuts

| Shortcut | Action |
| --- | --- |
| `Ctrl+Z` | Undo the last editor change |
| `Ctrl+Y` | Redo the last undone change |
| `Ctrl+C` | Copy the selected tree node and all descendants |
| `Ctrl+V` | Paste the copied tree as a new independent sequence |
| `Ctrl+D` | Duplicate only the selected tree node |
| `Delete` or `Backspace` | Delete the selected node and its child sequence |
| `Enter` | Accept a node rename or apply the focused NT4 address |
| `Escape` | Cancel a node rename |

Editor shortcuts do not intercept typing inside text fields, number fields, selects, or editable controls. Delete and Backspace are also disabled while Settings, Preferences, or Activity log dialogs are open.

## Generated file format

Each named path becomes a human-readable JSON file:

```text
<safe-path-name>.json
```

It contains the global motion constraints and:

- Waypoints with X/Y, heading, handoff radius, and profiled state.
- Rotation targets with heading and path position.
- Event triggers with command name and path position.
- Event Zones as paired start/end event triggers.
- Constraint-zone overrides with start/end positions.

Project-only editor metadata, including obstacles and version history, is stored separately in `voyager/assets/metadata.json`; it is not added to robot-side path JSON.

The complete tree is written as:

```text
auto_config.json
```

It contains each root autonomous routine and serializes its paths, events, true/false branches, loop bodies, interruptible sequences, and continuation chains.

## Quick start checklist

1. Install Voyager and VoyagerLib.
2. Open **Settings** and select the WPILib project.
3. Configure the field image, dimensions, and origin.
4. Configure robot size, swerve geometry, and center of rotation.
5. Configure constraints, tolerances, handoff radius, planner tuning, and translational/CTE/rotational PID gains.
6. Apply the team number or NT4 address.
7. Add and connect blocks in the path tree.
8. Map measured obstacles, then draw waypoints manually or use **Plan path** to generate a safe route.
9. Add rotation targets, events, event zones, and constraint zones.
10. Mirror an alliance-side path when needed.
11. Use **Playback** to inspect the simulated routine and estimated duration.
12. Select a routine, choose **Save all paths**, connect to the robot, and press **Publish Routine** or enable publishing on connect.

## Development

### Requirements

- Node.js 20 or newer
- npm
- Windows to produce the current installer targets

### Run locally

```powershell
git clone https://github.com/PriyanshuB09/Voyager.git
cd Voyager
npm install
npm run dev
```

### Validate and build

Compile the Electron main process, preload bridge, and React renderer:

```powershell
npm run build
```

### Package Windows distributions

```powershell
npm run dist
```

`npm run release` performs the same production build and Windows packaging operation. The output is written to `release/`:

```text
release/
|-- Voyager Setup 3.1.3-alpha.exe
`-- Voyager 3.1.3-alpha.exe
```

Before publishing a release, update the version in `package.json`, build both packages, smoke-test the packaged app, update the release notes, and attach the executables to a GitHub Release.

### Project structure

```text
Voyager/
|-- assets/                  Application imagery and icons
|-- electron/                Electron main process and preload bridge
|-- src/                     React application and styles
|-- electron.vite.config.ts  Electron/Vite build configuration
|-- package.json             Scripts, dependencies, and packaging settings
`-- RELEASE_NOTES_v3.1.3-alpha.md  Current release notes
```

### Technology

- Electron
- React and TypeScript
- ShadCN-style components backed by Base UI
- Vite and electron-vite
- electron-builder
- NTCore client libraries
- FRC Web Components

## Contributing

Issues and pull requests are welcome. Keep changes focused, explain any effect on the autonomous JSON format, run `npm run build`, and test saving and NT4 behavior when those areas are affected. Use [GitHub Issues](https://github.com/PriyanshuB09/Voyager/issues) for bug reports and feature requests.

## Related project

- [VoyagerLib-Public](https://github.com/PriyanshuB09/VoyagerLib-Public) — WPILib vendor dependency and robot-side Voyager library

## License

Voyager is distributed under the ISC license. See the repository license information for details.
