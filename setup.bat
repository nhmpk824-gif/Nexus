@echo off
:: Nexus 一键安装脚本（Windows）
:: macOS / Linux 用户请改用：bash scripts/setup.sh

chcp 65001 >nul
title Nexus 一键安装

echo ============================================
echo   Nexus 一键安装脚本（Windows）
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

:: 检查 git
where git >nul 2>nul
if %errorlevel% neq 0 (
    echo [警告] 未检测到 git，模型下载将不可用
    echo [提示] 请安装 git: https://git-scm.com/download/win
)

:: 第1步：安装 npm 依赖
echo.
echo [1/5] 安装 npm 依赖...
call npm install
if %errorlevel% neq 0 (
    echo [错误] npm install 失败
    pause
    exit /b 1
)
echo [完成] 依赖安装成功

:: 第2步：构建项目
echo.
echo [2/5] 构建项目...
call npm run build
if %errorlevel% neq 0 (
    echo [错误] 构建失败
    pause
    exit /b 1
)
echo [完成] 构建成功

:: 第3步：下载语音模型（使用跨平台脚本）
echo.
echo [3/5] 下载语音模型...
call node scripts/download-models.mjs
if %errorlevel% neq 0 (
    echo [警告] 部分模型下载失败，相关功能将不可用
)

:: 第4步：Python 依赖（可选，用于 OmniVoice TTS 和 GLM-ASR）
echo.
echo [4/5] 检查 Python AI 服务依赖（可选）...

where python >nul 2>nul
if %errorlevel% neq 0 (
    echo [跳过] 未检测到 Python，OmniVoice TTS 和 GLM-ASR 将不可用
    echo [提示] 安装 Python 3.10+ 后运行: pip install -r requirements.txt
    goto :skip_python
)

for /f "tokens=*" %%i in ('python --version') do echo [信息] %%i

python -c "import torch" >nul 2>nul
if %errorlevel% neq 0 (
    echo [提示] PyTorch 未安装。推荐手动安装以选择 CPU/CUDA 版本：
    echo   CPU:  pip install torch torchaudio
    echo   CUDA: pip install torch torchaudio --index-url https://download.pytorch.org/whl/cu126
    echo.
    set /p INSTALL_TORCH="是否安装 CPU 版 PyTorch？[y/N] "
    if /i "%INSTALL_TORCH%"=="y" (
        python -m pip install torch torchaudio
    ) else (
        echo [跳过] PyTorch 未安装，AI 语音服务将不可用
        goto :skip_python
    )
)

echo [安装] 其他 Python 依赖...
python -m pip install -r requirements.txt
if %errorlevel% neq 0 (
    echo [警告] Python 依赖安装失败
) else (
    echo [完成] Python 依赖安装成功
)

:skip_python

:: 第5步：验证安装
echo.
echo [5/5] 验证安装...
call node -e "require('sherpa-onnx-node')" >nul 2>nul
if %errorlevel% neq 0 (
    echo [警告] sherpa-onnx-node 原生模块加载失败
    echo [提示] 可能需要安装 Visual Studio Build Tools:
    echo        https://visualstudio.microsoft.com/visual-cpp-build-tools/
    echo        然后重新运行: npm rebuild sherpa-onnx-node
) else (
    echo [完成] sherpa-onnx-node 原生模块正常
)

echo.
echo ============================================
echo   安装完成！
echo ============================================
echo.
echo   启动开发模式:    npm run electron:dev
echo   打包 Windows:    npm run package:win
echo   打包 macOS:      npm run package:mac
echo   打包 Linux:      npm run package:linux
echo.
pause
