# [Resource] Introducing Voyager: a visual autonomous builder for branching FRC routines

Hi everyone,

I wanted to share **Voyager**, an open-source desktop tool for building FRC autonomous routines visually.

The short version is this: a lot of autonomous tools answer **"how should the robot drive this path?"** Voyager is aimed more at **"how should the whole autonomous routine be structured?"**

Instead of treating auto as just a list of paths, Voyager lets you build a **routine tree** with path blocks, `if` branches, loops, interrupts, and events, then save that structure directly into your robot project.

## What Voyager is

Voyager is a Windows desktop app that combines:

- a visual autonomous routine editor
- an interactive field/path editor
- project export into your robot codebase
- NT4 publishing for routine selection

The goal is to make it easier to organize more complex autonomous behavior without hiding everything behind hand-written JSON or a pile of ad hoc code.

## Why I built it

A lot of auto tooling is great at defining where a robot should drive. Voyager is meant to focus more on **how the overall routine is structured**.

That means:

- building autonomous as a tree instead of a flat sequence
- keeping path editing and routine logic in the same workflow
- exporting human-readable files that live with the robot code
- making routine selection easy to publish over NT4

If your team already has a workflow you love for path generation, this may not replace that. If your team wants a more visual way to manage multi-step, branching autonomous logic, Voyager may be useful.

## Current feature set

- Visual routine tree with path, `if`, loop, interrupt, and event blocks
- Interactive field editor with waypoints, rotation targets, event triggers, and constraint zones
- Configurable field dimensions, robot dimensions, and field image
- Local project persistence between sessions
- Save/export directly into a robot project
- Automatic cleanup of stale generated path files
- NT4 connection by team number, hostname, IP, or `localhost`
- Selection publishing to `/Voyager/SelectedAuto`

Voyager also prevents connections that would create loops in the routine tree.

## Robot-side integration

Voyager is designed to work with **VoyagerLib**, the companion vendor dependency for robot code:

- VoyagerLib repo: [VoyagerLib-Public](https://github.com/PriyanshuB09/VoyagerLib-Public)
- Vendordep URL: `https://priyanshub09.github.io/VoyagerLib-Public/VoyagerLib.json`

The current public vendordep targets the 2026 FRC season and provides the Java artifact `com.team4188:voyager`.

## What gets written to the robot project

Voyager exports human-readable JSON files into the selected robot-code project:

```text
<path-name>.json
auto_config.json
```

Path files can contain waypoints, rotation targets, events, and constraint zones. `auto_config.json` stores the full routine tree.

My intent is for these files to be committed alongside robot code so autonomous behavior is version-controlled like the rest of the project.

## Downloads

GitHub repo:

[Voyager](https://github.com/PriyanshuB09/Voyager)

Releases page:

[Voyager Releases](https://github.com/PriyanshuB09/Voyager/releases)

Current Windows release artifacts are:

- `Voyager Setup 1.0.1.exe`
- `Voyager 1.0.1.exe`

The installer is probably the best option for most teams. There is also a portable build.

## Important note

Current Windows builds are **not digitally code-signed** yet, so SmartScreen may show an **Unknown publisher** warning. Please only download builds from the official GitHub Releases page.

## Scope and limitations

Right now, Voyager is best described as:

- a Windows-first desktop release
- a tool built around the VoyagerLib robot-side workflow
- a good fit for teams that want visual structure around autonomous logic, not just path drawing

I do not want to oversell it as a universal replacement for every existing autonomous workflow. The value here is the combination of **path editing + branching routine structure + project export + NT4 selection** in one tool.

## Feedback I'd love

If you take a look, I'd especially appreciate feedback on:

- whether the routine-tree model feels useful in real team workflows
- what parts of the export format should be more transparent or easier to edit
- what integration points teams would want beyond the current VoyagerLib flow
- what would make this easier for new programmers to adopt

If there's interest, I can also post screenshots, a short demo video, and an example robot-project integration walkthrough.
