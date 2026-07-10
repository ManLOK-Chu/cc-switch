import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ProviderForm } from "@/components/providers/forms/ProviderForm";
import type { ProviderFormProps } from "@/components/providers/forms/ProviderForm";
import { createTestQueryClient } from "../utils/testQueryClient";

// 控制 resolvePreset 的系统信息来源，产出确定的动态 UA。
vi.mock("@tauri-apps/plugin-os", () => ({
  type: vi.fn(),
  version: vi.fn(),
  arch: vi.fn(),
}));

import { type, version, arch } from "@tauri-apps/plugin-os";

const EXPECTED_CODEX_UA =
  "codex_cli_rs/0.144.1 (Mac OS 15.1.0; arm64) xterm-256color";

function renderForm(overrides: Partial<ProviderFormProps> = {}) {
  const queryClient = createTestQueryClient();
  const onSubmit = vi.fn();
  const view = render(
    <QueryClientProvider client={queryClient}>
      <ProviderForm
        appId="codex"
        submitLabel="保存"
        onSubmit={onSubmit}
        onCancel={vi.fn()}
        {...overrides}
      />
    </QueryClientProvider>,
  );
  return { ...view, onSubmit };
}

describe("ProviderForm 默认 Codex User-Agent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(type).mockResolvedValue("macos");
    vi.mocked(version).mockResolvedValue("15.1.0");
    vi.mocked(arch).mockResolvedValue("aarch64");
  });

  it("新建 Codex 供应商时自动填充解析后的 codex-cli 动态 UA", async () => {
    renderForm({ appId: "codex" });

    // 填充后高级区自动展开，UA 输入框出现并带解析值。
    const input =
      await screen.findByPlaceholderText<HTMLInputElement>("Mozilla/5.0 ...");
    await waitFor(() => expect(input.value).toBe(EXPECTED_CODEX_UA));
  });

  it("新建 Claude 供应商时不填充 Codex 默认 UA", async () => {
    renderForm({ appId: "claude" });

    // 等待可能的异步 effect 结算后，确认没有任何输入被填成 Codex UA。
    await waitFor(() => expect(vi.mocked(type)).not.toHaveBeenCalled());
    const filled = screen
      .queryAllByRole("textbox")
      .some((el) =>
        ((el as HTMLInputElement).value ?? "").includes("codex_cli_rs"),
      );
    expect(filled).toBe(false);
  });

  it("Claude 表单选择 Codex OAuth 预设时填充 codex-cli 动态 UA", async () => {
    renderForm({ appId: "claude" });

    const codexPreset = screen.getByText("Codex").closest("button");
    expect(codexPreset).not.toBeNull();
    fireEvent.click(codexPreset!);

    const input =
      await screen.findByPlaceholderText<HTMLInputElement>("Mozilla/5.0 ...");
    await waitFor(() => expect(input.value).toBe(EXPECTED_CODEX_UA));
  });

  it("编辑 Codex 供应商时不覆盖已保存的自定义 UA", async () => {
    renderForm({
      appId: "codex",
      initialData: {
        name: "Existing",
        meta: { customUserAgent: "my-custom-ua/1.0" },
      },
    });

    const input =
      await screen.findByPlaceholderText<HTMLInputElement>("Mozilla/5.0 ...");
    expect(input.value).toBe("my-custom-ua/1.0");
    // 编辑态不应触发动态解析。
    expect(vi.mocked(type)).not.toHaveBeenCalled();
  });
});
