#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tauri::menu::{MenuBuilder, MenuItemBuilder};
use tauri::tray::TrayIconBuilder;
use tauri::Manager;
use std::process::Command;
use std::sync::Mutex;

struct SidecarState {
    port: Mutex<u16>,
}

fn find_node() -> Option<std::path::PathBuf> {
    // 1. Check common Homebrew paths (Apple Silicon + Intel)
    let candidates = [
        "/opt/homebrew/bin/node",
        "/usr/local/bin/node",
        "/usr/bin/node",
    ];
    for c in &candidates {
        let p = std::path::PathBuf::from(c);
        if p.exists() {
            return Some(p);
        }
    }
    // 2. Try PATH lookup via /usr/bin/env
    if let Ok(output) = Command::new("/usr/bin/env")
        .arg("which")
        .arg("node")
        .output()
    {
        if output.status.success() {
            let s = String::from_utf8_lossy(&output.stdout).trim().to_string();
            if !s.is_empty() && std::path::Path::new(&s).exists() {
                return Some(std::path::PathBuf::from(s));
            }
        }
    }
    None
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            None,
        ))
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_opener::init())
        .manage(SidecarState {
            port: Mutex::new(3456),
        })
        .setup(|app| {
            let port: u16 = std::env::var("SIDECAR_PORT")
                .ok()
                .and_then(|s| s.parse().ok())
                .unwrap_or(3456);

            // Resolve paths
            let manifest_dir = std::env::var("CARGO_MANIFEST_DIR").unwrap_or_default();
            let is_dev = !manifest_dir.is_empty();

            let (sidecar_entry, tsx_path): (std::path::PathBuf, std::path::PathBuf) = if is_dev {
                // Dev: use tsx to run TypeScript directly
                let base = std::path::PathBuf::from(&manifest_dir).join("..");
                (
                    base.join("sidecar/index.ts"),
                    base.join("node_modules/.bin/tsx"),
                )
            } else {
                // Production: use bundled compiled JS, no tsx needed
                let resource_dir = app
                    .path()
                    .resource_dir()
                    .unwrap_or_else(|_| std::path::PathBuf::from("."));
                let entry = resource_dir.join("_up_/dist-sidecar/index.cjs");

                (entry, std::path::PathBuf::new())
            };

            // Find node binary
            let node_bin = match find_node() {
                Some(p) => p,
                None => {
                    eprintln!("[tauri] ERROR: node not found. Sidecar will not start.");
                    // Still continue app launch - just no sidecar
                    let state = app.state::<SidecarState>();
                    *state.port.lock().unwrap() = port;

                    setup_tray(app)?;
                    return Ok(());
                }
            };

            eprintln!("[tauri] node: {}", node_bin.display());
            eprintln!("[tauri] tsx: {}", tsx_path.display());
            eprintln!("[tauri] sidecar: {}", sidecar_entry.display());

            if !sidecar_entry.exists() {
                eprintln!(
                    "[tauri] ERROR: sidecar entry not found at {}",
                    sidecar_entry.display()
                );
            }

            let port_str = port.to_string();
            let mut cmd = Command::new(&node_bin);
            cmd.env("SIDECAR_PORT", &port_str);

            if is_dev {
                cmd.arg(&tsx_path).arg(&sidecar_entry);
            } else {
                cmd.arg(&sidecar_entry);
            }

            let child = cmd
                .stdout(std::process::Stdio::piped())
                .stderr(std::process::Stdio::piped())
                .spawn();

            match child {
                Ok(mut child) => {
                    eprintln!("[tauri] Sidecar spawned on port {}", port);

                    // Monitor stderr for errors
                    let stderr = child.stderr.take();
                    std::thread::spawn(move || {
                        use std::io::BufRead;
                        if let Some(stderr) = stderr {
                            let reader = std::io::BufReader::new(stderr);
                            for line in reader.lines().flatten() {
                                eprintln!("[sidecar:err] {}", line);
                            }
                        }
                    });

                    // Monitor stdout for readiness
                    let handle = app.handle().clone();
                    std::thread::spawn(move || {
                        use std::io::BufRead;
                        if let Some(stdout) = child.stdout.as_mut() {
                            let reader = std::io::BufReader::new(stdout);
                            for line in reader.lines().flatten() {
                                eprintln!("[sidecar] {}", line);
                                if line.contains("Sidecar ready") {
                                    if let Some(w) = handle.get_webview_window("main") {
                                        let _ = w.eval(&format!(
                                            "window.__SIDECAR_PORT__ = {}; window.__SIDECAR_READY__ = true;",
                                            port
                                        ));
                                    }
                                    break;
                                }
                            }
                        }
                    });
                }
                Err(e) => {
                    eprintln!("[tauri] Failed to spawn sidecar: {}", e);
                }
            }

            // Store port
            let state = app.state::<SidecarState>();
            *state.port.lock().unwrap() = port;

            setup_tray(app)?;

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

fn setup_tray(app: &tauri::App) -> Result<(), Box<dyn std::error::Error>> {
    let show_item = MenuItemBuilder::with_id("show", "显示 NexusMind").build(app)?;
    let quit_item = MenuItemBuilder::with_id("quit", "退出").build(app)?;
    let menu = MenuBuilder::new(app)
        .items(&[&show_item, &quit_item])
        .build()?;

    let mut tray = TrayIconBuilder::new().menu(&menu);
    if let Some(icon) = app.default_window_icon() {
        tray = tray.icon(icon.clone());
    }
    tray.on_menu_event(|app, event| match event.id.as_ref() {
        "show" => {
            if let Some(w) = app.get_webview_window("main") {
                let _ = w.show();
                let _ = w.set_focus();
            }
        }
        "quit" => app.exit(0),
        _ => {}
    })
    .build(app)?;

    Ok(())
}
