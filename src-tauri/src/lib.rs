//! Thin Tauri host: serial bridge plus the SQLite plugin. No OBD/ELM327
//! behaviour belongs in Rust; migrations and repositories live in TypeScript.

mod serial;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_sql::Builder::default().build())
        .manage(serial::SerialState::default())
        .invoke_handler(tauri::generate_handler![
            serial::list_ports,
            serial::open_port,
            serial::close_port,
            serial::write_port
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
