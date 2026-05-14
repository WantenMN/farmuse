mod db;

use std::collections::HashSet;
use std::fs;
use std::path::{Path, PathBuf};
use serde::Serialize;
use notify::{Watcher, RecursiveMode, Event, EventKind};
use std::sync::Mutex;
use tauri::{AppHandle, Emitter, Manager};
use walkdir::WalkDir;
use db::DbManager;

#[derive(Serialize)]
pub struct FileEntry {
    name: String,
    path: String,
    is_dir: bool,
}

#[derive(Serialize)]
pub struct FileExplorerEntry {
    name: String,
    path: String,
    is_dir: bool,
    depth: usize,
}

pub struct WatcherState(Mutex<Option<notify::RecommendedWatcher>>);
pub struct ExplorerWatcherState(Mutex<Option<notify::RecommendedWatcher>>);

pub struct IndexerState {
    db: Mutex<Option<DbManager>>,
    watcher: Mutex<Option<notify::RecommendedWatcher>>,
}

impl IndexerState {
    fn new() -> Self {
        Self {
            db: Mutex::new(None),
            watcher: Mutex::new(None),
        }
    }
}

#[tauri::command]
fn list_directory_contents(path: String) -> Result<Vec<FileEntry>, String> {
    let resolved_path = resolve_path(&path)?;
    let entries = fs::read_dir(resolved_path).map_err(|e| e.to_string())?;
    let mut result = Vec::new();

    for entry in entries {
        if let Ok(entry) = entry {
            let path = entry.path();
            let name = entry.file_name().to_string_lossy().to_string();
            let is_dir = path.is_dir();

            // Filter out hidden entries (names starting with dot)
            if name.starts_with('.') {
                continue;
            }

            // If it's a file, only include if it's a markdown file
            if !is_dir && !name.to_lowercase().ends_with(".md") {
                continue;
            }

            result.push(FileEntry {
                name,
                path: path.to_string_lossy().to_string(),
                is_dir,
            });
        }
    }
    // Sort directories first, then by name
    result.sort_by(|a, b| {
        if a.is_dir != b.is_dir {
            b.is_dir.cmp(&a.is_dir)
        } else {
            a.name.to_lowercase().cmp(&b.name.to_lowercase())
        }
    });
    Ok(result)
}

#[tauri::command]
fn list_subdirs(path: String) -> Result<Vec<String>, String> {
    let resolved_path = resolve_path(&path)?;

    // If the path is a file, get its parent
    let search_dir = if resolved_path.is_dir() {
        resolved_path.clone()
    } else {
        resolved_path.parent().unwrap_or(Path::new("/")).to_path_buf()
    };

    let entries = fs::read_dir(search_dir).map_err(|e| e.to_string())?;
    let mut result = Vec::new();

    for entry in entries {
        if let Ok(entry) = entry {
            let name = entry.file_name().to_string_lossy().to_string();
            if entry.path().is_dir() && !name.starts_with('.') {
                result.push(name);
            }
        }
    }
    Ok(result)
}

#[tauri::command]
fn read_file_content(path: String) -> Result<String, String> {
    let resolved_path = resolve_path(&path)?;
    if !resolved_path.is_file() {
        return Err("Not a file".to_string());
    }
    fs::read_to_string(resolved_path).map_err(|e| e.to_string())
}

#[tauri::command]
fn write_file_content(path: String, content: String) -> Result<(), String> {
    let resolved_path = resolve_path(&path)?;
    fs::write(resolved_path, content).map_err(|e| e.to_string())
}

#[tauri::command]
fn watch_file(app: AppHandle, state: tauri::State<WatcherState>, path: String) -> Result<(), String> {
    let resolved_path = resolve_path(&path)?;
    let mut watcher_opt = state.0.lock().unwrap();

    // Stop previous watcher
    *watcher_opt = None;

    let app_clone = app.clone();
    let path_clone = path.clone();

    let mut watcher = notify::recommended_watcher(move |res: notify::Result<Event>| {
        if let Ok(event) = res {
            if event.kind.is_modify() {
                let _ = app_clone.emit("file-changed", path_clone.clone());
            }
        }
    }).map_err(|e| e.to_string())?;

    watcher.watch(&resolved_path, RecursiveMode::NonRecursive).map_err(|e| e.to_string())?;

    *watcher_opt = Some(watcher);
    Ok(())
}

#[tauri::command]
fn unwatch_file(state: tauri::State<WatcherState>) {
    let mut watcher_opt = state.0.lock().unwrap();
    *watcher_opt = None;
}

