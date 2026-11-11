//! Thin COM-port bridge. All ELM327/OBD behaviour stays in TypeScript; this module only
//! enumerates ports, moves bytes and reports disconnects to the UI.

use std::io::{ErrorKind, Read, Write};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::thread::JoinHandle;
use std::time::Duration;

use serde::Serialize;
use serialport::{SerialPort, SerialPortType};
use tauri::{AppHandle, Emitter, State};

/// How long a blocking read waits before the reader checks the stop flag again.
const READ_TIMEOUT_MS: u64 = 50;
const READ_BUFFER_SIZE: usize = 1024;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PortInfo {
    pub name: String,
    /// `usb`, `bluetooth`, `pci` or `unknown`.
    pub kind: String,
    /// USB manufacturer/product when the OS exposes it.
    pub label: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SerialClosedPayload {
    /// `None` when the app closed the port on purpose.
    pub reason: Option<String>,
}

struct OpenPort {
    writer: Box<dyn SerialPort>,
    stop: Arc<AtomicBool>,
    reader: Option<JoinHandle<()>>,
}

#[derive(Default)]
pub struct SerialState {
    port: Mutex<Option<OpenPort>>,
}

fn port_kind(port_type: &SerialPortType) -> (&'static str, Option<String>) {
    match port_type {
        SerialPortType::UsbPort(info) => {
            let label = [info.manufacturer.as_deref(), info.product.as_deref()]
                .into_iter()
                .flatten()
                .collect::<Vec<_>>()
                .join(" ");
            ("usb", (!label.is_empty()).then_some(label))
        }
        SerialPortType::BluetoothPort => ("bluetooth", None),
        SerialPortType::PciPort => ("pci", None),
        SerialPortType::Unknown => ("unknown", None),
    }
}

#[tauri::command]
pub fn list_ports() -> Result<Vec<PortInfo>, String> {
    let mut ports = serialport::available_ports()
        .map_err(|error| format!("Cannot enumerate serial ports: {error}"))?
        .into_iter()
        .map(|port| {
            let (kind, label) = port_kind(&port.port_type);
            PortInfo {
                name: port.port_name,
                kind: kind.to_string(),
                label,
            }
        })
        .collect::<Vec<_>>();

    ports.sort_by(|left, right| left.name.cmp(&right.name));
    Ok(ports)
}

#[tauri::command]
pub fn open_port(
    app: AppHandle,
    state: State<'_, SerialState>,
    port: String,
    baud: u32,
) -> Result<(), String> {
    let mut guard = state
        .port
        .lock()
        .map_err(|_| "Serial state is unavailable".to_string())?;

    if let Some(existing) = guard.as_ref() {
        let reader_finished = existing
            .reader
            .as_ref()
            .is_none_or(std::thread::JoinHandle::is_finished);

        if !reader_finished {
            return Err("A serial port is already open".to_string());
        }
    }

    // Drop a stale session left behind by an unplug before reopening.
    if let Some(mut stale) = guard.take() {
        stale.stop.store(true, Ordering::Relaxed);
        drop(stale.writer);
        if let Some(reader) = stale.reader.take() {
            let _ = reader.join();
        }
    }

    let writer = serialport::new(&port, baud)
        .timeout(Duration::from_millis(READ_TIMEOUT_MS))
        .open()
        .map_err(|error| format!("Cannot open {port} at {baud} baud: {error}"))?;

    let mut reader = writer
        .try_clone()
        .map_err(|error| format!("Cannot read from {port}: {error}"))?;

    let stop = Arc::new(AtomicBool::new(false));
    let reader_stop = Arc::clone(&stop);
    let reader_app = app.clone();

    let reader_thread = std::thread::spawn(move || {
        let mut buffer = [0_u8; READ_BUFFER_SIZE];

        loop {
            if reader_stop.load(Ordering::Relaxed) {
                break;
            }

            match reader.read(&mut buffer) {
                Ok(0) => std::thread::sleep(Duration::from_millis(10)),
                Ok(count) => {
                    let chunk = buffer[..count].to_vec();
                    if reader_app.emit("serial-data", chunk).is_err() {
                        break;
                    }
                }
                Err(error) if error.kind() == ErrorKind::TimedOut => continue,
                Err(error) => {
                    if reader_stop.load(Ordering::Relaxed) {
                        break;
                    }
                    let _ = reader_app.emit(
                        "serial-closed",
                        SerialClosedPayload {
                            reason: Some(error.to_string()),
                        },
                    );
                    break;
                }
            }
        }
    });

    *guard = Some(OpenPort {
        writer,
        stop,
        reader: Some(reader_thread),
    });

    Ok(())
}

#[tauri::command]
pub fn close_port(state: State<'_, SerialState>) -> Result<(), String> {
    let mut guard = state
        .port
        .lock()
        .map_err(|_| "Serial state is unavailable".to_string())?;

    if let Some(mut open) = guard.take() {
        open.stop.store(true, Ordering::Relaxed);
        // Dropping the writer releases the OS handle; the reader notices the stop flag
        // on its next timeout (<= READ_TIMEOUT_MS) and exits.
        drop(open.writer);
        if let Some(reader) = open.reader.take() {
            let _ = reader.join();
        }
    }

    Ok(())
}

#[tauri::command]
pub fn write_port(state: State<'_, SerialState>, data: Vec<u8>) -> Result<(), String> {
    let mut guard = state
        .port
        .lock()
        .map_err(|_| "Serial state is unavailable".to_string())?;

    let open = guard
        .as_mut()
        .ok_or_else(|| "No serial port is open".to_string())?;

    open.writer
        .write_all(&data)
        .map_err(|error| format!("Serial write failed: {error}"))?;
    open.writer
        .flush()
        .map_err(|error| format!("Serial flush failed: {error}"))?;

    Ok(())
}
