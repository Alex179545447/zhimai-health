#!/bin/bash
# ==========================================
# 智脉AI健康助手 - 服务器部署脚本
# ==========================================

# 配置变量
WEB_ROOT="/www/wwwroot/health.zhimai-ai.cn"
BACKUP_DIR="/www/wwwroot/backup/health"
SERVER_IP="47.110.151.231"
REPO_DIR=$(cd "$(dirname "$0")" && pwd)

echo "=========================================="
echo "智脉AI健康助手 - 开始部署"
echo "=========================================="
echo "网站目录: $WEB_ROOT"
echo "服务器IP: $SERVER_IP"
echo "时间: $(date)"
echo "=========================================="

# 创建备份
echo "[1/5] 创建备份..."
sudo mkdir -p $BACKUP_DIR
sudo cp -r $WEB_ROOT $BACKUP_DIR/backup_$(date +%Y%m%d_%H%M%S) 2>/dev/null || true
echo "备份完成!"

# 同步文件
echo "[2/5] 同步文件到服务器..."
sudo rsync -avz --delete \
  --exclude='.git' \
  --exclude='.github' \
  --exclude='node_modules' \
  --exclude='*.log' \
  --exclude='.DS_Store' \
  $REPO_DIR/ \
  $WEB_ROOT/
echo "文件同步完成!"

# 设置权限
echo "[3/5] 设置文件权限..."
sudo chown -R www:www $WEB_ROOT
sudo chmod -R 755 $WEB_ROOT
echo "权限设置完成!"

# 重启Nginx
echo "[4/5] 重启Nginx服务..."
sudo systemctl reload nginx
echo "Nginx已重新加载!"

# 验证部署
echo "[5/5] 验证部署..."
if [ -f "$WEB_ROOT/index.html" ]; then
    echo "✅ 部署成功!"
    echo "访问地址: https://health.zhimai-ai.cn"
else
    echo "❌ 部署失败: index.html 未找到"
    exit 1
fi

echo "=========================================="
echo "部署完成! 时间: $(date)"
echo "=========================================="
