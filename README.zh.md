# dsh-tool-antigravity

[English](README.md) | 中文

[![GitHub release](https://img.shields.io/github/v/release/mixgreen/dsh-tool-antigravity.svg)](https://github.com/mixgreen/dsh-tool-antigravity/releases)
[![license](https://img.shields.io/github/license/mixgreen/dsh-tool-antigravity.svg)](LICENSE)
[![Tests](https://img.shields.io/badge/tests-39%20suites%20%7C%20425%20passed-brightgreen.svg)](tests/)
[![TypeScript](https://img.shields.io/badge/TypeScript-Strict%20Types-blue.svg)](tsconfig.json)

为 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) (DSH) 打造的高性能 Antigravity 核心能力包插件。

提供私有 Google OAuth 2.0 PKCE 认证闭环、智能多账号池与额度用尽无感自动轮换、全系多模型路由服务（`google-antigravity`）、会话持久化 Nano Banana 2 图像生成与多轮编辑工具（`generate_image` / `list_images`），以及具备 SWR 容错缓存与实时配额看板的 Web 设置面板。

---

## V 0.6.1 版本重要更新

- 额度分为 Gemini（含 Hydrogen）、Claude/GPT、Gemini 4 Argon 三组。Argon 周额度不再并入 Gemini 周额度，只显示服务端实际返回的时间窗口。
- 设置面板和桌宠独立展示三组额度；桌宠按当前模型所属组计算余额，缺少该组时明确报错，不借用其他组的额度。
- 限流轮换按额度组隔离，Claude 与 GPT 共用一组。已有全账号冷却保留至到期；新增分组冷却在凭证刷新、应用重启后仍然保留，不修改账号凭证。
- 修复客户端依赖已移除的 `configForms` 而无法启动的问题，改为使用 DSH 的 `settingsScope` 服务。

## V 0.6.0 版本重要更新

- **新增 Gemini 4 Hydrogen**：模型标识为 `antigravity-gemini-4-hydrogen`，支持 `low`、`medium`、`high` 和 `xhigh`（Extra High），默认 `high`。
- **完整接入模型目录与流式生成**：识别账号目录中的基础及分档模型 ID，保留调用方输出上限，并使用官方 CLI 1.5.8 的四档路由和模型标签。上下文窗口为 1,048,576 token，单次输出上限为 65,536 token；实际可用性取决于账号目录。
- **修复干净检出的构建**：将缺失的浏览器打包配置内联，保留 DSH 模块注册格式及共享 React。

模型档位依据：[Google Antigravity 模型文档](https://antigravity.google/docs/models/)。

## v0.5.3 版本重要更新

- **修复 Claude VALIDATED 模式下 `anyOf` / `oneOf` 工具 Schema 校验报错 (解决 #12 / PR #13)**：彻底解决 `antigravity-claude-opus-5-5` 与 `antigravity-claude-sonnet-5-5` 在挂载含 `anyOf` 或 `oneOf` 联合类型的工具（如本插件自带的 `generate_image` 引用项、DSH 内置的定时任务、任务看板及 MCP 工具等）时触发 HTTP 400 `PROTOCOL_DRIFT` 的问题。
- **Claude 工具 Schema 归一化与对象联合无损合并**：引入 `cleanClaudeSchema` 预处理机制，在单一 Schema 下无损合并多分支 `object` 判别联合属性及可扩展字符串枚举预设，并接入 `@cortexkit/antigravity-auth-core` 的 `toGeminiSchema(..., { claudeValidated: true })` 展平剩余异构联合。
- **加固 Claude 工具参数类型提示**：标准化 `claudeToolTypeHint` 大小写转换，确保 `STRICT PARAMETERS:` 系统提示词中准确输出参数结构（如 `ARRAY_OF_OBJECTS[kind: string REQUIRED, handle: string, path: string]`），杜绝出现 `ARRAY_OF_UNKNOWN`。

## 核心特性与架构设计

### 1. 高性能底层架构
- **底层长连接池（TLS Socket Keep-Alive）与会话复用**：内置 HTTP/1.1 长连接池与 TLS 票据复用机制，彻底消除逐请求建立 TLS 握手的固有延迟，显著降低首字响应时间（TTFT）。
- **高吞吐 Buffer 游标滑动 SSE 解析**：在二进制 Buffer 字节层精确定位换行符并切片解码，彻底消除流式推理时高频字符串累加带来的 V8 堆内存重新分配与 GC 抖动。
- **细粒度思考预算调控**：全面支持 Gemini 3.8/3.7/3.6 Flash、Gemini 3.1 Pro 与 Claude 系列模型的思维链深度配置（`low`, `medium`, `high`）。
- **前置幂等断线自愈**：在流式首字节发出前遇到瞬时网络异常（如 TLS RST / 502 / 503 / 504）时自动平滑重试最多 3 次，提升模型生成稳定性。
- **Windows 文件锁活性探测**：引入 `process.kill(pid, 0)` 探测，若持有锁的外部进程已异常退出，立即主动回收锁，杜绝 30 秒卡死等待。
- **配额看板 SWR 容错与微光动效**：重构 5 小时与每周配额解析算法，解决窗口周期判断漂移问题；在接口波动时展示缓存数据与微光动效。

### 2. 支持的模型列表 (`google-antigravity`)
| 模型标识符 | 显示名称 | 核心模态 | 思考预算支持 |
| :--- | :--- | :--- | :--- |
| `antigravity-gemini-4-hydrogen` | Gemini 4 Hydrogen | 文本, 视觉, 工具 | Low / Medium / High（默认）/ Extra High |
| `antigravity-gemini-4-argon` | Gemini 4 Argon | 文本, 视觉, 工具 | Low / Medium / High |
| `antigravity-gemini-3.8-flash` | Gemini 3.8 Flash | 文本, 视觉, 工具 | Low / Medium / High |
| `antigravity-gemini-3.5-flash` | Gemini 3.5 Flash | 文本, 视觉, 工具 | Low / Medium / High |
| `antigravity-claude-opus-5-5` | Claude Opus 5.5 | 文本, 视觉, 工具 | Low / Medium / High |
| `antigravity-claude-sonnet-5-5` | Claude Sonnet 5.5 | 文本, 视觉, 工具 | Low / Medium / High |
| `antigravity-gpt-oss-120b-medium` | GPT-OSS 120B Medium | 文本, 视觉, 工具 | 固定档位 |

### 3. Nano Banana 2 图片生成与多轮编辑工具
- **`generate_image`**：依托 Nano Banana 2（`gemini-3.1-flash-image`）原生多模态能力，支持基于自然语言提示词的图像生成，以及基于会话图片的图生图/多轮编辑。
- **`list_images`**：供智能体检索当前会话中生成的图片附件。
- 深度接入 DSH `AttachmentStore` 与 `FileSystem`，结合 TOCTOU 防穿越路径准入，杜绝将大量 Base64 直接回灌进对话上下文。

---

## 安装与快速上手

### 为 DSH 0.2.2-rc.3 构建并安装

当前分支适配 DSH `0.2.2-rc.3`，需要 Node.js `>=24.9.0` 和 pnpm。已有的 [V0.6.1 Release](https://github.com/mixgreen/dsh-tool-antigravity/releases/tag/V0.6.1) 面向旧版 DSH `0.1.5-rc.1`；当前宿主请从此分支构建。

```sh
pnpm install --frozen-lockfile
pnpm build
npm pack
dsh plugin --profile web add /absolute/path/dsh-tool-antigravity-0.6.2.tgz
```

桌面宿主请在插件管理器中安装构建出的 `.tgz`，或将 CLI 命令里的 `web` 换为 `desktop`。

安装完成后重启 DSH。插件管理器会根据 `dsh.bundle` 自动启用认证、模型路由和图片工具；无需手工重复添加插件行。首次使用仍需在设置中登录 Google。不要通过 `pnpm update dsh-tool-antigravity --latest` 切回上游 npm 版本；升级本分支请安装新的 Release 地址。

### Cordis 插件配置
在你的 `cordis.patch.yml` 或 DSH 配置文件中注入插件行：

```yaml
- id: antigravity-auth
  name: 'dsh-tool-antigravity'

- id: antigravity-image
  name: 'dsh-tool-antigravity/image'
```

---

## 常用指令与界面交互

### 终端斜杠命令 (Slash Commands)
在 DSH 命令行或交互输入框中可直接使用：

- `/antigravity-auth login`：启动 Google OAuth 2.0 PKCE 登录流程并自动唤起默认浏览器。
- `/antigravity-auth status`：查看当前账号登录状态、脱敏邮箱与 Project ID。
- `/antigravity-auth logout`：注销当前登录凭证并吊销 Token。
- `/antigravity-auth cancel`：取消正在进行的登录操作。

### 前端设置与仪表盘
在 DSH Web 前端设置页面中自动注入：
- **Antigravity Auth 设置卡片**：展示登录状态、账号身份及功能开关。
- **配额可视化仪表盘**：动态展示 5 小时与每周重置窗口的剩余配额百分比与倒计时。
- **图片生成设置卡片**：配置默认生图模型与批次大小。

---

## 安全机制与不可变约束

1. **凭证物理隔离**：`accessToken` 与 `refreshToken` 严格保留在宿主安全存储中，绝不泄露给前端 UI、日志或命令历史。
2. **严格 Loopback 守卫**：账号 RPC 接口仅在明确绑定 `127.0.0.1` 时生效，其他公网/未知 bind 默认阻断（Fail-Closed）。
3. **不可篡改线路签名**：严格维持已审计的 AGY CLI User-Agent（`antigravity/cli/1.1.24`）与归属载荷。
4. **多媒体路径逃逸防护**：强制进行目录穿越防范与符号链接安全检测。

---

## 免责声明

本项目为非官方、社区驱动的开源能力包，仅供个人学习、技术研究与独立开发使用。请严格遵守相关平台的服务条款。

---

## 许可证

[MIT](LICENSE) © [dsh-tool-antigravity contributors](LICENSE)
