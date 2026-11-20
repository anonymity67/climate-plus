# RiverWatch BD: web GIS server (FastAPI + Leaflet) with the RiverWatch pipeline.
FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 PYTHONWARNINGS=ignore \
    RIVERWATCH_ROOT=/app PORT=8000
WORKDIR /app

COPY requirements-web.txt .
RUN pip install --no-cache-dir -r requirements-web.txt

COPY riverwatch ./riverwatch
COPY webapp ./webapp
COPY web ./web
COPY scripts ./scripts
COPY configs ./configs
COPY config.json ./
COPY gee ./gee
COPY data ./data
COPY runs ./runs
COPY tests ./tests
COPY README.md DEPLOY.md ./

# Population raster (WorldPop 2020, CC BY 4.0) is needed only for analyst re-runs.
# Build with --build-arg WITH_POPULATION=0 for a smaller, view-only image.
ARG WITH_POPULATION=1
RUN if [ "$WITH_POPULATION" = "1" ]; then \
      python scripts/fetch_data.py --serve-only && python scripts/prepare_population.py \
      && rm -f .cache/raw/bgd_ppp_2020.tif; fi

RUN useradd -m rw && chown -R rw:rw /app
USER rw
EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s CMD python -c "import urllib.request,os;urllib.request.urlopen(f'http://127.0.0.1:{os.environ.get(\"PORT\",\"8000\")}/api/health')"
# Single worker: run state, review files and background re-runs live in one process.
CMD ["sh", "-c", "uvicorn webapp.main:app --host 0.0.0.0 --port ${PORT} --proxy-headers --forwarded-allow-ips='*' --workers 1"]
