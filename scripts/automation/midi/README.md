# Midi-QOL automation

`hooks.mjs` registers all Midi-QOL hooks used by the module.

Keep hook names and registration here. Class-specific calculations can stay in
`scripts/automation/classes/*`, but new Midi-QOL integration should be exposed
through this folder instead of adding more direct `Hooks.on("midi-qol...")`
calls to `runtime.mjs`.
