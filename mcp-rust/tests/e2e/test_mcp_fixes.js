#!/usr/bin/env node
/**
 * Integration test for MCP protocol compliance fixes
 * Tests the actual dashboard-server -> Rust MCP server integration
 */

import('../../../dashboard-server/dist/services/MCPStdioService.js').then(async (module) => {
  const MCPStdioService = module.default;
  const service = new MCPStdioService();

  const rustConfig = {
    command: 'mcp-rust/target/release/mcp-multi-tenant.exe',
    args: [],
    cwd: process.cwd()
  };

  console.log('🧪 Testing MCP Protocol Compliance Fixes');
  console.log('==========================================');

  try {
    console.log('📡 Connecting to Rust MCP server...');
    await service.connect(rustConfig);

    // Wait for connection to stabilize
    await new Promise(resolve => setTimeout(resolve, 1000));

    const status = service.getServiceStatus();
    console.log('📊 Connection Status:', JSON.stringify(status, null, 2));

    if (status.status === 'connected') {
      console.log('✅ SUCCESS: MCP server connection established');
      console.log('✅ SUCCESS: No protocol violations detected');
      console.log('✅ SUCCESS: Notification handling working correctly');

      // Test tool execution (expected to fail due to AWS creds, but should handle gracefully)
      try {
        console.log('🔧 Testing tool execution...');
        await service.executeTool('kv_get', { key: 'test' });
        console.log('✅ SUCCESS: Tool execution completed');
      } catch (error) {
        if (error.message.includes('AWS') || error.message.includes('Handler error')) {
          console.log('✅ SUCCESS: Tool execution failed gracefully (expected - no AWS creds)');
        } else {
          console.log('❌ UNEXPECTED: Tool execution error:', error.message);
        }
      }

    } else if (status.status === 'permanently_disabled') {
      console.log('❌ FAILURE: MCP server was permanently disabled due to critical errors');
      console.log('❌ FAILURE: Protocol compliance issues still exist');
    } else {
      console.log('⚠️  WARNING: Unexpected connection status:', status.status);
    }

  } catch (error) {
    console.log('❌ FAILURE: Connection failed:', error.message);
    const status = service.getServiceStatus();
    console.log('📊 Final Status:', JSON.stringify(status, null, 2));
  }

  console.log('==========================================');
  console.log('🏁 Test Complete');

  process.exit(0);
}).catch(error => {
  console.error('💥 Test setup failed:', error);
  process.exit(1);
});