@echo off
:: Run this AFTER stopping the Minecraft server.
:: Clears the old wrongly-extracted webapp so it re-extracts correctly on next start.

echo Cleaning old webapp extraction...
rmdir /s /q "c:\Users\tyoueenn\Downloads\asd\plugins\DiscordAuth\webapp"
if %errorlevel% neq 0 (
    echo [ERROR] Could not delete webapp folder.
    echo         Make sure the Minecraft server is fully stopped first.
    pause
    exit /b 1
)
echo Done! Now start your Minecraft server.
pause
