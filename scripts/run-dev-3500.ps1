$ErrorActionPreference = 'Stop'
$project = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
Set-Location -LiteralPath $project
& 'C:\Program Files\nodejs\node.exe' '.\node_modules\vite\bin\vite.js' --host 0.0.0.0 --port 3500 --strictPort *> '.\vite-3500.log'
