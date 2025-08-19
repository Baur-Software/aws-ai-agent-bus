#!/usr/bin/env node

import AgentMeshMCPServer from './modules/mcp/server.js';

// Start the server
const server = new AgentMeshMCPServer();
server.run().catch(error => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
