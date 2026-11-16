# MiFiL — Home redesign 1.0

This is a replacement for the presentation site, not for the individual applications.

## Installation
1. Back up the current site or create a Git branch.
2. Unzip this update into the root of the existing website, replacing `index.html`, `style.css`, `script.js`, `texts.js` and adding `page.html`, `assets/` and `js/house.js`.
3. Leave `CNAME`, `logo.png` and the entire `playable_letter/` directory in place. The original domain `mifil.me` and the original two Godot exports stay unchanged.
4. Test locally with `python -m http.server 8000` from the website root, then open `http://localhost:8000/`. For GitHub Pages or other static hosting, upload the same files to the existing published directory. No npm install, build step or CDN needed.

## Editing
- `texts.js`: UI translations, project descriptions and `MiFiLProjects` registry. Add real public links in the matching `links` array; add a corresponding translation key for each label (or use an existing key). Existing local demo paths are included on the Playable Letter page. The old homepage pointed to the generic Fiverr home page, not a seller listing; a real URL can be added when supplied. Confirm the test exports may be shared publicly before publishing their links.
- `js/house.js`: procedural 3D meshes, windows array and coordinates, camera, picking, projection, glow, animations. Native WebGL plus a software 3D depth-buffer fallback; a static SVG is the final fallback. No Blender model is required. Geometry is a first low-poly draft, not final art.
- `style.css`: site colors, spacing, typography, adaptive layout and reduced-motion styles.
- `page.html`: detail template for the four projects and about/creator/privacy pages. UI translations are local (no API or machine-translation call at runtime); names and URLs are locale-independent.
- Language choice uses localStorage when available. The recent house angle uses sessionStorage. A public privacy policy is not finalized; the privacy page is a short draft notice only. Review translations (particularly non-primary locales) and legal wording before going live.

## Check before deployment
Test desktop/mobile hardware WebGL, touch rotation, window picking, project navigation, back button and both Godot demos on the actual host. The demos were preserved, not modified or played through. The software renderer and interface were tested in headless Chromium using inlined local assets because normal URL navigation and hardware WebGL were restricted in the test environment.
