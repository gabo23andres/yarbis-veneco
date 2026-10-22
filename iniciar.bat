@echo off
chcp 65001 >nul
title YARBIS - servidor local
cd /d "%~dp0"
echo.
echo   Iniciando YARBIS en http://localhost:8000
echo   NO cierres esta ventana mientras uses la app.
echo   Para el microfono usa Chrome o Edge (Brave no trae reconocimiento de voz).
echo.

rem Abre el navegador 2 segundos despues, cuando el servidor ya esta listo
start "" cmd /c "timeout /t 2 /nobreak >nul & start http://localhost:8000"

py --version >nul 2>nul && goto usar_py
python --version >nul 2>nul && goto usar_python
node --version >nul 2>nul && goto usar_node

echo   No encontre Python ni Node.js en esta computadora.
echo   Instala Python desde https://www.python.org/downloads/
echo   y marca la casilla "Add Python to PATH". Luego abre este archivo otra vez.
goto fin

:usar_py
py -m http.server 8000
goto fin

:usar_python
python -m http.server 8000
goto fin

:usar_node
node server.js
goto fin

:fin
echo.
pause
