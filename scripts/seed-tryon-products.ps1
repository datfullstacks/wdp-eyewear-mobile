param(
  [switch]$DryRun,
  [string]$BaseUrl = $env:BASE_URL,
  [string]$Token = $env:TOKEN,
  [string]$TryOnEffectPath = $(if ($env:TRYON_EFFECT_PATH) { $env:TRYON_EFFECT_PATH } else { "effects/test_TeethTone" }),
  [string]$DemoGlbUrl = $env:DEMO_GLB_URL,
  [string]$DemoUsdzUrl = $env:DEMO_USDZ_URL
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

if ([string]::IsNullOrWhiteSpace($BaseUrl)) {
  throw "BASE_URL is required. Set -BaseUrl or env BASE_URL."
}

if ([string]::IsNullOrWhiteSpace($Token) -and -not $DryRun) {
  throw "TOKEN is required unless -DryRun is used. Set -Token or env TOKEN."
}

$headers = @{
  accept = "application/json"
}
if (-not [string]::IsNullOrWhiteSpace($Token)) {
  $headers.Authorization = "Bearer $Token"
}

function Invoke-ApiGet([string]$Url) {
  Invoke-RestMethod -Uri $Url -Method Get -Headers $headers
}

function Invoke-ApiPut([string]$Url, [object]$Body) {
  $json = $Body | ConvertTo-Json -Depth 100
  if ($DryRun) {
    return [pscustomobject]@{
      dryRun = $true
      body = $json
    }
  }
  Invoke-RestMethod -Uri $Url -Method Put -Headers $headers -ContentType "application/json" -Body $json
}

function To-Text($v) {
  if ($null -eq $v) { return "" }
  return [string]$v
}

function Asset-Format($asset) {
  return (To-Text $asset.format).Trim().ToLowerInvariant()
}

function Asset-Type($asset) {
  return (To-Text $asset.assetType).Trim().ToLowerInvariant()
}

function Product-Type($product) {
  return (To-Text $product.type).Trim().ToLowerInvariant()
}

function Get-Products {
  $page = 1
  $limit = 100
  $all = @()
  while ($true) {
    $url = "$BaseUrl/api/products?page=$page&limit=$limit"
    $res = Invoke-ApiGet $url
    $data = @($res.data)
    if ($data.Count -eq 0) { break }
    $all += $data
    $totalPages = [int]($res.pagination.totalPages)
    if ($page -ge $totalPages) { break }
    $page++
  }
  return $all
}

function Ensure-DemoAssets($product) {
  $assets = @()
  if ($product.media -and $product.media.assets) {
    $assets = @($product.media.assets)
  }

  $glbAsset = $assets | Where-Object { (Asset-Type $_) -eq "3d" -and (Asset-Format $_) -in @("glb", "gltf") } | Select-Object -First 1
  $usdzAsset = $assets | Where-Object { (Asset-Type $_) -eq "3d" -and (Asset-Format $_) -eq "usdz" } | Select-Object -First 1
  $modified = $false

  if (-not $glbAsset -and -not [string]::IsNullOrWhiteSpace($DemoGlbUrl)) {
    $assets += [pscustomobject]@{
      assetType = "3d"
      role = "try_on"
      format = "glb"
      url = $DemoGlbUrl
      ar = @{
        glbUrl = $DemoGlbUrl
        usdzUrl = $DemoUsdzUrl
      }
    }
    $modified = $true
  }

  if (-not $usdzAsset -and -not [string]::IsNullOrWhiteSpace($DemoUsdzUrl)) {
    $assets += [pscustomobject]@{
      assetType = "3d"
      role = "try_on"
      format = "usdz"
      url = $DemoUsdzUrl
      ar = @{
        glbUrl = $DemoGlbUrl
        usdzUrl = $DemoUsdzUrl
      }
    }
    $modified = $true
  }

  return [pscustomobject]@{
    assets = $assets
    modified = $modified
  }
}

function Select-RequiredTryOnAssets($assets) {
  $glb = $assets | Where-Object { (Asset-Type $_) -eq "3d" -and (Asset-Format $_) -in @("glb", "gltf") } | Select-Object -First 1
  $usdz = $assets | Where-Object { (Asset-Type $_) -eq "3d" -and (Asset-Format $_) -eq "usdz" } | Select-Object -First 1

  return [pscustomobject]@{
    glb = $glb
    usdz = $usdz
  }
}

function Get-AssetId($asset) {
  $id = To-Text $asset._id
  if ([string]::IsNullOrWhiteSpace($id)) {
    $id = To-Text $asset.id
  }
  return $id
}

Write-Host "Loading products from $BaseUrl ..."
$products = @(Get-Products)
Write-Host "Fetched $($products.Count) products."

$targets = @(
  $products | Where-Object {
    $t = Product-Type $_
    $t -eq "frame" -or $t -eq "sunglasses"
  }
)

Write-Host "Target products (frame/sunglasses): $($targets.Count)"
Write-Host "DryRun: $DryRun"
Write-Host "TryOnEffectPath: $TryOnEffectPath"

$stats = [ordered]@{
  total = $targets.Count
  updated = 0
  skippedMissing3d = 0
  skippedNoId = 0
  failed = 0
}

foreach ($product in $targets) {
  $id = To-Text $product._id
  $name = To-Text $product.name

  if ([string]::IsNullOrWhiteSpace($id)) {
    Write-Warning "Skip product without id: $name"
    $stats.skippedNoId++
    continue
  }

  try {
    $current = $product
    $ensured = Ensure-DemoAssets $current

    if ($ensured.modified) {
      $assetPayload = @{
        media = @{
          assets = $ensured.assets
        }
      }
      Write-Host "[$id] $name -> adding demo 3d assets ..."
      [void](Invoke-ApiPut "$BaseUrl/api/products/$id" $assetPayload)

      if (-not $DryRun) {
        $refetched = Invoke-ApiGet "$BaseUrl/api/products/$id"
        $current = $refetched.data
      } else {
        $current = [pscustomobject]@{
          _id = $id
          name = $name
          media = @{
            assets = $ensured.assets
          }
        }
      }
    }

    $assets = @()
    if ($current.media -and $current.media.assets) {
      $assets = @($current.media.assets)
    }

    $picked = Select-RequiredTryOnAssets $assets
    if (-not $picked.glb -or -not $picked.usdz) {
      Write-Warning "[$id] $name -> missing glb/usdz, skip."
      $stats.skippedMissing3d++
      continue
    }

    $glbId = Get-AssetId $picked.glb
    $usdzId = Get-AssetId $picked.usdz
    if ([string]::IsNullOrWhiteSpace($glbId) -or [string]::IsNullOrWhiteSpace($usdzId)) {
      Write-Warning "[$id] $name -> missing asset _id after update, skip."
      $stats.skippedMissing3d++
      continue
    }

    $publishPayload = @{
      media = @{
        assets = $assets
        tryOn = @{
          enabled = $true
          status = "published"
          arUrl = $TryOnEffectPath
          assetIds = @($glbId, $usdzId)
        }
      }
    }

    Write-Host "[$id] $name -> publish tryOn ..."
    [void](Invoke-ApiPut "$BaseUrl/api/products/$id" $publishPayload)
    $stats.updated++
  } catch {
    $stats.failed++
    Write-Warning "[$id] $name -> failed: $($_.Exception.Message)"
  }
}

Write-Host ""
Write-Host "==== TryOn seed summary ===="
$stats.GetEnumerator() | ForEach-Object {
  Write-Host ("{0}: {1}" -f $_.Key, $_.Value)
}
