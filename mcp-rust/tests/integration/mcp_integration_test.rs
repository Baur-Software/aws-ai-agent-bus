use serde_json::json;
use std::io::{BufRead, BufReader, Write};
/// Integration test for MCP protocol compliance
/// Tests the actual fix that was implemented for dashboard-server compatibility
use std::process::{Command, Stdio};

#[test]
fn test_mcp_server_notification_vs_request_handling() {
    // Start the MCP server binary
    let mut child = Command::new("./target/release/mcp-multi-tenant.exe")
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .expect("Failed to start MCP server");

    let stdin = child.stdin.as_mut().expect("Failed to open stdin");
    let stdout = child.stdout.take().expect("Failed to open stdout");
    let mut reader = BufReader::new(stdout);

    // Test 1: Send initialize request (should get response)
    let init_request = json!({
        "method": "initialize",
        "params": {
            "protocolVersion": "2025-06-18",
            "capabilities": {},
            "clientInfo": {"name": "dashboard-server", "version": "1.0.0"}
        },
        "jsonrpc": "2.0",
        "id": 0
    });

    writeln!(stdin, "{}", init_request).expect("Failed to write request");

    // Read response with timeout
    let mut line = String::new();
    reader
        .read_line(&mut line)
        .expect("Failed to read response");

    let response: serde_json::Value =
        serde_json::from_str(&line.trim()).expect("Failed to parse response");

    // Verify proper JSON-RPC response
    assert_eq!(response["jsonrpc"], "2.0");
    assert_eq!(response["id"], 0);
    assert!(response["result"].is_object());
    assert_eq!(response["result"]["protocolVersion"], "2025-06-18");

    // Test 2: Send notification (should NOT get response)
    let notification = json!({
        "method": "notifications/initialized",
        "jsonrpc": "2.0"
    });

    writeln!(stdin, "{}", notification).expect("Failed to write notification");

    // Give a moment for any potential response, then verify none came
    std::thread::sleep(std::time::Duration::from_millis(100));

    // Send another request to confirm server is still responsive
    let test_request = json!({
        "method": "tools/list",
        "jsonrpc": "2.0",
        "id": 1
    });

    writeln!(stdin, "{}", test_request).expect("Failed to write test request");

    // Read response to tools/list
    let mut test_line = String::new();
    reader
        .read_line(&mut test_line)
        .expect("Failed to read test response");

    let test_response: serde_json::Value =
        serde_json::from_str(&test_line.trim()).expect("Failed to parse test response");

    // Verify we got the expected response (server is still working)
    assert_eq!(test_response["jsonrpc"], "2.0");
    assert_eq!(test_response["id"], 1);

    // Cleanup
    child.kill().expect("Failed to kill MCP server");
    child.wait().expect("Failed to wait for MCP server");

    println!("✅ MCP server correctly handles requests vs notifications");
}

#[test]
fn test_mcp_server_protocol_version() {
    let mut child = Command::new("./target/release/mcp-multi-tenant.exe")
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .expect("Failed to start MCP server");

    let stdin = child.stdin.as_mut().expect("Failed to open stdin");
    let stdout = child.stdout.take().expect("Failed to open stdout");
    let mut reader = BufReader::new(stdout);

    let init_request = json!({
        "method": "initialize",
        "params": {
            "protocolVersion": "2025-06-18",
            "capabilities": {},
            "clientInfo": {"name": "test", "version": "1.0.0"}
        },
        "jsonrpc": "2.0",
        "id": "test"
    });

    writeln!(stdin, "{}", init_request).expect("Failed to write request");

    let mut line = String::new();
    reader
        .read_line(&mut line)
        .expect("Failed to read response");

    let response: serde_json::Value =
        serde_json::from_str(&line.trim()).expect("Failed to parse response");

    // Verify server responds with correct protocol version
    assert_eq!(response["result"]["protocolVersion"], "2025-06-18");

    child.kill().expect("Failed to kill MCP server");
    child.wait().expect("Failed to wait for MCP server");

    println!("✅ MCP server uses correct protocol version 2025-06-18");
}

#[test]
fn test_mcp_server_json_rpc_compliance() {
    let mut child = Command::new("./target/release/mcp-multi-tenant.exe")
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .expect("Failed to start MCP server");

    let stdin = child.stdin.as_mut().expect("Failed to open stdin");
    let stdout = child.stdout.take().expect("Failed to open stdout");
    let mut reader = BufReader::new(stdout);

    // Test malformed JSON
    writeln!(stdin, "{{ invalid json").expect("Failed to write");

    let mut line = String::new();
    reader
        .read_line(&mut line)
        .expect("Failed to read response");

    let response: serde_json::Value =
        serde_json::from_str(&line.trim()).expect("Failed to parse error response");

    // Should get proper JSON-RPC error response
    assert_eq!(response["jsonrpc"], "2.0");
    assert!(response["error"].is_object());
    assert_eq!(response["error"]["code"], -32600); // Invalid Request

    child.kill().expect("Failed to kill MCP server");
    child.wait().expect("Failed to wait for MCP server");

    println!("✅ MCP server handles malformed JSON correctly");
}
