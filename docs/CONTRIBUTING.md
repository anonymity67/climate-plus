# Collaboration workflow

1. Keep the original received ZIP and its SHA-256 separately. Extract a working copy and open its workspace in VS Code.
2. Install with `npm ci`. Run `npm run verify:handoff` before edits and `npm run check` as the baseline. Use a private Git repository if desired (`git init`, review files, then commit); this kit has no Git history or hosting identity attached.
3. Create a branch per change. Keep raw snapshots immutable and add new dataset versions rather than editing old measurements. Never commit credentials, `.env`, dependency directories, generated builds or Python environments.
4. Write a failing regression for numerical/input bugs before fixing them. Format source with `npm run format`. Run `npm run check`; for scientific changes, also run the reproduction workflow and record new independent validation.
5. Review the app in a browser: continuity response; budget changes; pollution filters; marker/selector selection; both map layers and their legends; model abstention; valid/invalid observation import; paired-input validation; receipt export; reset; and narrow-screen layout. A Vite build does not prove these interactions.
6. Explain changed behavior, data provenance, validation and remaining uncertainty in the change description. Another collaborator should review joins, objective changes and scientific claims. Never silently improve test metrics by refitting on the frozen holdout.

The `EVIDENCE-MANIFEST.json` describes the received handoff, so intentional edits cause mismatches. Keep it and the ZIP as reference. For a new release create a separately named manifest after reviewing source/data diffs; record the previous digest and version. Do not replace an unexpected mismatch with newly computed hashes and call it verification.

## Troubleshooting

| Symptom                                   | Action                                                                                                             |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `npm` is unavailable                      | Install Node 24 LTS, restart VS Code, check `node --version`                                                       |
| PowerShell refuses `npm.ps1`              | Use `npm.cmd ci`, `npm.cmd run dev`, etc.                                                                          |
| Port 5173 is occupied                     | Stop the previous app; avoid accidentally testing another server                                                   |
| Evidence file cannot load                 | Run Vite from the project root; check `public/data/water-evidence.json`; run `verify:data`                         |
| Basemap blank                             | Check network/tile-provider access; markers and station selector still support inspection                          |
| Model abstains                            | Supply all six UI predictors within training ranges; never force an estimate by replacing missing values with zero |
| Handoff hashes differ                     | Determine whether edits are expected; preserve original reference and investigate unexpected changes               |
| Python dependency error                   | Use a clean Python 3.14 virtual environment and the pinned requirements                                            |
| Chain button unavailable in build preview | Use the dev server and separately start the optional chain service                                                 |

Do not run `npm audit fix --force` without reviewing the changed dependency/API behavior. Run audits in the core and optional tool independently. The optional Ganache fallback warning and advisories are documented, not suppressed or silently treated as resolved.
