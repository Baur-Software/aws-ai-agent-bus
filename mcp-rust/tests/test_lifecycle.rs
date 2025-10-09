use std::io::Write;
use std::process::{Command, Stdio};
use std::time::Duration;

/// Test that the MCP server exits properly when stdin is closed
#[test]
fn test_server_exits_on_stdin_close() {
    // Set environment variables for the test
    std::env::set_var("DEFAULT_TENANT_ID", "test-tenant");
    std::env::set_var("DEFAULT_USER_ID", "test-user");
    std::env::set_var("AWS_REGION", "us-west-2");

    // Build the binary first - build in current dir
    println!("Building release binary...");
    let build_output = Command::new("cargo")
        .args(&["build", "--release"])
        .current_dir(env!("CARGO_MANIFEST_DIR"))
        .output()
        .expect("Failed to build binary");

    if !build_output.status.success() {
        eprintln!(
            "Build stderr: {}",
            String::from_utf8_lossy(&build_output.stderr)
        );
        panic!("Build failed");
    }

    println!("Starting server...");
    // Start the server process
    let mut child = Command::new("target/release/mcp-multi-tenant")
        .current_dir(env!("CARGO_MANIFEST_DIR"))
        .env("DEFAULT_TENANT_ID", "test-tenant")
        .env("DEFAULT_USER_ID", "test-user")
        .env("AWS_REGION", "us-west-2")
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .expect("Failed to start server");

    // Give the server a moment to initialize
    std::thread::sleep(Duration::from_millis(500));

    // Send an initialize request and close stdin
    println!("Sending initialize request...");
    if let Some(mut stdin) = child.stdin.take() {
        let init_request = r#"{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"test","version":"1.0.0"}}}"#;
        stdin.write_all(init_request.as_bytes()).unwrap();
        stdin.write_all(b"\n").unwrap();
        stdin.flush().unwrap();

        // Close stdin to signal shutdown
        println!("Closing stdin to signal shutdown...");
        drop(stdin);
    }

    // Wait for the process to exit with a timeout
    println!("Waiting for server to exit...");
    let timeout = Duration::from_secs(5);
    let start = std::time::Instant::now();

    loop {
        match child.try_wait() {
            Ok(Some(status)) => {
                println!("✓ Server exited with status: {:?}", status);
                // Read any remaining stderr
                if let Ok(stderr) = child.wait_with_output() {
                    if !stderr.stderr.is_empty() {
                        println!(
                            "Server stderr:\n{}",
                            String::from_utf8_lossy(&stderr.stderr)
                        );
                    }
                }
                // Exit code 0 means success
                assert_eq!(status.code(), Some(0), "Server should exit with code 0");
                return;
            }
            Ok(None) => {
                if start.elapsed() > timeout {
                    // Server didn't exit - this is the bug!
                    let _ = child.kill();
                    panic!(
                        "Server did not exit within {:?} after stdin closed",
                        timeout
                    );
                }
                std::thread::sleep(Duration::from_millis(100));
            }
            Err(e) => {
                let _ = child.kill();
                panic!("Error waiting for server: {}", e);
            }
        }
    }
}

/// Test server behavior with empty input (immediate EOF)
#[test]
fn test_server_exits_on_immediate_eof() {
    let mut child = Command::new("target/release/mcp-multi-tenant")
        .current_dir(env!("CARGO_MANIFEST_DIR"))
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .expect("Failed to start server");

    // Immediately close stdin without sending anything
    drop(child.stdin.take());

    // Server should exit immediately
    let timeout = Duration::from_secs(2);
    let start = std::time::Instant::now();

    loop {
        match child.try_wait() {
            Ok(Some(status)) => {
                println!("Server exited with status: {:?}", status);
                return;
            }
            Ok(None) => {
                if start.elapsed() > timeout {
                    child.kill().unwrap();
                    panic!(
                        "Server did not exit within {:?} after immediate EOF",
                        timeout
                    );
                }
                std::thread::sleep(Duration::from_millis(100));
            }
            Err(e) => {
                child.kill().unwrap();
                panic!("Error waiting for server: {}", e);
            }
        }
    }
}
