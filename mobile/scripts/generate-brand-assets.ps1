Add-Type -AssemblyName System.Drawing

$assetsDirectory = Join-Path $PSScriptRoot '..\assets'

function New-HostelHubArtwork {
  param(
    [Parameter(Mandatory = $true)] [string] $OutputPath,
    [Parameter(Mandatory = $true)] [int] $Size,
    [Parameter(Mandatory = $true)] [bool] $TransparentBackground,
    [Parameter(Mandatory = $true)] [int] $MarkInset
  )

  $bitmap = [System.Drawing.Bitmap]::new($Size, $Size)
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality

  if ($TransparentBackground) {
    $graphics.Clear([System.Drawing.Color]::Transparent)
  } else {
    $graphics.Clear([System.Drawing.ColorTranslator]::FromHtml('#4F46E5'))
    $accentBrush = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(38, 255, 255, 255))
    $graphics.FillEllipse($accentBrush, -[int]($Size * 0.18), -[int]($Size * 0.10), [int]($Size * 0.62), [int]($Size * 0.62))
    $graphics.FillEllipse($accentBrush, [int]($Size * 0.67), [int]($Size * 0.69), [int]($Size * 0.46), [int]($Size * 0.46))
    $accentBrush.Dispose()
  }

  $scale = ($Size - (2 * $MarkInset)) / 64.0
  $offset = [double]$MarkInset

  function Point([double] $x, [double] $y) {
    return [System.Drawing.PointF]::new([single]($offset + ($x * $scale)), [single]($offset + ($y * $scale)))
  }

  $whiteBrush = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::White)
  $purpleBrush = [System.Drawing.SolidBrush]::new([System.Drawing.ColorTranslator]::FromHtml('#4F46E5'))
  $roofPen = [System.Drawing.Pen]::new([System.Drawing.Color]::White, [single](6 * $scale))
  $roofPen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
  $roofPen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
  $roofPen.LineJoin = [System.Drawing.Drawing2D.LineJoin]::Round

  $house = [System.Drawing.PointF[]]@(
    (Point 10 29.5), (Point 32 12), (Point 54 29.5),
    (Point 54 54), (Point 10 54)
  )
  $graphics.FillPolygon($whiteBrush, $house)
  $graphics.DrawLines($roofPen, [System.Drawing.PointF[]]@((Point 5.5 31.5), (Point 32 10), (Point 58.5 31.5)))

  $bedX = $offset + (19 * $scale)
  $bedY = $offset + (34 * $scale)
  $graphics.FillRectangle($purpleBrush, [single]$bedX, [single]$bedY, [single](26 * $scale), [single](15 * $scale))
  $graphics.FillRectangle($whiteBrush, [single]($offset + (22.5 * $scale)), [single]($offset + (37.5 * $scale)), [single](8 * $scale), [single](4.5 * $scale))
  $graphics.FillRectangle($whiteBrush, [single]($offset + (33.5 * $scale)), [single]($offset + (37.5 * $scale)), [single](8 * $scale), [single](4.5 * $scale))

  $legPen = [System.Drawing.Pen]::new([System.Drawing.Color]::White, [single](3.5 * $scale))
  $legPen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
  $legPen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
  $graphics.DrawLine($legPen, (Point 22 48), (Point 22 53))
  $graphics.DrawLine($legPen, (Point 42 48), (Point 42 53))

  $bitmap.Save($OutputPath, [System.Drawing.Imaging.ImageFormat]::Png)

  $legPen.Dispose()
  $roofPen.Dispose()
  $purpleBrush.Dispose()
  $whiteBrush.Dispose()
  $graphics.Dispose()
  $bitmap.Dispose()
}

New-HostelHubArtwork -OutputPath (Join-Path $assetsDirectory 'icon.png') -Size 1024 -TransparentBackground $false -MarkInset 225
New-HostelHubArtwork -OutputPath (Join-Path $assetsDirectory 'adaptive-icon.png') -Size 1024 -TransparentBackground $true -MarkInset 270
New-HostelHubArtwork -OutputPath (Join-Path $assetsDirectory 'splash.png') -Size 1024 -TransparentBackground $true -MarkInset 235
New-HostelHubArtwork -OutputPath (Join-Path $assetsDirectory 'favicon.png') -Size 96 -TransparentBackground $false -MarkInset 20

Write-Output 'Generated matching HostelHub app and launch assets.'
