param(
    [switch]$Build,
    [switch]$Stop,
    [switch]$Clean,
    [switch]$Status,
    [switch]$Logs,
    [string]$Service = "",
    [switch]$Help
)

function Write-Info   { param($m) Write-Host "[INFO]  $m" -ForegroundColor Cyan }
function Write-Ok     { param($m) Write-Host "[OK]    $m" -ForegroundColor Green }
function Write-Warn   { param($m) Write-Host "[WARN]  $m" -ForegroundColor Yellow }
function Write-Err    { param($m) Write-Host "[ERROR] $m" -ForegroundColor Red }
function Write-Header { param($m) Write-Host "`n$m" -ForegroundColor White }

$HealthUrls = @{
    "ingestion-service"  = "http://localhost:3001/health"
    "analysis-service"   = "http://localhost:8000/health"
    "prediction-service" = "http://localhost:8080/health"
    "api-gateway"        = "http://localhost:4000/health"
    "dashboard-ui"       = "http://localhost:3000"
}
$HealthTimeoutSec = 180
$PollIntervalSec  = 3

if ($Help) {
    Write-Host ""
    Write-Host "AI News Reader and Predictor - Start Script" -ForegroundColor White
    Write-Host ""
    Write-Host "  .\start.ps1                          Start the full stack"
    Write-Host "  .\start.ps1 -Build                   Force rebuild all images then start"
    Write-Host "  .\start.ps1 -Stop                    Stop all containers (data preserved)"
    Write-Host "  .\start.ps1 -Clean                   Stop and delete all data volumes"
    Write-Host "  .\start.ps1 -Status                  Show health of every service"
    Write-Host "  .\start.ps1 -Logs                    Tail logs from all services"
    Write-Host "  .\start.ps1 -Logs -Service api-gateway   Tail logs for one service"
    Write-Host ""
    exit 0
}

function Check-Prerequisites {
    Write-Header "Checking prerequisites..."
    $ok = $true
    try {
        $v = (docker --version 2>&1)
        Write-Ok "Docker found: $v"
    } catch {
        Write-Err "Docker is not installed. Get it from https://docs.docker.com/get-docker/"
        $ok = $false
    }
    try {
        $null = docker info 2>&1
        if ($LASTEXITCODE -ne 0) { throw "daemon not running" }
        Write-Ok "Docker daemon is running"
    } catch {
        Write-Err "Docker daemon is not running. Start Docker Desktop and try again."
        $ok = $false
    }
    try {
        $cv = (docker compose version 2>&1)
        Write-Ok "Docker Compose found: $cv"
    } catch {
        Write-Err "Docker Compose not found."
        $ok = $false
    }
    if (-not $ok) {
        Write-Host ""
        Write-Err "Fix the issues above and re-run the script."
        exit 1
    }
}

function Setup-Env {
    if (-not (Test-Path ".env")) {
        if (Test-Path ".env.example") {
            Write-Warn ".env not found - copying from .env.example"
            Copy-Item ".env.example" ".env"
            Write-Warn "Review .env and update POSTGRES_PASSWORD before production use."
        } else {
            Write-Warn ".env.example not found - Docker Compose will use built-in defaults."
        }
    } else {
        Write-Ok ".env file found"
    }
}

function Wait-ForService {
    param([string]$Name, [string]$Url)
    $elapsed = 0
    Write-Host ("  Waiting for {0,-22}" -f "$Name...") -NoNewline
    while ($true) {
        try {
            $resp = Invoke-WebRequest -Uri $Url -TimeoutSec 4 -UseBasicParsing -ErrorAction Stop
            if ($resp.StatusCode -eq 200) {
                Write-Host " " -NoNewline
                Write-Host "healthy" -ForegroundColor Green
                return $true
            }
        } catch { }
        if ($elapsed -ge $HealthTimeoutSec) {
            Write-Host " " -NoNewline
            Write-Host "TIMED OUT after ${HealthTimeoutSec}s" -ForegroundColor Red
            return $false
        }
        Start-Sleep -Seconds $PollIntervalSec
        $elapsed += $PollIntervalSec
        Write-Host "." -NoNewline
    }
}

