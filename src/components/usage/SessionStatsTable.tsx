import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useSessionStats } from "@/lib/query/usage";
import type { UsageRangeSelection } from "@/types/usage";
import { fmtUsd } from "./format";

interface SessionStatsTableProps {
  range: UsageRangeSelection;
  appType?: string;
  providerName?: string;
  model?: string;
  refreshIntervalMs: number;
}

const MARKER_NONE = "__none__";

function compactSessionId(sessionId: string) {
  if (sessionId.length <= 18) return sessionId;
  return `${sessionId.slice(0, 14)}…${sessionId.slice(-4)}`;
}

function formatTimestamp(seconds: number) {
  return new Date(seconds * 1000).toLocaleString();
}

export function SessionStatsTable({
  range,
  appType,
  providerName,
  model,
  refreshIntervalMs,
}: SessionStatsTableProps) {
  const { t } = useTranslation();
  const {
    data: stats,
    isLoading,
    isError,
  } = useSessionStats(
    range,
    { appType, providerName, model },
    {
      refetchInterval: refreshIntervalMs > 0 ? refreshIntervalMs : false,
    },
  );
  const [markers, setMarkers] = useState<Record<string, string>>({});

  const markerOptions = useMemo(() => {
    const names = new Set<string>();
    for (const stat of stats ?? []) {
      if (stat.lastProviderName) names.add(stat.lastProviderName);
    }
    return Array.from(names).sort((a, b) => a.localeCompare(b));
  }, [stats]);

  if (isLoading) {
    return <div className="h-[400px] animate-pulse rounded bg-gray-100" />;
  }

  if (isError) {
    return (
      <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-6 text-sm text-destructive">
        {t("usage.sessions.loadError", "加载会话统计失败")}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-border/50 bg-card/40 backdrop-blur-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>
                {t("usage.sessions.lastActive", "最近活跃")}
              </TableHead>
              <TableHead>{t("usage.sessions.sessionId", "会话 ID")}</TableHead>
              <TableHead>{t("usage.app", "应用")}</TableHead>
              <TableHead className="text-right">
                {t("usage.requests", "请求数")}
              </TableHead>
              <TableHead className="text-right">
                {t("usage.tokens", "Tokens")}
              </TableHead>
              <TableHead className="text-right">
                {t("usage.cost", "成本")}
              </TableHead>
              <TableHead className="text-right">
                {t("usage.successRate", "成功率")}
              </TableHead>
              <TableHead className="text-right">
                {t("usage.avgLatency", "平均延迟")}
              </TableHead>
              <TableHead>
                {t("usage.sessions.recentProvider", "最近 Provider")}
              </TableHead>
              <TableHead>
                {t("usage.sessions.providerMarker", "Provider 标记")}
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {stats?.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={10}
                  className="py-10 text-center text-muted-foreground"
                >
                  <div>{t("usage.sessions.empty", "暂无会话统计")}</div>
                  <div className="mt-1 text-xs">
                    {t(
                      "usage.sessions.singleRequestHidden",
                      "当前原型默认隐藏单请求会话。",
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              stats?.map((stat) => {
                const marker = markers[stat.sessionId];
                return (
                  <TableRow key={stat.sessionId}>
                    <TableCell className="whitespace-nowrap text-sm">
                      {formatTimestamp(stat.lastActiveAt)}
                    </TableCell>
                    <TableCell
                      className="font-mono text-xs"
                      title={stat.sessionId}
                    >
                      {compactSessionId(stat.sessionId)}
                    </TableCell>
                    <TableCell>{stat.appType}</TableCell>
                    <TableCell className="text-right">
                      {stat.requestCount.toLocaleString()}
                    </TableCell>
                    <TableCell
                      className="text-right"
                      title={`fresh=${stat.freshInput}, output=${stat.outputTokens}, cache_read=${stat.totalCacheReadTokens}, cache_creation=${stat.totalCacheCreationTokens}`}
                    >
                      {stat.totalTokens.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right">
                      {fmtUsd(stat.totalCost, 4)}
                    </TableCell>
                    <TableCell className="text-right">
                      {stat.successRate.toFixed(1)}%
                    </TableCell>
                    <TableCell className="text-right">
                      {stat.avgLatencyMs}ms
                    </TableCell>
                    <TableCell>
                      {stat.lastProviderName ?? stat.lastProviderId}
                    </TableCell>
                    <TableCell>
                      <div className="min-w-[160px] space-y-1">
                        <Select
                          value={marker ?? MARKER_NONE}
                          onValueChange={(value) => {
                            setMarkers((current) => {
                              const next = { ...current };
                              if (value === MARKER_NONE) {
                                delete next[stat.sessionId];
                              } else {
                                next[stat.sessionId] = value;
                              }
                              return next;
                            });
                          }}
                        >
                          <SelectTrigger
                            className="h-8 text-xs"
                            aria-label={t(
                              "usage.sessions.providerMarker",
                              "Provider 标记",
                            )}
                          >
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value={MARKER_NONE}>
                              {t("usage.sessions.noMarker", "未标记")}
                            </SelectItem>
                            {markerOptions.map((name) => (
                              <SelectItem key={name} value={name}>
                                {name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {marker ? (
                          <div className="text-xs text-muted-foreground">
                            {t("usage.sessions.markedAs", {
                              defaultValue: "已标记为 {{provider}}",
                              provider: marker,
                            })}
                          </div>
                        ) : null}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
      <p className="text-xs text-muted-foreground">
        {t(
          "usage.sessions.prototypeDisclaimer",
          "Provider 标记仅用于原型展示，不影响路由。",
        )}
      </p>
    </div>
  );
}
