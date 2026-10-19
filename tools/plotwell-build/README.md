# Plotwell Script Editor

Screenplay mode uses Plotwell v0.2.0 (MIT), bundled to local static assets by GitHub Actions.
Legacy js/script-workspace.js remains only for rollback and is no longer loaded by Story Admin.

Build assets in tools/plotwell-build with npm ci and npm run bundle.
Script content is stored as structured story.scriptDoc and compatible HTML story.body.
The existing Story Admin save action and backup flow remain active.
See js/vendor/LICENSE-plotwell.txt for the required MIT notice.

Before production rollout, perform manual browser QA of undo, paste, cursor handling, imports, page boundaries, draft recovery and long PDF exports.
