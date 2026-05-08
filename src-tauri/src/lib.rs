use std::fs;
use std::path::{Path, PathBuf};
use serde::Serialize;
use notify::{Watcher, RecursiveMode, Event};
use std::sync::Mutex;
use tauri::{AppHandle, Emitter};

#[derive(Serialize)]
pub struct FileEntry {
    name: String,
    path: String,
    is_dir: bool,
}

pub struct WatcherState(Mutex<Option<notify::RecommendedWatcher>>);

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
            if entry.path().is_dir() {
                result.push(entry.file_name().to_string_lossy().to_string());
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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(WatcherState(Mutex::new(None)))
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            list_directory_contents,
            list_subdirs,
            read_file_content,
            write_file_content,
            watch_file,
            unwatch_file
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

