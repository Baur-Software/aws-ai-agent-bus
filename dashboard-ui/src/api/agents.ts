// Agent API for dashboard-ui
// Connects to dashboard-server for agent CRUD operations

export async function listAgents(_ownerType: 'organization' | 'user', _ownerId: string) {
  // TODO: Replace with actual WebSocket/evented API call
  // Placeholder: returns empty array
  return [];
}

export async function getAgent(_agentId: string, _ownerType: 'organization' | 'user', _ownerId: string) {
  // TODO: Replace with actual API call
  return null;
}

export async function createAgent(_params: {
  ownerType: 'organization' | 'user';
  ownerId: string;
  name: string;
  description?: string;
  markdown: string;
  tags?: string[];
  permissions?: Record<string, any>;
}) {
  // TODO: Replace with actual API call
  return { success: false };
}

export async function updateAgent(_params: {
  agentId: string;
  ownerType: 'organization' | 'user';
  ownerId: string;
  markdown: string;
  description?: string;
  tags?: string[];
  permissions?: Record<string, any>;
}) {
  // TODO: Replace with actual API call
  return { success: false };
}

export async function deleteAgent(_agentId: string, _ownerType: 'organization' | 'user', _ownerId: string) {
  // TODO: Replace with actual API call
  return { success: false };
}
