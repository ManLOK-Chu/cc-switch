import {
  useMutation,
  useQuery,
  useQueryClient,
  keepPreviousData,
} from "@tanstack/react-query";
import {
  skillsApi,
  type SkillBackupEntry,
  type DiscoverableSkill,
  type ImportSkillSelection,
  type InstalledSkill,
  type SkillUpdateInfo,
  type SkillsShSearchResult,
  type SkillGroup,
  type SkillGroupMember,
} from "@/lib/api/skills";
import type { AppId } from "@/lib/api/types";
import { mergeImportedSkills } from "@/hooks/useSkills.helpers";

/**
 * 查询所有已安装的 Skills
 * 使用 staleTime: Infinity 和 placeholderData: keepPreviousData
 * 实现首次进入使用缓存，只有刷新时才重新获取
 */
export function useInstalledSkills() {
  return useQuery({
    queryKey: ["skills", "installed"],
    queryFn: () => skillsApi.getInstalled(),
    staleTime: Infinity,
    placeholderData: keepPreviousData,
  });
}

export function useSkillBackups() {
  return useQuery({
    queryKey: ["skills", "backups"],
    queryFn: () => skillsApi.getBackups(),
    enabled: false,
  });
}

export function useDeleteSkillBackup() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (backupId: string) => skillsApi.deleteBackup(backupId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["skills", "backups"] });
    },
  });
}

/**
 * 发现可安装的 Skills（从仓库获取）
 * 使用 staleTime: Infinity 和 placeholderData: keepPreviousData
 * 实现首次进入使用缓存，只有刷新时才重新获取
 */
export function useDiscoverableSkills() {
  return useQuery({
    queryKey: ["skills", "discoverable"],
    queryFn: () => skillsApi.discoverAvailable(),
    staleTime: Infinity,
    placeholderData: keepPreviousData,
  });
}

/**
 * 安装 Skill
 * 成功后直接更新缓存，不触发重新加载/刷新
 */
export function useInstallSkill() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      skill,
      currentApp,
    }: {
      skill: DiscoverableSkill;
      currentApp: AppId;
    }) => skillsApi.installUnified(skill, currentApp),
    onSuccess: (installedSkill, _vars, _ctx) => {
      const { skill } = _vars;
      // 直接更新 installed 缓存
      queryClient.setQueryData<InstalledSkill[]>(
        ["skills", "installed"],
        (oldData) => {
          if (!oldData) return [installedSkill];
          return [...oldData, installedSkill];
        },
      );

      // 更新 discoverable 缓存中对应技能的 installed 状态
      const installName =
        skill.directory.split(/[/\\]/).pop()?.toLowerCase() ||
        skill.directory.toLowerCase();
      const skillKey = `${installName}:${skill.repoOwner.toLowerCase()}:${skill.repoName.toLowerCase()}`;

      queryClient.setQueryData<DiscoverableSkill[]>(
        ["skills", "discoverable"],
        (oldData) => {
          if (!oldData) return oldData;
          return oldData.map((s) => {
            if (s.key === skillKey) {
              return { ...s, installed: true };
            }
            return s;
          });
        },
      );
    },
  });
}

/**
 * 卸载 Skill
 * 成功后直接更新缓存，不触发重新加载/刷新
 */
export function useUninstallSkill() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, skillKey }: { id: string; skillKey: string }) =>
      skillsApi
        .uninstallUnified(id)
        .then((result) => ({ ...result, skillKey })),
    onSuccess: ({ skillKey }, _vars) => {
      // 直接更新 installed 缓存，移除该 skill
      queryClient.setQueryData<InstalledSkill[]>(
        ["skills", "installed"],
        (oldData) => {
          if (!oldData) return oldData;
          return oldData.filter((s) => s.id !== _vars.id);
        },
      );

      // 更新 discoverable 缓存中对应技能的 installed 状态
      queryClient.setQueryData<DiscoverableSkill[]>(
        ["skills", "discoverable"],
        (oldData) => {
          if (!oldData) return oldData;
          return oldData.map((s) => {
            if (s.key === skillKey) {
              return { ...s, installed: false };
            }
            return s;
          });
        },
      );
    },
  });
}

