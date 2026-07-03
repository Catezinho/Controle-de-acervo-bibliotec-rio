
@echo off
echo Iniciando o Servidor do Acervo Tech...
cd /d "%~dp0back-end"
start "" cmd /c "timeout /t 3 >nul && start http://127.0.0.1:8000"
uvicorn main:app --reload
pause