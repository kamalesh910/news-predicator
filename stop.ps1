param(
    [switch]$Clean,
    [switch]$Help
)

function Write-Info { param($m) Write-Host "[INFO]  $m" -ForegroundColor Cyan }
function Write-Ok   { param($m) Write-Host "[OK]    $m" -ForegroundColor Green }
function Write-Warn { param($m) Write-Host "[WARN]  $m" -ForegroundColor Yellow }
function Write-Err  { param($m) Write-Host "[ERROR] $m" -ForegroundColor Red }

if ($Help) {
    Write-Host ""
    Write-Host "Sentinel - Stop Script" -ForegroundColor White
    Write-Host ""
    Write-Host "  .\stop.ps1           Stop all containers (data volumes preserved)"
    Write-Host "  .\stop.ps1 -Clean    Stop containers AND remove all data volumes"
    Write-Host ""
    exit 0
}

Write-Host ""
Write-Host "============================================================" -ForegroundColor White
Write-Host "  Sentinel - Stopping all services" -ForegroundColor White
Write-Host "============================================================" -ForegroundColor White
Write-Host ""

$dockerInfo = docker info 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Err "Cannot reach Docker daemon. Make sure Docker Desktop is running."
    exit 1
}

if ($Clean) {
    Write-Warn "Clean mode: containers AND volumes will be removed."
    Write-Warn "This permanently deletes all PostgreSQL, Kafka, and Redis data."
    Write-Host ""
    $confirm = Read-Host "Are you sure? (yes/no)"
    if ($confirm -ne "yes") {
        Write-Info "Aborted."
        exit 0
    }
    Write-Host ""
    docker compose down -v --remove-orphans
    Write-Host ""
    Write-Ok "All containers and volumes removed."
} else {
    Write-Info "Stopping containers, keeping volumes..."
    Write-Host ""
    docker compose down --remove-orphans
    Write-Host ""
    Write-Ok "All containers stopped. Data volumes are preserved."
    Write-Host ""
    Write-Host "  Start again:   .\start.ps1"
    Write-Host "  Wipe data:     .\stop.ps1 -Clean"
}

Write-Host ""
