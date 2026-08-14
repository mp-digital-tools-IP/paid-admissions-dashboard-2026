param(
    [Parameter(Mandatory = $true)][string]$Plan,
    [Parameter(Mandatory = $true)][string]$Contracts,
    [Parameter(Mandatory = $true)][string]$SnapshotAt
)

$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
Push-Location $projectRoot
try {
    python tools/update_dashboard.py --plan $Plan --contracts $Contracts --snapshot-at $SnapshotAt
    if ($LASTEXITCODE -ne 0) { throw 'Проверка и обновление агрегатов завершились ошибкой.' }
    pnpm run check
    if ($LASTEXITCODE -ne 0) { throw 'Тесты или production-сборка завершились ошибкой.' }
    Write-Host 'Готово: агрегаты проверены, тесты и production-сборка прошли.'
} finally {
    Pop-Location
}
