$port = 9999
$folder = "c:\Users\gquero\Documents\yarbis"

$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:$port/")
try {
    $listener.Prefixes.Add("http://+:$port/")
} catch {
    try {
        $listener.Prefixes.Add("http://172.20.12.146:$port/")
    } catch {}
}

try {
    $listener.Start()
} catch {
    Write-Host "El servidor ya se encuentra escuchando."
}
Write-Host "YARBIS Veneco servidor activo en http://localhost:$port/ y en tu telefono http://172.20.12.146:$port/"

while ($listener.IsListening) {
    $context = $listener.GetContext()
    $request = $context.Request
    $response = $context.Response

    $path = $request.Url.LocalPath
    if ($path -eq "/") { $path = "/index.html" }
    $localPath = Join-Path $folder $path

    if (Test-Path $localPath -PathType Leaf) {
        $bytes = [System.IO.File]::ReadAllBytes($localPath)
        if ($path.EndsWith(".html")) { $response.ContentType = "text/html; charset=utf-8" }
        elseif ($path.EndsWith(".css")) { $response.ContentType = "text/css" }
        elseif ($path.EndsWith(".js")) { $response.ContentType = "application/javascript" }
        
        $response.ContentLength64 = $bytes.Length
        $response.OutputStream.Write($bytes, 0, $bytes.Length)
    } else {
        $response.StatusCode = 444
    }
    $response.Close()
}
