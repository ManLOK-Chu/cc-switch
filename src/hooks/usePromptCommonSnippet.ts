import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { promptsApi, type AppId } from "@/lib/api";

export const promptCommonSnippetQueryKey = (appId: AppId) =>
  ["prompt-common-snippet", appId] as const;

export function usePromptCommonSnippet(appId: AppId, enabled = true) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: promptCommonSnippetQueryKey(appId),
    queryFn: () => promptsApi.getPromptCommonSnippet(appId),
    staleTime: Infinity,
    enabled,
  });

  const mutation = useMutation({
    mutationFn: (value: string) =>
      promptsApi.setPromptCommonSnippet(appId, value),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: promptCommonSnippetQueryKey(appId),
      });
    },
  });

  return {
    snippet: query.data ?? "",
    isLoading: query.isLoading,
    isSaving: mutation.isPending,
    loadError: query.error,
    save: mutation.mutateAsync,
  };
}
