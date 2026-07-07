# Hyperframes Composition Brief: Voyager

## Objective
Create a 20-second launch-style brag video for Voyager, an open-source FIRST Robotics Competition autonomous builder.

## Output
- Composition directory: `brag-output/composition/`
- Rendered video: `brag-output/brag.mp4`
- Format: landscape — 1920x1080
- Duration: 20 seconds

## Source Material
- Project root: `C:\Users\6434124104\code\Voyager`
- Primary files read: `src/App.tsx`, `src/styles/style.css`, `package.json`, `index.html`
- Product name: Voyager
- Strongest claim: visual, modular FRC autonomous routines with branching and live robot feedback
- Key UI moment to recreate: the Auto maker field with waypoints beside the branching path tree, followed by Live robot position and Publish Routine
- Copy that must appear verbatim:
  - Auto maker field
  - Live robot position
  - Publish Routine
  - Waypoint
  - Rotation Target
  - Event Trigger
  - Constraint Zone

## Creative Direction
- Tone preset: cinematic
- Creative direction: FRC mission control, precise rather than bombastic
- Interpretation: large, confident typography and camera movement frame a detailed, faithful reconstruction of Voyager’s own interface.
- Angle: complex autonomous behavior becomes visible, editable, and publishable in one workspace.
- Hook: Autonomy should be visible.
- Outro: Build the route. Branch the logic. Ship the auto.
- Avoid: generic SaaS language, unrelated abstract filler, fake performance metrics, or redesigning Voyager into a different product

## Visual Identity
- Background: #090d14
- Panel: #0f1521
- Text: #e5ecf7
- Accent: #5eead4
- Secondary accent: #38bdf8
- Warning: #facc15
- Display font: bundled SF Pro Rounded Semibold
- Body font: bundled IBM Plex Sans
- Visual references: real FRC field asset, waypoint markers, teal path lines, cyan routine selection, tree nodes and connectors, connection pill

## Storyboard
Use `brag-output/brag-plan.md` as the creative contract.

Scene summary:
1. Make it visible — 3.2s — FRC field scan, hook, first route line
2. Build the route — 4.0s — real Auto maker field UI and sequential path elements
3. Branch the logic — 4.1s — branching path tree assembles beside the route
4. See it live — 4.1s — robot motion, NT4 connection, Publish Routine interaction
5. Voyager — 4.6s — logo, tagline, open-source FRC readout

## Audio
- Audio role: cinematic technical support
- Audio arc: restrained bed, slight lift at the tree reveal, small confirmation at connection, clean logo payoff and fade
- Music: `voyager-piano.mp3`, derived from CC0 `Emotional piano.wav` by triangelx
- Music treatment: slowed solo piano at 0.48 with gentle fades; no percussion, SFX, clicks, impacts, or volume-drop automation
- Music cue guidance: natural piano phrasing; prioritize long text crossings and dissolves over beat snapping
- Audio-reactive treatment: subtle field glow/title halo only, if extraction is available
- Audio-coupled moments: waypoint sequence, logic lock-in, connected status, publish click, final logo
- SFX selection guidance: none — piano only
- SFX analysis guidance: `C:\Users\6434124104\.codex\skills\brag\assets\sfx\sfx-analysis.md`
- Exact SFX choice: choose after animation exists; prioritize low high-frequency-risk sounds
- Audio files: copy selected music and SFX into `brag-output/composition/assets/`

## Hyperframes Instructions
- Use current Hyperframes conventions and a single paused, seek-safe GSAP timeline.
- Show the actual Voyager UI language and real field artwork.
- Keep every required line readable and the total duration exactly 20 seconds.
- Use local runtime and media assets where possible.
- Lock 1–3 major reveals to nearby music cues only when readability is preserved.
- Run lint, validate, inspect, and snapshot before preview.
