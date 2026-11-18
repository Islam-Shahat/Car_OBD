# Third-Party Software and Asset Notices

This document details the third-party datasets, fonts, and open-source libraries incorporated into or utilized by Car OBD.

---

## 1. Bundled Diagnostic Datasets

### OBDex
- **Upstream Repository**: [https://github.com/opencode/obdex](https://github.com/opencode/obdex)
- **Component**: Standard Diagnostic Trouble Code (DTC) definitions and descriptions (`src/data/`).
- **Data License**: Creative Commons Zero v1.0 Universal (CC0 1.0 Universal - Public Domain Dedication).
  - The diagnostic data files imported into this project are dedicated to the public domain under CC0 1.0.
- **Tooling License**: Tooling scripts adapted for parsing and building the dataset are licensed under the MIT License.

---

## 2. Bundled Fonts

### Cairo Font Family
- **Source**: [https://fonts.google.com/specimen/Cairo](https://fonts.google.com/specimen/Cairo)
- **Copyright**: Copyright 2016 The Cairo Project Authors.
- **License**: SIL Open Font License, Version 1.1 (OFL-1.1).
- **Files**: `src/assets/fonts/cairo-arabic.woff2`, `src/assets/fonts/cairo-latin.woff2`
- **Notice**: The Cairo Font Software is licensed under the SIL Open Font License, Version 1.1. The license is available with a FAQ at https://openfontlicense.org.

---

## 3. Open-Source Dependencies (Node.js & Rust)

This project relies on third-party open-source libraries managed via npm (`package.json`) and Cargo (`src-tauri/Cargo.toml`).

These dependencies are distributed under their respective open-source licenses, including but not limited to:
- MIT License
- Apache License, Version 2.0
- BSD 2-Clause and 3-Clause Licenses
- ISC License
- Unicode-DFS-2016

Each dependency remains the property of its respective author(s). Complete metadata and licenses for these dependencies can be inspected in the respective project manifests (`package.json`, `package-lock.json`, `src-tauri/Cargo.toml`, and `src-tauri/Cargo.lock`).
