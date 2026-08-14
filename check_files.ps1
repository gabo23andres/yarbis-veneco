$files = @("js/audioEffects.js", "js/arcReactor.js", "js/speechEngine.js", "js/yarbisBrain.js", "js/app.js", "sw.js")
foreach ($f in $files) {
    if (Test-Path $f) {
        $content = Get-Content $f -Raw
        Write-Host "File: $f - Bytes: $($content.Length)"
    } else {
        Write-Host "Missing file: $f"
    }
}
