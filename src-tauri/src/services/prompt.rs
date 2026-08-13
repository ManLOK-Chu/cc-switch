use indexmap::IndexMap;
use std::path::Path;

use crate::app_config::AppType;
use crate::config::write_text_file;
use crate::error::AppError;
use crate::prompt::Prompt;
use crate::prompt_files::prompt_file_path;
use crate::store::AppState;

const COMMON_PROMPT_PLACEHOLDER: &str = "{{common}}";

/// 安全地获取当前 Unix 时间戳
fn get_unix_timestamp() -> Result<i64, AppError> {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs() as i64)
        .map_err(|e| AppError::Message(format!("Failed to get system time: {e}")))
}

pub struct PromptService;

fn project_prompt_set_to_path(
    prompts: &IndexMap<String, Prompt>,
    target_path: &Path,
    snippet: Option<&str>,
) -> Result<Option<String>, AppError> {
    let enabled: Vec<(&String, &Prompt)> = prompts
        .iter()
        .filter(|(_, prompt)| prompt.enabled)
        .collect();

    if let Some((_, prompt)) = enabled.first() {
        let content = PromptService::render_prompt_content(prompt, snippet);
        write_text_file(target_path, &content)?;
    } else if target_path.exists() {
        // Match the existing "disable the last prompt" behavior without
        // creating an otherwise unused application config directory.
        write_text_file(target_path, "")?;
    }

    if enabled.len() <= 1 {
        return Ok(None);
    }

    let ids = enabled
        .iter()
        .map(|(id, _)| id.as_str())
        .collect::<Vec<_>>()
        .join(", ");
    Ok(Some(format!(
        "多个 Prompt 同时启用，已按稳定顺序投影第一个；enabled IDs: {ids}"
    )))
}

impl PromptService {
    pub(crate) fn render_prompt_content(prompt: &Prompt, snippet: Option<&str>) -> String {
        if prompt.content.contains(COMMON_PROMPT_PLACEHOLDER) {
            prompt
                .content
                .replace(COMMON_PROMPT_PLACEHOLDER, snippet.unwrap_or_default())
        } else {
            prompt.content.clone()
        }
    }

    fn render_prompt_for_write(
        state: &AppState,
        app: &AppType,
        prompt: &Prompt,
    ) -> Result<String, AppError> {
        let snippet = if prompt.content.contains(COMMON_PROMPT_PLACEHOLDER) {
            state.db.get_prompt_common_snippet(app.as_str())?
        } else {
            None
        };
        Ok(Self::render_prompt_content(prompt, snippet.as_deref()))
    }

    pub fn get_prompts(
        state: &AppState,
        app: AppType,
    ) -> Result<IndexMap<String, Prompt>, AppError> {
        state.db.get_prompts(app.as_str())
    }

    pub fn upsert_prompt(
        state: &AppState,
        app: AppType,
        _id: &str,
        prompt: Prompt,
    ) -> Result<(), AppError> {
        // 检查是否为已启用的提示词
        let is_enabled = prompt.enabled;

        state.db.save_prompt(app.as_str(), &prompt)?;

        if is_enabled {
            // 启用提示词：写入内容到文件
            let target_path = prompt_file_path(&app)?;
            let final_content = Self::render_prompt_for_write(state, &app, &prompt)?;
            write_text_file(&target_path, &final_content)?;
        } else {
            // 禁用提示词：检查是否还有其他已启用的提示词
            let prompts = state.db.get_prompts(app.as_str())?;
            let any_enabled = prompts.values().any(|p| p.enabled);

            if !any_enabled {
                // 所有提示词都已禁用，清空文件
                let target_path = prompt_file_path(&app)?;
                if target_path.exists() {
                    write_text_file(&target_path, "")?;
                }
            }
        }

        Ok(())
    }

    pub fn delete_prompt(state: &AppState, app: AppType, id: &str) -> Result<(), AppError> {
        let prompts = state.db.get_prompts(app.as_str())?;

        if let Some(prompt) = prompts.get(id) {
            if prompt.enabled {
                return Err(AppError::InvalidInput("无法删除已启用的提示词".to_string()));
            }
        }

        state.db.delete_prompt(app.as_str(), id)?;
        Ok(())
    }

