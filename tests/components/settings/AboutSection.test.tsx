import { render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { http, HttpResponse } from "msw";
import { server } from "../../msw/server";

// --- Mocks ---

vi.mock("@tauri-apps/api/app", () => ({
  getVersion: vi.fn(),
}));

vi.mock("@/contexts/UpdateContext", () => ({
  useUpdate: () => ({
    hasUpdate: false,
    updateInfo: null,
    updateHandle: null,
    checkUpdate: vi.fn(),
    resetDismiss: vi.fn(),
    isChecking: false,
  }),
}));

vi.mock("@/lib/updater", () => ({
  relaunchApp: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
  },
}));

vi.mock("framer-motion", () => ({
  motion: {
    section: ({
      children,
      ...props
    }: React.PropsWithChildren<Record<string, unknown>>) => (
      <section {...props}>{children}</section>
    ),
    div: ({
      children,
      ...props
    }: React.PropsWithChildren<Record<string, unknown>>) => (
      <div {...props}>{children}</div>
    ),
  },
  AnimatePresence: ({
    children,
  }: React.PropsWithChildren<Record<string, unknown>>) => children,
}));

vi.mock("@/assets/icons/app-icon.png", () => ({
  default: "mock-app-icon.png",
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

// --- Imports (after mocks) ---

import { getVersion } from "@tauri-apps/api/app";
import { AboutSection } from "@/components/settings/AboutSection";

const TAURI_ENDPOINT = "http://tauri.local";

// --- Tests ---

describe("AboutSection build tag badge", () => {
  beforeEach(() => {
    vi.mocked(getVersion).mockReset();
  });

  it("shows only version badge when build tag matches upstream", async () => {
    vi.mocked(getVersion).mockResolvedValue("3.16.1");

    server.use(
      http.post(`${TAURI_ENDPOINT}/get_build_tag`, () =>
        HttpResponse.json("v3.16.1"),
      ),
      http.post(`${TAURI_ENDPOINT}/get_tool_versions`, () =>
        HttpResponse.json([]),
      ),
    );

    render(<AboutSection isPortable={false} />);

    await waitFor(() => {
      expect(screen.getByText("v3.16.1")).toBeInTheDocument();
    });

    expect(screen.queryByText("settings.buildTag")).not.toBeInTheDocument();
  });

  it("shows secondary badge when build tag differs from upstream", async () => {
    vi.mocked(getVersion).mockResolvedValue("3.16.1");

    server.use(
      http.post(`${TAURI_ENDPOINT}/get_build_tag`, () =>
        HttpResponse.json("vnightly-20260601"),
      ),
      http.post(`${TAURI_ENDPOINT}/get_tool_versions`, () =>
        HttpResponse.json([]),
      ),
    );

    render(<AboutSection isPortable={false} />);

    await waitFor(() => {
      expect(screen.getByText("v3.16.1")).toBeInTheDocument();
    });

    expect(screen.getByText("settings.buildTag")).toBeInTheDocument();
    expect(screen.getByText("vnightly-20260601")).toBeInTheDocument();
  });
});
