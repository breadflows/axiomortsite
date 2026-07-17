@echo off
REM ===============================================================
REM   AXIOMORT launcher  -  ALWAYS start the game with this.
REM   It runs the Node server, which serves the site AND the
REM   multiplayer relay on the same port. Python ("http.server")
REM   serves files but has NO WebSocket support, so it silently
REM   kills multiplayer/chat/punch. Do not use python.
REM ===============================================================
title AXIOMORT Server

REM --- make sure no stale python is squatting on the port ---
for /f "tokens=5" %%P in ('netstat -ano ^| findstr ":8741" ^| findstr "LISTENING"') do (
    for /f "tokens=1" %%N in ('tasklist /fi "PID eq %%P" /nh ^| findstr /i "python"') do (
        echo Killing stale python server holding port 8741 ^(PID %%P^)...
        taskkill /F /PID %%P >nul 2>&1
    )
)

cd /d "%~dp0"
echo.
echo   AXIOMORT  -  starting Node server on http://localhost:8741
echo   (multiplayer, chat and punch all run through this server)
echo.
start "" http://localhost:8741
node server.js

echo.
echo   Server stopped. Press any key to close.
pause >nul