    pub fn enable_prompt(state: &AppState, app: AppType, id: &str) -> Result<(), AppError> {
        // 回填当前 live 文件内容到已启用的提示词，或创建备份
        let target_path = prompt_file_path(&app)?;
        if target_path.exists() {
            if let Ok(live_content) = std::fs::read_to_string(&target_path) {
                if !live_content.trim().is_empty() {
                    let mut prompts = state.db.get_prompts(app.as_str())?;

                    // 尝试回填到当前已启用的提示词
                    if let Some((enabled_id, enabled_prompt)) = prompts
                        .iter_mut()
                        .find(|(_, p)| p.enabled)
                        .map(|(id, p)| (id.clone(), p))
                    {
                        if enabled_prompt.content.contains(COMMON_PROMPT_PLACEHOLDER) {
                            log::info!("跳过含通用片段占位符的已启用提示词回填: {enabled_id}");
                        } else {
                            let timestamp = get_unix_timestamp()?;
                            enabled_prompt.content = live_content.clone();
                            enabled_prompt.updated_at = Some(timestamp);
                            log::info!("回填 live 提示词内容到已启用项: {enabled_id}");
                            state.db.save_prompt(app.as_str(), enabled_prompt)?;
                        }
                    } else {
                        // 没有已启用的提示词，则创建一次备份（避免重复备份）
                        let content_exists = prompts
                            .values()
                            .any(|p| p.content.trim() == live_content.trim());
                        if !content_exists {
                            let timestamp = std::time::SystemTime::now()
                                .duration_since(std::time::UNIX_EPOCH)
                                .unwrap_or_default()
                                .as_secs() as i64;
                            let backup_id = format!("backup-{timestamp}");
                            let backup_prompt = Prompt {
                                id: backup_id.clone(),
                                name: format!(
                                    "原始提示词 {}",
                                    chrono::Local::now().format("%Y-%m-%d %H:%M")
                                ),
                                content: live_content,
                                description: Some("自动备份的原始提示词".to_string()),
                                enabled: false,
                                created_at: Some(timestamp),
                                updated_at: Some(timestamp),
                            };
                            log::info!("回填 live 提示词内容，创建备份: {backup_id}");
                            state.db.save_prompt(app.as_str(), &backup_prompt)?;
                        }
                    }
                }
            }
        }

        // 启用目标提示词并写入文件
        let mut prompts = state.db.get_prompts(app.as_str())?;

        for prompt in prompts.values_mut() {
            prompt.enabled = false;
        }

        if let Some(prompt) = prompts.get_mut(id) {
            prompt.enabled = true;
            let final_content = Self::render_prompt_for_write(state, &app, prompt)?;
            write_text_file(&target_path, &final_content)?; // 原子写入
            state.db.save_prompt(app.as_str(), prompt)?;
        } else {
            return Err(AppError::InvalidInput(format!("提示词 {id} 不存在")));
        }

        // Save all prompts to disable others
        for (_, prompt) in prompts.iter() {
            state.db.save_prompt(app.as_str(), prompt)?;
        }

        Ok(())
    }

    pub fn get_prompt_common_snippet(
        state: &AppState,
        app: AppType,
    ) -> Result<Option<String>, AppError> {
        state.db.get_prompt_common_snippet(app.as_str())
    }

    pub fn set_prompt_common_snippet(
        state: &AppState,
        app: AppType,
        value: String,
    ) -> Result<(), AppError> {
        state
            .db
            .set_prompt_common_snippet(app.as_str(), Some(value))?;

        let prompts = state.db.get_prompts(app.as_str())?;
        let Some(enabled_prompt) = prompts
            .values()
            .find(|prompt| prompt.enabled && prompt.content.contains(COMMON_PROMPT_PLACEHOLDER))
        else {
            return Ok(());
        };

        let target_path = prompt_file_path(&app)?;
        let final_content = Self::render_prompt_for_write(state, &app, enabled_prompt)?;
        write_text_file(&target_path, &final_content)?;
        Ok(())
    }

    pub fn import_from_file(state: &AppState, app: AppType) -> Result<String, AppError> {
        let file_path = prompt_file_path(&app)?;

        if !file_path.exists() {
            return Err(AppError::Message("提示词文件不存在".to_string()));
        }

        let content =
            std::fs::read_to_string(&file_path).map_err(|e| AppError::io(&file_path, e))?;
        let timestamp = get_unix_timestamp()?;

        let id = format!("imported-{timestamp}");
        let prompt = Prompt {
            id: id.clone(),
            name: format!(
                "导入的提示词 {}",
                chrono::Local::now().format("%Y-%m-%d %H:%M")
            ),
            content,
            description: Some("从现有配置文件导入".to_string()),
            enabled: false,
            created_at: Some(timestamp),
            updated_at: Some(timestamp),
        };

        Self::upsert_prompt(state, app, &id, prompt)?;
        Ok(id)
    }

