Add-Type -AssemblyName System.Drawing

$assetsDirectory = Join-Path $PSScriptRoot '..\assets'
$masterMarkPath = Join-Path $assetsDirectory 'brand-mark.png'

if (-not (Test-Path -LiteralPath $masterMarkPath)) {
  throw 'The master HostelHub logo was not found at assets/brand-mark.png.'
}

function New-HostelHubAsset {
  param(
    [Parameter(Mandatory = $true)] [string] $OutputPath,
    [Parameter(Mandatory = $true)] [int] $Size,
    [Parameter(Mandatory = $true)] [int] $MarkSize,
    [Parameter(Mandatory = $true)] [bool] $TransparentBackground
  )

  $bitmap = [System.Drawing.Bitmap]::new($Size, $Size)
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  $graphics.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
  $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality

  if ($TransparentBackground) {
    $graphics.Clear([System.Drawing.Color]::Transparent)
  } else {
    $graphics.Clear([System.Drawing.ColorTranslator]::FromHtml('#F5F3FF'))
  }

  $masterMark = [System.Drawing.Image]::FromFile($masterMarkPath)
  $markOffset = [int](($Size - $MarkSize) / 2)
  $graphics.DrawImage($masterMark, $markOffset, $markOffset, $MarkSize, $MarkSize)
  $bitmap.Save($OutputPath, [System.Drawing.Imaging.ImageFormat]::Png)

  $masterMark.Dispose()
  $graphics.Dispose()
  $bitmap.Dispose()
}

New-HostelHubAsset -OutputPath (Join-Path $assetsDirectory 'icon.png') -Size 1024 -MarkSize 830 -TransparentBackground $false
New-HostelHubAsset -OutputPath (Join-Path $assetsDirectory 'adaptive-icon.png') -Size 1024 -MarkSize 690 -TransparentBackground $true
New-HostelHubAsset -OutputPath (Join-Path $assetsDirectory 'splash.png') -Size 1024 -MarkSize 760 -TransparentBackground $true
New-HostelHubAsset -OutputPath (Join-Path $assetsDirectory 'favicon.png') -Size 96 -MarkSize 82 -TransparentBackground $false

Write-Output 'Generated app assets from the HostelHub master logo.'
