import { createRef } from "react";
import { render, screen, waitFor, act } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";

import UnifiedSkillsPanel, {
  type UnifiedSkillsPanelHandle,
} from "@/components/skills/UnifiedSkillsPanel";

const scanUnmanagedMock = vi.fn();
const toggleSkillAppMock = vi.fn();
const uninstallSkillMock = vi.fn();
const importSkillsMock = vi.fn();
const installFromZipMock = vi.fn();
const deleteSkillBackupMock = vi.fn();
const restoreSkillBackupMock = vi.fn();

let mockGroupsData: Array<{
  id: string;
  name: string;
  sortIndex: number;
  createdAt: number;
}> = [];

let mockInstalledSkills: Array<{
  id: string;
  name: string;
  description?: string;
  directory: string;
  repoOwner?: string;
  repoName?: string;
  readmeUrl?: string;
  apps: Record<string, boolean>;
}> = [];

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

vi.mock("@/hooks/useSkills", () => ({
  useInstalledSkills: () => ({
    data: mockInstalledSkills,
    isLoading: false,
  }),
  useSkillBackups: () => ({
    data: [],
    refetch: vi.fn(),
    isFetching: false,
  }),
  useDeleteSkillBackup: () => ({
    mutateAsync: deleteSkillBackupMock,
    isPending: false,
  }),
  useToggleSkillApp: () => ({
    mutateAsync: toggleSkillAppMock,
  }),
  useRestoreSkillBackup: () => ({
    mutateAsync: restoreSkillBackupMock,
    isPending: false,
  }),
  useUninstallSkill: () => ({
    mutateAsync: uninstallSkillMock,
  }),
  useScanUnmanagedSkills: () => ({
    data: [
      {
        directory: "shared-skill",
        name: "Shared Skill",
        description: "Imported from Claude",
        foundIn: ["claude"],
        path: "/tmp/shared-skill",
      },
    ],
    refetch: scanUnmanagedMock,
  }),
  useImportSkillsFromApps: () => ({
    mutateAsync: importSkillsMock,
  }),
  useInstallSkillsFromZip: () => ({
    mutateAsync: installFromZipMock,
  }),
  useCheckSkillUpdates: () => ({
    data: [],
    refetch: vi.fn(),
    isFetching: false,
  }),
  useUpdateSkill: () => ({
    mutateAsync: vi.fn(),
    isPending: false,
  }),
  useSkillGroups: () => ({ data: mockGroupsData }),
  useSkillGroupMembers: () => ({ data: [] }),
  useCreateSkillGroup: () => ({ mutate: vi.fn(), mutateAsync: vi.fn() }),
  useUpdateSkillGroup: () => ({ mutate: vi.fn(), mutateAsync: vi.fn() }),
  useDeleteSkillGroup: () => ({ mutate: vi.fn(), mutateAsync: vi.fn() }),
  useBatchToggleGroupApps: () => ({ mutate: vi.fn(), mutateAsync: vi.fn() }),
  useMoveSkillToGroup: () => ({ mutate: vi.fn(), mutateAsync: vi.fn() }),
}));

vi.mock("@/components/skills/GroupSidebar", () => ({
  GroupSidebar: vi.fn(() => <div data-testid="group-sidebar" />),
}));

vi.mock("@dnd-kit/core", () => ({
  DndContext: vi.fn(({ children }: { children: React.ReactNode }) => (
    <div data-testid="dnd-context">{children}</div>
  )),
  DragOverlay: vi.fn(() => null),
  useDraggable: vi.fn(() => ({
    attributes: {},
    listeners: {},
    setNodeRef: vi.fn(),
    transform: null,
    isDragging: false,
  })),
  useDroppable: vi.fn(() => ({ isOver: false, setNodeRef: vi.fn() })),
  PointerSensor: vi.fn(),
  KeyboardSensor: vi.fn(),
  useSensor: vi.fn(() => ({})),
  useSensors: vi.fn(() => []),
  closestCenter: vi.fn(),
}));

vi.mock("@dnd-kit/utilities", () => ({
  CSS: { Translate: { toString: vi.fn(() => "") } },
}));

vi.mock("@/lib/query", () => ({
  useSettingsQuery: () => ({ data: null }),
  useSaveSettingsMutation: () => ({ mutate: vi.fn(), mutateAsync: vi.fn() }),
}));

describe("UnifiedSkillsPanel", () => {
  beforeEach(() => {
    mockGroupsData = [];
    mockInstalledSkills = [];
    scanUnmanagedMock.mockResolvedValue({
      data: [
        {
          directory: "shared-skill",
          name: "Shared Skill",
          description: "Imported from Claude",
          foundIn: ["claude"],
          path: "/tmp/shared-skill",
        },
      ],
    });
    toggleSkillAppMock.mockReset();
    uninstallSkillMock.mockReset();
    importSkillsMock.mockReset();
    installFromZipMock.mockReset();
    deleteSkillBackupMock.mockReset();
    restoreSkillBackupMock.mockReset();
  });

  it("opens the import dialog without crashing when app toggles render", async () => {
    const ref = createRef<UnifiedSkillsPanelHandle>();

    render(
      <UnifiedSkillsPanel
        ref={ref}
        onOpenDiscovery={() => {}}
        currentApp="claude"
      />,
    );

    await act(async () => {
      await ref.current?.openImport();
    });

    await waitFor(() => {
      expect(screen.getByText("skills.import")).toBeInTheDocument();
      expect(screen.getByText("Shared Skill")).toBeInTheDocument();
      expect(screen.getByText("/tmp/shared-skill")).toBeInTheDocument();
    });
  });

  it("shows sidebar when groups exist", async () => {
    mockInstalledSkills = [
      {
        id: "skill-1",
        name: "Test Skill",
        directory: "test-skill",
        apps: { claude: true, codex: false, gemini: false, opencode: false, openclaw: false, hermes: false },
      },
    ];
    mockGroupsData = [
      { id: "g1", name: "Test Group", sortIndex: 0, createdAt: 1 },
    ];

    render(
      <UnifiedSkillsPanel onOpenDiscovery={vi.fn()} currentApp="claude" />,
    );

    await waitFor(() => {
      expect(screen.getByTestId("dnd-context")).toBeInTheDocument();
      expect(screen.getByTestId("group-sidebar")).toBeInTheDocument();
    });
  });

  it("hides sidebar when no groups exist", async () => {
    mockGroupsData = [];

    render(
      <UnifiedSkillsPanel onOpenDiscovery={vi.fn()} currentApp="claude" />,
    );

    await waitFor(() => {
      expect(screen.queryByTestId("dnd-context")).not.toBeInTheDocument();
    });
  });
});
