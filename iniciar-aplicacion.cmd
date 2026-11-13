@echo off
title Asphalt PCI Mapa - localhost 3500
cd /d "%~dp0"
echo Iniciando Asphalt PCI Mapa en http://localhost:3500
echo Mantenga esta ventana abierta mientras utilice la aplicacion.
echo.
"C:\Program Files\nodejs\node.exe" ".\node_modules\vite\bin\vite.js" --host 0.0.0.0 --port 3500 --strictPort
echo.
echo El servidor se detuvo o no pudo iniciar.
pause
