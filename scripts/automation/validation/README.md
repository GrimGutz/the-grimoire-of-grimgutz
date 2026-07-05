# Validation automation

Put drag/drop prerequisite and feature-level validation here.

Runtime should only wire validators into Foundry hooks. Class-specific validation can import shared selectors and receive any domain helpers it needs from runtime.

Current modules:

- `prerequisites.mjs` — pre-create class, subclass, technique, and feature checks.
- `advancement.mjs` — advancement-manager checks for classes and granted feature levels.
