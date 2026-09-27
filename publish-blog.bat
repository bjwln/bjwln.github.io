@echo off
setlocal

cd /d "%~dp0"
set "COMMIT_MESSAGE=update"

echo [1/3] Adding changes...
git add .
if errorlevel 1 goto failed

git diff --cached --quiet
if not errorlevel 1 goto push

echo [2/3] Creating commit...
git commit -m "%COMMIT_MESSAGE%"
if errorlevel 1 goto failed

:push
echo [3/3] Pushing to GitHub...
git push
if errorlevel 1 goto failed

echo.
echo Blog update completed.
pause
exit /b 0

:failed
echo.
echo Blog update failed. Review the error above.
pause
exit /b 1
