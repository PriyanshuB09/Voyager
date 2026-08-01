# Voyager v3.2.0-alpha

This release focuses on responsiveness, startup time, and a calmer PathPlanner-inspired workspace without removing editor, planning, telemetry, history, obstacle, save, or customization features.

## Performance

- Reduced first-render JavaScript from about 3.63 MB to about 263 KB by loading NetworkTables after the workspace becomes interactive.
- Removed the unused 3.69 MB rounded font and the additional bundled UI font in favor of fast native system typography.
- Isolated high-frequency robot telemetry from the main editor render tree, limited subscriptions to 50 Hz, coalesced updates to animation frames, and capped the live trail at 600 meaningful points.
- Converted waypoint, rotation, event, and constraint dragging to direct frame rendering with a single state commit when the interaction ends.
- Reused the IndexedDB connection, delayed background persistence until the editor is idle, and bounded the activity log.
- Removed unused build dependencies and upgraded Electron and Vite. The npm audit reports zero known vulnerabilities.

## Interface

- Added a calmer graphite/periwinkle default palette and larger Segoe UI system typography.
- Simplified the title bar to workspace context, layout, Save, and a single Tools menu.
- Made the autonomous field the primary editor and collapsed the live field to a compact status row until requested.
- Increased control, label, tree, menu, and dialog text sizes while reducing glow, gradients, blur, and visual noise.
- Preserved all layout modes, appearance presets, history, obstacles, settings, path tools, playback, and routine publishing.

## Windows artifacts

- `Voyager Setup 3.2.0-alpha.exe` — Windows installer
- `Voyager 3.2.0-alpha.exe` — portable Windows application
