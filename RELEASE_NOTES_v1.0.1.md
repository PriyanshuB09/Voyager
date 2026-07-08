# Voyager 1.0.1

Voyager 1.0.1 is a maintenance release that restores the Electron preload bridge in packaged Windows builds.

## Fixed

- Fixed the packaged app reporting `Electron preload API is unavailable` when selecting or writing to a robot project.
- Changed the preload bundle from ES modules (`preload.mjs`) to explicit CommonJS (`preload.cjs`) so it runs in Electron's sandboxed renderer.
- Kept context isolation and renderer sandboxing enabled.
- Added preload failure logging to make future packaging problems easier to diagnose.

## Downloads

- `Voyager Setup 1.0.1.exe` - Windows installer
- `Voyager 1.0.1.exe` - portable Windows application

> [!IMPORTANT]
> These builds are not digitally code-signed. Windows SmartScreen may show an **Unknown publisher** warning. Download Voyager only from the official [GitHub Releases](https://github.com/PriyanshuB09/Voyager/releases) page.

## Robot-Side Dependency

Voyager works with [VoyagerLib-Public](https://github.com/PriyanshuB09/VoyagerLib-Public). Install the WPILib vendor dependency using:

```text
https://priyanshub09.github.io/VoyagerLib-Public/VoyagerLib.json
```
