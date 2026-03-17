@echo off
taskkill /IM electron.exe /F 2>nul
taskkill /IM "Clui CC.exe" /F 2>nul
echo Clui CC stopped.
