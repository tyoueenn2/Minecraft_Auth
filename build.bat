@echo off
setlocal enabledelayedexpansion

:: DiscordAuth Plugin Build Script
:: Just double-click this file to build.

echo.
echo =====================================================
echo       DiscordAuth Plugin - Build Script
echo =====================================================
echo.

:: Java and Maven paths (set by previous install)
set "JAVA_HOME=C:\Program Files\Eclipse Adoptium\jdk-21.0.10.7-hotspot"
set "MVN=C:\maven\apache-maven-3.9.6\bin\mvn.cmd"
set "PATH=%JAVA_HOME%\bin;%PATH%"

:: Check Java
java -version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Java not found at %JAVA_HOME%
    echo         Download Java: https://adoptium.net/
    goto :fail
)

:: Check Maven
if not exist "%MVN%" (
    echo [ERROR] Maven not found at C:\maven\apache-maven-3.9.6
    goto :fail
)

:: Check Node.js
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Node.js not found. Download: https://nodejs.org/
    goto :fail
)

set "ROOT=%~dp0"
set "PLUGIN=%ROOT%plugin\DiscordAuth"
set "WEBAPP=%PLUGIN%\src\main\resources\webapp"
set "NMODS=%ROOT%node_modules"
set "NZIP=%WEBAPP%\node_modules.zip"
set "JAR=%PLUGIN%\output\DiscordAuth-1.0.0.jar"

echo [1/4] Syncing Node.js files to plugin resources...
call :cp "package.json"                        ""
call :cp "src\index.js"                        "src"
call :cp "src\database\index.js"               "src\database"
call :cp "src\utils\mojang.js"                 "src\utils"
call :cp "src\utils\discord.js"                "src\utils"
call :cp "src\bot\index.js"                    "src\bot"
call :cp "src\bot\commands\setup.js"           "src\bot\commands"
call :cp "src\bot\commands\status.js"          "src\bot\commands"
call :cp "src\bot\commands\unlink.js"          "src\bot\commands"
call :cp "src\bot\commands\whitelist.js"       "src\bot\commands"
call :cp "src\bot\events\interactionCreate.js" "src\bot\events"
call :cp "src\web\app.js"                      "src\web"
call :cp "src\web\routes\auth.js"              "src\web\routes"
call :cp "src\web\routes\api.js"               "src\web\routes"
call :cp "public\index.html"                   "public"
call :cp "public\css\style.css"                "public\css"
call :cp "public\js\app.js"                    "public\js"
echo     OK

echo [2/4] Running npm install (production only)...
cd /d "%ROOT%"
call npm install --omit=dev
if %errorlevel% neq 0 ( echo [ERROR] npm install failed & goto :fail )
echo     OK

echo [3/4] Bundling node_modules into ZIP...
if not exist "%NMODS%" ( echo [ERROR] node_modules not found & goto :fail )
if exist "%NZIP%" del /f /q "%NZIP%"
powershell -NoProfile -NonInteractive -Command "Add-Type -AssemblyName System.IO.Compression.FileSystem; [System.IO.Compression.ZipFile]::CreateFromDirectory('%NMODS:\=\\%', '%NZIP:\=\\%')"
if %errorlevel% neq 0 ( echo [ERROR] Zip failed & goto :fail )
echo     OK

echo [4/4] Building JAR with Maven...
cd /d "%PLUGIN%"
call "%MVN%" clean package -q
if %errorlevel% neq 0 ( echo [ERROR] Maven build failed & goto :fail )
if not exist "%JAR%" ( echo [ERROR] JAR not found after build & goto :fail )
echo     OK

for %%A in ("%JAR%") do set "JSIZE=%%~zA"
set /a "JSIZEMB=%JSIZE% / 1048576"

echo.
echo =====================================================
echo              BUILD SUCCESSFUL!
echo =====================================================
echo.
echo Output: %JAR%
echo Size:   %JSIZEMB% MB (includes node_modules)
echo.
echo Next steps:
echo   1. Copy DiscordAuth-1.0.0.jar to your server's plugins\ folder
echo   2. Start server, then edit plugins\DiscordAuth\config.yml
echo   3. Restart server - bot and web dashboard will auto-start
echo.
echo Server needs: Node.js runtime only (NOT npm)
echo Download:     https://nodejs.org/
echo.
pause
exit /b 0

:cp
set "SRC=%ROOT%%~1"
if "%~2"=="" ( set "DST=%WEBAPP%" ) else ( set "DST=%WEBAPP%\%~2" )
if not exist "%DST%" mkdir "%DST%"
copy /y "%SRC%" "%DST%\" >nul
exit /b 0

:fail
echo.
echo Build failed. Check errors above.
echo.
pause
exit /b 1