#[tauri::command]
fn watch_explorer_directories(
    app: AppHandle,
    state: tauri::State<ExplorerWatcherState>,
    paths: Vec<String>,
) -> Result<(), String> {
    let mut watcher_opt = state.0.lock().unwrap();
    *watcher_opt = None;

    if paths.is_empty() {
        return Ok(());
    }

    let app_handle = app.clone();
    let mut watcher = notify::recommended_watcher(move |res: notify::Result<Event>| {
        if let Ok(event) = res {
            let mut dirs_to_refresh = HashSet::new();
            for path in event.paths {
                // If it's a directory that changed, or if a file inside a directory changed
                if let Some(parent) = path.parent() {
                    dirs_to_refresh.insert(parent.to_string_lossy().to_string());
                }
                // Also add the path itself if it's one of the watched directories
                dirs_to_refresh.insert(path.to_string_lossy().to_string());
            }
            for dir in dirs_to_refresh {
                let _ = app_handle.emit("explorer-refresh", dir);
            }
        }
    })
    .map_err(|e| e.to_string())?;

    for path in paths {
        let resolved = resolve_path(&path)?;
        if resolved.is_dir() {
            let _ = watcher.watch(&resolved, RecursiveMode::NonRecursive);
        }
    }

    *watcher_opt = Some(watcher);
    Ok(())
}

fn resolve_path(path: &str) -> Result<PathBuf, String> {
    if path.starts_with("~/") {
        let home = std::env::var("HOME")
            .or_else(|_| std::env::var("USERPROFILE"))
            .map_err(|_| "Could not find home directory".to_string())?;
        let mut pb = PathBuf::from(home);
        pb.push(&path[2..]);
        Ok(pb)
    } else if path == "~" {
        let home = std::env::var("HOME")
            .or_else(|_| std::env::var("USERPROFILE"))
            .map_err(|_| "Could not find home directory".to_string())?;
        Ok(PathBuf::from(home))
    } else {
        Ok(PathBuf::from(path))
    }
}

#[tauri::command]
fn create_directory(path: String) -> Result<(), String> {
    let resolved_path = resolve_path(&path)?;
    fs::create_dir_all(resolved_path).map_err(|e| e.to_string())
}

#[tauri::command]
fn rename_item(at: String, new_name: String) -> Result<String, String> {
    let resolved_at = resolve_path(&at)?;
    let parent = resolved_at.parent().ok_or("Could not find parent directory")?;
    let new_path = parent.join(new_name);
    fs::rename(&resolved_at, &new_path).map_err(|e| e.to_string())?;
    Ok(new_path.to_string_lossy().to_string())
}

#[tauri::command]
fn remove_to_trash(path: String) -> Result<(), String> {
    let resolved_path = resolve_path(&path)?;
    trash::delete(resolved_path).map_err(|e| e.to_string())
}

#[tauri::command]
fn duplicate_item(path: String) -> Result<String, String> {
    let resolved_path = resolve_path(&path)?;
    let parent = resolved_path.parent().ok_or("Could not find parent directory")?;
    let file_name = resolved_path.file_name().ok_or("Invalid file name")?.to_string_lossy();
    let is_dir = resolved_path.is_dir();

    let (stem, ext) = if is_dir {
        (file_name.to_string(), String::new())
    } else {
        let p = Path::new(file_name.as_ref());
        (
            p.file_stem().unwrap_or_default().to_string_lossy().to_string(),
            p.extension()
                .and_then(|e| e.to_str())
                .map(|e| format!(".{}", e))
                .unwrap_or_default(),
        )
    };

    let mut count = 1;
    let mut new_path = parent.join(format!("{} Copy {}{}", stem, count, ext));

    while new_path.exists() {
        count += 1;
        new_path = parent.join(format!("{} Copy {}{}", stem, count, ext));
    }

    if is_dir {
        copy_dir_recursive(&resolved_path, &new_path).map_err(|e| e.to_string())?;
    } else {
        fs::copy(&resolved_path, &new_path).map_err(|e| e.to_string())?;
    }

    Ok(new_path.to_string_lossy().to_string())
}

fn copy_dir_recursive(src: &Path, dst: &Path) -> std::io::Result<()> {
    fs::create_dir_all(dst)?;
    for entry in fs::read_dir(src)? {
        let entry = entry?;
        let ty = entry.file_type()?;
        if ty.is_dir() {
            copy_dir_recursive(&entry.path(), &dst.join(entry.file_name()))?;
        } else {
            fs::copy(entry.path(), dst.join(entry.file_name()))?;
        }
    }
    Ok(())
}

