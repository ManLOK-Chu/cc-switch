import React, { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { ExternalLink, RefreshCw, Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { settingsApi } from "@/lib/api";
import { SKILLS_APP_IDS } from "@/config/appConfig";
import { AppToggleGroup } from "@/components/common/AppToggleGroup";
import { ListItemRow } from "@/components/common/ListItemRow";
import type { AppId } from "@/lib/api/types";
import type {
  InstalledSkill,
  SkillGroup,
  SkillGroupMember,
} from "@/hooks/useSkills";

interface DraggableSkillRowProps {
  skill: InstalledSkill;
  hasUpdate?: boolean;
  isUpdating?: boolean;
  onToggleApp: (id: string, app: AppId, enabled: boolean) => void;
  onUninstall: () => void;
  onUpdate?: () => void;
  isLast?: boolean;
  groups: SkillGroup[];
  members: SkillGroupMember[];
}

export const DraggableSkillRow: React.FC<DraggableSkillRowProps> = ({
  skill,
  hasUpdate,
  isUpdating,
  onToggleApp,
  onUninstall,
  onUpdate,
  isLast,
  groups,
  members,
}) => {
  const { t } = useTranslation();

  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({ id: skill.id });

  const style = transform
    ? {
        transform: CSS.Translate.toString(transform),
        opacity: isDragging ? 0.5 : undefined,
      }
    : undefined;

  const openDocs = async () => {
    if (!skill.readmeUrl) return;
    try {
      await settingsApi.openExternal(skill.readmeUrl);
    } catch {
      // ignore
    }
  };

  const sourceLabel = useMemo(() => {
    if (skill.repoOwner && skill.repoName) {
      return `${skill.repoOwner}/${skill.repoName}`;
    }
    return t("skills.local");
  }, [skill.repoOwner, skill.repoName, t]);

  const groupLabel = useMemo(() => {
    const member = members.find((m) => m.skillId === skill.id);
    if (!member) return null;
    const group = groups.find((g) => g.id === member.groupId);
    return group?.name ?? null;
  }, [members, groups, skill.id]);

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <ListItemRow isLast={isLast}>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            {groupLabel && (
              <Badge
                variant="outline"
                className="shrink-0 text-[10px] px-1.5 py-0 h-4"
              >
                {groupLabel}
              </Badge>
            )}
            <span className="font-medium text-sm text-foreground truncate">
              {skill.name}
            </span>
            {skill.readmeUrl && (
              <button
                type="button"
                onClick={openDocs}
                className="text-muted-foreground/60 hover:text-foreground flex-shrink-0"
              >
                <ExternalLink size={12} />
              </button>
            )}
            <span className="text-xs text-muted-foreground/50 flex-shrink-0">
              {sourceLabel}
            </span>
            {hasUpdate && (
              <Badge
                variant="outline"
                className="shrink-0 text-[10px] px-1.5 py-0 h-4 border-amber-500 text-amber-600 dark:text-amber-400"
              >
                {t("skills.updateAvailable")}
              </Badge>
            )}
          </div>
          {skill.description && (
            <p
              className="text-xs text-muted-foreground truncate"
              title={skill.description}
            >
              {skill.description}
            </p>
          )}
        </div>

        <AppToggleGroup
          apps={skill.apps}
          onToggle={(app, enabled) => onToggleApp(skill.id, app, enabled)}
          appIds={SKILLS_APP_IDS}
        />

        <div className="flex-shrink-0 flex items-center gap-0.5">
          {hasUpdate && onUpdate && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-7 w-7 hover:text-blue-500 hover:bg-blue-100 dark:hover:text-blue-400 dark:hover:bg-blue-500/10"
              onClick={onUpdate}
              disabled={isUpdating}
              title={t("skills.update")}
            >
              {isUpdating ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <RefreshCw size={14} />
              )}
            </Button>
          )}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7 hover:text-red-500 hover:bg-red-100 dark:hover:text-red-400 dark:hover:bg-red-500/10"
            onClick={onUninstall}
            title={t("skills.uninstall")}
          >
            <Trash2 size={14} />
          </Button>
        </div>
      </ListItemRow>
    </div>
  );
};
