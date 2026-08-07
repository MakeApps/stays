"""Gunicorn configuration.

UNVERIFIED on this machine: gunicorn has no Windows support (it needs ``fcntl``),
so this has only ever been read, not run. ``waitress-serve --port=8000 wsgi:app``
is the local production-like check.
"""

import os

bind = "0.0.0.0:8000"

# Threads, not processes alone: this workload is database-bound rather than
# CPU-bound, so threads spend their time waiting on MySQL instead of competing
# for cores.
workers = int(os.getenv("WEB_CONCURRENCY", str((os.cpu_count() or 2) * 2 + 1)))
worker_class = "gthread"
threads = 4

timeout = 60
graceful_timeout = 30
keepalive = 5

# Bounds any slow leak. The jitter staggers recycling so workers do not all
# restart at the same moment.
max_requests = 1000
max_requests_jitter = 100

# False so each worker creates its own engine after forking. Sharing a
# pre-forked connection pool across workers corrupts it.
preload_app = False

# The app emits its own structured access log with request ids and timings, so
# gunicorn's would be duplicate noise.
accesslog = None
errorlog = "-"
