<#
    Start the whole stack for local testing.

        .\dev.ps1              # start API + web
        .\dev.ps1 -Reset       # wipe and reseed the demo data first
        .\dev.ps1 -Stop        # stop everything

    Kills anything already holding the ports first. A Flask process started
    before a route was added keeps serving the old route map, which shows up as
    a 404 on an endpoint that demonstrably exists  -  restarting is the fix, so
    this script always does it rather than leaving a stale one running.
#>
param(
    [switch]$Reset,
    [switch]$Stop
)

# Continue, not Stop: PowerShell 5.1 wraps a native command's stderr in an
# ErrorRecord, and alembic logs INFO there - with Stop that is fatal. Native
# calls below check $LASTEXITCODE instead.
$ErrorActionPreference = "Continue"
$root = $PSScriptRoot
$backend = Join-Path $root "backend"
$frontend = Join-Path $root "frontend"
$python = Join-Path $backend ".venv\Scripts\python.exe"

function Stop-Stack {
    Get-CimInstance Win32_Process -Filter "Name='python.exe'" |
        Where-Object { $_.CommandLine -like "*wsgi*" } |
        ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }

    Get-NetTCPConnection -LocalPort 3000, 3002, 8000 -State Listen -ErrorAction SilentlyContinue |
        Select-Object -ExpandProperty OwningProcess -Unique |
        ForEach-Object { Stop-Process -Id $_ -Force -ErrorAction SilentlyContinue }

    Start-Sleep -Seconds 2
}

Write-Host "Stopping anything already running..." -ForegroundColor DarkGray
Stop-Stack

if ($Stop) {
    Write-Host "Stopped." -ForegroundColor Green
    exit 0
}

if (-not (Test-Path $python)) {
    Write-Host "No virtualenv at backend\.venv  -  run the setup in README.md first." -ForegroundColor Red
    exit 1
}

# --- database ---
# Run through cmd: alembic and flask log INFO to stderr, and PowerShell 5.1
# surfaces a native command's stderr as a NativeCommandError even on success.
Write-Host "Applying migrations..." -ForegroundColor DarkGray
Push-Location $backend
$env:PYTHONIOENCODING = "utf-8"

cmd /c """$backend\.venv\Scripts\alembic.exe"" upgrade head >nul 2>&1"
if ($LASTEXITCODE -ne 0) {
    Pop-Location
    Write-Host "Migrations failed. Is MySQL running?" -ForegroundColor Red
    exit 1
}

if ($Reset) {
    Write-Host "Resetting demo data..." -ForegroundColor Yellow
    $seeded = cmd /c """$backend\.venv\Scripts\flask.exe"" --app wsgi seed-demo --force 2>&1"
    $seeded | Where-Object { $_ -match "Seeded" } | ForEach-Object { Write-Host "  $_" -ForegroundColor DarkGray }
}
Pop-Location

# --- api ---
Write-Host "Starting API on :8000..." -ForegroundColor DarkGray
$env:PYTHONIOENCODING = "utf-8"
Start-Process -FilePath $python `
    -ArgumentList "-m", "flask", "--app", "wsgi", "run", "--port", "8000" `
    -WorkingDirectory $backend -WindowStyle Hidden

# --- web ---
Write-Host "Starting web on :3000..." -ForegroundColor DarkGray
Start-Process -FilePath "cmd.exe" -ArgumentList "/c", "npm run dev" `
    -WorkingDirectory $frontend -WindowStyle Hidden

# --- wait for both ---
$deadline = (Get-Date).AddSeconds(90)
$apiUp = $false
$webUp = $false

while ((Get-Date) -lt $deadline -and -not ($apiUp -and $webUp)) {
    Start-Sleep -Seconds 2
    if (-not $apiUp) {
        try { $apiUp = (Invoke-WebRequest "http://127.0.0.1:8000/healthz" -UseBasicParsing -TimeoutSec 3).StatusCode -eq 200 } catch {}
    }
    if (-not $webUp) {
        try { $webUp = (Invoke-WebRequest "http://localhost:3000/login" -UseBasicParsing -TimeoutSec 3).StatusCode -eq 200 } catch {}
    }
}

Write-Host ""
if ($apiUp -and $webUp) {
    # Read from the database, which is where the credential actually lives.
    # This used to echo ADMIN_EMAIL/ADMIN_PASSWORD out of .env.local, which
    # printed whatever the file said whether or not it matched the account you
    # could sign in with. The password is deliberately not shown: it is stored
    # only as an Argon2 hash and nothing can recover it.
    $email = ""
    try {
        $email = & (Join-Path $backend ".venv\Scripts\python.exe") -c @"
from app import create_app
from app.extensions import db
from sqlalchemy import text
app = create_app()
with app.app_context():
    row = db.session.execute(text(
        'select email from users where deleted_at is null and role = :r order by created_at limit 1'
    ), {'r': 'admin'}).first()
    print(row[0] if row else '')
"@ 2>$null | Select-Object -Last 1
    } catch {}
    if (-not $email) { $email = "(no admin account - run: flask --app wsgi create-admin)" }

    Write-Host "  Ready." -ForegroundColor Green
    Write-Host ""
    Write-Host "    http://localhost:3000"
    Write-Host "    $email"
    Write-Host "    (password as set in the app - Users > Edit to change it)" -ForegroundColor DarkGray
    Write-Host ""
    Write-Host "  Stop with:  .\dev.ps1 -Stop" -ForegroundColor DarkGray
} else {
    Write-Host "  API up: $apiUp   Web up: $webUp" -ForegroundColor Red
    Write-Host "  Something did not start. Run each by hand to see the error:" -ForegroundColor Red
    Write-Host "    cd backend;  .venv\Scripts\flask.exe --app wsgi run --port 8000"
    Write-Host "    cd frontend; npm run dev"
    exit 1
}
