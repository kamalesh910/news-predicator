param(
    [string]$Title      = "Breaking: New Political Development Shakes Region",
    [string]$Body       = "A major political development has emerged that analysts say could reshape the regional balance of power. Key stakeholders are responding with a mix of concern and cautious optimism as details continue to emerge.",
    [string]$Source     = "NewsAPI",
    [string]$Url        = "https://example.com/article",
    [switch]$Help
)

if ($Help) {
    Write-Host ""
    Write-Host "inject-article.ps1 - Push a raw news article into the pipeline" -ForegroundColor White
    Write-Host ""
    Write-Host "Usage:"
    Write-Host "  .\inject-article.ps1"
    Write-Host "  .\inject-article.ps1 -Title 'My Topic' -Body 'Article body text' -Source 'NewsAPI'"
    Write-Host ""
    Write-Host "Parameters:"
    Write-Host "  -Title    Article headline (becomes the topic name in trending topics)"
    Write-Host "  -Body     Article body text (used for BERT bias analysis)"
    Write-Host "  -Source   Platform name: NewsAPI, SocialStream, Reuters, etc."
    Write-Host "  -Url      Source URL (optional)"
    Write-Host ""
    Write-Host "The article flows through the full pipeline:"
    Write-Host "  raw-news (Kafka) -> analysis-service (BERT) -> analyzed-news (Kafka)"
    Write-Host "  -> prediction-service (Flink) -> predictions (Kafka)"
    Write-Host "  -> api-gateway (WebSocket) -> dashboard (live update)"
    Write-Host ""
    exit 0
}

function Write-Info { param($m) Write-Host "[INFO]  $m" -ForegroundColor Cyan }
function Write-Ok   { param($m) Write-Host "[OK]    $m" -ForegroundColor Green }
function Write-Err  { param($m) Write-Host "[ERROR] $m" -ForegroundColor Red }

# Generate a unique article ID
$ArticleId = "manual-" + [System.Guid]::NewGuid().ToString("N").Substring(0, 12)
$PublishedAt = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ss.fffZ")

# Build the JSON payload (raw-news schema)
$Payload = @{
    articleId     = $ArticleId
    sourceUrl     = $Url
    title         = $Title
    body          = $Body
    sourceName    = $Source
    publishedAt   = $PublishedAt
    schemaVersion = "1.0"
} | ConvertTo-Json -Compress

Write-Host ""
Write-Host "============================================================" -ForegroundColor White
Write-Host "  Sentinel - Inject Raw Article" -ForegroundColor White
Write-Host "============================================================" -ForegroundColor White
Write-Host ""
Write-Info "Article ID : $ArticleId"
Write-Info "Title      : $Title"
Write-Info "Source     : $Source"
Write-Info "Published  : $PublishedAt"
Write-Host ""

# Check Kafka is reachable
$kafkaCheck = docker exec kafka kafka-broker-api-versions --bootstrap-server localhost:9092 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Err "Kafka is not reachable. Make sure the stack is running: .\start.ps1"
    exit 1
}

# Push to raw-news Kafka topic
Write-Info "Pushing to raw-news Kafka topic..."
$Payload | docker exec -i kafka kafka-console-producer --bootstrap-server localhost:9092 --topic raw-news 2>&1

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Ok "Article injected successfully!"
    Write-Host ""
    Write-Host "  Pipeline flow:" -ForegroundColor White
    Write-Host "  1. analysis-service  - BERT bias scoring (~2-5s)"
    Write-Host "  2. prediction-service - Flink window aggregation (~30-60s)"
    Write-Host "  3. api-gateway       - WebSocket broadcast to dashboard"
    Write-Host "  4. dashboard         - TrendingTopicsTable live update"
    Write-Host ""
    Write-Host "  Watch the dashboard at http://localhost:3000"
    Write-Host "  Or check the API:     http://localhost:4000/trending-topics"
    Write-Host ""
} else {
    Write-Err "Failed to inject article into Kafka."
    exit 1
}
