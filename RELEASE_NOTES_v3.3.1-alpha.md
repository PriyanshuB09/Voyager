# Voyager v3.3.1-alpha

This stabilization release fixes the Auto Builder rendering and path-tree visibility regressions discovered after adding the Live Robot workspace.

## Correctness fixes

- Reattaches Auto field and path-tree size observers after every Live Robot to Auto Builder transition.
- Measures remounted workspaces synchronously, eliminating stale geometry and false `No path blocks are visible` warnings.
- Suppresses field overlays until valid dimensions exist, preventing partial circular artifacts at the field edge.
- Closes playback, planner, drag, context-menu, and element-editor state when leaving Auto Builder.
- Moves activity/notification text after Save and Tools at the right edge of the navigation actions.
- Cancels pending autosave and metadata timers when their settings are disabled or dependencies change.
- Restores persisted custom themes correctly.
- Repairs invalid or duplicate persisted IDs and normalizes non-finite field, robot, path, tree, obstacle, and modal geometry.
- Bounds handoff radii during input, persistence recovery, and rendering.
- Prevents different path names from resolving to the same Windows JSON filename while preserving intentional exact-name path reuse.
- Handles Windows reserved filenames and trailing periods safely.

## Telemetry fixes

- Clears stale Direct NT4 topic announcements on disconnect and reconnect.
- Ages out stopped ChassisSpeeds samples even when no new topic packet arrives.
- Cancels live client timers and pending work cleanly during transport changes.

## Accessibility and security

- Adds keyboard editing for path-tree nodes, waypoints, rotation targets, and the panel divider.
- Adds accessible names to field controls and path element handles.
- Adds dialog semantics, Escape handling, focus placement, and Settings focus containment.
- Rejects untrusted renderer IPC, popup windows, unexpected navigation, malformed IPC payloads, oversized text writes, and unsafe filenames.

## Performance

- Thirty repeated Live/Auto transitions average about 32 ms in the release benchmark.
- Transition DOM count remains stable with no accumulating workspace nodes.
- Initial NT4 clients remain lazy-loaded in independent chunks.

See `QUALITY_AUDIT_v3.3.1-alpha.md` for the complete scoring rubric and validation evidence.

## Windows artifacts

- `Voyager Setup 3.3.1-alpha.exe` — Windows installer
- `Voyager 3.3.1-alpha.exe` — portable Windows application
