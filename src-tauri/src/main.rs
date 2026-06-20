// Prevents additional console window on Windows in release
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::process::{Command, Child};
use std::sync::Mutex;
use tauri::{Manager, State};

struct BackendProcess(Mutex<Option<Child>>);

/// Launch the FastAPI backend as a sidecar subprocess
fn start_backend() -> Option<Child> {
    // Try python3 first, then python
    let python = if cfg!(target_os = "windows") { "python" } else { "python3" };

    let backend_dir = std::env::current_exe()
        .ok()?
        .parent()?
        .join("backend");

    let main_py = backend_dir.join("main.py");

    if !main_py.exists() {
        eprintln!("[neuron] backend/main.py not found at {:?}", main_py);
        return None;
    }

    match Command::new(python)
        .arg(main_py)
        .current_dir(&backend_dir)
        .spawn()
    {
        Ok(child) => {
            println!("[neuron] Backend started (PID {})", child.id());
            Some(child)
        }
        Err(e) => {
            eprintln!("[neuron] Failed to start backend: {}", e);
            None
        }
    }
}

#[tauri::command]
fn get_app_version() -> String {
    env!("CARGO_PKG_VERSION").to_string()
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .manage(BackendProcess(Mutex::new(None)))
        .setup(|app| {
            // Start FastAPI backend
            let child = start_backend();
            let state = app.state::<BackendProcess>();
            *state.0.lock().unwrap() = child;

            // Give backend 2s to start before the window makes requests
            std::thread::sleep(std::time::Duration::from_millis(2000));

            Ok(())
        })
        .on_window_event(|_window, event| {
            if let tauri::WindowEvent::Destroyed = event {
                // Backend will be killed when the Tauri process exits
            }
        })
        .invoke_handler(tauri::generate_handler![get_app_version])
        .run(tauri::generate_context!())
        .expect("error while running Neuron IDE");
}
