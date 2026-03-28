\
param(
  [string]$OutputPath = "",
  [string]$HostName = $env:DB_HOST,
  [string]$Port = $env:DB_PORT,
  [string]$Database = $env:DB_NAME,
  [string]$UserName = $env:DB_USER
)

if ([string]::IsNullOrWhiteSpace($OutputPath)) {
  $timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
  $OutputPath = ".\backup_proyectomgm_$timestamp.dump"
}

if ([string]::IsNullOrWhiteSpace($HostName)) { $HostName = "localhost" }
if ([string]::IsNullOrWhiteSpace($Port)) { $Port = "5432" }

Write-Host "Creating backup at $OutputPath ..."
pg_dump -h $HostName -p $Port -U $UserName -d $Database -Fc -f $OutputPath

if ($LASTEXITCODE -ne 0) {
  throw "Backup failed."
}

Write-Host "Backup completed: $OutputPath"
