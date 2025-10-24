# Repository Guidelines

## Project Structure & Module Organization
The ripple effect plugin lives in `src/main.js`, implemented as an ES module that extends jQuery. Rollup configuration files in `build/` control how the bundle targets browsers, while generated assets land in `dist/` and should only be updated via the build scripts. Use `demo/index.html` as the playground for verifying UI changes against real backgrounds and interaction scenarios.

## Build, Test, and Development Commands
- `npm install` installs Rollup, jQuery, and ancillary tooling for local builds.
- `npm run build` outputs an unminified bundle to `dist/jquery.ripples.js`; run this before debugging or submitting patches.
- `npm run build-min` produces the minified `dist/jquery.ripples-min.js` artefact used for distribution.
- `npm version <patch|minor|major>` executes both build tasks and stages `dist/` updates, streamlining release prep.

## Coding Style & Naming Conventions
Follow the existing tab-based indentation, single quotes for strings, and semicolon-terminated statements. Keep code modular by adding helpers near related logic in `src/main.js` and prefer descriptive function names such as `loadConfig` and `drawTexture`. Guard DOM and WebGL interactions with null checks so the plugin remains resilient across browsers, and document non-obvious branches with concise inline comments.

## Testing Guidelines
There is no automated test harness, so rely on manual verification. After running the build scripts, serve the repository root with `npx http-server .` or `python3 -m http.server` and load `demo/index.html` in multiple browsers. Validate ripple startup, interactive responses, and teardown flows; when fixing regressions, describe the scenarios exercised and include screenshots or short screen captures.

## Commit & Pull Request Guidelines
Mirroring the existing history (for example, `Fix effect not working on iOS`), craft short, imperative commit subjects that explain the change at a glance. Each PR should link related issues, summarize motivation and testing, and call out any behavioural or API adjustments. Include before/after visuals when UI output changes, mention manual test coverage, and flag follow-up work so reviewers can assess risk quickly.
