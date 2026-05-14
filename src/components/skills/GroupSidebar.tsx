import React from "react";
import { useTranslation } from "react-i18next";
import { useDroppable } from "@dnd-kit/core";
import {
  Folder,
  FolderPlus,
  Pencil,
  Trash2,
  Power,
  PowerOff,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type { SkillGroup, SkillGroupMember } from "@/hooks/useSkills";

const DEFAULT_GROUP_ID = "default";

function DroppableGroupItem({
  groupId,
  groupName,
  skillCount,
  isDefault,
  isSelected,
  isEmpty,
  onSelect,
  onEdit,
  onDelete,
  onBatchToggle,
}: {
  groupId: string;
  groupName: string;
  skillCount: number;
  isDefault: boolean;
  isSelected: boolean;
  isEmpty: boolean;
  onSelect: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  onBatchToggle?: (enabled: boolean) => void;
}) {
  const { t } = useTranslation();
  const { isOver, setNodeRef } = useDroppable({ id: groupId });

  return (
    <div
      ref={setNodeRef}
      onClick={onSelect}
      className={`group flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer select-none transition-colors ${
        isSelected
          ? "bg-primary/10 border border-primary/30"
          : "hover:bg-muted border border-transparent"
      } ${isOver ? "bg-primary/10 border-primary ring-1 ring-primary/20" : ""}`}
    >
      <Folder className="h-4 w-4 shrink-0 text-muted-foreground" />
      <span className="flex-1 text-sm truncate">{groupName}</span>
      <span className="text-xs text-muted-foreground">({skillCount})</span>

      {!isDefault && onBatchToggle && !isEmpty && (
        <>
          <button
            className="opacity-0 group-hover:opacity-100 h-5 w-5 flex items-center justify-center rounded hover:bg-muted-foreground/10"
            title={t("skills.groups.batchEnable")}
            onClick={(e) => {
              e.stopPropagation();
              onBatchToggle(true);
            }}
          >
            <Power className="h-3 w-3" />
          </button>
          <button
            className="opacity-0 group-hover:opacity-100 h-5 w-5 flex items-center justify-center rounded hover:bg-muted-foreground/10"
            title={t("skills.groups.batchDisable")}
            onClick={(e) => {
              e.stopPropagation();
              onBatchToggle(false);
            }}
          >
            <PowerOff className="h-3 w-3" />
          </button>
        </>
      )}

      {!isDefault && onEdit && (
        <button
          className="opacity-0 group-hover:opacity-100 h-5 w-5 flex items-center justify-center rounded hover:bg-muted-foreground/10"
          onClick={(e) => {
            e.stopPropagation();
            onEdit();
          }}
        >
          <Pencil className="h-3 w-3" />
        </button>
      )}

      {!isDefault && onDelete && isEmpty && (
        <button
          className="opacity-0 group-hover:opacity-100 h-5 w-5 flex items-center justify-center rounded hover:bg-destructive/10 text-destructive"
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
        >
          <Trash2 className="h-3 w-3" />
        </button>
      )}
    </div>
  );
}

interface GroupSidebarProps {
  groups: SkillGroup[];
  members: SkillGroupMember[];
  totalSkillCount: number;
  selectedGroupId: string | null;
  onSelectGroup: (groupId: string | null) => void;
  onBatchToggleGroup?: (groupId: string, enabled: boolean) => void;
  onCreateGroup?: (name: string) => void;
  onUpdateGroup?: (id: string, name: string) => void;
  onDeleteGroup?: (id: string) => void;
}

export function GroupSidebar({
  groups,
  members,
  totalSkillCount,
  selectedGroupId,
  onSelectGroup,
  onBatchToggleGroup,
  onCreateGroup,
  onUpdateGroup,
  onDeleteGroup,
}: GroupSidebarProps) {
  const { t } = useTranslation();
  const [newGroupDialogOpen, setNewGroupDialogOpen] = React.useState(false);
  const [newGroupName, setNewGroupName] = React.useState("");
  const [editingGroup, setEditingGroup] = React.useState<SkillGroup | null>(
    null,
  );
  const [editName, setEditName] = React.useState("");

  const groupSkillCounts = React.useMemo(() => {
    const counts = new Map<string, number>();
    members.forEach((m) => {
      counts.set(m.groupId, (counts.get(m.groupId) || 0) + 1);
    });
    return counts;
  }, [members]);

  const defaultCount = React.useMemo(() => {
    const groupedCount = Array.from(groupSkillCounts.values()).reduce(
      (a, b) => a + b,
      0,
    );
    return totalSkillCount - groupedCount;
  }, [totalSkillCount, groupSkillCounts]);

  const sortedGroups = [...groups].sort((a, b) => a.sortIndex - b.sortIndex);

  return (
    <div className="w-[200px] flex-shrink-0 border-r border-border-default flex flex-col h-full overflow-y-auto">
      <div className="p-2 space-y-1">
        {/* Default group */}
        <DroppableGroupItem
          groupId={DEFAULT_GROUP_ID}
          groupName={t("skills.groups.default")}
          skillCount={defaultCount}
          isDefault
          isSelected={selectedGroupId === null}
          isEmpty={defaultCount === 0}
          onSelect={() => onSelectGroup(null)}
        />

        {/* Separator */}
        {groups.length > 0 && (
          <div className="my-2 border-t border-border-default" />
        )}

        {/* Custom groups */}
        {sortedGroups.map((group) => (
          <DroppableGroupItem
            key={group.id}
            groupId={group.id}
            groupName={group.name}
            skillCount={groupSkillCounts.get(group.id) ?? 0}
            isDefault={false}
            isSelected={selectedGroupId === group.id}
            isEmpty={(groupSkillCounts.get(group.id) ?? 0) === 0}
            onSelect={() =>
              onSelectGroup(selectedGroupId === group.id ? null : group.id)
            }
            onEdit={() => {
              setEditingGroup(group);
              setEditName(group.name);
            }}
            onDelete={() => onDeleteGroup?.(group.id)}
            onBatchToggle={
              onBatchToggleGroup
                ? (enabled) => onBatchToggleGroup(group.id, enabled)
                : undefined
            }
          />
        ))}
      </div>

      {/* Bottom: New group button */}
      {onCreateGroup && (
        <div className="p-2 border-t border-border-default mt-auto">
          <Button
            variant="outline"
            size="sm"
            className="w-full"
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

      {/* Create dialog */}
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

      {/* Edit dialog */}
      <Dialog
        open={!!editingGroup}
        onOpenChange={(open) => !open && setEditingGroup(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("skills.groups.editTitle")}</DialogTitle>
          </DialogHeader>
          <Input
            placeholder={t("skills.groups.namePlaceholder")}
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
          />
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setEditingGroup(null)}
            >
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
