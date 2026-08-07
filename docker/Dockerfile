# syntax=docker/dockerfile:1
#
# UNVERIFIED: Docker is not installed on the development machine, so this has
# never been built or run. Treat the first `docker build` as a debugging
# session rather than a deploy. See docker/README.md.

FROM python:3.12-slim AS runtime

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1

# WeasyPrint's runtime libraries plus Thai fonts. The fonts are not optional:
# without them every baht sign and Thai vendor name in a PDF renders as tofu.
RUN apt-get update && apt-get install -y --no-install-recommends \
      libpango-1.0-0 libpangoft2-1.0-0 libcairo2 libgdk-pixbuf-2.0-0 \
      fonts-thai-tlwg fonts-noto-core curl \
 && rm -rf /var/lib/apt/lists/*

# Non-root: a container running as root is one escape away from root on the host.
RUN useradd --uid 10001 --create-home --shell /usr/sbin/nologin app

WORKDIR /srv/app

# Dependencies first so a code change does not invalidate the install layer.
# PyMySQL is pure Python, which is why no build toolchain is needed here.
COPY backend/pyproject.toml ./
RUN pip install --no-cache-dir ".[prod]"

COPY --chown=app:app backend/ ./
USER app

ARG GIT_SHA=dev
ENV APP_GIT_SHA=${GIT_SHA} \
    REPORTS_PDF_ENGINE=weasyprint

EXPOSE 8000

# Liveness only. /healthz never touches the database, so a database blip cannot
# trigger a restart storm across every replica.
HEALTHCHECK --interval=30s --timeout=3s --start-period=20s --retries=3 \
  CMD curl -fsS http://localhost:8000/healthz || exit 1

CMD ["gunicorn", "-c", "gunicorn.conf.py", "wsgi:app"]
