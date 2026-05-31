# Omni Pot 发布、更新检测与官网下载设计

## 背景

Omni Pot 当前已经能在 Windows 上打包出安装版和便携版产物，公开发布仓库是 `TuTouPower/omni_pot_release`。App 内已有自研更新检测逻辑，会访问 GitHub latest release、比较版本、下载完整安装包并校验 sha256。

Cloudflare R2 已有公开 bucket，可通过 `https://downloads.zzzkkkccc.site` 读取对象。官网项目位于 WSL 的 `/home/karon/karson_ubuntu/public_website`，是静态导出的 Next.js 站点，下载按钮目前未配置真实链接。Cloudflare 配置位于 WSL 的 `/home/karon/karson_ubuntu/cloudflare_service`。

## 目标

- 发布时同时上传 GitHub Release 和 Cloudflare R2。
- GitHub 与 R2 都保存同一份最新版元数据，作为双源同权来源。
- App 保持完整包下载更新，不做增量更新。
- 官网下载按钮直接指向 R2 的固定最新版链接。
- 发布流程先由本地脚本执行，脚本结构保留未来迁移到 CI 的空间。

## 非目标

- 不在本阶段接入 `electron-updater` 的增量更新。
- 不引入 Worker 作为下载入口。
- 不让官网运行时请求接口动态渲染版本号。
- 不为 macOS/Linux 伪造下载链接。

## 发布产物

Windows 产物保留两类：

- 安装版：用于普通用户安装和 App 内更新。
- 便携版：用于手动下载，不作为 App 内更新默认包。

发布脚本生成每个产物的 sha256，并生成 `latest.json`。`latest.json` 至少包含：

```json
{
    "format_version": 1,
    "version": "{VERSION}",
    "released_at": "2026-05-31T08:00:00.000+08:00",
    "files": {
        "windows_installer": {
            "filename": "OmniPot{VERSION}.exe",
            "versioned_filename": "OmniPot{VERSION}.exe",
            "sha256": "<64 位 sha256，发布脚本动态生成>",
            "size": 85000000,
            "github_url": "https://github.com/TuTouPower/omni_pot_release/releases/download/v{VERSION}/OmniPot{VERSION}.exe",
            "r2_url": "https://downloads.zzzkkkccc.site/omni-pot/latest/OmniPot{VERSION}.exe"
        },
        "windows_portable": {
            "filename": "OmniPot{VERSION}-portable.exe",
            "versioned_filename": "OmniPot{VERSION}-portable.exe",
            "sha256": "<64 位 sha256，发布脚本动态生成>",
            "size": 85000000,
            "github_url": "https://github.com/TuTouPower/omni_pot_release/releases/download/v{VERSION}/OmniPot{VERSION}-portable.exe",
            "r2_url": "https://downloads.zzzkkkccc.site/omni-pot/latest/OmniPot{VERSION}-portable.exe"
        }
    }
}
```

字段名固定使用 snake_case。`format_version` 固定为 `1`，App 遇到未知格式版本时不更新并记录错误。`versioned_filename` 用于归档；`filename` 与 `versioned_filename` 一致，使用实际打包产物名。`released_at` 只用于日志、展示和人工排查，App 不用它判断版本新旧；发布脚本使用中国时间（UTC+8）ISO 8601 字符串（如 `2026-05-31T08:00:00.000+08:00`）。

## R2 路径

R2 使用两层路径：

- 版本归档：`omni-pot/<version>/<versioned_filename>`
- 最新版当前版本对象：`omni-pot/latest/<filename>`
- 最新版元数据：`omni-pot/latest.json`

示例：

- `https://downloads.zzzkkkccc.site/omni-pot/{VERSION}/OmniPot{VERSION}.exe`
- `https://downloads.zzzkkkccc.site/omni-pot/latest/OmniPot{VERSION}.exe`
- `https://downloads.zzzkkkccc.site/omni-pot/latest.json`

R2 静态对象不能做真正的 302，所以官网链接指向 `latest/` 下当前版本文件。版本归档文件仍保留，便于回溯。

`latest/` 下使用当前版本实际文件名对象，例如 `OmniPot{VERSION}.exe` 和 `OmniPot{VERSION}-portable.exe`。发布脚本按当前 manifest 覆盖这些对象；版本变化时文件名也随版本变化。发布脚本在新 metadata 与当前文件读回校验通过后，读取旧的 `latest.json`，删除旧 metadata 指向但不在当前 manifest 里的 `latest/` 对象。当前 Wrangler CLI 不提供对象前缀枚举；若有人手工向 `omni-pot/latest/` 写入未被旧 metadata 引用的散落对象，需要人工删除。

## GitHub Release

GitHub Release 使用 tag `v<version>`。上传内容：

- 版本化安装版文件。
- 版本化便携版文件。
- `latest.json`。

GitHub 侧不使用固定文件名覆盖模式，避免 release 资产语义混乱。

## 发布脚本流程

本地发布脚本执行顺序：

1. 运行现有打包流程，生成 release 产物。
2. 找到安装版和便携版产物。
3. 计算 sha256 和 size。
4. 生成 `latest.json`。
5. 创建或复用 GitHub Release。
6. 上传或复用 GitHub Release 版本化 assets。
7. 上传 R2 版本归档对象。
8. 覆盖 R2 `latest/` 当前版本对象。
9. 远程读回 R2 `latest/` 当前版本对象，校验 size 和 sha256。
10. 覆盖 GitHub Release 和 R2 的 `latest.json`。
11. 远程读回 GitHub Release 和 R2 的 `latest.json`，校验 version、filename、sha256、size 一致。
12. 删除旧 metadata 指向但不在当前 manifest 里的 R2 `latest/` 对象。

