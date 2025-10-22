$content = Get-Content "src/workflow/types.ts" -Raw

# Replace TaskConfigSchema
$oldTaskSchema = @'
export interface TaskConfigSchema {
  type: 'object';
  properties: Record<string, SchemaProperty>;
  required: string[];
  title: string;
  description: string;
  examples?: any[];
}
'@

$newTaskSchema = @'
export interface TaskConfigSchema {
  input?: {
    type: 'object';
    properties: Record<string, SchemaProperty>;
    required?: string[];
    title?: string;
    description?: string;
    examples?: any[];
  };
  output?: {
    type: 'object';
    properties: Record<string, SchemaProperty>;
    required?: string[];
    title?: string;
    description?: string;
  };
}
'@

$content = $content -replace [regex]::Escape($oldTaskSchema), $newTaskSchema

# Replace SchemaProperty
$oldSchemaProp = @'
export interface SchemaProperty {
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  title: string;
  description: string;
  default?: any;
  enum?: any[];
  format?: string;
  minimum?: number;
  maximum?: number;
  items?: SchemaProperty;
  properties?: Record<string, SchemaProperty>;
}
'@

$newSchemaProp = @'
export interface SchemaProperty {
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  title?: string;
  description?: string;
  default?: any;
  enum?: any[];
  format?: string;
  minimum?: number;
  maximum?: number;
  items?: SchemaProperty | { type: string };
  properties?: Record<string, SchemaProperty>;
  placeholder?: string;
  pattern?: string;
  required?: string[];
}
'@

$content = $content -replace [regex]::Escape($oldSchemaProp), $newSchemaProp

# Replace TaskDisplayInfo
$oldDisplayInfo = @'
export interface TaskDisplayInfo {
  category: string;
  label: string;
  icon: string;
  color: string;
  description: string;
  tags?: string[];
  integrationRequired?: string;
}
'@

$newDisplayInfo = @'
export interface TaskDisplayInfo {
  category: string;
  name?: string;
  label?: string;
  icon: string;
  color: string;
  description: string;
  tags?: string[];
  integrationRequired?: string;
}
'@

$content = $content -replace [regex]::Escape($oldDisplayInfo), $newDisplayInfo

Set-Content -Path "src/workflow/types.ts" -Value $content -NoNewline
Write-Host "Updated types.ts successfully"