function Wait-ForAllServices {
    Write-Header "Waiting for services to become healthy..."
    Write-Info "(analysis-service may take 60-90s while the BERT model loads)"
    Write-Host ""
    $failed = $false
    foreach ($name in @("ingestion-service","analysis-service","prediction-service","api-gateway","dashboard-ui")) {
        $result = Wait-ForService -Name $name -Url $HealthUrls[$name]
        if (-not $result) { $failed = $true }
    }
    Write-Host ""
    if ($failed) {
        Write-Err "One or more services failed to become healthy."
        Write-Host ""
        Write-Host "  Check all logs:    .\start.ps1 -Logs"
        Write-Host "  Check one service: .\start.ps1 -Logs -Service analysis-service"
        exit 1
    }
}

function Print-Urls {
    Write-Header "All services are running!"
    Write-Host ""
    Write-Host "  Dashboard UI          " -NoNewline; Write-Host "http://localhost:3000" -ForegroundColor Green
    Write-Host "  API Gateway           http://localhost:4000"
    Write-Host "  API Gateway Health    http://localhost:4000/health"
    Write-Host "  Ingestion Health      http://localhost:3001/health"
    Write-Host "  Analysis Health       http://localhost:8000/health"
    Write-Host "  Prediction Health     http://localhost:8080/health"
    Write-Host ""
    Write-Host "  PostgreSQL            localhost:5432  (db: ainews)"
    Write-Host "  Redis                 localhost:6379"
    Write-Host "  Kafka                 localhost:29092"
    Write-Host ""
    Write-Host "  Stop:       .\start.ps1 -Stop"
    Write-Host "  View logs:  .\start.ps1 -Logs"
    Write-Host ""
    try {
        Start-Process "http://localhost:3000"
        Write-Ok "Opening dashboard in your browser..."
    } catch {
        Write-Info "Open http://localhost:3000 in your browser."
    }
}

function Show-Status {
    Write-Header "Container status"
    Write-Host ""
    docker compose ps
    Write-Host ""
    Write-Header "Health check"
    Write-Host ""
    foreach ($name in @("ingestion-service","analysis-service","prediction-service","api-gateway","dashboard-ui")) {
        $url = $HealthUrls[$name]
        try {
            $resp = Invoke-WebRequest -Uri $url -TimeoutSec 4 -UseBasicParsing -ErrorAction Stop
            Write-Host ("  {0,-26}" -f $name) -NoNewline
            Write-Host "healthy (HTTP 200)" -ForegroundColor Green
        } catch {
            Write-Host ("  {0,-26}" -f $name) -NoNewline
            Write-Host "unreachable" -ForegroundColor Red
        }
    }
    Write-Host ""
}

if ($Stop) {
    Write-Header "Stopping all containers..."
    docker compose stop
    Write-Ok "All containers stopped. Data volumes are preserved."
    Write-Host "  Start again: .\start.ps1"
    Write-Host "  Wipe data:   .\start.ps1 -Clean"
    exit 0
}

if ($Clean) {
    Write-Header "Stopping containers and removing all data volumes..."
    Write-Host ""
    Write-Warn "This permanently deletes all PostgreSQL, Kafka, and Redis data."
    $confirm = Read-Host "  Are you sure? (yes/no)"
    if ($confirm -ne "yes") { Write-Info "Aborted."; exit 0 }
    docker compose down -v
    Write-Ok "All containers and volumes removed."
    exit 0
}

if ($Status) { Show-Status; exit 0 }

if ($Logs) {
    if ($Service -ne "") { docker compose logs -f $Service }
    else { docker compose logs -f }
    exit 0
}

# Default: START
Write-Host ""
Write-Host "============================================" -ForegroundColor White
Write-Host "  AI News Reader and Predictor" -ForegroundColor White
Write-Host "============================================" -ForegroundColor White
Write-Host ""

Check-Prerequisites
Setup-Env

Write-Header "Starting all services..."
Write-Host ""

if ($Build) { docker compose up -d --build }
else { docker compose up -d }

Write-Host ""
Wait-ForAllServices
Print-Urls