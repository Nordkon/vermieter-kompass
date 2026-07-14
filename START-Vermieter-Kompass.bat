@echo off
setlocal EnableExtensions

title Vermieter Kompass - Lokaler Start
pushd "%~dp0"
if errorlevel 1 goto path_error

echo.
echo  ========================================
echo       VERMIETER KOMPASS - DEMO
echo  ========================================
echo.

where node.exe >nul 2>&1
if errorlevel 1 goto missing_node

where npm.cmd >nul 2>&1
if errorlevel 1 goto missing_node

rem Wenn die App bereits laeuft, nur den Browser oeffnen.
powershell.exe -NoProfile -Command "try { $r = Invoke-WebRequest -UseBasicParsing -Uri 'http://127.0.0.1:4173' -TimeoutSec 2; if ($r.StatusCode -eq 200 -and $r.Content -match 'Vermieter Kompass') { exit 0 } } catch {}; exit 1" >nul 2>&1
if not errorlevel 1 (
    echo Die Anwendung laeuft bereits.
    if /i "%~1"=="--check" (
        echo BAT_CHECK_OK
        popd
        exit /b 0
    )
    echo Browser wird geoeffnet: http://127.0.0.1:4173
    start "" "http://127.0.0.1:4173"
    timeout /t 2 /nobreak >nul
    popd
    exit /b 0
)

rem Beim ersten Start die benoetigten Pakete automatisch installieren.
if not exist "node_modules\.bin\vite.cmd" (
    echo Erster Start: Benoetigte Pakete werden installiert ...
    echo.
    call npm.cmd install
    if errorlevel 1 goto install_error
    echo.
)

if /i "%~1"=="--check" (
    echo BAT_CHECK_OK
    popd
    exit /b 0
)

echo Anwendung startet unter http://127.0.0.1:4173
echo Der Browser oeffnet sich automatisch.
echo.
echo Dieses Fenster bitte geoeffnet lassen.
echo Zum Beenden Strg+C druecken.
echo.

call npm.cmd run dev -- --open
if errorlevel 1 goto start_error
popd
exit /b 0

:missing_node
echo FEHLER: Node.js beziehungsweise npm wurde nicht gefunden.
echo Bitte Node.js installieren und die BAT danach erneut starten.
echo.
pause
popd
exit /b 1

:install_error
echo.
echo FEHLER: Die benoetigten Pakete konnten nicht installiert werden.
echo Pruefe bitte die Internetverbindung und versuche es erneut.
echo.
pause
popd
exit /b 1

:start_error
echo.
echo FEHLER: Die Anwendung konnte nicht gestartet werden.
echo Moeglicherweise wird Port 4173 bereits von einem anderen Programm verwendet.
echo.
pause
popd
exit /b 1

:path_error
echo FEHLER: Der Projektordner konnte nicht geoeffnet werden.
echo.
pause
exit /b 1

