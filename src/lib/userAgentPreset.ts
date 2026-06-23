import { arch, version, type } from "@tauri-apps/plugin-os";

const OS_DISPLAY_NAMES: Record<string, string> = {
  macos: "Mac OS",
  windows: "Windows",
  linux: "Linux",
};

const ARCH_DISPLAY_NAMES: Record<string, string> = {
  aarch64: "arm64",
  x86_64: "x86_64",
};

/**
 * 解析 User-Agent 预设模板，将 {osVersion}、{arch}、{osName} 占位符
 * 替换为当前系统的真实值。不含占位符的模板直接返回。
 */
export async function resolvePreset(template: string): Promise<string> {
  if (!template.includes("{")) return template;

  const [os, ver, a] = await Promise.all([type(), version(), arch()]);
  const osName = OS_DISPLAY_NAMES[os] ?? os;
  const archName = ARCH_DISPLAY_NAMES[a] ?? a;

  return template
    .replace(/\{osVersion\}/g, ver)
    .replace(/\{arch\}/g, archName)
    .replace(/\{osName\}/g, osName);
}
