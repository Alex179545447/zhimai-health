# 🚀 智脉AI健康助手 - 服务器部署指南

## 📋 部署架构

```
GitHub → GitHub Actions → SSH → 阿里云ECS → Nginx → health.zhimai-ai.cn
```

## 🖥️ 服务器信息

| 项目 | 配置 |
|------|------|
| 服务器IP | 47.110.151.231 |
| SSH端口 | 22 |
| SSH用户 | root |
| 宝塔面板 | https://47.110.151.230:21779/841da119 |
| 网站目录 | /www/wwwroot/health.zhimai-ai.cn |

## 📦 部署步骤

### 第一步：在GitHub仓库设置Secrets

1. 打开您的GitHub仓库
2. 进入 **Settings → Secrets and variables → Actions**
3. 点击 **New repository secret**，添加以下4个Secrets：

| Secret名称 | 值 |
|-----------|-----|
| `ECS_HOST` | `47.110.151.231` |
| `ECS_USER` | `root` |
| `ECS_PORT` | `22` |
| `ECS_PASSWORD` | `Alex179545447` |

### 第二步：在宝塔面板配置网站

1. 登录宝塔面板: https://47.110.151.230:21779/841da119
2. 点击 **网站** → **添加站点**
3. 配置：
   - 域名: `health.zhimai-ai.cn`
   - 根目录: `/www/wwwroot/health.zhimai-ai.cn`
   - PHP版本: 选择"纯静态"
4. 点击 **提交**

### 第三步：配置SSL证书（可选）

1. 在宝塔面板网站设置中
2. 点击 **SSL** → **Let's Encrypt**
3. 申请免费证书
4. 开启HTTPS

### 第四步：首次手动部署

在本地执行以下命令：

```bash
cd D:\家庭医生\prototype

# 添加所有文件
git add .

# 提交
git commit -m "Initial commit - 智脉AI健康助手"

# 添加GitHub仓库（请替换为您的仓库地址）
git remote add origin https://github.com/您的用户名/智脉AI健康助手.git

# 推送到GitHub
git push -u origin main
```

### 第五步：验证自动化部署

1. 每次推送到 `main` 分支，GitHub Actions会自动部署
2. 查看 **Actions** 标签页查看部署状态
3. 部署完成后访问: https://health.zhimai-ai.cn

## 🔧 手动部署（备选）

如果需要手动部署到服务器：

```bash
# 在本地打包
cd D:\家庭医生\prototype
tar -czf health-app.tar.gz --exclude='.git' --exclude='.github' .

# 上传到服务器
scp -P 22 health-app.tar.gz root@47.110.151.231:/tmp/

# 在服务器上执行
ssh root@47.110.151.231
cd /www/wwwroot/health.zhimai-ai.cn
tar -xzf /tmp/health-app.tar.gz
chown -R www:www /www/wwwroot/health.zhimai-ai.cn
systemctl reload nginx
rm /tmp/health-app.tar.gz
```

## ⚠️ 注意事项

1. **首次部署前**：确保域名已解析到服务器IP
2. **宝塔安全组**：确保80和443端口已开放
3. **Nginx配置**：确保Nginx配置正确指向网站目录

## 📞 故障排查

### 部署失败
- 检查GitHub Actions日志
- 确认Secrets配置正确
- 检查SSH连接是否正常

### 网站无法访问
- 检查Nginx是否运行: `systemctl status nginx`
- 检查防火墙: `systemctl status firewalld`
- 检查网站目录权限

### SSL证书问题
- 在宝塔面板重新申请证书
- 检查域名解析是否生效

## 📊 监控

- 宝塔面板: https://47.110.151.230:21779/841da119
- Nginx日志: `/www/wwwlogs/nginx/`