#[tauri::command]
fn copy_item(at: String, to_dir: String) -> Result<String, String> {
    let resolved_at = resolve_path(&at)?;
    let resolved_to_dir = resolve_path(&to_dir)?;
    let file_name = resolved_at.file_name().ok_or("Invalid file name")?;
    let mut new_path = resolved_to_dir.join(file_name);

    if new_path.exists() {
        if resolved_at.parent() == Some(&resolved_to_dir) {
            return duplicate_item(at);
        }

        let is_dir = resolved_at.is_dir();
        let name = file_name.to_string_lossy();
        let (stem, ext) = if is_dir {
            (name.to_string(), String::new())
        } else {
            let p = Path::new(name.as_ref());
            (
                p.file_stem().unwrap_or_default().to_string_lossy().to_string(),
                p.extension()
                    .and_then(|e| e.to_str())
                    .map(|e| format!(".{}", e))
                    .unwrap_or_default(),
            )
        };

        let mut count = 1;
        new_path = resolved_to_dir.join(format!("{} Copy {}{}", stem, count, ext));
        while new_path.exists() {
            count += 1;
            new_path = resolved_to_dir.join(format!("{} Copy {}{}", stem, count, ext));
        }
    }

    let is_dir = resolved_at.is_dir();
    if is_dir {
        copy_dir_recursive(&resolved_at, &new_path).map_err(|e| e.to_string())?;
    } else {
        fs::copy(&resolved_at, &new_path).map_err(|e| e.to_string())?;
    }
    Ok(new_path.to_string_lossy().to_string())
}

#[tauri::command]
fn move_item(at: String, to_dir: String) -> Result<String, String> {
    let resolved_at = resolve_path(&at)?;
    let resolved_to_dir = resolve_path(&to_dir)?;
    let file_name = resolved_at.file_name().ok_or("Invalid file name")?;
    let new_path = resolved_to_dir.join(file_name);

    if new_path.exists() {
        return Err("A file with the same name already exists in the destination".to_string());
    }

    fs::rename(&resolved_at, &new_path).map_err(|e| e.to_string())?;
    Ok(new_path.to_string_lossy().to_string())
}

#[tauri::command]
async fn list_all_subdirs(state: tauri::State<'_, IndexerState>, path: String) -> Result<Vec<String>, String> {
    let resolved_path = resolve_path(&path)?;
    let path_str = resolved_path.to_string_lossy().to_string();

    let db = {
        let db_lock = state.db.lock().unwrap();
        db_lock.clone()
    };

    if let Some(db) = db {
        if let Ok(entries) = db.get_entries_by_root(&path_str).await {
            let dirs = entries.into_iter()
                .filter(|e| e.is_dir)
                .map(|e| e.path)
                .collect::<Vec<_>>();
            if !dirs.is_empty() {
                return Ok(dirs);
            }
        }
    }
    // ... Fallback logic ...
    let mut result = Vec::new();
    let mut stack = vec![resolved_path];

    while let Some(current) = stack.pop() {
        if let Ok(entries) = fs::read_dir(current) {
            for entry in entries.flatten() {
                let path = entry.path();
                if path.is_dir() {
                    let name = entry.file_name().to_string_lossy().to_string();
                    if !name.starts_with('.') {
                        result.push(path.to_string_lossy().to_string());
                        stack.push(path);
                    }
                }
            }
        }
    }
    Ok(result)
}

