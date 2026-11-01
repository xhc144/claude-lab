@echo off
chcp 65001 >nul
title 冲刺日历
cd /d "%~dp0"
if not exist "node_modules\.bin\vinext.cmd" (
  echo 正在进行首次准备，请稍候……
  call npm.cmd install --ignore-scripts --no-audit --no-fund
)
echo.
echo 正在启动冲刺日历，页面就绪后会自动打开：http://localhost:3000
echo 请保持本窗口开启；关闭窗口即可停止软件。
echo.
set WRANGLER_LOG_PATH=.wrangler\wrangler.log
call node.exe scripts\start-local.mjs
pause
