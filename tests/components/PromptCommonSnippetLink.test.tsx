import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import i18n from "i18next";
import { beforeEach, describe, expect, it, vi } from "vitest";
import PromptCommonSnippetLink from "@/components/prompts/PromptCommonSnippetLink";

const apiMocks = vi.hoisted(() => ({
  getPromptCommonSnippet: vi.fn(),
  setPromptCommonSnippet: vi.fn(),
}));

vi.mock("@/lib/api", () => ({
  promptsApi: {
    getPromptCommonSnippet: (...args: unknown[]) =>
      apiMocks.getPromptCommonSnippet(...args),
    setPromptCommonSnippet: (...args: unknown[]) =>
      apiMocks.setPromptCommonSnippet(...args),
  },
}));

vi.mock("@/components/common/FullScreenPanel", () => ({
  FullScreenPanel: ({
    isOpen,
    title,
    children,
    footer,
  }: {
    isOpen: boolean;
    title: string;
    children: ReactNode;
    footer?: ReactNode;
  }) =>
    isOpen ? (
      <div data-testid="prompt-common-snippet-panel">
        <h2>{title}</h2>
        <div>{children}</div>
        <div>{footer}</div>
      </div>
    ) : null,
}));

vi.mock("@/components/MarkdownEditor", () => ({
  default: ({
    value,
    onChange,
  }: {
    value: string;
    onChange?: (value: string) => void;
  }) => (
    <textarea
      aria-label="mock-markdown-editor"
      value={value}
      onChange={(event) => onChange?.(event.target.value)}
    />
  ),
}));

function addTranslations() {
  i18n.addResourceBundle(
    "zh",
    "translation",
    {
      common: {
        cancel: "取消",
        save: "保存",
        saving: "保存中",
      },
      prompts: {
        commonSnippet: {
          editLink: "编辑通用提示词",
          placeholderHint: "使用 {{placeholder}} 在内容中插入通用提示词。",
          modalTitle: "编辑通用提示词片段",
          infoTitle: "什么是通用提示词？",
          infoBody:
            "用来在多条提示词间共享公共段落。先编辑公共内容，再在单条提示词内容里写 {{placeholder}}。",
          editorPlaceholder: "输入通用提示词",
          saveSuccess: "通用提示词已保存",
          saveFailed: "保存通用提示词失败",
          loadFailed: "加载通用提示词失败",
        },
      },
    },
    true,
    true,
  );
}

function renderWithQueryClient(ui: ReactNode) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>,
  );
}

describe("PromptCommonSnippetLink", () => {
  beforeEach(() => {
    addTranslations();
    apiMocks.getPromptCommonSnippet.mockResolvedValue("");
    apiMocks.setPromptCommonSnippet.mockResolvedValue(undefined);
  });

  it("renders edit link and placeholder hint", () => {
    renderWithQueryClient(<PromptCommonSnippetLink appId="claude" />);

    expect(
      screen.getByRole("button", { name: "编辑通用提示词" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("使用 {{common}} 在内容中插入通用提示词。"),
    ).toBeInTheDocument();
  });

  it("opens the common snippet modal from the edit link", async () => {
    renderWithQueryClient(<PromptCommonSnippetLink appId="claude" />);

    fireEvent.click(screen.getByRole("button", { name: "编辑通用提示词" }));

    expect(await screen.findByText("编辑通用提示词片段")).toBeInTheDocument();
  });
});
