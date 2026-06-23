@echo off
REM Запуск Craft Advisor (dev): vite renderer + electron overlay.
REM Двойной клик — поднимает оба окна. Закрыть — закрыть оба окна.
cd /d "%~dp0"
start "Craft Advisor — renderer" cmd /k "cd renderer && npm run dev"
echo Жду vite (5 сек)...
timeout /t 5 /nobreak >nul
start "Craft Advisor — overlay" cmd /k "cd main && npm run dev"
echo Оба процесса запущены в отдельных окнах. В PoE2 нажми Ctrl+E на предмете.
