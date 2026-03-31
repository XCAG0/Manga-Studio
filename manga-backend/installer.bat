@echo off
setlocal EnableExtensions
cd /d "%~dp0"

echo ==========================================
echo   Manga Studio Backend Installer
echo ==========================================
echo.

set "PYTHON_CMD="

where py >nul 2>nul
if not errorlevel 1 (
    set "PYTHON_CMD=py -3"
) else (
    where python >nul 2>nul
    if not errorlevel 1 (
        set "PYTHON_CMD=python"
    )
)

if not defined PYTHON_CMD (
    echo [ERROR] Python 3 was not found on this machine.
    echo Install Python 3.10+ and re-run this file.
    pause
    exit /b 1
)

echo [1/5] Using launcher: %PYTHON_CMD%

if not exist ".venv\Scripts\python.exe" (
    echo [2/5] Creating local virtual environment...
    call %PYTHON_CMD% -m venv .venv
    if errorlevel 1 goto :fail
) else (
    echo [2/5] Reusing existing virtual environment...
)

set "VENV_PY=.venv\Scripts\python.exe"

if not exist "%VENV_PY%" (
    echo [ERROR] Virtual environment Python was not created successfully.
    goto :fail
)

echo [3/5] Upgrading pip, setuptools, and wheel...
call "%VENV_PY%" -m pip install --upgrade pip setuptools wheel
if errorlevel 1 goto :fail

echo [4/5] Installing backend requirements...
call "%VENV_PY%" -m pip install -r requirements.txt
if errorlevel 1 goto :fail

echo [5/5] Verifying required backend modules...
call "%VENV_PY%" -c "import flask, click, flask_cors, PIL, numpy, cv2, paddle, paddleocr, deep_translator; print('Backend dependencies installed successfully.')"
if errorlevel 1 goto :fail

echo.
echo Backend setup is complete.
echo Manga Studio will automatically use:
echo %cd%\.venv\Scripts\python.exe
echo.
pause
exit /b 0

:fail
echo.
echo Backend installation failed.
echo Review the error above, then re-run this installer.
echo If Paddle fails to install, verify your Python version and pip setup.
echo.
pause
exit /b 1
