use sqlx::{sqlite::SqlitePool, Row, Sqlite, Transaction};
use std::path::Path;
use serde::Serialize;

#[derive(Serialize, Debug, Clone)]
pub struct MarkdownFile {
    pub id: i64,
    pub path: String,
    pub filename: String,
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
            "CREATE TABLE IF NOT EXISTS markdown_files (
                id INTEGER PRIMARY KEY,
                path TEXT NOT NULL UNIQUE,
                filename TEXT NOT NULL,
                mtime INTEGER NOT NULL,
                root TEXT NOT NULL
            )"
        )
        .execute(&pool)
        .await
        .map_err(|e| e.to_string())?;

        sqlx::query("CREATE INDEX IF NOT EXISTS idx_root ON markdown_files(root)")
            .execute(&pool)
            .await
            .map_err(|e| e.to_string())?;

        Ok(Self { pool })
    }

    pub async fn begin_transaction(&self) -> Result<Transaction<'_, Sqlite>, String> {
        self.pool.begin().await.map_err(|e| e.to_string())
    }

    pub async fn upsert_file_tx(tx: &mut Transaction<'_, Sqlite>, path: &str, filename: &str, mtime: i64, root: &str) -> Result<(), String> {
        sqlx::query(
            "INSERT INTO markdown_files (path, filename, mtime, root)
             VALUES (?1, ?2, ?3, ?4)
             ON CONFLICT(path) DO UPDATE SET filename=?2, mtime=?3, root=?4"
        )
        .bind(path)
        .bind(filename)
        .bind(mtime)
        .bind(root)
        .execute(&mut **tx)
        .await
        .map_err(|e| e.to_string())?;
        Ok(())
    }

    pub async fn upsert_file(&self, path: &str, filename: &str, mtime: i64, root: &str) -> Result<(), String> {
        sqlx::query(
            "INSERT INTO markdown_files (path, filename, mtime, root)
             VALUES (?1, ?2, ?3, ?4)
             ON CONFLICT(path) DO UPDATE SET filename=?2, mtime=?3, root=?4"
        )
        .bind(path)
        .bind(filename)
        .bind(mtime)
        .bind(root)
        .execute(&self.pool)
        .await
        .map_err(|e| e.to_string())?;
        Ok(())
    }

    pub async fn remove_file(&self, path: &str) -> Result<(), String> {
        sqlx::query("DELETE FROM markdown_files WHERE path = ?1")
            .bind(path)
            .execute(&self.pool)
            .await
            .map_err(|e| e.to_string())?;
        Ok(())
    }

    pub async fn remove_by_prefix(&self, prefix: &str) -> Result<(), String> {
        sqlx::query("DELETE FROM markdown_files WHERE path LIKE ?1 || '%'")
            .bind(prefix)
            .execute(&self.pool)
            .await
            .map_err(|e| e.to_string())?;
        Ok(())
    }

    pub async fn get_metadata_for_root(&self, root: &str) -> Result<std::collections::HashMap<String, i64>, String> {
        let rows = sqlx::query("SELECT path, mtime FROM markdown_files WHERE root = ?1")
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
        let rows = sqlx::query("SELECT path FROM markdown_files WHERE root = ?1")
            .bind(root)
            .fetch_all(&mut **tx)
            .await
            .map_err(|e| e.to_string())?;

        for row in rows {
            let path: String = row.get(0);
            if !found_paths.contains(&path) {
                sqlx::query("DELETE FROM markdown_files WHERE path = ?1")
                    .bind(&path)
                    .execute(&mut **tx)
                    .await
                    .map_err(|e| e.to_string())?;
            }
        }
        Ok(())
    }

    pub async fn get_all(&self) -> Result<Vec<MarkdownFile>, String> {
        let rows = sqlx::query("SELECT id, path, filename FROM markdown_files")
            .fetch_all(&self.pool)
            .await
            .map_err(|e| e.to_string())?;

        Ok(rows.into_iter().map(|row| MarkdownFile {
            id: row.get(0),
            path: row.get(1),
            filename: row.get(2),
        }).collect())
    }
}
