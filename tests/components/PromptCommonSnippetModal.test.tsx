import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import i18n from "i18next";
import { beforeEach, describe, expect, it, vi } from "vitest";
import PromptCommonSnippetModal from "@/components/prompts/PromptCommonSnippetModal";

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

vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

vi.mock("@/components/common/FullScreenPanel", () => ({
  FullScreenPanel: ({
    isOpen,
    title,
    onClose,
    children,
    footer,
  }: {
    isOpen: boolean;
    title: string;
    onClose: () => void;
    children: ReactNode;
    footer?: ReactNode;
  }) =>
    isOpen ? (
      <div data-testid="prompt-common-snippet-panel">
        <button type="button" onClick={onClose}>
          panel-close
        </button>
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
    placeholder,
  }: {
    value: string;
    onChange?: (value: string) => void;
    placeholder?: string;
  }) => (
    <textarea
      aria-label="mock-markdown-editor"
      placeholder={placeholder}
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
        loading: "加载中",
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

describe("PromptCommonSnippetModal", () => {
  beforeEach(() => {
    addTranslations();
    apiMocks.getPromptCommonSnippet.mockResolvedValue("shared snippet");
    apiMocks.setPromptCommonSnippet.mockResolvedValue(undefined);
  });

  it("loads snippet into the editor", async () => {
    renderWithQueryClient(
      <PromptCommonSnippetModal
        appId="claude"
        isOpen={true}
        onClose={() => {}}
      />,
    );

    expect(apiMocks.getPromptCommonSnippet).toHaveBeenCalledWith("claude");
    expect(
      await screen.findByDisplayValue("shared snippet"),
    ).toBeInTheDocument();
  });

  it("saves the edited snippet", async () => {
    const onClose = vi.fn();
    renderWithQueryClient(
      <PromptCommonSnippetModal
        appId="claude"
        isOpen={true}
        onClose={onClose}
      />,
    );
    const editor = await screen.findByLabelText("mock-markdown-editor");

    fireEvent.change(editor, { target: { value: "updated snippet" } });
    fireEvent.click(screen.getByRole("button", { name: "保存" }));

    await waitFor(() =>
      expect(apiMocks.setPromptCommonSnippet).toHaveBeenCalledWith(
        "claude",
        "updated snippet",
      ),
    );
    expect(onClose).toHaveBeenCalled();
  });

  it("cancels without saving", async () => {
    const onClose = vi.fn();
    renderWithQueryClient(
      <PromptCommonSnippetModal
        appId="claude"
        isOpen={true}
        onClose={onClose}
      />,
    );
    await screen.findByLabelText("mock-markdown-editor");

    fireEvent.click(screen.getByRole("button", { name: "取消" }));

    expect(apiMocks.setPromptCommonSnippet).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });
});
