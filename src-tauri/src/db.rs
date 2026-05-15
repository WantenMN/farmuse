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
        let normalized_path = path.replace("\\", "/");
        let normalized_root = root.replace("\\", "/");
        sqlx::query(
            "INSERT INTO all_entries (path, name, is_dir, mtime, root)
             VALUES (?1, ?2, ?3, ?4, ?5)
             ON CONFLICT(path) DO UPDATE SET name=?2, is_dir=?3, mtime=?4, root=?5"
        )
        .bind(&normalized_path)
        .bind(name)
        .bind(is_dir)
        .bind(mtime)
        .bind(&normalized_root)
        .execute(&mut **tx)
        .await
        .map_err(|e| e.to_string())?;
        Ok(())
    }

    pub async fn upsert_entry(&self, path: &str, name: &str, is_dir: bool, mtime: i64, root: &str) -> Result<(), String> {
        // Normalize to forward slashes for cross-platform consistency
        let normalized_path = path.replace("\\", "/");
        let normalized_root = root.replace("\\", "/");
        sqlx::query(
            "INSERT INTO all_entries (path, name, is_dir, mtime, root)
             VALUES (?1, ?2, ?3, ?4, ?5)
             ON CONFLICT(path) DO UPDATE SET name=?2, is_dir=?3, mtime=?4, root=?5"
        )
        .bind(&normalized_path)
        .bind(name)
        .bind(is_dir)
        .bind(mtime)
        .bind(&normalized_root)
        .execute(&self.pool)
        .await
        .map_err(|e| e.to_string())?;
        Ok(())
    }

    pub async fn remove_entry(&self, path: &str) -> Result<(), String> {
        let normalized = path.replace("\\", "/");
        sqlx::query("DELETE FROM all_entries WHERE path = ?1")
            .bind(&normalized)
            .execute(&self.pool)
            .await
            .map_err(|e| e.to_string())?;
        Ok(())
    }

    pub async fn remove_by_prefix(&self, prefix: &str) -> Result<(), String> {
        let normalized = prefix.replace("\\", "/");
        let like_pattern = format!("{}/%", normalized);
        sqlx::query("DELETE FROM all_entries WHERE path = ?1 OR path LIKE ?2")
            .bind(&normalized)
            .bind(&like_pattern)
            .execute(&self.pool)
            .await
            .map_err(|e| e.to_string())?;
        Ok(())
    }

    pub async fn reindex_directory(&self, dir_path: &str, root: &str) -> Result<(), String> {
        use walkdir::WalkDir;

        let mtime = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.as_secs() as i64)
            .unwrap_or(0);

        let mut tx = self.begin_transaction().await?;

        for entry in WalkDir::new(dir_path).into_iter().filter_map(|e| e.ok()) {
            let name = entry.file_name().to_string_lossy().to_string();
            if name.starts_with('.') {
                continue;
            }
            let path = entry.path().to_string_lossy().to_string();
            if path == dir_path {
                continue;
            }
            let is_dir = entry.file_type().is_dir();
            let is_md = entry.file_type().is_file() && entry.path().extension().map_or(false, |ext| ext == "md");
            if !is_dir && !is_md {
                continue;
            }
            Self::upsert_entry_tx(&mut tx, &path, &name, is_dir, mtime, root).await?;
        }

        tx.commit().await.map_err(|e| e.to_string())?;
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

    pub async fn move_entry(&self, old_path: &str, new_path: &str, new_name: &str, is_dir: bool) -> Result<(), String> {
        let old_normalized = old_path.replace("\\", "/");
        let new_normalized = new_path.replace("\\", "/");

        // Find workspace root
        let root_row = sqlx::query("SELECT root FROM all_entries WHERE path = ?1")
            .bind(&old_normalized)
            .fetch_optional(&self.pool)
            .await
            .map_err(|e| e.to_string())?;

        let workspace_root = match root_row {
            Some(row) => row.get::<String, _>(0),
            None => return Ok(()),
        };

        // Remove old entry + all children
        self.remove_by_prefix(&old_normalized).await?;

        let mtime = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.as_secs() as i64)
            .unwrap_or(0);

        // Insert the moved entry itself
        self.upsert_entry(&new_normalized, new_name, is_dir, mtime, &workspace_root).await?;

        // If directory, re-index from filesystem
        if is_dir {
            self.reindex_directory(new_path, &workspace_root).await?;
        }

        Ok(())
    }
}
