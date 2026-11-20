# Aquavelle release plan

Software · water information and planning for residents and field teams in Bangladesh.

The QGIS edition includes 545 files from the earlier Aquavelle web/model/service archive plus ten GIS files. Eleven shared files changed. Use the QGIS edition as the baseline. Its RiverWatch and WASH playbook copies match their standalone archives. The RainHub standalone archive includes original inputs and intermediate outputs absent from the integrated package. The integrated exporter is newer and has a different rainfall input contract, so preserve both versions with their original archives. Borsha-Bandhu supplies three site-sizing examples and engineering reference material. Use only named, reproducible inputs in the public calculator. Climate Plus contributes the existing continuity and response practice modules, with simulated events clearly labelled.

1. Put water search and practical advice first. Render the entry page and water guidance on the server. Give Bangla and English equal access to the resident pathways.
2. Keep river observations and rain planning in the public tools. Put shared hub modelling, source screening, outage practice, field records and research in the field workspace.
3. Check coverage, units, dates, rights and evidence type. Preserve the frozen datasets and their hashes. Remove causal or drinking-water claims that input data cannot establish.
4. Build and test the Worker with D1 migrations. Make anonymous public tools available and validate field identity before using private records. Verify the deploy configuration and record any external launch prerequisites.

The public interface uses the supplied Dhaka OSM channel snapshot and original-coordinate observations for its cover map. The mapped dots represent recorded sampling positions. The map is not a safety classification.

## Data decisions and open checks

- Restored the CHIRPS monthly (2017–2021), CHIRPS daily (2020) and WorldPop 2020 source files from the standalone RainHub archive at the exact paths the integrated R pipeline expects. Their SHA-256 values are respectively `8a5c4fd3147833580caa03d76ac0bfea7bcf557cc7d11bd0bce7156bfbb07bc2`, `8cf879e92523f38bc1214c71f90d28b5d138581ea81528dfcb1095ab0a7bcf7c` and `c7b0c3afd11c93fc7ef7145854d007f8b400dcb98ae23f5dbc67c700e0919c36`. Confirm the current R-INLA export in a reproducibility environment before replacing the frozen published model.
- Use Borsha-Bandhu’s three roof, tank and user-count presets times the guide’s 5 L/person/day planning assumption. The guide’s monthly rainfall scaled by 0.75 is a sensitivity assumption. It does not establish an empirical 80% rainfall probability. Its period descriptions also disagree on dry-season length, so its reliability percentages and costs are excluded from the Aquavelle calculator.
- The modelled number of people assigned to shared storage is a capacity assumption. The water-access index is weighted by population and excludes other supply types. No field outcomes, existing hub inventory, tested engineering design or realised service gain are claimed.
- RiverWatch national screening has no field-reviewed links or optical scores in the bundled public run. A modelled downstream corridor and mapped facility tag help prioritise visits. They do not prove flow, pollution or exposure.
- The WASH archive’s 18 bundled files match byte for byte. Keep the supplied playbook formatting separate from the application code style check so the archived copy and field forms remain reproducible.

## Verification on 20 November 2026

- The production build, TypeScript and formatting checks passed. All 139 core tests and 97 frozen data/reference hash checks passed. The browser’s shared-tank scenario calculation agrees with the archived R output for all four scenarios and tested cleanup assumptions.
- The compiled Worker with local D1 passed 24 HTTP checks, including dated evidence, rounded location search, volume conservation, private persistence and safe retries. Direct public mode refused unsigned identity headers. Cloudflare accepted the public deployment dry run at about 2.5 MiB compressed. The optional local chain integration test passed using its JavaScript fallback.
- Edge completed the desktop and Bangla mobile journeys. The water guidance rendered with JavaScript disabled. The main resident pages fit 320–1440 px. Axe reported zero WCAG-tagged violations across the five sampled page states. Reports and screenshots are in the verification folder.
- The design-taste checker flagged its full-screen landing-page layout and motion conventions. Aquavelle uses a short service page so residents can reach the tools with less scrolling. No checker waivers were applied.
- The base Aquavelle GeoPackage and the national and Dhaka RiverWatch GeoPackages passed SQLite integrity checks. The historical data and archived models were checked for consistency. Fresh R-INLA fitting, local engineering and water tests, a field usability pilot and live Cloudflare account setup remain external validation steps.
