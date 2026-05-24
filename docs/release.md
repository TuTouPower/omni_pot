# 发布流程

## 仓库结构

| 仓库 | 地址 | 可见性 | 用途 |
|---|---|---|---|
| 源码仓库 | `https://github.com/TuTouPower/omni_pot` | 私有 | 开发、CI、测试 |
| 发布仓库 | `https://github.com/TuTouPower/omni_pot_release` | 公开 | 对外发布 release |

本地 git remote 配置：

- `origin` → 私有源码仓库
- `release` → 公开发布仓库

## 发布步骤

### 1. 构建产物

```bash
npm run dist
```

产物输出在 `release/` 目录，包含 NSIS 安装版（`.exe`）和便携版（`-portable.zip`）。

### 2. 确定版本号

版本号定义在 `package.json` 的 `version` 字段，遵循 semver。

发布前确认版本号已更新。

### 3. 创建 release

通过 GitHub API 在公开发布仓库创建 release 并上传产物：

```bash
# 获取 token（git credential manager 中已存储）
TOKEN=$(printf "protocol=https\nhost=github.com\n" | git credential fill 2>/dev/null | grep '^password=' | cut -d= -f2-)

# 创建 release
curl -X POST \
  -H "Authorization: token $TOKEN" \
  -H "Content-Type: application/json" \
  https://api.github.com/repos/TuTouPower/omni_pot_release/releases \
  -d '{"tag_name":"v{VERSION}","name":"Omni Pot v{VERSION}","body":"release notes here"}'

# 上传产物（用返回的 upload_url）
curl -X POST \
  -H "Authorization: token $TOKEN" \
  -H "Content-Type: application/octet-stream" \
  "{UPLOAD_URL}?name={FILENAME}" \
  --data-binary @"release/{FILENAME}"
```

将 `{VERSION}` 替换为实际版本号，`{FILENAME}` 替换为产物文件名。

## 注意事项

- 源代码不推送到公开仓库，公开仓库仅用于 GitHub Release 功能。
- release 产物由私有仓库的代码构建，确保构建前测试通过。
