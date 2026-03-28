\
param(
  [Parameter(Mandatory = $true)]
  [string]$InputPath,
  [string]$HostName = $env:DB_HOST,
  [string]$Port = $env:DB_PORT,
  [string]$Database = $env:DB_NAME,
  [string]$UserName = $env:DB_USER
)

if (-not (Test-Path $InputPath)) {
  throw "Backup file not found: $InputPath"
}

if ([string]::IsNullOrWhiteSpace($HostName)) { $HostName = "localhost" }
if ([string]::IsNullOrWhiteSpace($Port)) { $Port = "5432" }

Write-Host "Restoring backup from $InputPath ..."
pg_restore -h $HostName -p $Port -U $UserName -d $Database --clean --if-exists --no-owner --no-privileges $InputPath

if ($LASTEXITCODE -ne 0) {
  throw "Restore failed."
}

Write-Host "Restore completed from: $InputPath"
