# Voyager 2.4.2

Voyager 2.4.2 expands the path-playback release with configurable workspaces, swerve-aware robot visualization, live autonomous tracing, faster path-tree editing, safer menus, activity history, and interface refinements.

## 2.4.2 focus-field correction

- Removed the picture-in-picture live field from Auto focus mode.
- Rendered the live robot pose and persistent white autonomous trail directly on the Auto maker field in focus mode.
- Displays the live overlay at `(0,0)` while disconnected and follows the NT4 robot pose while connected.

## 2.4.2 playback and window performance correction

- Removed application-wide React state updates from the per-frame playback loop; robot pose, swerve modules, timestamp, and timeline now update locally at animation-frame speed.
- Made playback seeking update the preview directly and commit editor state only after the seek finishes.
- Changed playback, path-element, and focus-tree window dragging to GPU-accelerated transforms with one state commit when the pointer is released.
- Disabled expensive backdrop filtering only while a floating window is being dragged or resized, then restored the themed effect afterward.

## 2.4.1 fix

- Restored window dragging from the unoccupied top navigation area while keeping navigation buttons and layout controls interactive.

## 2.4.0 workspace layouts

- Added a four-button layout switcher to the top navigation bar with compact diagrams of each workspace arrangement.
- Retained the default layout with two stacked field views on the left and a full-height path tree on the right.
- Added a horizontal layout with both field views across the top and a full-width path tree across the bottom.
- Added a mirrored layout with the full-height path tree on the left and both field views stacked on the right.
- Added an Auto focus layout that fills the workspace with the Auto maker field and overlays the live robot pose on the same field canvas.
- Added the connection indicator and Publish Routine control to the Auto maker toolbar while focus mode is active.
- Converted the focus-mode path tree into a draggable, resizable, and minimizable floating window.
- Made the vertical and horizontal workspace dividers resize in the direction appropriate to the selected layout.

## Earlier 2.3 refinements

- Reduced the default visual wheel thickness for a cleaner robot preview.
- Added Settings sliders for swerve wheel length and width in meters.
- Added Settings sliders for longitudinal and lateral module offsets in meters.
- Wired module offsets into inverse kinematics and wheel dimensions into all playback, live-pose, and robot-settings previews.

### Interface refinements

- Matched the Publish Routine control to the Auto maker Add button styling.
- Correctly centered the sliding activity-log icon throughout its reveal animation.
- Added Delete and Backspace shortcuts for removing the selected tree block and its child sequence while protecting text-entry controls and open settings/preferences dialogs.
- Matched all four swerve wheels to their robot-frame perimeter color and refined their clean visual geometry.

## Robot visualization and live field

- Replaced the `preview` and `robot` labels with four visible swerve modules in the playback, live robot, and robot-dimension previews.
- Module steering angles are calculated from the robot's translational velocity, rotational velocity, heading, configured center of rotation, and physical module positions using inverse kinematics.
- Added a solid white live-pose trail that begins when a routine is published and remains visible throughout the autonomous routine.
- Made robot frames use one uniform pixels-per-meter scale so the configured length and width represent the same physical dimensions on both field views.
- Retained the simulated robot exclusively on the Auto maker field and live NT4 pose exclusively on the Live robot position field.

## Path-tree workflow

- Added `Ctrl+C` to copy the selected tree block and its complete child sequence.
- Added `Ctrl+V` to paste the copied sequence as independently named blocks with independently cloned path data.
- Added `Ctrl+D` to duplicate only the selected tree block without its children.
- Added a clear selected-block outline for keyboard clipboard operations.
- Made path-node, edge, and canvas context menus measure and reposition themselves so the complete menu remains inside the application window; oversized menus scroll internally.
- Retained the nearest-path recovery control and warning when no path blocks are visible.

## Notifications and interface fixes

- Added a hover action beside notification text. The action remains visible while either the text or button is hovered.
- Added an activity-log modal containing session notifications and local timestamps, including save, publish, undo/redo, path-tree, connection, and recovery messages.
- Fixed the Save dropdown stacking order so it appears above the Auto maker field.
- Restyled the Publish Routine button with corrected spacing, clearer contrast, and consistent themed interaction states.
- Retained the Base UI-backed ShadCN interface, ten theme presets, custom theme editor, and responsive scrollable field surfaces.

## Path editing, controllers, and playback

- Includes Undo and Redo buttons plus `Ctrl+Z` and `Ctrl+Y` shortcuts.
- Includes global translational and rotational velocity/acceleration constraints, end tolerances, and the default intermediate waypoint handoff radius.
- Includes translational, rotational, and CTE PID controller settings.
- Includes the draggable looping playback window with seeking, play, pause, reset, current time, and total estimated path time.
- Playback estimation and motion account for constraint zones, controller response, waypoint handoffs, end tolerances, and rotation targets.

## Downloads

- `Voyager Setup 2.4.2.exe` - Windows installer
- `Voyager 2.4.2.exe` - portable Windows application

> [!IMPORTANT]
> These builds are not digitally code-signed. Windows SmartScreen may show an **Unknown publisher** warning. Download Voyager only from the official [GitHub Releases](https://github.com/PriyanshuB09/Voyager/releases) page.

## Robot-Side Dependency

Voyager works with [VoyagerLib-Public](https://github.com/PriyanshuB09/VoyagerLib-Public). Install the WPILib vendor dependency using:

```text
https://priyanshub09.github.io/VoyagerLib-Public/VoyagerLib.json
```
