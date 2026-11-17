//! Thin Tauri host: serial bridge plus the SQLite plugin. No OBD/ELM327
//! behaviour belongs in Rust; migrations and repositories live in TypeScript.

mod serial;

use std::collections::HashSet;
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use tauri::State;

#[cfg(target_os = "windows")]
use webview2_com::Microsoft::Web::WebView2::Win32::ICoreWebView2_7;
#[cfg(target_os = "windows")]
use windows::core::Interface;

#[derive(Default)]
pub struct PdfExportState {
    generated_paths: Mutex<HashSet<PathBuf>>,
}

impl PdfExportState {
    pub fn record_path(&self, path: PathBuf) -> Result<(), String> {
        let mut guard = self
            .generated_paths
            .lock()
            .map_err(|_| "PDF export state lock poisoned".to_string())?;
        guard.insert(path);
        Ok(())
    }

    pub fn is_authorized_path(&self, candidate: &Path) -> Result<bool, String> {
        let guard = self
            .generated_paths
            .lock()
            .map_err(|_| "PDF export state lock poisoned".to_string())?;
        Ok(guard.contains(candidate))
    }
}

pub fn build_pdf_save_path(base_dir: &Path, timestamp_secs: u64, seq: u32) -> PathBuf {
    let filename = if seq == 0 {
        format!("obd-report-{timestamp_secs}.pdf")
    } else {
        format!("obd-report-{timestamp_secs}-{seq}.pdf")
    };
    base_dir.join(filename)
}

pub fn resolve_downloads_dir() -> PathBuf {
    let user_profile = std::env::var("USERPROFILE").unwrap_or_else(|_| "C:\\".to_string());
    PathBuf::from(user_profile).join("Downloads")
}

pub fn generate_next_pdf_path(state: &PdfExportState) -> Result<PathBuf, String> {
    let downloads = resolve_downloads_dir();
    let timestamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0);
    let guard = state
        .generated_paths
        .lock()
        .map_err(|_| "PDF export state lock poisoned".to_string())?;
    let seq = guard.len() as u32;
    Ok(build_pdf_save_path(&downloads, timestamp, seq))
}

pub fn build_explorer_select_args(authorized_path: &Path) -> [&str; 2] {
    ["/select,", authorized_path.to_str().unwrap_or("")]
}

#[tauri::command]
async fn save_pdf(
    window: tauri::WebviewWindow,
    pdf_state: State<'_, PdfExportState>,
) -> Result<String, String> {
    save_pdf_for_window(&window, &pdf_state)
}

fn save_pdf_for_window(
    window: &tauri::WebviewWindow,
    pdf_state: &PdfExportState,
) -> Result<String, String> {
    #[cfg(target_os = "windows")]
    {
        use std::sync::mpsc;
        let target_path = generate_next_pdf_path(pdf_state)?;
        let windows_path = target_path.to_string_lossy().replace('/', "\\");
        let canonical_target = PathBuf::from(&windows_path);

        let (tx, rx) = mpsc::channel();
        let wide_path = windows::core::HSTRING::from(&windows_path);
        let path_clone = windows_path.clone();

        window
            .with_webview(move |w| unsafe {
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
                let handler = webview2_com::PrintToPdfCompletedHandler::create(Box::new(
                    move |res, success| {
                        match res {
                            Ok(()) => {
                                if success {
                                    let _ = tx_completed.send(Ok(saved_path));
                                } else {
                                    let _ = tx_completed
                                        .send(Err("PrintToPdf returned success=false".to_string()));
                                }
                            }
                            Err(e) => {
                                let _ = tx_completed.send(Err(e.to_string()));
                            }
                        }
                        Ok(())
                    },
                ));

                let res = core_7.PrintToPdf(
                    windows::core::PCWSTR::from_raw(wide_path.as_ptr()),
                    None,
                    &handler,
                );
                if let Err(e) = res {
                    let _ = tx.send(Err(format!("PrintToPdf call failed: {e}")));
                }
            })
            .map_err(|e| e.to_string())?;

        let saved = rx
            .recv()
            .map_err(|e| format!("Channel receive error: {e}"))??;
        pdf_state.record_path(canonical_target)?;
        Ok(saved)
    }
    #[cfg(not(target_os = "windows"))]
    {
        let _ = (window, pdf_state);
        Err("PrintToPdf is only supported on Windows".to_string())
    }
}

#[tauri::command]
fn show_in_folder(path: String, pdf_state: State<'_, PdfExportState>) -> Result<(), String> {
    let normalized = PathBuf::from(path.replace('/', "\\"));
    if !pdf_state.is_authorized_path(&normalized)? {
        return Err(
            "Refusing to open folder: path was not generated by this application".to_string(),
        );
    }

    #[cfg(target_os = "windows")]
    {
        let args = build_explorer_select_args(&normalized);
        let _ = std::process::Command::new("explorer.exe")
            .args(args)
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let sample_pdf_check = std::env::args().any(|arg| arg == "--sample-pdf-check");

    tauri::Builder::default()
        .plugin(tauri_plugin_sql::Builder::default().build())
        .manage(serial::SerialState::default())
        .manage(PdfExportState::default())
        .setup(move |app| {
            if sample_pdf_check
                && let Some(window) = tauri::Manager::get_webview_window(app, "main")
            {
                std::thread::spawn(move || {
                    std::thread::sleep(std::time::Duration::from_millis(2000));
                    let _ = window.eval("window.location.hash = '#/report-preview';");
                    std::thread::sleep(std::time::Duration::from_millis(2000));
                    let _ = window.eval("window.dispatchEvent(new HashChangeEvent('hashchange'));");
                });
            }
            Ok(())
        })
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn builds_fixed_folder_pdf_save_path() {
        let base = PathBuf::from(r"C:\Users\TestUser\Downloads");
        let path0 = build_pdf_save_path(&base, 1_700_000_000, 0);
        assert_eq!(
            path0,
            PathBuf::from(r"C:\Users\TestUser\Downloads\obd-report-1700000000.pdf")
        );

        let path1 = build_pdf_save_path(&base, 1_700_000_000, 1);
        assert_eq!(
            path1,
            PathBuf::from(r"C:\Users\TestUser\Downloads\obd-report-1700000000-1.pdf")
        );
    }

    #[test]
    fn rejects_unrecorded_or_tampered_paths_in_show_in_folder_guard() {
        let state = PdfExportState::default();
        let generated = PathBuf::from(r"C:\Users\TestUser\Downloads\obd-report-1700000000.pdf");
        let arbitrary = PathBuf::from(r"C:\Windows\System32\cmd.exe");
        let traversal = PathBuf::from(r"C:\Users\TestUser\Downloads\..\secret.txt");

        assert!(!state.is_authorized_path(&generated).unwrap());
        state.record_path(generated.clone()).unwrap();

        assert!(state.is_authorized_path(&generated).unwrap());
        assert!(!state.is_authorized_path(&arbitrary).unwrap());
        assert!(!state.is_authorized_path(&traversal).unwrap());
    }

    #[test]
    fn builds_separate_explorer_arguments_without_shell_concatenation() {
        let generated = PathBuf::from(r"C:\Users\TestUser\Downloads\obd-report-1700000000.pdf");
        let args = build_explorer_select_args(&generated);
        assert_eq!(args.len(), 2);
        assert_eq!(args[0], "/select,");
        assert_eq!(
            args[1],
            r"C:\Users\TestUser\Downloads\obd-report-1700000000.pdf"
        );
    }
}
