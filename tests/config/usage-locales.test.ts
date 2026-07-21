import { describe, expect, it } from "vitest";
import en from "@/i18n/locales/en.json";
import ja from "@/i18n/locales/ja.json";
import zhTW from "@/i18n/locales/zh-TW.json";
import zh from "@/i18n/locales/zh.json";
import { KNOWN_APP_TYPES } from "@/types/usage";

describe("usage locale coverage", () => {
  it.each([
    ["zh", zh],
    ["zh-TW", zhTW],
    ["en", en],
    ["ja", ja],
  ])("defines every app filter label in %s", (_locale, translations) => {
    const appFilter = translations.usage.appFilter as Record<string, string>;

    for (const appType of KNOWN_APP_TYPES) {
      expect(
        appFilter[appType],
        `missing usage.appFilter.${appType}`,
      ).toBeTruthy();
    }
  });
});
