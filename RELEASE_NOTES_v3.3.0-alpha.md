# Voyager v3.3.0-alpha

Voyager 3.3 separates autonomous editing from live robot diagnostics and adds configurable, inspectable NetworkTables 4 telemetry.

## Live telemetry

- Added dedicated **Auto builder** and **Live robot** workspace tabs.
- Added an expandable directory browser for every topic announced by the NT4 server.
- Preserved the default AdvantageKit `DSAttached` and `Odometry/Robot` topics while allowing both to be changed.
- Added optional measured and setpoint swerve `ChassisSpeeds` topics.
- Decodes WPILib raw structs as three little-endian doubles (`vx`, `vy`, and `omega`) and also accepts arrays or JSON objects.
- Detects sustained measured-versus-commanded motion disagreement with trigger and recovery hysteresis.
- Highlights possible collision or wheel slip periods using a red robot perimeter and red trail segments.
- Added a runtime switch between Voyager's compact direct NT4 adapter and the FRC Web Components NT4 client.
- Added a mock NT4 protocol test that verifies discovery, binary decoding, anomaly detection, trail highlighting, and transport switching.

## Field images and interface

- Every uploaded field image now opens a visual crop step.
- Added **Tools → Crop field image** for recropping existing field artwork.
- Cropped field images are resized when necessary and stored as high-quality WebP to reduce workspace size and rendering cost.
- Removed the redundant Workspace label from the top bar.
- Removed live-field duplication from the Auto editor, leaving one focused field and path tree.

## Performance and reliability

- Topic discovery uses announcement-only subscriptions instead of streaming every NetworkTables value.
- Only the configured pose and ChassisSpeeds sources subscribe at 50 Hz.
- Both NT4 transports remain lazy-loaded; the selected compatibility library does not delay first render.
- Replaced hundreds of live-trail SVG elements with at most two compact SVG paths.
- Disconnected pose packets no longer produce repeated React updates.
- Explicitly enabled production JavaScript and CSS minification.
- Production dependency audit reports zero known vulnerabilities.

## Windows artifacts

- `Voyager Setup 3.3.0-alpha.exe` — Windows installer
- `Voyager 3.3.0-alpha.exe` — portable Windows application
