# Credits

- **Project:** Đảo Đèn Lồng (Lantern Island) — Day 12 AI SDLC Lab
- **Author:** Khuất Tiến Minh (`2A202603616`)
- **License:** MIT License (see `LICENSE`)

## Open-Source Libraries & Runtime
- **Three.js (r128)** — 3D WebGL rendering engine, bundled locally at `public/lib/three.min.js` (MIT License, https://threejs.org/).
- **Node.js** — JavaScript runtime used for local HTTP server, headless simulation, test runner, benchmark, and soak test (MIT License).

## 3D Visuals & Audio Assets
- **3D Models & Terrain:** All 3D meshes (Mây character with conical hat & lantern, 3 islands, bamboo bridge, jump pads, bell tower, lanterns with fuel bars, motes, shades, drifters, wind charms) are procedurally generated in JavaScript using Three.js geometric primitives (`CylinderGeometry`, `SphereGeometry`, `ConeGeometry`, `TorusGeometry`, `BoxGeometry`, `ExtrudeGeometry`, `InstancedMesh`). No external copyrighted 3D models or textures are used.
- **Audio & Music:** All 10 sound effects and ambient night background music are synthesized in real time using the browser **Web Audio API** (`OscillatorNode` + `GainNode`). No external audio files are used.

## AI Tools Used
- **Google Antigravity (Gemini models):** Assisted with architecture design, code implementation across Phases 1–4, automated test authoring, ADR/documentation writing, and performance optimization, guided by repository harness (`AGENTS.md` and `.agents/skills/verify-contract/SKILL.md`).