export function useRestoreSkillBackup() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      backupId,
      currentApp,
    }: {
      backupId: string;
      currentApp: AppId;
    }) => skillsApi.restoreBackup(backupId, currentApp),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["skills", "installed"] });
      queryClient.invalidateQueries({ queryKey: ["skills", "backups"] });
    },
  });
}

/**
 * 切换 Skill 在特定应用的启用状态
 */
export function useToggleSkillApp() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      app,
      enabled,
    }: {
      id: string;
      app: AppId;
      enabled: boolean;
    }) => skillsApi.toggleApp(id, app, enabled),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["skills", "installed"] });
    },
  });
}

/**
 * 扫描未管理的 Skills
 */
export function useScanUnmanagedSkills() {
  return useQuery({
    queryKey: ["skills", "unmanaged"],
    queryFn: () => skillsApi.scanUnmanaged(),
    enabled: false, // 手动触发
  });
}

/**
 * 从应用目录导入 Skills
 * 成功后直接更新缓存，不触发重新加载/刷新
 */
export function useImportSkillsFromApps() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (imports: ImportSkillSelection[]) =>
      skillsApi.importFromApps(imports),
    onSuccess: (importedSkills) => {
      // 直接更新 installed 缓存
      queryClient.setQueryData<InstalledSkill[]>(
        ["skills", "installed"],
        (oldData) => mergeImportedSkills(oldData, importedSkills),
      );
      // 刷新 unmanaged 列表（已被导入的应该移除）
      queryClient.invalidateQueries({ queryKey: ["skills", "unmanaged"] });
    },
  });
}

/**
 * 获取仓库列表
 */
export function useSkillRepos() {
  return useQuery({
    queryKey: ["skills", "repos"],
    queryFn: () => skillsApi.getRepos(),
  });
}

/**
 * 添加仓库
 */
export function useAddSkillRepo() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: skillsApi.addRepo,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["skills", "repos"] });
      queryClient.invalidateQueries({ queryKey: ["skills", "discoverable"] });
    },
  });
}

/**
 * 删除仓库
 */
export function useRemoveSkillRepo() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ owner, name }: { owner: string; name: string }) =>
      skillsApi.removeRepo(owner, name),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["skills", "repos"] });
      queryClient.invalidateQueries({ queryKey: ["skills", "discoverable"] });
    },
  });
}

/**
 * 从 ZIP 文件安装 Skills
 * 成功后直接更新缓存，不触发重新加载/刷新
 */
export function useInstallSkillsFromZip() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      filePath,
      currentApp,
    }: {
      filePath: string;
      currentApp: AppId;
    }) => skillsApi.installFromZip(filePath, currentApp),
    onSuccess: (installedSkills) => {
      // 直接更新 installed 缓存
      queryClient.setQueryData<InstalledSkill[]>(
        ["skills", "installed"],
        (oldData) => {
          if (!oldData) return installedSkills;
          return [...oldData, ...installedSkills];
        },
      );
    },
  });
}

// ========== 更新检测 ==========

/**
 * 检查 Skills 更新（手动触发）
 */
export function useCheckSkillUpdates() {
  return useQuery({
    queryKey: ["skills", "updates"],
    queryFn: () => skillsApi.checkUpdates(),
    enabled: false,
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * 更新单个 Skill
 */
export function useUpdateSkill() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => skillsApi.updateSkill(id),
    onSuccess: (updatedSkill) => {
      queryClient.setQueryData<InstalledSkill[]>(
        ["skills", "installed"],
        (oldData) => {
          if (!oldData) return [updatedSkill];
          return oldData.map((s) =>
            s.id === updatedSkill.id ? updatedSkill : s,
          );
        },
      );
      queryClient.setQueryData<SkillUpdateInfo[]>(
        ["skills", "updates"],
        (oldData) => {
          if (!oldData) return oldData;
          return oldData.filter((u) => u.id !== updatedSkill.id);
        },
      );
    },
  });
}

// ========== skills.sh 搜索 ==========

/**
 * 搜索 skills.sh 公共目录
 * 使用 300ms staleTime 和 keepPreviousData 实现平滑搜索体验
 */
