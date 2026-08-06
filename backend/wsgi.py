"""WSGI entry point.

Local development:   flask --app wsgi run --debug --port 8000
Local prod-like:     waitress-serve --port=8000 --threads=8 wsgi:app
Container:           gunicorn -c gunicorn.conf.py wsgi:app
"""

from __future__ import annotations

from dotenv import load_dotenv

# Loaded before create_app so Settings sees the file. Real environment
# variables always win over .env values.
load_dotenv(".env", override=False)
load_dotenv(".env.local", override=False)

from app import create_app  # noqa: E402

app = create_app()

if __name__ == "__main__":  # pragma: no cover
    app.run(host="127.0.0.1", port=8000, debug=app.config["SETTINGS"].DEBUG)
