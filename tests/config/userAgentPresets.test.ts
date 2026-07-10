import { describe, it, expect } from "vitest";
import { USER_AGENT_PRESETS } from "@/config/userAgentPresets";

describe("USER_AGENT_PRESETS", () => {
  it("every preset has a template string", () => {
    for (const preset of USER_AGENT_PRESETS) {
      expect(typeof preset.template).toBe("string");
      expect(preset.template.length).toBeGreaterThan(0);
    }
  });

  it("static presets have no placeholders", () => {
    const staticPresets = USER_AGENT_PRESETS.filter((p) => !p.label);
    for (const preset of staticPresets) {
      expect(preset.template).not.toMatch(/\{/);
    }
  });

  it("codex-cli preset has the expected label, template and placeholders", () => {
    const codex = USER_AGENT_PRESETS.find((p) =>
      p.label?.includes("codex-cli"),
    );
    expect(codex).toBeDefined();
    expect(codex!.label).toBe("codex-cli (dynamic)");
    expect(codex!.template).toBe(
      "codex_cli_rs/0.144.1 ({osName} {osVersion}; {arch}) xterm-256color",
    );
    expect(codex!.template).toContain("{osName}");
    expect(codex!.template).toContain("{osVersion}");
    expect(codex!.template).toContain("{arch}");
    expect(codex!.template).toContain("xterm-256color");
    // 旧的 codex-tui / Apple_Terminal 格式不应再出现。
    expect(codex!.template).not.toContain("codex-tui");
    expect(codex!.template).not.toContain("Apple_Terminal");
  });
});
