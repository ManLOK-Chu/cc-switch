import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock @tauri-apps/plugin-os before importing the module under test
vi.mock("@tauri-apps/plugin-os", () => ({
  type: vi.fn(),
  version: vi.fn(),
  arch: vi.fn(),
}));

import { resolvePreset } from "@/lib/userAgentPreset";
import { type, version, arch } from "@tauri-apps/plugin-os";

const mockType = vi.mocked(type);
const mockVersion = vi.mocked(version);
const mockArch = vi.mocked(arch);

describe("resolvePreset", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns template as-is when no placeholders", async () => {
    const result = await resolvePreset("claude-cli/2.1.161");
    expect(result).toBe("claude-cli/2.1.161");
    expect(mockType).not.toHaveBeenCalled();
  });

  it("resolves {osVersion} and {arch} on macOS", async () => {
    mockType.mockResolvedValue("macos");
    mockVersion.mockResolvedValue("15.1.0");
    mockArch.mockResolvedValue("aarch64");

    const result = await resolvePreset(
      "codex-tui/0.142.0 ({osName} {osVersion}; {arch})"
    );
    expect(result).toBe("codex-tui/0.142.0 (Mac OS 15.1.0; arm64)");
  });

  it("resolves {osName} to Windows on Windows", async () => {
    mockType.mockResolvedValue("windows");
    mockVersion.mockResolvedValue("10.0.26100");
    mockArch.mockResolvedValue("x86_64");

    const result = await resolvePreset("test ({osName} {osVersion}; {arch})");
    expect(result).toBe("test (Windows 10.0.26100; x86_64)");
  });

  it("resolves {osName} to Linux on Linux", async () => {
    mockType.mockResolvedValue("linux");
    mockVersion.mockResolvedValue("6.1.0");
    mockArch.mockResolvedValue("x86_64");

    const result = await resolvePreset("test ({osName})");
    expect(result).toBe("test (Linux)");
  });

  it("maps aarch64 to arm64", async () => {
    mockType.mockResolvedValue("macos");
    mockVersion.mockResolvedValue("15.0.0");
    mockArch.mockResolvedValue("aarch64");

    const result = await resolvePreset("{arch}");
    expect(result).toBe("arm64");
  });

  it("preserves unknown arch values as-is", async () => {
    mockType.mockResolvedValue("linux");
    mockVersion.mockResolvedValue("6.0.0");
    mockArch.mockResolvedValue("riscv64");

    const result = await resolvePreset("{arch}");
    expect(result).toBe("riscv64");
  });
});
