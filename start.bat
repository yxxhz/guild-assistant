@echo off
cd /d "%~dp0"
setlocal enabledelayedexpansion

title 直播公会助手 - 局域网服务

echo ====================================
echo   直播公会助手 - 局域网服务
echo ====================================
echo.

if not exist "node_modules" (
    echo [1/4] 正在安装依赖...
    call npm install --silent
)

echo [1/4] 正在生成Prisma客户端...
call npx prisma generate >nul 2>&1

echo [2/4] 正在同步数据库...
call npx prisma db push >nul 2>&1

echo [3/4] 正在构建生产版本...
call npx next build >nul 2>&1

:: 获取本机局域网IP
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /i "IPv4"') do (
    set "ip=%%a"
    goto :found
)
:found
set "ip=%ip: =%"

echo [4/4] 正在启动服务器...
echo.
echo ┌─────────────────────────────────────────────────┐
echo │  本机访问:  http://localhost:3000               │
echo │  局域网访问: http://!ip!:3000                    │
echo │                                                  │
echo │  其他设备在同一局域网下，打开浏览器输入上方地址即可  │
echo │  如无法访问，请关闭防火墙或添加 3000 端口白名单    │
echo └─────────────────────────────────────────────────┘
echo.
echo 提示: 请在 .env 文件中配置 DEEPSEEK_API_KEY
echo       否则话术推荐将使用默认模板回复
echo.
echo 按 Ctrl+C 停止服务器
echo.

call npx next start -H 0.0.0.0 -p 3000
pause
