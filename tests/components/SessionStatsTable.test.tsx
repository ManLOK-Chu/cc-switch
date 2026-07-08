import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SessionStatsTable } from "@/components/usage/SessionStatsTable";
import type { UsageRangeSelection } from "@/types/usage";

const useSessionStatsMock = vi.hoisted(() => vi.fn());

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, fallbackOrOptions?: string | Record<string, string>) => {
      if (typeof fallbackOrOptions === "string") return fallbackOrOptions;
      if (key === "usage.sessions.markedAs") {
        return `已标记为 ${fallbackOrOptions?.provider}`;
      }
      return fallbackOrOptions?.defaultValue ?? key;
    },
  }),
}));

vi.mock("@/lib/query/usage", () => ({
  useSessionStats: (...args: unknown[]) => useSessionStatsMock(...args),
}));

vi.mock("@/components/ui/table", () => ({
  Table: ({ children }: any) => <table>{children}</table>,
  TableBody: ({ children }: any) => <tbody>{children}</tbody>,
  TableCell: ({ children, ...props }: any) => <td {...props}>{children}</td>,
  TableHead: ({ children, ...props }: any) => <th {...props}>{children}</th>,
  TableHeader: ({ children }: any) => <thead>{children}</thead>,
  TableRow: ({ children }: any) => <tr>{children}</tr>,
}));

vi.mock("@/components/ui/select", () => ({
  Select: ({ children, value, onValueChange }: any) => (
    <div data-value={value}>
      {children}
      <button type="button" onClick={() => onValueChange("Provider B")}>
        Provider B
      </button>
    </div>
  ),
  SelectTrigger: ({ children, ...props }: any) => (
    <button type="button" {...props}>
      {children}
    </button>
  ),
  SelectValue: () => <span />,
  SelectContent: ({ children }: any) => <div>{children}</div>,
  SelectItem: ({ children }: any) => <div>{children}</div>,
}));

const range: UsageRangeSelection = { preset: "today" };

function renderTable() {
  return render(
    <SessionStatsTable range={range} appType="all" refreshIntervalMs={0} />,
  );
}

describe("SessionStatsTable", () => {
  beforeEach(() => {
    useSessionStatsMock.mockReset();
  });

  it("renders empty state", () => {
    useSessionStatsMock.mockReturnValue({
      data: [],
      isLoading: false,
      isError: false,
    });

    renderTable();

    expect(screen.getByText("暂无会话统计")).toBeInTheDocument();
    expect(
      screen.getByText("当前原型默认隐藏单请求会话。"),
    ).toBeInTheDocument();
  });

  it("renders session rows and updates frontend-only provider marker", () => {
    useSessionStatsMock.mockReturnValue({
      data: [
        {
          sessionId: "session-alpha-1234567890",
          appType: "claude",
          requestCount: 2,
          totalTokens: 445,
          totalCost: "0.0300",
          successRate: 50,
          avgLatencyMs: 200,
          lastActiveAt: 1100,
          lastProviderId: "provider-b",
          lastProviderName: "Provider B",
          lastModel: "claude-opus",
          totalCacheReadTokens: 30,
          totalCacheCreationTokens: 15,
          freshInput: 300,
          outputTokens: 100,
        },
      ],
      isLoading: false,
      isError: false,
    });

    renderTable();

    expect(screen.getByText("session-alpha-…7890")).toBeInTheDocument();
    expect(screen.getAllByText("Provider B").length).toBeGreaterThan(0);
    expect(screen.getByText("445")).toBeInTheDocument();
    expect(screen.getByText("50.0%")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Provider B" }));

    expect(screen.getByText("已标记为 Provider B")).toBeInTheDocument();
    expect(useSessionStatsMock).toHaveBeenCalledWith(
      range,
      { appType: "all", providerName: undefined, model: undefined },
      { refetchInterval: false },
    );
  });

  it("renders error state", () => {
    useSessionStatsMock.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
    });

    renderTable();

    expect(screen.getByText("加载会话统计失败")).toBeInTheDocument();
  });
});
