# Baseline provenance

The collaborator kit was assembled from the existing Climate++ prototype checkout. It intentionally contains no `.git`, deployment identity, credentials, dependency installations, videos or previous build output. Formatting, component extraction, defensive validation fixes and new developer documentation are described in `docs/AUDIT.md`.

`original-release-manifest.json` is the earlier release inventory, retained without alteration. Its old source hashes are expected to differ from this handoff; some historical scripts were intentionally omitted. Use the root `EVIDENCE-MANIFEST.json` to verify this handoff, and `DATA-MANIFEST.json` for its frozen source/derived/reference assets. Raw dataset snapshots were preserved without changing their bytes or publisher attributions.

The earlier standalone presentation/PDF/spreadsheet deliverables and deferred video project are outside this source-and-data kit. Active scientific, operator and venture documentation is retained in `documentation/`. Current setup and development guidance lives in the root README and `docs/`.
