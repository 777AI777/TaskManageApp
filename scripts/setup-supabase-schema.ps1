param(
  [string]$ProjectRef = "",
  [string]$DbPassword = "",
  [switch]$LinkProject
)

$ErrorActionPreference = "Stop"

function Read-EnvFile {
  param(
    [string]$Path,
    [hashtable]$Store
  )

  Get-Content $Path | ForEach-Object {
    $line = $_.Trim()
    if (-not $line -or $line.StartsWith("#")) {
      return
    }
    $separatorIndex = $line.IndexOf("=")
    if ($separatorIndex -lt 1) {
      return
    }

    $key = $line.Substring(0, $separatorIndex).Trim()
    $value = $line.Substring($separatorIndex + 1).Trim().Trim('"').Trim("'")
    $Store[$key] = $value
  }
}

$repoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $repoRoot

$envValues = @{}
@(".env.local", "env.local", ".env") | ForEach-Object {
  if (Test-Path $_) {
    Read-EnvFile -Path $_ -Store $envValues
  }
}

if (-not $ProjectRef -and $envValues.ContainsKey("SUPABASE_PROJECT_REF")) {
  $ProjectRef = $envValues["SUPABASE_PROJECT_REF"]
}
if (-not $DbPassword -and $envValues.ContainsKey("SUPABASE_DB_PASSWORD")) {
  $DbPassword = $envValues["SUPABASE_DB_PASSWORD"]
}
if ($envValues.ContainsKey("SUPABASE_ACCESS_TOKEN")) {
  $env:SUPABASE_ACCESS_TOKEN = $envValues["SUPABASE_ACCESS_TOKEN"]
}

if (-not $ProjectRef) {
  throw "SUPABASE_PROJECT_REF が未設定です。.env.local か引数 -ProjectRef で指定してください。"
}
if (-not $DbPassword) {
  throw "SUPABASE_DB_PASSWORD が未設定です。.env.local か引数 -DbPassword で指定してください。"
}

if (-not (Test-Path "supabase/migrations")) {
  throw "supabase/migrations が見つかりません。"
}

$escapedPassword = [Uri]::EscapeDataString($DbPassword)
$dbUrl = "postgresql://postgres:$escapedPassword@db.$ProjectRef.supabase.co:5432/postgres?sslmode=require"

Write-Host "Supabase CLI を確認しています..."
& npx supabase --version | Out-Null
if ($LASTEXITCODE -ne 0) {
  throw "Supabase CLI の実行に失敗しました。npx が使えるか確認してください。"
}

if ($LinkProject) {
  Write-Host "プロジェクトをリンクします: $ProjectRef"
  & npx supabase link --project-ref $ProjectRef --password $DbPassword
  if ($LASTEXITCODE -ne 0) {
    throw "supabase link に失敗しました。"
  }

  Write-Host "リンク済みプロジェクトへマイグレーションを適用します..."
  & npx supabase db push --include-all
  if ($LASTEXITCODE -ne 0) {
    throw "supabase db push に失敗しました。"
  }
} else {
  Write-Host "DB URL 経由でマイグレーションを適用します..."
  & npx supabase db push --db-url $dbUrl --include-all
  if ($LASTEXITCODE -ne 0) {
    throw "supabase db push に失敗しました。"
  }
}

Write-Host "完了: Supabaseスキーマの適用が終わりました。"