export function useSearchSkillsSh(
  query: string,
  limit: number,
  offset: number,
) {
  return useQuery({
    queryKey: ["skills", "skillssh", query, limit, offset],
    queryFn: () => skillsApi.searchSkillsSh(query, limit, offset),
    enabled: query.length >= 2,
    staleTime: 5 * 60 * 1000,
    placeholderData: keepPreviousData,
  });
}

// ========== Skill Groups ==========

/**
 * 查询所有 Skill 分组
 */
export function useSkillGroups() {
  return useQuery({
    queryKey: ["skills", "groups"],
    queryFn: () => skillsApi.getGroups(),
    staleTime: Infinity,
    placeholderData: keepPreviousData,
  });
}

/**
 * 创建 Skill 分组
 */
export function useCreateSkillGroup() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (name: string) => skillsApi.createGroup(name),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["skills", "groups"] });
    },
  });
}

/**
 * 更新 Skill 分组名称
 */
export function useUpdateSkillGroup() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) =>
      skillsApi.updateGroup(id, name),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["skills", "groups"] });
    },
  });
}

/**
 * 删除 Skill 分组
 */
export function useDeleteSkillGroup() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => skillsApi.deleteGroup(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["skills", "groups"] });
      queryClient.invalidateQueries({ queryKey: ["skills", "groupMembers"] });
    },
  });
}

/**
 * 重新排序 Skill 分组
 */
export function useReorderSkillGroups() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (ids: string[]) => skillsApi.reorderGroups(ids),
    onSuccess: (_data, ids) => {
      queryClient.setQueryData<SkillGroup[]>(["skills", "groups"], (old) => {
        if (!old) return old;
        const map = new Map(old.map((g) => [g.id, g]));
        return ids
          .map((id, index) => {
            const group = map.get(id);
            return group ? { ...group, sortIndex: index } : null;
          })
          .filter((g): g is SkillGroup => g !== null);
      });
    },
  });
}

/**
 * 查询所有 Skill 分组关联关系
 */
export function useSkillGroupMembers() {
  return useQuery({
    queryKey: ["skills", "groupMembers"],
    queryFn: () => skillsApi.getGroupMembers(),
    staleTime: Infinity,
    placeholderData: keepPreviousData,
  });
}

/**
 * 将 Skill 添加到分组
 */
export function useAddSkillToGroup() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      skillId,
      groupId,
    }: {
      skillId: string;
      groupId: string;
    }) => skillsApi.addSkillToGroup(skillId, groupId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["skills", "groupMembers"] });
    },
  });
}

/**
 * 将 Skill 从分组中移除
 */
export function useRemoveSkillFromGroup() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (skillId: string) => skillsApi.removeSkillFromGroup(skillId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["skills", "groupMembers"] });
    },
  });
}

/**
 * 移动 Skill 到指定分组
 */
export function useMoveSkillToGroup() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      skillId,
      groupId,
    }: {
      skillId: string;
      groupId: string | null;
    }) => skillsApi.moveSkillToGroup(skillId, groupId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["skills", "groupMembers"] });
    },
  });
}

/**
 * 按分组批量启用/停用 Skills
 */
export function useBatchToggleGroupApps() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      groupId,
      app,
      enabled,
    }: {
      groupId: string;
      app: AppId;
      enabled: boolean;
    }) => skillsApi.batchToggleGroupApps(groupId, app, enabled),
    onSuccess: (updatedSkills) => {
      queryClient.setQueryData<InstalledSkill[]>(
        ["skills", "installed"],
        (oldData) => {
          if (!oldData) return updatedSkills;
          const updatedMap = new Map(updatedSkills.map((s) => [s.id, s]));
          return oldData.map((s) => updatedMap.get(s.id) ?? s);
        },
      );
    },
  });
}

// ========== 辅助类型 ==========

export type {
  InstalledSkill,
  DiscoverableSkill,
  ImportSkillSelection,
  SkillBackupEntry,
  SkillUpdateInfo,
  SkillsShSearchResult,
  SkillGroup,
  SkillGroupMember,
  AppId,
};
