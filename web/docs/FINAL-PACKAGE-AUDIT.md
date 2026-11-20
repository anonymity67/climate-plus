# Final package audit

The supplied collaborator archive passed its ZIP integrity and SHA-256 checks. A clean extraction installed from the lockfile and passed the build and test suite. The review then exercised the built platform in Microsoft Edge and compared the shipped site and data against the project source.

## Findings and fixes

| Finding                                                                                                                                      | Final behaviour                                                                                                                                                  |
| -------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Both rainwater calculators relied on a server request for local arithmetic.                                                                  | After the planner loads, both calculators run in the browser using the same model functions as the API. The result receives focus when the calculation finishes. |
| A direct link to the drawings stopped at the planner heading.                                                                                | The drawings section scrolls into view and receives focus when it mounts.                                                                                        |
| Returning from a RiverWatch detail lost the reader's place.                                                                                  | Keyboard focus returns to the same result when it is visible in the list.                                                                                        |
| A delayed location fix could replace a subsequent area search and send coordinates.                                                          | Starting an area search cancels the pending location result. A fresh nearby search still sends the rounded coordinates for that explicit request.                |
| The evidence table and the response footer failed contrast checks. The response home link's accessible name differed from its visible brand. | Contrast and labelling are corrected. The footer is larger and the home link consistently uses the Aquavelle name.                                               |
| A RiverWatch snap point used a missing marker image, and waterways arriving later could cover the trace.                                     | The map draws the link directly to the recorded snap point and keeps the basemap underneath the trace.                                                           |

## Release checks

- Production build, formatting, type checking, 145 tests and 97 frozen-data checks passed. The dependency audit reported zero vulnerabilities.
- The built local Worker passed all 27 HTTP smoke checks. The Cloudflare deployment dry run accepted the bundle.
- Automated accessibility and overflow checks passed for 12 routes in each of the English and Bangla settings at 390 CSS pixels wide. The browser also verified the drawing link, both disconnected calculators, keyboard focus restoration, the delayed-location regression and trace visibility after detailed waterways load.
- Seven GeoPackages passed SQLite integrity checks. The QGIS project, packaged Office files and original rainwater archive passed structural checks. The package includes the full RiverWatch runs and RainHub inputs. The project checksums are included at the root. Start with [the three-minute walkthrough](DEMO.md).

Automated checks cover the tested states. Live Cloudflare access and field validation remain separate operational steps. River traces and rainwater outputs support inspection and planning. Drinking-water decisions require local source verification and testing.
