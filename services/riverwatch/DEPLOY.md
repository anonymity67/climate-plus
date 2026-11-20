# Deploying RiverWatch BD

The app is a single FastAPI process. It serves the static Leaflet UI (`web/static`) and the
API (`/api/*`) from the run folders listed in `runs/runs.json`. No database is required.
Reviews are stored as JSON in `data/reviews/`, and re-runs write to `runs/<id>/`.

## Requirements
* 1 vCPU and 1 GB RAM are enough to serve the map. Use **2 GB or more** if analysts will re-run
  the national analysis (about 30 s, roughly 1 GB peak).
* Outbound HTTPS from the browser for basemap tiles (Esri / OpenStreetMap).
* Outbound HTTPS from the server only for *Re-run + refresh Sentinel-2* (Earth Search on AWS).

## Environment variables
| Variable | Default | Meaning |
|---|---|---|
| `RIVERWATCH_ADMIN_TOKEN` | *(empty)* | Turns on analyst review editing and re-runs (header `X-Admin-Token`). Leave it empty for a read-only public map. |
| `RIVERWATCH_CRITICAL_SNAP_M` | `500` | Snap distance used for the *critical to rivers* flag |
| `PORT` | `8000` | Listen port (Docker / PaaS) |
| `RIVERWATCH_ROOT` | repo root | Project root |

Run **one worker** (`--workers 1`). Run state and background jobs live in that one process.
To scale reads, put a CDN or reverse proxy in front. The JSON responses are gzip-compressed.

## Docker / Compose
```sh
docker build -t riverwatch-bd .                         # add --build-arg WITH_POPULATION=0 for a view-only image
docker run -p 8000:8000 -e RIVERWATCH_ADMIN_TOKEN=... riverwatch-bd
# or
RIVERWATCH_ADMIN_TOKEN=... docker compose up -d --build
```
Compose mounts named volumes on `data/reviews` and `runs`, so reviews and re-run results
survive container upgrades.

## Render / Railway / Fly.io
* **Render:** `render.yaml` is included. Connect the repo and Render builds from the Dockerfile and
  generates an admin token. Health check: `/api/health`.
* **Railway / Heroku-style:** the `Procfile` runs uvicorn on `$PORT`.
* **Fly.io:** `fly launch` detects the Dockerfile. Set the secret with `fly secrets set RIVERWATCH_ADMIN_TOKEN=...`
  and mount a volume at `/app/data/reviews`.

## Behind nginx (VM)
```nginx
location / {
    proxy_pass http://127.0.0.1:8000;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_read_timeout 120s;
}
```
Serve the app over HTTPS. The admin token travels in a request header.

## Updating the data
1. `bash scripts/build_all.sh` rebuilds everything from fresh OSM, HydroRIVERS, WorldPop and Sentinel-2 data.
   To use a different dry season, set `S2_START` and `S2_END`.
2. Commit or redeploy `data/inputs`, `data/observations`, `web/static/data` and `runs/`.
3. To add a run, append an entry to `runs/runs.json` with its `out`, `sites`, `rivers`,
   `population`, `pois`, `config` and `observations` paths. The UI lists it automatically.

## Security notes
* The read-only endpoints are public by design. If facility-level links must stay internal
  (see method docs), put the whole app behind SSO or basic auth at the proxy.
* The download endpoint only serves a fixed allow-list of run files.