    pub fn get_current_file_content(app: AppType) -> Result<Option<String>, AppError> {
        let file_path = prompt_file_path(&app)?;
        if !file_path.exists() {
            return Ok(None);
        }
        let content =
            std::fs::read_to_string(&file_path).map_err(|e| AppError::io(&file_path, e))?;
        Ok(Some(content))
    }

    /// Project the database SSOT to one application's managed prompt file.
    ///
    /// This deliberately does not call `enable_prompt`: restore paths must not
    /// read stale live content and write it back into the freshly imported DB.
    pub fn sync_to_live(state: &AppState, app: AppType) -> Result<(), AppError> {
        if matches!(app, AppType::ClaudeDesktop) {
            return Ok(());
        }

        let prompts = state.db.get_prompts(app.as_str())?;
        let target_path = prompt_file_path(&app)?;
        let snippet = state.db.get_prompt_common_snippet(app.as_str())?;
        if let Some(warning) =
            project_prompt_set_to_path(&prompts, &target_path, snippet.as_deref())?
        {
            return Err(AppError::Message(warning));
        }
        Ok(())
    }

    /// Best-effort projection for every Prompt-capable application.
    pub fn sync_all_to_live(state: &AppState) -> Result<(), AppError> {
        let mut failures = Vec::new();
        for app in AppType::all() {
            if matches!(app, AppType::ClaudeDesktop) {
                continue;
            }
            if let Err(error) = Self::sync_to_live(state, app.clone()) {
                log::warn!("同步 Prompt 到 {app:?} 失败: {error}");
                failures.push(format!("{}: {error}", app.as_str()));
            }
        }

        if failures.is_empty() {
            Ok(())
        } else {
            Err(AppError::Message(format!(
                "部分应用 Prompt 同步失败: {}",
                failures.join("; ")
            )))
        }
    }

    /// 首次启动时从现有提示词文件自动导入（如果存在）
    /// 返回导入的数量
    pub fn import_from_file_on_first_launch(
        state: &AppState,
        app: AppType,
    ) -> Result<usize, AppError> {
        // 幂等性保护：该应用已有提示词则跳过
        let existing = state.db.get_prompts(app.as_str())?;
        if !existing.is_empty() {
            return Ok(0);
        }

        let file_path = prompt_file_path(&app)?;

        // 检查文件是否存在
        if !file_path.exists() {
            return Ok(0);
        }

        // 读取文件内容
        let content = match std::fs::read_to_string(&file_path) {
            Ok(c) => c,
            Err(e) => {
                log::warn!("读取提示词文件失败: {file_path:?}, 错误: {e}");
                return Ok(0);
            }
        };

        // 检查内容是否为空
        if content.trim().is_empty() {
            return Ok(0);
        }

        log::info!("发现提示词文件，自动导入: {file_path:?}");

        // 创建提示词对象
        let timestamp = get_unix_timestamp()?;
        let id = format!("auto-imported-{timestamp}");
        let prompt = Prompt {
            id: id.clone(),
            name: format!(
                "Auto-imported Prompt {}",
                chrono::Local::now().format("%Y-%m-%d %H:%M")
            ),
            content,
            description: Some("Automatically imported on first launch".to_string()),
            enabled: true, // 首次导入时自动启用
            created_at: Some(timestamp),
            updated_at: Some(timestamp),
        };

        // 保存到数据库
        state.db.save_prompt(app.as_str(), &prompt)?;

        log::info!("自动导入完成: {}", app.as_str());
        Ok(1)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::database::Database;
    use crate::prompt_files::prompt_file_path;
    use serial_test::serial;
    use std::fs;
    use std::sync::{Arc, Mutex, OnceLock};

    fn test_guard() -> std::sync::MutexGuard<'static, ()> {
        static LOCK: OnceLock<Mutex<()>> = OnceLock::new();
        LOCK.get_or_init(|| Mutex::new(()))
            .lock()
            .unwrap_or_else(|err| err.into_inner())
    }

    fn with_test_state<T>(test: impl FnOnce(&AppState) -> T) -> T {
        let _guard = test_guard();
        let temp = tempfile::tempdir().expect("tempdir");
        let old_test_home = std::env::var_os("CC_SWITCH_TEST_HOME");
        let old_home = std::env::var_os("HOME");
        std::env::set_var("CC_SWITCH_TEST_HOME", temp.path());
        std::env::set_var("HOME", temp.path());

        let db = Arc::new(Database::memory().expect("in-memory database"));
        let state = AppState::new(db);
        let result = test(&state);

        match old_test_home {
            Some(value) => std::env::set_var("CC_SWITCH_TEST_HOME", value),
            None => std::env::remove_var("CC_SWITCH_TEST_HOME"),
        }
        match old_home {
            Some(value) => std::env::set_var("HOME", value),
            None => std::env::remove_var("HOME"),
        }

        result
    }

