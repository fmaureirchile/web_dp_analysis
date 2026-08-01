param(
  [Parameter(Mandatory = $true)]
  [string]$DatabaseUrl,

  [string]$RedisUrl = "redis://localhost:6379",

  [ValidateSet("test", "development", "production")]
  [string]$NodeEnv = "test",

  [ValidateRange(1, 65535)]
  [int]$AppPort = 3000,

  [switch]$SkipConnectivityCheck,

  [string]$OutputReportPath
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"
if (Get-Variable -Name PSNativeCommandUseErrorActionPreference -Scope Global -ErrorAction SilentlyContinue) {
  $global:PSNativeCommandUseErrorActionPreference = $false
}

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"

if ([string]::IsNullOrWhiteSpace($OutputReportPath)) {
  $OutputReportPath = Join-Path $repoRoot ("test-lab/golden-results/stage3-apto-validation-{0}.md" -f $timestamp)
}

$reportDir = Split-Path -Parent $OutputReportPath
if (-not (Test-Path $reportDir)) {
  New-Item -Path $reportDir -ItemType Directory -Force | Out-Null
}

$logDir = Join-Path $repoRoot "test-lab/golden-results/logs"
if (-not (Test-Path $logDir)) {
  New-Item -Path $logDir -ItemType Directory -Force | Out-Null
}

function Mask-DbUrl {
  param([string]$Value)

  try {
    $builder = New-Object System.UriBuilder($Value)
    if (-not [string]::IsNullOrWhiteSpace($builder.Password)) {
      $builder.Password = "***"
    }
    return $builder.Uri.AbsoluteUri
  } catch {
    return "invalid_url"
  }
}

function Test-DbTcpConnectivity {
  param([string]$Value)

  $uri = New-Object System.Uri($Value)
  $hostName = $uri.Host
  $port = if ($uri.Port -gt 0) { $uri.Port } else { 5432 }

  $probe = Test-NetConnection -ComputerName $hostName -Port $port -WarningAction SilentlyContinue
  if (-not $probe.TcpTestSucceeded) {
    throw ("No se puede conectar a {0}:{1}" -f $hostName, $port)
  }
}

$script:stepResults = @()

function Invoke-Step {
  param(
    [string]$Name,
    [string]$CommandLabel,
    [scriptblock]$Action
  )

  Write-Host ""
  Write-Host ("==> {0}" -f $Name) -ForegroundColor Cyan
  Write-Host ("Cmd: {0}" -f $CommandLabel) -ForegroundColor DarkCyan

  $startedAt = Get-Date
  $lines = @()
  $capturedError = $null
  $previousErrorAction = $ErrorActionPreference
  $ErrorActionPreference = "Continue"
  try {
    $lines = & $Action 2>&1
  } catch {
    $capturedError = $_
    $lines = @($_.Exception.Message)
    $global:LASTEXITCODE = 1
  } finally {
    $ErrorActionPreference = $previousErrorAction
  }
  $exitCode = 0
  if (Get-Variable -Name LASTEXITCODE -Scope Global -ErrorAction SilentlyContinue) {
    $exitCode = $global:LASTEXITCODE
  }
  $durationSec = [Math]::Round(((Get-Date) - $startedAt).TotalSeconds, 2)

  $logName = "stage3-apto-{0}-{1}.log" -f $timestamp, (($Name -replace "[^a-zA-Z0-9]", "-").ToLowerInvariant())
  $logPath = Join-Path $logDir $logName

  if ($lines) {
    $renderedLines = @()
    foreach ($line in @($lines)) {
      $text = [string]$line
      $renderedLines += $text
      Write-Host $text
    }
    ($renderedLines -join [Environment]::NewLine) | Set-Content -Path $logPath -Encoding UTF8
  } else {
    "(sin salida)" | Set-Content -Path $logPath -Encoding UTF8
  }

  $status = if ($exitCode -eq 0) { "OK" } else { "FAILED" }

  $script:stepResults += [PSCustomObject]@{
    Name = $Name
    Command = $CommandLabel
    Status = $status
    ExitCode = $exitCode
    DurationSec = $durationSec
    LogPath = $logPath
  }

  if ($exitCode -ne 0) {
    if ($capturedError) {
      Write-Host ($capturedError | Out-String) -ForegroundColor Red
    }
    throw "Fallo en paso: $Name"
  }
}

$overallStatus = "FAILED"
$runStartedAt = Get-Date
$previousLocation = Get-Location

try {
  Set-Location $repoRoot

  $env:NODE_ENV = $NodeEnv
  $env:APP_PORT = "$AppPort"
  $env:REDIS_URL = $RedisUrl
  $env:DATABASE_URL = $DatabaseUrl
  $env:USE_PRISMA_PERSISTENCE = "true"

  if (-not $SkipConnectivityCheck) {
    Invoke-Step -Name "Conectividad DB" -CommandLabel "Test-NetConnection host/port de DATABASE_URL" -Action {
      Test-DbTcpConnectivity -Value $env:DATABASE_URL
      Write-Output "Conectividad TCP OK"
    }
  }

  Invoke-Step -Name "Validar entorno" -CommandLabel "npm run env:validate" -Action {
    npm run env:validate
  }

  Invoke-Step -Name "Aplicar migraciones" -CommandLabel "npm run db:migrate:deploy" -Action {
    npm run db:migrate:deploy
  }

  Invoke-Step -Name "Generar cliente Prisma" -CommandLabel "npm run db:generate" -Action {
    npm run db:generate
  }

  Invoke-Step -Name "Tests integracion" -CommandLabel "npm run test:integration" -Action {
    npm run test:integration
  }

  $overallStatus = "APTO"
} catch {
  Write-Host ""
  Write-Host $_.Exception.Message -ForegroundColor Red
} finally {
  Set-Location $previousLocation
}

$elapsedSec = [Math]::Round(((Get-Date) - $runStartedAt).TotalSeconds, 2)
$maskedDbUrl = Mask-DbUrl -Value $DatabaseUrl
$reportDate = Get-Date -Format 'yyyy-MM-dd HH:mm:ss'

$reportLines = @(
  "# Reporte one-shot - Validacion APTO Etapa 3",
  "",
  "- Fecha: $reportDate",
  "- Estado final: $overallStatus",
  "- Duracion total (s): $elapsedSec",
  "",
  "## Parametros de ejecucion",
  "",
  "- NODE_ENV: $NodeEnv",
  "- APP_PORT: $AppPort",
  "- REDIS_URL: $RedisUrl",
  "- DATABASE_URL: $maskedDbUrl",
  "- USE_PRISMA_PERSISTENCE: true",
  "- SkipConnectivityCheck: $SkipConnectivityCheck",
  "",
  "## Resultado por paso",
  "",
  "| Paso | Comando | Estado | Exit code | Duracion (s) | Log |",
  "|---|---|---|---:|---:|---|"
)

foreach ($item in $script:stepResults) {
  $repoRootPath = (Resolve-Path $repoRoot).Path
  $resolvedLogPath = (Resolve-Path $item.LogPath).Path
  $relativeLogPath = $resolvedLogPath.Replace($repoRootPath + "\\", "").Replace("\\", "/")
  $reportLines += "| $($item.Name) | $($item.Command) | $($item.Status) | $($item.ExitCode) | $($item.DurationSec) | $relativeLogPath |"
}

$reportLines += ""
$reportLines += "## Criterio APTO"
$reportLines += ""
$reportLines += "APTO requiere todos los pasos en estado OK."

$reportLines | Set-Content -Path $OutputReportPath -Encoding UTF8

Write-Host ""
Write-Host ("Reporte generado: {0}" -f $OutputReportPath) -ForegroundColor Green

if ($overallStatus -ne "APTO") {
  exit 1
}

exit 0
