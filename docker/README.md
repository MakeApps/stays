# Containers — unverified

Docker is not installed on the machine this was built on, so **nothing in this
directory has been built or run.** It is written from the same configuration the
app already uses locally, but the first `docker build` should be treated as a
debugging session, not a deploy.

Shipping compose files as "production-ready" without ever running them is how a
deploy fails at the worst possible moment. This file exists to say so plainly
rather than let the presence of a Dockerfile imply more than it should.

## Expect to fix these first

- **`backend/.env.docker` does not exist yet.** Copy `backend/.env.example` and
  set `DATABASE_URL` to the compose service host (`db`, not `127.0.0.1`), plus
  real `SECRET_KEY` and `JWT_SECRET`. The app deliberately refuses to boot in
  production without them.
- **Pin `minio/minio:latest`** to a digest before production.
- **The MySQL healthcheck** uses an unauthenticated ping, which works for the
  default image but will need credentials if you lock the server down.
- **`REPORTS_PDF_ENGINE=weasyprint`** is set in the image because the runtime
  libraries and Thai fonts are installed there. It stays `none` locally, where
  GTK on Windows is impractical.

## Running

```bash
cp backend/.env.example backend/.env.docker   # then edit it
DB_ROOT_PASSWORD=choose-something docker compose -f docker/docker-compose.yml up --build
```

## Why the migration is its own service

`migrate` runs once and exits, and `api` waits for it to complete. Running
`alembic upgrade head` from the API's entrypoint instead would have every
replica attempt the same DDL simultaneously on a scaled deploy.