    fn make_prompt(id: &str, content: &str, enabled: bool) -> Prompt {
        Prompt {
            id: id.to_string(),
            name: id.to_string(),
            content: content.to_string(),
            description: None,
            enabled,
            created_at: Some(1),
            updated_at: Some(1),
        }
    }

    #[test]
    fn render_prompt_content_replaces_common_placeholder() {
        let prompt = make_prompt("p1", "before {{common}} after", true);

        let rendered = PromptService::render_prompt_content(&prompt, Some("shared"));

        assert_eq!(rendered, "before shared after");
    }

    #[test]
    fn render_prompt_content_replaces_multiple_placeholders() {
        let prompt = make_prompt("p1", "{{common}}\nbody\n{{common}}", true);

        let rendered = PromptService::render_prompt_content(&prompt, Some("shared"));

        assert_eq!(rendered, "shared\nbody\nshared");
    }

    #[test]
    fn render_prompt_content_empty_snippet_becomes_empty_string() {
        let prompt = make_prompt("p1", "before {{common}} after", true);

        let rendered = PromptService::render_prompt_content(&prompt, Some(""));

        assert_eq!(rendered, "before  after");
    }

    #[test]
    fn render_prompt_content_missing_snippet_treated_as_empty() {
        let prompt = make_prompt("p1", "before {{common}} after", true);

        let rendered = PromptService::render_prompt_content(&prompt, None);

        assert_eq!(rendered, "before  after");
    }

    #[test]
    fn render_prompt_content_without_placeholder_keeps_content() {
        let prompt = make_prompt("p1", "plain content", true);

        let rendered = PromptService::render_prompt_content(&prompt, Some("shared"));

        assert_eq!(rendered, "plain content");
    }

    #[test]
    fn get_set_prompt_common_snippet_roundtrip() {
        let db = Database::memory().expect("in-memory database");

        assert_eq!(
            db.get_prompt_common_snippet("claude").expect("get empty"),
            None
        );

        db.set_prompt_common_snippet("claude", Some("shared".to_string()))
            .expect("set snippet");

        assert_eq!(
            db.get_prompt_common_snippet("claude").expect("get snippet"),
            Some("shared".to_string())
        );
    }

    #[test]
    fn clear_prompt_common_snippet_deletes_key() {
        let db = Database::memory().expect("in-memory database");
        db.set_prompt_common_snippet("claude", Some("shared".to_string()))
            .expect("set snippet");

        db.set_prompt_common_snippet("claude", Some("   \n".to_string()))
            .expect("clear snippet");

        assert_eq!(
            db.get_prompt_common_snippet("claude").expect("get cleared"),
            None
        );
    }

    #[test]
    #[serial]
    fn upsert_enabled_prompt_writes_rendered_common_content() {
        with_test_state(|state| {
            let prompt = make_prompt("p1", "before {{common}} after", true);
            state
                .db
                .set_prompt_common_snippet("claude", Some("shared".to_string()))
                .expect("set snippet");

            PromptService::upsert_prompt(state, AppType::Claude, "p1", prompt)
                .expect("upsert prompt");

            let target_path = prompt_file_path(&AppType::Claude).expect("prompt path");
            let live_content = fs::read_to_string(target_path).expect("read live prompt");
            assert_eq!(live_content, "before shared after");
        });
    }

    #[test]
    #[serial]
    fn set_prompt_common_snippet_rewrites_enabled_prompt_live_file() {
        with_test_state(|state| {
            let prompt = make_prompt("p1", "before {{common}} after", true);
            state
                .db
                .save_prompt(AppType::Claude.as_str(), &prompt)
                .expect("save prompt");

            PromptService::set_prompt_common_snippet(state, AppType::Claude, "shared".to_string())
                .expect("set snippet");

            let target_path = prompt_file_path(&AppType::Claude).expect("prompt path");
            let live_content = fs::read_to_string(target_path).expect("read live prompt");
            assert_eq!(live_content, "before shared after");
        });
    }

