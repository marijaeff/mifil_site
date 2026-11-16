# MiFiL — Home redesign 2.0

Static site, no build or external runtime dependencies.

## Install
- Back up the current project. Copy these files to its publishing root, preserving the directory structure.
- Delete `playable_letter/test_1/` and `playable_letter/test_2/` from the existing project/hosting repository (ZIP extraction does not delete old files). If empty, remove `playable_letter/`. Commit the deletions as well as the update. This clean archive contains neither demo.
- `CNAME` is preserved from the original archive; original `logo.png` also retained for compatibility.
- Run `python -m http.server 8000` and open `http://localhost:8000/` for local testing.

## Changes
- Richer layered blue/petrol atmosphere, soft ambient light, warmer window emission and local warm light on walls / ground. The house remains interactive geometry, with four windows, two torches and cat.
- Both renderers updated: WebGL and software 3D fallback.
- Removed both outdated Playable Letter demos and their links, including the noscript links. Project page remains; add the correct URL later in `texts.js`.
- 16 existing localizations, layout and route structure preserved. Privacy notice and translations remain drafts.

Verify hardware WebGL, touch picking, and actual hosted navigation on target devices.
