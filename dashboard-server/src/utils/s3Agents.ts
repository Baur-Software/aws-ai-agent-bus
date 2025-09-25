import { S3 } from 'aws-sdk';

const s3 = new S3();

export async function saveAgentMarkdown(s3Key: string, content: string): Promise<void> {
  await s3.putObject({
    Bucket: process.env.AGENT_BUCKET!,
    Key: s3Key,
    Body: content,
    ContentType: 'text/markdown'
  }).promise();
}

export async function getAgentMarkdown(s3Key: string): Promise<string> {
  const res = await s3.getObject({
    Bucket: process.env.AGENT_BUCKET!,
    Key: s3Key
  }).promise();
  return res.Body!.toString();
}

// For versioning, use S3 versioning or append version to key
export async function listAgentVersions(s3Key: string): Promise<string[]> {
  const res = await s3.listObjectVersions({
    Bucket: process.env.AGENT_BUCKET!,
    Prefix: s3Key
  }).promise();
  return (res.Versions ?? []).map(v => v.VersionId!);
}
