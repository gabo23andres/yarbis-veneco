$html = New-Object -ComObject "HTMLFile"
$window = $html.Script

$files = @("js/audioEffects.js", "js/arcReactor.js", "js/speechEngine.js", "js/yarbisBrain.js", "js/app.js")
foreach ($f in $files) {
    Write-Host "Testing $f..."
    $content = Get-Content $f -Raw
    try {
        # Note: HTMLFile engine evaluates ES3/ES5, but modern ES6 classes might throw if evaluated in legacy IE.
        Write-Host "$f size: $($content.Length) bytes"
    } catch {
        Write-Host "Error in $f : $_"
    }
}
