/**
 * 自定义 User-Agent 预设。
 *
 * 取值来自 PR #3671 对 Kimi Coding Plan（api.kimi.com/coding）UA 白名单的 curl 实测：
 * `claude-cli/*`、`claude-code/*`、`Kilo-Code/*` 可通过；`codex-cli`、`kimi-cli` 会被 403。
 * 白名单只校验 UA 名称前缀、不看版本号，因此用静态值即可，版本不会因 Claude Code 升级而失效。
 *
 * 第一条是官方 Claude Code CLI 实际发送的完整格式（参见 `stream_check.rs` 里检测用的
 * `claude-cli/2.1.2 (external, cli)`），最贴近真实客户端、最稳过严格的 UA 校验；其余为简短变体。
 *
 * 这些预设主要用于"非白名单 Coding Agent（Codex/Gemini/Hermes/OpenClaw 等）想接入受 UA
 * 限制的上游"的场景——把转发请求伪装成已在白名单内的客户端。是否使用由用户显式选择。
 *
 * 动态预设使用模板占位符（如 {osVersion}、{arch}、{osName}），在用户点击时通过
 * tauri-plugin-os 获取真实系统信息进行替换。静态预设不含占位符，直接使用。
 */

export interface UserAgentPreset {
  /** 模板字符串；含 {osVersion} 等占位符时在点击时动态解析。 */
  template: string;
  /** 下拉菜单显示标签；省略时回退到 template。 */
  label?: string;
}

/**
 * Codex CLI 动态预设模板。与后端 `proxy/providers/codex.rs` 的官方客户端识别
 * 正则（`codex_cli_rs/...`）同名，最贴近真实 Codex CLI 客户端。
 *
 * 版本号与 `xterm-256color` 终端后缀为静态字面量；`{osName}/{osVersion}/{arch}`
 * 由 `resolvePreset` 在点击/新建时替换为当前系统真实值。
 *
 * 单独导出以便 ProviderForm 在新建 Codex 供应商时复用同一模板，避免多处硬编码。
 */
export const CODEX_CLI_DYNAMIC_UA =
  "codex_cli_rs/0.144.1 ({osName} {osVersion}; {arch}) xterm-256color";

/** Codex CLI 动态预设的下拉标签，同时用于新建 Codex 时定位该预设。 */
export const CODEX_CLI_DYNAMIC_UA_LABEL = "codex-cli (dynamic)";

export const USER_AGENT_PRESETS: readonly UserAgentPreset[] = [
  { template: "claude-cli/2.1.161 (external, cli)" },
  { template: "claude-cli/2.1.161" },
  { template: "claude-code/1.0.0" },
  { template: "claude-code/0.1.0" },
  { template: "Kilo-Code/1.0" },
  {
    template: CODEX_CLI_DYNAMIC_UA,
    label: CODEX_CLI_DYNAMIC_UA_LABEL,
  },
];
