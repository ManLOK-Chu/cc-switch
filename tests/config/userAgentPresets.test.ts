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

  it("codex-tui preset has osVersion and arch placeholders", () => {
    const codex = USER_AGENT_PRESETS.find((p) => p.label?.includes("codex-tui"));
    expect(codex).toBeDefined();
    expect(codex!.template).toContain("{osVersion}");
    expect(codex!.template).toContain("{arch}");
  });
});