    #[test]
    #[serial]
    fn set_prompt_common_snippet_does_not_rewrite_live_file_without_placeholder() {
        with_test_state(|state| {
            let prompt = make_prompt("p1", "plain content", true);
            state
                .db
                .save_prompt(AppType::Claude.as_str(), &prompt)
                .expect("save prompt");
            let target_path = prompt_file_path(&AppType::Claude).expect("prompt path");
            if let Some(parent) = target_path.parent() {
                fs::create_dir_all(parent).expect("create prompt dir");
            }
            fs::write(&target_path, "existing live").expect("write live prompt");

            PromptService::set_prompt_common_snippet(state, AppType::Claude, "shared".to_string())
                .expect("set snippet");

            let live_content = fs::read_to_string(target_path).expect("read live prompt");
            assert_eq!(live_content, "existing live");
        });
    }

    #[test]
    #[serial]
    fn enable_prompt_does_not_backfill_rendered_common_content() {
        with_test_state(|state| {
            let prompt_with_common = make_prompt("p1", "before {{common}} after", true);
            let next_prompt = make_prompt("p2", "next prompt", false);
            state
                .db
                .save_prompt(AppType::Claude.as_str(), &prompt_with_common)
                .expect("save prompt with common");
            state
                .db
                .save_prompt(AppType::Claude.as_str(), &next_prompt)
                .expect("save next prompt");
            state
                .db
                .set_prompt_common_snippet("claude", Some("shared".to_string()))
                .expect("set snippet");
            let target_path = prompt_file_path(&AppType::Claude).expect("prompt path");
            if let Some(parent) = target_path.parent() {
                fs::create_dir_all(parent).expect("create prompt dir");
            }
            fs::write(&target_path, "before shared after").expect("write rendered live prompt");

            PromptService::enable_prompt(state, AppType::Claude, "p2").expect("enable next prompt");

            let prompts = state
                .db
                .get_prompts(AppType::Claude.as_str())
                .expect("get prompts");
            assert_eq!(
                prompts.get("p1").expect("first prompt").content,
                "before {{common}} after"
            );
            assert_eq!(prompts.len(), 2);
        });
    }

    #[test]
    fn restored_prompt_projection_writes_the_enabled_content() {
        let temp = tempfile::tempdir().expect("tempdir");
        let path = temp.path().join("AGENTS.md");
        let mut prompts = IndexMap::new();
        prompts.insert("off".to_string(), make_prompt("off", "old", false));
        prompts.insert("on".to_string(), make_prompt("on", "restored", true));

        let warning = project_prompt_set_to_path(&prompts, &path, None).expect("project prompt");
        assert!(warning.is_none());
        assert_eq!(fs::read_to_string(path).expect("read prompt"), "restored");
    }

    #[test]
    fn restored_prompt_projection_clears_a_stale_file_when_none_are_enabled() {
        let temp = tempfile::tempdir().expect("tempdir");
        let path = temp.path().join("AGENTS.md");
        fs::write(&path, "stale").expect("seed stale prompt");
        let prompts = IndexMap::new();

        let warning = project_prompt_set_to_path(&prompts, &path, None).expect("clear prompt");
        assert!(warning.is_none());
        assert_eq!(fs::read_to_string(path).expect("read prompt"), "");
    }

    #[test]
    fn restored_prompt_projection_selects_the_first_enabled_prompt_deterministically() {
        let temp = tempfile::tempdir().expect("tempdir");
        let path = temp.path().join("AGENTS.md");
        let mut prompts = IndexMap::new();
        prompts.insert(
            "first".to_string(),
            make_prompt("first", "first body", true),
        );
        prompts.insert(
            "second".to_string(),
            make_prompt("second", "second body", true),
        );

        let warning = project_prompt_set_to_path(&prompts, &path, None)
            .expect("project prompt")
            .expect("duplicate enabled prompts should warn");
        assert!(warning.contains("first, second"));
        assert_eq!(fs::read_to_string(path).expect("read prompt"), "first body");
    }

    #[test]
    #[serial]
    fn sync_to_live_renders_common_prompt_snippet() {
        with_test_state(|state| {
            let prompt = make_prompt("p1", "before {{common}} after", true);
            state
                .db
                .save_prompt(AppType::Claude.as_str(), &prompt)
                .expect("save prompt");
            state
                .db
                .set_prompt_common_snippet("claude", Some("shared".to_string()))
                .expect("set snippet");

            PromptService::sync_to_live(state, AppType::Claude).expect("sync prompt");

            let target_path = prompt_file_path(&AppType::Claude).expect("prompt path");
            assert_eq!(
                fs::read_to_string(target_path).expect("read prompt"),
                "before shared after"
            );
        });
    }
}
