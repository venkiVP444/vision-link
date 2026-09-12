@echo off
title Vision-Link Android Emulator Launcher
echo ====================================================
echo Starting Vision-Link Android Emulator on Desktop...
echo ====================================================

set "JAVA_HOME=C:\Program Files\Microsoft\jdk-17.0.20.101-hotspot"
set "ANDROID_HOME=%LOCALAPPDATA%\Android\Sdk"
set "PATH=%JAVA_HOME%\bin;%ANDROID_HOME%\platform-tools;%ANDROID_HOME%\emulator;%PATH%"

echo Launching AVD VisionLink_AVD_34...
start "" "%ANDROID_HOME%\emulator\emulator.exe" -avd VisionLink_AVD_34

echo Waiting for emulator to connect...
adb wait-for-device
timeout /t 5 /nobreak >nul
adb reverse tcp:8081 tcp:8081

echo Opening Vision-Link Mobile App on the emulator...
adb shell monkey -p com.visionlinkmobile -c android.intent.category.LAUNCHER 1

echo ====================================================
echo Vision-Link is now running on your Emulator window!
echo ====================================================
pause
