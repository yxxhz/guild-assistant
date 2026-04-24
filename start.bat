@echo off
cd /d "%~dp0"

echo ====================================
echo   直播公会助手 - 招募沟通版
echo ====================================
echo.

if not exist "node_modules" (
    echo [1/3] 正在安装依赖...
    call npm install --silent
)

echo [1/3] 正在生成Prisma客户端...
call npx prisma generate

echo [2/3] 正在同步数据库...
call npx prisma db push

echo [3/3] 正在启动服务器...
echo.
echo ⚠ 首次使用请先访问 http://localhost:3000/api/setup 初始化数据
echo.
echo ┌──────────────────────────────────────┐
echo │  默认账号: admin / admin123          │
echo │  测试账号: broker / broker123        │
echo │                                      │
echo │  局域网访问: http://192.168.31.179:3000 │
echo │  如需局域网访问，请开放防火墙3000端口    │
echo └──────────────────────────────────────┘
echo.
echo 提示: 请在 .env 文件中配置 DEEPSEEK_API_KEY
echo       否则话术推荐将使用默认模板回复
echo.

call npm run dev
pause
