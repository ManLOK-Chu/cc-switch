import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import type { AppId } from "@/lib/api";
import PromptCommonSnippetModal from "./PromptCommonSnippetModal";

interface PromptCommonSnippetLinkProps {
  appId: AppId;
}

const COMMON_PLACEHOLDER = "{{common}}";

const PromptCommonSnippetLink: React.FC<PromptCommonSnippetLinkProps> = ({
  appId,
}) => {
  const { t } = useTranslation();
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <div className="flex flex-wrap items-center justify-end gap-x-3 gap-y-1 text-right">
      <span className="text-xs text-muted-foreground">
        {t("prompts.commonSnippet.placeholderHint", {
          placeholder: COMMON_PLACEHOLDER,
        })}
      </span>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-7 px-2 text-xs"
        onClick={() => setIsModalOpen(true)}
      >
        {t("prompts.commonSnippet.editLink")}
      </Button>
      <PromptCommonSnippetModal
        appId={appId}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />
    </div>
  );
};

export default PromptCommonSnippetLink;
