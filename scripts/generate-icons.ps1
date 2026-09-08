Add-Type -AssemblyName System.Drawing
foreach ($size in @(192,512,1024)) {
  $bitmap = [System.Drawing.Bitmap]::new($size,$size)
  $g = [System.Drawing.Graphics]::FromImage($bitmap)
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $g.Clear([System.Drawing.Color]::FromArgb(10,10,10))
  $red = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(220,38,38))
  $points = [System.Drawing.PointF[]]@([System.Drawing.PointF]::new($size*.28,$size*.22),[System.Drawing.PointF]::new($size*.72,$size*.22),[System.Drawing.PointF]::new($size*.72,$size*.78),[System.Drawing.PointF]::new($size*.5,$size*.64),[System.Drawing.PointF]::new($size*.28,$size*.78))
  $g.FillPolygon($red,$points)
  $play = [System.Drawing.PointF[]]@([System.Drawing.PointF]::new($size*.43,$size*.34),[System.Drawing.PointF]::new($size*.62,$size*.45),[System.Drawing.PointF]::new($size*.43,$size*.56))
  $g.FillPolygon([System.Drawing.Brushes]::White,$play)
  if ($size -eq 1024) { $target='apps/mobile/assets/icon.png' } else { $target="public/icons/icon-${size}x${size}.png" }
  [System.IO.Directory]::CreateDirectory((Join-Path (Get-Location) (Split-Path $target))) | Out-Null
  $bitmap.Save((Join-Path (Get-Location) $target),[System.Drawing.Imaging.ImageFormat]::Png)
  $g.Dispose(); $bitmap.Dispose(); $red.Dispose()
}