任何一步失败都让脚本非零退出。若 GitHub 和 R2 只成功一边，脚本必须报告不完整发布，不能静默成功。失败后不自动回滚已上传对象，保留现场并要求人工介入；GitHub Release 和 R2 对象不是事务系统，自动删除更容易删错或扩大事故。

发布脚本必须幂等：GitHub Release 已存在时复用；远程 asset 已存在时先读回并校验 sha256 和 size，匹配则跳过上传，不匹配则报错并要求人工处理。R2 版本归档对象同样按 sha256 和 size 判断是否复用。

## App 更新检测

App 继续使用完整包更新模式。

检测时并行读取：

- GitHub Release 上的 `latest.json`
- R2 的 `latest.json`

选择规则：

1. 两边都成功，且版本、安装包 sha256、size 一致：使用该版本。
2. 只有一边成功：允许使用成功的一边，并记录来源。此时 sha256 的信任来源是成功读取到的 `latest.json`，不是下载文件本身；下载后仍必须匹配该 sha256。
3. `format_version` 不是 `1`：不提示更新，记录不支持的 metadata 格式。
4. 两边都成功但 version、sha256 或 size 冲突：不提示更新，记录错误。
5. 两边都失败：显示无可用更新或检查失败。

下载优先级：

1. 优先下载 R2 的安装版当前版本对象。
2. R2 下载失败时，回退 GitHub Release 版本化资产。
3. 下载完成后必须校验 sha256。
4. sha256 不匹配时删除下载文件，不打开安装包。

现有下载 URL 白名单必须加入 `https://downloads.zzzkkkccc.site/omni-pot/`，否则 R2 下载会被 App 拒绝。

便携版运行时也提示更新，但下载便携版当前版本对象 `OmniPot{VERSION}-portable.exe`，不切换到安装版。Windows 便携版用 `PORTABLE_EXECUTABLE_DIR` 环境变量识别；没有该环境变量时按安装版处理。

## 官网下载链接

官网保持静态导出，源码位于 `/home/karon/karson_ubuntu/public_website`。下载入口在官网页面内改为 R2 `latest/` 当前版本链接，不依赖 Next.js API route 或运行时服务。Windows 下载按钮直接使用：

```text
https://downloads.zzzkkkccc.site/omni-pot/latest/OmniPot{VERSION}.exe
```

便携版可单独放一个次级链接：

```text
https://downloads.zzzkkkccc.site/omni-pot/latest/OmniPot{VERSION}-portable.exe
```

macOS/Linux 在有真实产物前不提供下载链接。按钮应显示“即将推出”或隐藏，避免用户下载到不存在的文件。

官网显示的下载链接需要跟随当前版本。由于文件名包含版本号，发布新版本后必须让官网 AI 同步更新链接，或由发布流程触发官网重建；本阶段不引入 Worker/API。

## 错误处理

- 发布脚本失败时不改写成功状态文件。
- 覆盖 R2 `latest/` 当前版本对象和 `latest.json` 之间存在秒级短暂不一致窗口；发布脚本先写并读回校验当前版本对象，再切换 GitHub 与 R2 的 `latest.json`。这会让旧 metadata 短暂继续指向旧文件，而不是让新 metadata 指向缺失文件。
- 双源 metadata 冲突时 App 不更新，避免下载错误包。
- 单源不可用时 App 可继续使用另一源。
- 下载后 sha256 是最终信任边界。
- 官网 R2 当前版本对象缺失或内容不匹配时会导致 404 或 sha256 校验失败；发布脚本的 R2 校验必须覆盖这个风险。

## 版本撤回与回退

已发布版本出现问题时，优先发新 hotfix 版本，不覆盖历史版本号。只有必须立即阻止用户下载时，才执行人工撤回：

1. 将 GitHub Release 标记为 prerelease 或删除该 release。
2. 删除或替换 R2 `latest/` 当前版本对象。
3. 将 R2 `latest.json` 回退到上一稳定版本。
4. 如 GitHub 保留上一稳定版本，也重新上传上一稳定版本的 `latest.json`。
5. 手动访问 GitHub 与 R2，确认 metadata 和下载链接都指向同一稳定版本。

## 测试与验证

单元测试：

- `latest.json` 解析。
- 版本比较。
- 双源选择规则。
- metadata 冲突时不提示更新。
- R2 下载失败时回退 GitHub。
- sha256 不匹配时拒绝打开安装包。

脚本测试：

- 文件发现规则。
- sha256 和 size 生成。
- R2 路径生成。
- GitHub asset 名称生成。

手动验证：

- 运行发布脚本到测试版本。
- 访问 R2 `latest.json` 和下载链接。
- 访问 GitHub Release assets。
- 在旧版本 App 中检查更新，确认提示新版本。
- 断开 R2 或 GitHub 其中一个源，确认 fallback 生效。
- 打开官网，确认 Windows 下载按钮能下载 R2 安装包。

## 后续 CI 迁移

本地脚本应拆成可复用步骤：构建、生成 metadata、上传 GitHub、上传 R2、校验。未来迁移到 GitHub Actions 时，只需要把这些步骤放入 Windows runner，并配置 GitHub token 与 Cloudflare R2 凭据。
