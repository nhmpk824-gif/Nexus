@echo off
chcp 65001 >nul
title Nexus 一键安装

echo ============================================
echo   Nexus 一键安装脚本
echo ============================================
echo.

:: 检查 Node.js
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [错误] 未检测到 Node.js，请先安装 Node.js ^(https://nodejs.org^)
    pause
    exit /b 1
)

for /f "tokens=*" %%i in ('node -v') do echo [信息] Node.js 版本: %%i

:: 第1步：安装依赖
echo.
echo [1/2] 安装 npm 依赖...
call npm install
if %errorlevel% neq 0 (
    echo [错误] npm install 失败
    pause
    exit /b 1
)
echo [完成] 依赖安装成功

:: 第2步：构建项目
echo.
echo [2/2] 构建项目...
call npm run build
if %errorlevel% neq 0 (
    echo [错误] 构建失败
    pause
    exit /b 1
)
echo [完成] 构建成功

echo.
echo ============================================
echo   安装完成！
echo ============================================
echo.
echo   启动开发模式:    npm run electron:dev
echo   打包安装程序:    npm run package:win
echo.
pause
