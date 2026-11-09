@echo off
setlocal

cd /d "%~dp0"
set "COMMIT_MESSAGE=update"

echo [1/4] Adding changes...
git add .
if errorlevel 1 goto failed

git diff --cached --quiet
if not errorlevel 1 goto sync

echo [2/4] Creating commit...
git commit -m "%COMMIT_MESSAGE%"
if errorlevel 1 goto failed

:sync
echo [3/4] Syncing with GitHub...
git pull --rebase origin main
if errorlevel 1 goto failed

echo [4/4] Pushing to GitHub...
git push origin main
if errorlevel 1 goto failed

echo.
echo Blog update completed.
pause
exit /b 0

:failed
echo.
echo Blog update failed. Review the error above.
echo Tip: close this window, wait a minute, then run this bat again.
pause
exit /b 1
