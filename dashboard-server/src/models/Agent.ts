export interface Agent {
  agentId: string;
  name: string;
  ownerType: 'organization' | 'user';
  ownerId: string;
  s3Key: string;
  createdAt: string;
  updatedAt: string;
  permissions: {
    read: string[]; // user/org IDs
    write: string[]; // user/org IDs
  };
  version: number;
}
