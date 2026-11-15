//! Thin Tauri host: serial bridge plus the SQLite plugin. No OBD/ELM327
//! behaviour belongs in Rust; migrations and repositories live in TypeScript.

mod serial;


#[cfg(target_os = "windows")]
use webview2_com::Microsoft::Web::WebView2::Win32::ICoreWebView2_7;
#[cfg(target_os = "windows")]
use windows::core::Interface;

#[tauri::command]
async fn save_pdf(window: tauri::WebviewWindow, path: Option<String>) -> Result<String, String> {
    #[cfg(target_os = "windows")]
    {
        use std::sync::mpsc;
        let windows_path = match path {
            Some(p) if !p.trim().is_empty() => p.replace('/', "\\"),
            _ => {
                let user_profile = std::env::var("USERPROFILE").unwrap_or_else(|_| "C:\\".to_string());
                let downloads = format!("{}\\Downloads", user_profile);
                let timestamp = std::time::SystemTime::now()
                    .duration_since(std::time::UNIX_EPOCH)
                    .map(|d| d.as_secs())
                    .unwrap_or(0);
                format!("{}\\obd-report-{}.pdf", downloads, timestamp)
            }
        };
        let (tx, rx) = mpsc::channel();
        let wide_path = windows::core::HSTRING::from(&windows_path);
        let path_clone = windows_path.clone();

        window.with_webview(move |w| {
            unsafe {
                let controller = w.controller();
                let core = match controller.CoreWebView2() {
                    Ok(c) => c,
                    Err(e) => {
                        let _ = tx.send(Err(e.to_string()));
                        return;
                    }
                };
                let core_7: ICoreWebView2_7 = match core.cast() {
                    Ok(c) => c,
                    Err(e) => {
                        let _ = tx.send(Err(format!("ICoreWebView2_7 not supported: {e}")));
                        return;
                    }
                };
                let tx_completed = tx.clone();
                let saved_path = path_clone.clone();
                let handler = webview2_com::PrintToPdfCompletedHandler::create(Box::new(move |res, success| {
                    match res {
                        Ok(()) => {
                            if success {
                                let _ = tx_completed.send(Ok(saved_path));
                            } else {
                                let _ = tx_completed.send(Err("PrintToPdf returned success=false".to_string()));
                            }
                        }
                        Err(e) => {
                            let _ = tx_completed.send(Err(e.to_string()));
                        }
                    }
                    Ok(())
                }));

                let res = core_7.PrintToPdf(
                    windows::core::PCWSTR::from_raw(wide_path.as_ptr()),
                    None,
                    &handler,
                );
                if let Err(e) = res {
                    let _ = tx.send(Err(format!("PrintToPdf call failed: {e}")));
                }
            }
        }).map_err(|e| e.to_string())?;

        rx.recv().map_err(|e| format!("Channel receive error: {e}"))?
    }
    #[cfg(not(target_os = "windows"))]
    {
        let _ = (window, path);
        Err("PrintToPdf is only supported on Windows".to_string())
    }
}

#[tauri::command]
fn show_in_folder(path: String) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        let windows_path = path.replace('/', "\\");
        let _ = std::process::Command::new("explorer")
            .arg(format!("/select,{}", windows_path))
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_sql::Builder::default().build())
        .manage(serial::SerialState::default())
        .invoke_handler(tauri::generate_handler![
            serial::list_ports,
            serial::open_port,
            serial::close_port,
            serial::write_port,
            show_in_folder,
            save_pdf
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
