import React, { useMemo, useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import {
  ChevronDown,
  ChevronRight,
  Folder,
  FolderPlus,
  Pencil,
  Trash2,
  Power,
  PowerOff,
} from "lucide-react";
import type {
  InstalledSkill,
  SkillGroup,
  SkillGroupMember,
} from "@/hooks/useSkills";
import type { AppId } from "@/lib/api/types";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

const DEFAULT_GROUP_ID = "default";

interface SkillGroupListProps {
  skills: InstalledSkill[];
  groups: SkillGroup[];
  members: SkillGroupMember[];
  currentApp: AppId;
  renderSkillItem: (skill: InstalledSkill, isLast: boolean) => React.ReactNode;
  onBatchToggleGroup?: (groupId: string, enabled: boolean) => void;
  onCreateGroup?: (name: string) => void;
  onUpdateGroup?: (id: string, name: string) => void;
  onDeleteGroup?: (id: string) => void;
  onMoveSkill?: (_skillId: string, _groupId: string | null) => void;
}

export function SkillGroupList({
  skills,
  groups,
  members,
  currentApp: _currentApp,
  renderSkillItem,
  onBatchToggleGroup,
  onCreateGroup,
  onUpdateGroup,
  onDeleteGroup,
  onMoveSkill: _onMoveSkill,
}: SkillGroupListProps) {
  const { t } = useTranslation();
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(
    () => new Set([DEFAULT_GROUP_ID, ...groups.map((g) => g.id)]),
  );
  const [newGroupDialogOpen, setNewGroupDialogOpen] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [editingGroup, setEditingGroup] = useState<SkillGroup | null>(null);
  const [editName, setEditName] = useState("");

  const skillToGroupMap = useMemo(() => {
    const map = new Map<string, string>();
    members.forEach((m) => map.set(m.skillId, m.groupId));
    return map;
  }, [members]);

  const groupedSkills = useMemo(() => {
    const result = new Map<string, InstalledSkill[]>();
    result.set(DEFAULT_GROUP_ID, []);
    groups.forEach((g) => result.set(g.id, []));

    skills.forEach((skill) => {
      const groupId = skillToGroupMap.get(skill.id) || DEFAULT_GROUP_ID;
      const list = result.get(groupId) || [];
      list.push(skill);
      result.set(groupId, list);
    });

    return result;
  }, [skills, groups, skillToGroupMap]);

  const toggleGroup = useCallback((groupId: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(groupId)) {
        next.delete(groupId);
      } else {
        next.add(groupId);
      }
      return next;
    });
  }, []);

  // 如果没有自定义分组，显示原始列表 + 新建分组按钮
  if (groups.length === 0) {
    return (
      <div className="space-y-2">
        {onCreateGroup && (
          <div className="flex justify-end mb-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setNewGroupName("");
                setNewGroupDialogOpen(true);
              }}
            >
              <FolderPlus className="mr-1 h-4 w-4" />
              {t("skills.groups.new")}
            </Button>
          </div>
        )}
        <div className="rounded-xl border border-border-default overflow-hidden">
          {skills.length > 0 ? (
            skills.map((skill, index) =>
              renderSkillItem(skill, index === skills.length - 1),
            )
          ) : (
            <div className="py-10 text-center text-sm text-muted-foreground">
              {t("skills.noInstalled")}
            </div>
          )}
        </div>
        {/* 新建分组对话框 */}
        <Dialog open={newGroupDialogOpen} onOpenChange={setNewGroupDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t("skills.groups.createTitle")}</DialogTitle>
            </DialogHeader>
            <Input
              placeholder={t("skills.groups.namePlaceholder")}
              value={newGroupName}
              onChange={(e) => setNewGroupName(e.target.value)}
            />
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setNewGroupDialogOpen(false);
                  setNewGroupName("");
                }}
              >
                {t("common.cancel")}
              </Button>
              <Button
                onClick={() => {
                  if (newGroupName.trim() && onCreateGroup) {
                    onCreateGroup(newGroupName.trim());
                    setNewGroupDialogOpen(false);
                    setNewGroupName("");
                  }
                }}
              >
                {t("common.create")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  const sortedGroups = [...groups].sort((a, b) => a.sortIndex - b.sortIndex);

  const renderGroupSection = (
    groupId: string,
    groupName: string,
    groupSkills: InstalledSkill[],
  ) => {
    const isExpanded = expandedGroups.has(groupId);
    const isDefault = groupId === DEFAULT_GROUP_ID;
    const hasSkills = groupSkills.length > 0;

    return (
      <div key={groupId} className={isDefault ? "" : "mt-2"}>
        <div
          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/50 hover:bg-muted cursor-pointer select-none"
          onClick={() => toggleGroup(groupId)}
        >
          {isExpanded ? (
            <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
          )}
          <Folder className="h-4 w-4 shrink-0 text-muted-foreground" />
          <span className="flex-1 text-sm font-medium">{groupName}</span>
          <span className="text-xs text-muted-foreground">
            ({groupSkills.length})
          </span>

          {!isDefault && onBatchToggleGroup && hasSkills && (
            <>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                title={t("skills.groups.batchEnable")}
                onClick={(e) => {
                  e.stopPropagation();
                  onBatchToggleGroup(groupId, true);
                }}
              >
                <Power className="h-3 w-3" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                title={t("skills.groups.batchDisable")}
                onClick={(e) => {
                  e.stopPropagation();
                  onBatchToggleGroup(groupId, false);
                }}
              >
                <PowerOff className="h-3 w-3" />
              </Button>
            </>
          )}

          {!isDefault && onUpdateGroup && (
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={(e) => {
                e.stopPropagation();
                const group = groups.find((g) => g.id === groupId);
                if (group) {
                  setEditingGroup(group);
                  setEditName(group.name);
                }
              }}
            >
              <Pencil className="h-3 w-3" />
            </Button>
          )}

          {!isDefault && onDeleteGroup && !hasSkills && (
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-destructive hover:text-destructive"
              onClick={(e) => {
                e.stopPropagation();
                onDeleteGroup(groupId);
              }}
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          )}
        </div>

        {isExpanded && (
          <div className="ml-6 mt-1 space-y-1">
            {hasSkills ? (
              <div className="rounded-xl border border-border-default overflow-hidden">
                {groupSkills.map((skill, index) =>
                  renderSkillItem(skill, index === groupSkills.length - 1),
                )}
              </div>
            ) : (
              <div className="py-3 px-4 text-xs text-muted-foreground">
                {t("skills.groups.empty")}
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-2">
      {onCreateGroup && (
        <div className="flex justify-end mb-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setNewGroupName("");
              setNewGroupDialogOpen(true);
            }}
          >
            <FolderPlus className="mr-1 h-4 w-4" />
            {t("skills.groups.new")}
          </Button>
        </div>
      )}

      {renderGroupSection(
        DEFAULT_GROUP_ID,
        t("skills.groups.default") || "默认分组",
        groupedSkills.get(DEFAULT_GROUP_ID) || [],
      )}

      {sortedGroups.map((group) =>
        renderGroupSection(
          group.id,
          group.name,
          groupedSkills.get(group.id) || [],
        ),
      )}

      {/* 新建分组对话框 */}
      <Dialog open={newGroupDialogOpen} onOpenChange={setNewGroupDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("skills.groups.createTitle")}</DialogTitle>
          </DialogHeader>
          <Input
            placeholder={t("skills.groups.namePlaceholder")}
            value={newGroupName}
            onChange={(e) => setNewGroupName(e.target.value)}
          />
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setNewGroupDialogOpen(false);
                setNewGroupName("");
              }}
            >
              {t("common.cancel")}
            </Button>
            <Button
              onClick={() => {
                if (newGroupName.trim() && onCreateGroup) {
                  onCreateGroup(newGroupName.trim());
                  setNewGroupDialogOpen(false);
                  setNewGroupName("");
                }
              }}
            >
              {t("common.create")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 编辑分组对话框 */}
      <Dialog
        open={!!editingGroup}
        onOpenChange={(open) => !open && setEditingGroup(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {t("skills.groups.editTitle") || "编辑分组"}
            </DialogTitle>
          </DialogHeader>
          <Input
            placeholder={t("skills.groups.namePlaceholder")}
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingGroup(null)}>
              {t("common.cancel")}
            </Button>
            <Button
              onClick={() => {
                if (editName.trim() && editingGroup && onUpdateGroup) {
                  onUpdateGroup(editingGroup.id, editName.trim());
                  setEditingGroup(null);
                }
              }}
            >
              {t("common.save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
