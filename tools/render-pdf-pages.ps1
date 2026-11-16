Param(
    [string]$PdfPath = "docs/samples/report-sample.pdf",
    [string]$OutputDir = "docs/samples"
)

$ErrorActionPreference = "Stop"

Add-Type -AssemblyName System.Runtime.WindowsRuntime
Add-Type -AssemblyName System.IO

[Windows.Storage.StorageFile, Windows.Storage, ContentType = WindowsRuntime] | Out-Null
[Windows.Data.Pdf.PdfDocument, Windows.Data.Pdf, ContentType = WindowsRuntime] | Out-Null
[Windows.Storage.Streams.IRandomAccessStream, Windows.Storage.Streams, ContentType = WindowsRuntime] | Out-Null

$resolvedPdf = (Resolve-Path $PdfPath).Path

# Helper to await WinRT IAsyncOperation`1
$asTaskGeneric = ([System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object {
    $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1'
})[0]

function Await-WinRtOperation($asyncOp, [Type]$resultType) {
    $asTask = $asTaskGeneric.MakeGenericMethod($resultType)
    $netTask = $asTask.Invoke($null, @($asyncOp))
    $netTask.Wait(-1) | Out-Null
    return $netTask.Result
}

# Helper to await WinRT IAsyncAction
$asTaskAction = ([System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object {
    $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncAction'
})[0]

function Await-WinRtAction($asyncAction) {
    $netTask = $asTaskAction.Invoke($null, @($asyncAction))
    $netTask.Wait(-1) | Out-Null
}

Write-Host "Opening PDF: $resolvedPdf"
$storageFile = Await-WinRtOperation ([Windows.Storage.StorageFile]::GetFileFromPathAsync($resolvedPdf)) ([Windows.Storage.StorageFile])
$pdfDoc = Await-WinRtOperation ([Windows.Data.Pdf.PdfDocument]::LoadFromFileAsync($storageFile)) ([Windows.Data.Pdf.PdfDocument])

Write-Host "Total PDF Pages: $($pdfDoc.PageCount)"

for ($i = 0; $i -lt $pdfDoc.PageCount; $i++) {
    $page = $pdfDoc.GetPage($i)
    Write-Host "Page $($i + 1) Size: $($page.Size.Width) x $($page.Size.Height)"
    $outPngPath = Join-Path (Resolve-Path $OutputDir).Path ("page-$($i + 1).png")
    
    # Create output file
    $outStorageFile = Await-WinRtOperation ([Windows.Storage.StorageFile]::GetFileFromPathAsync((New-Item -ItemType File -Path $outPngPath -Force).FullName)) ([Windows.Storage.StorageFile])
    $stream = Await-WinRtOperation ($outStorageFile.OpenAsync([Windows.Storage.FileAccessMode]::ReadWrite)) ([Windows.Storage.Streams.IRandomAccessStream])
    
    # Render page to stream
    $renderOptions = New-Object Windows.Data.Pdf.PdfPageRenderOptions
    # High resolution render (e.g. 2x)
    $renderOptions.DestinationWidth = [uint32]($page.Size.Width * 2)
    $renderOptions.DestinationHeight = [uint32]($page.Size.Height * 2)

    Await-WinRtAction ($page.RenderToStreamAsync($stream, $renderOptions))
    $stream.Dispose()
    $page.Dispose()
    
    Write-Host "Rendered page $($i + 1) to $outPngPath"
}

Write-Host "Rendering complete!"
