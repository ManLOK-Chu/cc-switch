//! Skill Groups 数据访问对象
//!
//! 提供 Skill 分组的 CRUD 操作。

use crate::database::{lock_conn, Database};
use crate::error::AppError;
use crate::services::skill::{SkillGroup, SkillGroupMember};
use rusqlite::params;

impl Database {
    // ========== SkillGroup CRUD ==========

    /// 获取所有 Skill 分组
    pub fn get_skill_groups(&self) -> Result<Vec<SkillGroup>, AppError> {
        let conn = lock_conn!(self.conn);
        let mut stmt = conn
            .prepare(
                "SELECT id, name, sort_index, created_at FROM skill_groups ORDER BY sort_index ASC, created_at ASC",
            )
            .map_err(|e| AppError::Database(e.to_string()))?;

        let groups = stmt
            .query_map([], |row| {
                Ok(SkillGroup {
                    id: row.get(0)?,
                    name: row.get(1)?,
                    sort_index: row.get(2)?,
                    created_at: row.get(3)?,
                })
            })
            .map_err(|e| AppError::Database(e.to_string()))?
            .collect::<Result<Vec<_>, _>>()
            .map_err(|e| AppError::Database(e.to_string()))?;

        Ok(groups)
    }

    /// 获取单个 Skill 分组
    pub fn get_skill_group(&self, id: &str) -> Result<Option<SkillGroup>, AppError> {
        let conn = lock_conn!(self.conn);
        let result = conn.query_row(
            "SELECT id, name, sort_index, created_at FROM skill_groups WHERE id = ?1",
            params![id],
            |row| {
                Ok(SkillGroup {
                    id: row.get(0)?,
                    name: row.get(1)?,
                    sort_index: row.get(2)?,
                    created_at: row.get(3)?,
                })
            },
        );

        match result {
            Ok(g) => Ok(Some(g)),
            Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
            Err(e) => Err(AppError::Database(e.to_string())),
        }
    }

    /// 保存 Skill 分组（添加或更新）
    pub fn save_skill_group(&self, group: &SkillGroup) -> Result<(), AppError> {
        let conn = lock_conn!(self.conn);
        conn.execute(
            "INSERT OR REPLACE INTO skill_groups (id, name, sort_index, created_at) VALUES (?1, ?2, ?3, ?4)",
            params![group.id, group.name, group.sort_index, group.created_at],
        )
        .map_err(|e| AppError::Database(e.to_string()))?;
        Ok(())
    }

    /// 删除 Skill 分组
    pub fn delete_skill_group(&self, id: &str) -> Result<bool, AppError> {
        let conn = lock_conn!(self.conn);
        let affected = conn
            .execute("DELETE FROM skill_groups WHERE id = ?1", params![id])
            .map_err(|e| AppError::Database(e.to_string()))?;
        Ok(affected > 0)
    }

    // ========== SkillGroupMember CRUD ==========

    /// 获取所有 Skill 分组关联关系
    pub fn get_skill_group_members(&self) -> Result<Vec<SkillGroupMember>, AppError> {
        let conn = lock_conn!(self.conn);
        let mut stmt = conn
            .prepare("SELECT skill_id, group_id FROM skill_group_members")
            .map_err(|e| AppError::Database(e.to_string()))?;

        let members = stmt
            .query_map([], |row| {
                Ok(SkillGroupMember {
                    skill_id: row.get(0)?,
                    group_id: row.get(1)?,
                })
            })
            .map_err(|e| AppError::Database(e.to_string()))?
            .collect::<Result<Vec<_>, _>>()
            .map_err(|e| AppError::Database(e.to_string()))?;

        Ok(members)
    }

    /// 获取指定分组下的所有 Skill ID
    pub fn get_group_members_by_group(&self, group_id: &str) -> Result<Vec<String>, AppError> {
        let conn = lock_conn!(self.conn);
        let mut stmt = conn
            .prepare("SELECT skill_id FROM skill_group_members WHERE group_id = ?1")
            .map_err(|e| AppError::Database(e.to_string()))?;

        let skill_ids = stmt
            .query_map(params![group_id], |row| row.get(0))
            .map_err(|e| AppError::Database(e.to_string()))?
            .collect::<Result<Vec<_>, _>>()
            .map_err(|e| AppError::Database(e.to_string()))?;

        Ok(skill_ids)
    }

    /// 添加 Skill 到分组
    pub fn add_skill_to_group(&self, skill_id: &str, group_id: &str) -> Result<(), AppError> {
        let conn = lock_conn!(self.conn);
        conn.execute(
            "INSERT OR REPLACE INTO skill_group_members (skill_id, group_id) VALUES (?1, ?2)",
            params![skill_id, group_id],
        )
        .map_err(|e| AppError::Database(e.to_string()))?;
        Ok(())
    }

    /// 将 Skill 从分组中移除
    pub fn remove_skill_from_group(&self, skill_id: &str) -> Result<bool, AppError> {
        let conn = lock_conn!(self.conn);
        let affected = conn
            .execute(
                "DELETE FROM skill_group_members WHERE skill_id = ?1",
                params![skill_id],
            )
            .map_err(|e| AppError::Database(e.to_string()))?;
        Ok(affected > 0)
    }

    /// 移动 Skill 到指定分组（None 表示移除分组）
    pub fn move_skill_to_group(
        &self,
        skill_id: &str,
        group_id: Option<&str>,
    ) -> Result<(), AppError> {
        let conn = lock_conn!(self.conn);
        conn.execute(
            "DELETE FROM skill_group_members WHERE skill_id = ?1",
            params![skill_id],
        )
        .map_err(|e| AppError::Database(e.to_string()))?;

        if let Some(gid) = group_id {
            conn.execute(
                "INSERT INTO skill_group_members (skill_id, group_id) VALUES (?1, ?2)",
                params![skill_id, gid],
            )
            .map_err(|e| AppError::Database(e.to_string()))?;
        }
        Ok(())
    }
}
