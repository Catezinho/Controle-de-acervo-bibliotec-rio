@echo off
echo Iniciando o Servidor do Acervo Tech...
cd /d "%~dp0"
uvicorn back-end.main:app --reload
pause