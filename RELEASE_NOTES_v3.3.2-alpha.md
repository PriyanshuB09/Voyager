# Voyager v3.3.2-alpha

This release fixes focus-layout stacking and adds live ChassisSpeeds vector visualization.

## Auto Builder

- Keeps the draggable path-tree modal above the Auto maker field toolbar and all of its controls in the full-size Auto focus layout.
- Adds a deterministic overlap regression that checks both computed layer order and the actual topmost hit-tested element.

## Live Robot

- Draws a solid cyan translation arrow for measured `vx` and `vy` at the live robot pose.
- Draws a dashed pink translation arrow for setpoint `vx` and `vy`, remaining visible when it overlaps the measured vector.
- Draws separate signed rotation arcs with arrowheads for measured and setpoint `omega`.
- Scales translation length and rotation sweep by command magnitude while bounding both to keep the field readable.
- Adds color-keyed cards below the field with linear magnitude, `vx`, `vy`, and `omega`, including units.
- Keeps the overlays non-interactive and reuses the existing decoded ChassisSpeeds values for low update overhead.

## Validation

- Focus-modal overlap test passes with modal layer 120 above toolbar layer 90.
- Direct NT4 and FRC Web Components mock tests pass with both vector types and both legend cards visible.
- The complete UI, persistence, smoke, build, and performance gates remain green.
- Thirty repeated Live/Auto transitions average 16 ms with stable DOM and reported heap usage.

See `QUALITY_AUDIT_v3.3.2-alpha.md` for the complete pass scores and evidence.

## Windows artifacts

- `Voyager Setup 3.3.2-alpha.exe` — Windows installer
- `Voyager 3.3.2-alpha.exe` — portable Windows application
