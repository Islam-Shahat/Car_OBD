## Summary of Changes
Provide a brief summary of the changes proposed in this Pull Request and reference any related issues.

## Type of Change
- [ ] Bug fix (non-breaking change which fixes an issue)
- [ ] Catalog or dataset update (WMI or vehicle model additions)
- [ ] Localization improvement (Arabic / English strings)
- [ ] Documentation update
- [ ] Refactoring / performance improvement

## Contributor Checklist
Before submitting this pull request, please verify the following:

- [ ] **Tests pass**: `npm test` runs with all test suites passing.
- [ ] **Typecheck clean**: `npm run typecheck` produces 0 errors.
- [ ] **Lint & formatting clean**: `npm run lint` and `npm run format:check` pass cleanly.
- [ ] **Rust checks**: `cargo fmt --manifest-path src-tauri/Cargo.toml --all -- --check` and `cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings` pass.
- [ ] **Dependencies**: No new npm or Rust dependencies have been added without clear architectural justification.
- [ ] **Documentation**: Docs, README, or release notes have been updated accurately where appropriate.
- [ ] **Honesty Guarantee**: No claim of physical vehicle road testing or real-hardware verification has been made unless explicitly verified with physical test logs and photos/video. Synthetic and emulator fixtures are documented as such.
