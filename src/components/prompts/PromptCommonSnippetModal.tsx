import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Info } from "lucide-react";
import { toast } from "sonner";
import MarkdownEditor from "@/components/MarkdownEditor";
import { FullScreenPanel } from "@/components/common/FullScreenPanel";
import { Button } from "@/components/ui/button";
import { usePromptCommonSnippet } from "@/hooks/usePromptCommonSnippet";
import type { AppId } from "@/lib/api";

interface PromptCommonSnippetModalProps {
  appId: AppId;
  isOpen: boolean;
  onClose: () => void;
}

const COMMON_PLACEHOLDER = "{{common}}";

const PromptCommonSnippetModal: React.FC<PromptCommonSnippetModalProps> = ({
  appId,
  isOpen,
  onClose,
}) => {
  const { t } = useTranslation();
  const { snippet, isLoading, isSaving, save } = usePromptCommonSnippet(
    appId,
    isOpen,
  );
  const [draft, setDraft] = useState("");
  const [isDarkMode, setIsDarkMode] = useState(false);

  useEffect(() => {
    if (isOpen && !isLoading) {
      setDraft(snippet);
    }
  }, [isOpen, isLoading, snippet]);

  useEffect(() => {
    setIsDarkMode(document.documentElement.classList.contains("dark"));

    const observer = new MutationObserver(() => {
      setIsDarkMode(document.documentElement.classList.contains("dark"));
    });

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });

    return () => observer.disconnect();
  }, []);

  const handleSave = async () => {
    try {
      await save(draft);
      toast.success(t("prompts.commonSnippet.saveSuccess"), {
        closeButton: true,
      });
      onClose();
    } catch (error) {
      toast.error(t("prompts.commonSnippet.saveFailed"));
    }
  };

  return (
    <FullScreenPanel
      isOpen={isOpen}
      title={t("prompts.commonSnippet.modalTitle")}
      onClose={onClose}
      footer={
        <>
          <Button type="button" variant="outline" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button type="button" onClick={handleSave} disabled={isSaving}>
            {isSaving ? t("common.saving") : t("common.save")}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="rounded-lg border border-border-default bg-muted/40 p-4">
          <div className="flex items-start gap-3">
            <Info className="mt-0.5 h-4 w-4 flex-shrink-0 text-muted-foreground" />
            <div className="space-y-1 text-sm">
              <div className="font-medium text-foreground">
                {t("prompts.commonSnippet.infoTitle")}
              </div>
              <p className="text-muted-foreground">
                {t("prompts.commonSnippet.infoBody", {
                  placeholder: COMMON_PLACEHOLDER,
                })}
              </p>
            </div>
          </div>
        </div>

        {isLoading ? (
          <div className="py-12 text-center text-sm text-muted-foreground">
            {t("prompts.loading")}
          </div>
        ) : (
          <MarkdownEditor
            value={draft}
            onChange={setDraft}
            placeholder={t("prompts.commonSnippet.editorPlaceholder")}
            darkMode={isDarkMode}
            minHeight="360px"
          />
        )}
      </div>
    </FullScreenPanel>
  );
};

export default PromptCommonSnippetModal;