#[tauri::command]
async fn initialize_indexer(app: AppHandle, state: tauri::State<'_, IndexerState>, root_path: String) -> Result<(), String> {
    let resolved_root = resolve_path(&root_path)?;

    // 1. Initialize DB
    let app_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    fs::create_dir_all(&app_dir).map_err(|e| e.to_string())?;
    let db_path = app_dir.join("index.db");
    let db = DbManager::new(db_path).await?;

    let app_handle_progress = app.clone();
    let db_clone = db.clone();
    let resolved_root_clone = resolved_root.clone();
    let root_str = resolved_root.to_string_lossy().to_string();

    let root_str_for_indexing = root_str.clone();

    // 2. Incremental Indexing in background
    tauri::async_runtime::spawn(async move {
        let _ = app_handle_progress.emit("index-status", "indexing");

        // Get existing metadata to skip unchanged files
        let existing_meta = db_clone.get_metadata_for_root(&root_str_for_indexing).await.unwrap_or_default();
        let mut found_paths = std::collections::HashSet::new();
        let mut count = 0;
        let mut updated_count = 0;

        let mut tx = match db_clone.begin_transaction().await {
            Ok(t) => t,
            Err(_) => return,
        };

        for entry in WalkDir::new(&resolved_root_clone)
            .into_iter()
            .filter_map(|e| e.ok())
        {
            let name = entry.file_name().to_string_lossy().to_string();
            if name.starts_with('.') {
                continue;
            }

            let path = entry.path().to_string_lossy().to_string();
            if path == root_str_for_indexing {
                continue;
            }

            let is_dir = entry.file_type().is_dir();
            let is_md = entry.file_type().is_file() && entry.path().extension().map_or(false, |ext| ext == "md");

            if !is_dir && !is_md {
                continue;
            }

            found_paths.insert(path.clone());

            let mtime = entry.metadata().ok().and_then(|m| m.modified().ok())
                .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
                .map(|d| d.as_secs() as i64)
                .unwrap_or(0);

            // Only update if mtime changed or entry is new
            if existing_meta.get(&path) != Some(&mtime) {
                let _ = DbManager::upsert_entry_tx(&mut tx, &path, &name, is_dir, mtime, &root_str_for_indexing).await;
                updated_count += 1;
            }

            if !is_dir {
                count += 1;
                if count % 100 == 0 {
                    let _ = app_handle_progress.emit("index-progress", count);
                }
            }
        }

        // Remove stale entries
        let _ = DbManager::cleanup_root_stale_tx(&mut tx, &root_str_for_indexing, &found_paths).await;

        let _ = tx.commit().await;

        let _ = app_handle_progress.emit("index-progress", count);
        let _ = app_handle_progress.emit("index-status", "idle");

        if updated_count > 0 {
             let _ = app_handle_progress.emit("index-updated", ());
        }
    });

    *state.db.lock().unwrap() = Some(db);

    // 3. Setup Watcher
    let app_handle = app.clone();
    let root_str_for_watcher = root_str.clone();
    let mut watcher = notify::recommended_watcher(move |res: notify::Result<Event>| {
        if let Ok(event) = res {
            let app_handle_inner = app_handle.clone();
            let root_str_inner = root_str_for_watcher.clone();
            tauri::async_runtime::spawn(async move {
                    let state = app_handle_inner.state::<IndexerState>();
                    let db = {
                        let db_lock = state.db.lock().unwrap();
                        db_lock.clone()
                    };
                    if let Some(db) = db {
                        match event.kind {
                            EventKind::Create(_) | EventKind::Modify(_) | EventKind::Any => {
                                for path in event.paths {
                                    if path.exists() {
                                        let name = path.file_name().unwrap_or_default().to_string_lossy().to_string();
                                        if name.starts_with('.') {
                                            continue;
                                        }

                                        let is_dir = path.is_dir();
                                        let is_md = path.is_file() && path.extension().map_or(false, |ext| ext == "md");

                                        if is_dir || is_md {
                                            let path_str = path.to_string_lossy().to_string();
                                            let mtime = path.metadata().ok().and_then(|m| m.modified().ok())
                                                .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
                                                .map(|d| d.as_secs() as i64)
                                                .unwrap_or(0);
                                            let _ = db.upsert_entry(&path_str, &name, is_dir, mtime, &root_str_inner).await;
                                        }
                                    } else {
                                        let path_str = path.to_string_lossy().to_string();
                                        let _ = db.remove_entry(&path_str).await;
                                        let _ = db.remove_by_prefix(&path_str).await;
                                    }
                                }
                            }
                            EventKind::Remove(_) => {
                                for path in event.paths {
                                    let path_str = path.to_string_lossy().to_string();
                                    let _ = db.remove_entry(&path_str).await;
                                    let _ = db.remove_by_prefix(&path_str).await;
                                }
                            }
                            _ => {}
                        }
                        let _ = app_handle_inner.emit("index-updated", ());
                    }
            });
        }
    }).map_err(|e| e.to_string())?;

    watcher.watch(&resolved_root, RecursiveMode::Recursive).map_err(|e| e.to_string())?;
    *state.watcher.lock().unwrap() = Some(watcher);

    Ok(())
}

