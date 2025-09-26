import { S3Client, PutObjectCommand, GetObjectCommand, ListObjectVersionsCommand } from '@aws-sdk/client-s3';

const s3 = new S3Client({});

export async function saveAgentMarkdown(s3Key: string, content: string): Promise<void> {
  const command = new PutObjectCommand({
    Bucket: process.env.AGENT_BUCKET!,
    Key: s3Key,
    Body: content,
    ContentType: 'text/markdown'
  });
  await s3.send(command);
}

export async function getAgentMarkdown(s3Key: string): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: process.env.AGENT_BUCKET!,
    Key: s3Key
  });
  const res = await s3.send(command);
  return await res.Body!.transformToString();
}

// For versioning, use S3 versioning or append version to key
export async function listAgentVersions(s3Key: string): Promise<string[]> {
  const command = new ListObjectVersionsCommand({
    Bucket: process.env.AGENT_BUCKET!,
    Prefix: s3Key
  });
  const res = await s3.send(command);
  return (res.Versions ?? []).map(v => v.VersionId!);
}
