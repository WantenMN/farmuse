use sqlx::{sqlite::SqlitePool, Row, Sqlite, Transaction};
use std::path::Path;
use serde::Serialize;

#[derive(Serialize, Debug, Clone)]
pub struct MarkdownFile {
    pub id: i64,
    pub path: String,
    pub filename: String,
    pub is_dir: bool,
}

#[derive(Clone)]
pub struct DbManager {
    pool: SqlitePool,
}

impl DbManager {
    pub async fn new<P: AsRef<Path>>(path: P) -> Result<Self, String> {
        let path_str = path.as_ref().to_str().ok_or("Invalid path")?;
        let conn_str = format!("sqlite:{}", path_str);

        if !path.as_ref().exists() {
            std::fs::File::create(path.as_ref()).map_err(|e| e.to_string())?;
        }

        let pool = SqlitePool::connect(&conn_str).await.map_err(|e| e.to_string())?;

        sqlx::query(
            "CREATE TABLE IF NOT EXISTS all_entries (
                path TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                is_dir BOOLEAN NOT NULL,
                mtime INTEGER NOT NULL,
                root TEXT NOT NULL
            )"
        )
        .execute(&pool)
        .await
        .map_err(|e| e.to_string())?;

        sqlx::query("CREATE INDEX IF NOT EXISTS idx_entries_root ON all_entries(root)")
            .execute(&pool)
            .await
            .map_err(|e| e.to_string())?;

        Ok(Self { pool })
    }

    pub async fn begin_transaction(&self) -> Result<Transaction<'_, Sqlite>, String> {
        self.pool.begin().await.map_err(|e| e.to_string())
    }

    pub async fn upsert_entry_tx(tx: &mut Transaction<'_, Sqlite>, path: &str, name: &str, is_dir: bool, mtime: i64, root: &str) -> Result<(), String> {
        sqlx::query(
            "INSERT INTO all_entries (path, name, is_dir, mtime, root)
             VALUES (?1, ?2, ?3, ?4, ?5)
             ON CONFLICT(path) DO UPDATE SET name=?2, is_dir=?3, mtime=?4, root=?5"
        )
        .bind(path)
        .bind(name)
        .bind(is_dir)
        .bind(mtime)
        .bind(root)
        .execute(&mut **tx)
        .await
        .map_err(|e| e.to_string())?;
        Ok(())
    }

    pub async fn upsert_entry(&self, path: &str, name: &str, is_dir: bool, mtime: i64, root: &str) -> Result<(), String> {
        sqlx::query(
            "INSERT INTO all_entries (path, name, is_dir, mtime, root)
             VALUES (?1, ?2, ?3, ?4, ?5)
             ON CONFLICT(path) DO UPDATE SET name=?2, is_dir=?3, mtime=?4, root=?5"
        )
        .bind(path)
        .bind(name)
        .bind(is_dir)
        .bind(mtime)
        .bind(root)
        .execute(&self.pool)
        .await
        .map_err(|e| e.to_string())?;
        Ok(())
    }

    pub async fn remove_entry(&self, path: &str) -> Result<(), String> {
        sqlx::query("DELETE FROM all_entries WHERE path = ?1")
            .bind(path)
            .execute(&self.pool)
            .await
            .map_err(|e| e.to_string())?;
        Ok(())
    }

    pub async fn remove_by_prefix(&self, prefix: &str) -> Result<(), String> {
        sqlx::query("DELETE FROM all_entries WHERE path LIKE ?1 || '%'")
            .bind(prefix)
            .execute(&self.pool)
            .await
            .map_err(|e| e.to_string())?;
        Ok(())
    }

    pub async fn get_metadata_for_root(&self, root: &str) -> Result<std::collections::HashMap<String, i64>, String> {
        let rows = sqlx::query("SELECT path, mtime FROM all_entries WHERE root = ?1")
            .bind(root)
            .fetch_all(&self.pool)
            .await
            .map_err(|e| e.to_string())?;

        let mut map = std::collections::HashMap::new();
        for row in rows {
            map.insert(row.get(0), row.get(1));
        }
        Ok(map)
    }

    pub async fn cleanup_root_stale_tx(
        tx: &mut Transaction<'_, Sqlite>,
        root: &str,
        found_paths: &std::collections::HashSet<String>,
    ) -> Result<(), String> {
        let rows = sqlx::query("SELECT path FROM all_entries WHERE root = ?1")
            .bind(root)
            .fetch_all(&mut **tx)
            .await
            .map_err(|e| e.to_string())?;

        for row in rows {
            let path: String = row.get(0);
            if !found_paths.contains(&path) {
                sqlx::query("DELETE FROM all_entries WHERE path = ?1")
                    .bind(&path)
                    .execute(&mut **tx)
                    .await
                    .map_err(|e| e.to_string())?;
            }
        }
        Ok(())
    }

    pub async fn clear_root_index(&self, root: &str) -> Result<(), String> {
        sqlx::query("DELETE FROM all_entries WHERE root = ?1")
            .bind(root)
            .execute(&self.pool)
            .await
            .map_err(|e| e.to_string())?;
        Ok(())
    }

    pub async fn get_entries_by_root(&self, root: &str) -> Result<Vec<MarkdownFile>, String> {
        let rows = sqlx::query("SELECT path, name, is_dir FROM all_entries WHERE root = ?1")
            .bind(root)
            .fetch_all(&self.pool)
            .await
            .map_err(|e| e.to_string())?;

        Ok(rows.into_iter().map(|row| MarkdownFile {
            id: 0,
            path: row.get(0),
            filename: row.get(1),
            is_dir: row.get(2),
        }).collect())
    }

    pub async fn get_all(&self) -> Result<Vec<MarkdownFile>, String> {
        let rows = sqlx::query("SELECT path, name, is_dir FROM all_entries")
            .fetch_all(&self.pool)
            .await
            .map_err(|e| e.to_string())?;

        Ok(rows.into_iter().map(|row| MarkdownFile {
            id: 0,
            path: row.get(0),
            filename: row.get(1),
            is_dir: row.get(2),
        }).collect())
    }
}