#[tauri::command]
async fn search_markdown_files(state: tauri::State<'_, IndexerState>, query: String, root_path: Option<String>) -> Result<Vec<db::MarkdownFile>, String> {
    if query.is_empty() {
        return Ok(Vec::new());
    }

    let db = {
        let db_lock = state.db.lock().unwrap();
        db_lock.clone()
    };

    if let Some(db) = db {
        let all_files = if let Some(root) = root_path {
            db.get_entries_by_root(&root).await?
        } else {
            db.get_all().await?
        };

        use fuzzy_matcher::skim::SkimMatcherV2;
        use fuzzy_matcher::FuzzyMatcher;
        let matcher = SkimMatcherV2::default();

        let mut ranked: Vec<(i64, db::MarkdownFile)> = all_files
            .into_iter()
            .filter(|f| !f.is_dir) // Only search files
            .filter_map(|file| {
                matcher.fuzzy_match(&file.filename, &query)
                    .map(|score| (score, file))
            })
            .collect();

        ranked.sort_by(|a, b| b.0.cmp(&a.0));
        Ok(ranked.into_iter().map(|(_, file)| file).take(50).collect())
    } else {
        Ok(Vec::new())
    }
}

#[tauri::command]
async fn clear_root_index(state: tauri::State<'_, IndexerState>, root_path: String) -> Result<(), String> {
    let db = {
        let db_lock = state.db.lock().unwrap();
        db_lock.clone()
    };
    if let Some(db) = db {
        db.clear_root_index(&root_path).await
    } else {
        Ok(())
    }
}

#[tauri::command]
async fn get_explorer_entries(
    state: tauri::State<'_, IndexerState>,
    root_path: String,
    expanded_paths: Option<Vec<String>>,
    expand_all: Option<bool>,
) -> Result<Vec<FileExplorerEntry>, String> {
    let resolved_root = resolve_path(&root_path)?;
    let root_str = resolved_root.to_string_lossy().to_string();
    let is_expand_all = expand_all.unwrap_or(false);
    let expanded_set: HashSet<String> = if is_expand_all {
        HashSet::new()
    } else {
        expanded_paths.unwrap_or_default().into_iter().collect()
    };

    let db = {
        let db_lock = state.db.lock().unwrap();
        db_lock.clone()
    };

    if let Some(db) = db {
        let all_entries = db.get_entries_by_root(&root_str).await.unwrap_or_default();

        let mut entries_by_parent: std::collections::HashMap<String, Vec<db::MarkdownFile>> =
            std::collections::HashMap::new();

        for e in &all_entries {
            let p = Path::new(&e.path)
                .parent()
                .map(|p| p.to_string_lossy().to_string())
                .unwrap_or_default();
            entries_by_parent.entry(p).or_default().push(e.clone());
        }

        let mut result = Vec::with_capacity(all_entries.len());

        fn collect_recursive(
            current_path: &str,
            depth: usize,
            expanded_set: &HashSet<String>,
            is_expand_all: bool,
            entries_by_parent: &std::collections::HashMap<String, Vec<db::MarkdownFile>>,
            result: &mut Vec<FileExplorerEntry>,
        ) {
            if let Some(entries) = entries_by_parent.get(current_path) {
                let mut sorted_entries = entries.clone();
                sorted_entries.sort_unstable_by(|a, b| {
                    if a.is_dir != b.is_dir {
                        b.is_dir.cmp(&a.is_dir)
                    } else {
                        a.filename.to_lowercase().cmp(&b.filename.to_lowercase())
                    }
                });

                for entry in sorted_entries {
                    let path_for_result = entry.path.clone();
                    let is_dir = entry.is_dir;
                    result.push(FileExplorerEntry {
                        name: entry.filename,
                        path: path_for_result.clone(),
                        is_dir,
                        depth,
                    });

                    if is_dir {
                        let expanded = is_expand_all || expanded_set.contains(&path_for_result) || expanded_set.contains(&path_for_result.replace("\\", "/"));
                        if expanded {
                            collect_recursive(
                                &path_for_result,
                                depth + 1,
                                expanded_set,
                                is_expand_all,
                                entries_by_parent,
                                result,
                            );
                        }
                    }
                }
            }
        }

        collect_recursive(
            &root_str,
            0,
            &expanded_set,
            is_expand_all,
            &entries_by_parent,
            &mut result,
        );
        return Ok(result);
    }

    Ok(Vec::new())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(WatcherState(Mutex::new(None)))
        .manage(ExplorerWatcherState(Mutex::new(None)))
        .manage(IndexerState::new())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .invoke_handler(tauri::generate_handler![
            list_directory_contents,
            list_subdirs,
            read_file_content,
            write_file_content,
            watch_file,
            unwatch_file,
            watch_explorer_directories,
            create_directory,
            list_all_subdirs,
            initialize_indexer,
            search_markdown_files,
            clear_root_index,
            get_explorer_entries,
            rename_item,
            remove_to_trash,
            duplicate_item,
            copy_item,
            move_item
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

