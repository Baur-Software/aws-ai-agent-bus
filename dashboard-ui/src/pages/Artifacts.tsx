import { createSignal, createResource, Show, For, onCleanup, onMount } from 'solid-js';
import { usePageHeader } from '../contexts/HeaderContext';
import { useDashboardServer } from '../contexts/DashboardServerContext';
import { useNotifications } from '../contexts/NotificationContext';
import { useOrganization } from '../contexts/OrganizationContext';
import { useAuth } from '../contexts/AuthContext';
import { formatDate, formatFileSize } from '../utils/formatters';
import { Archive, Upload, Download, Trash2, File, FolderOpen, Search, Plus, FileUp } from 'lucide-solid';

interface ArtifactItem {
  key: string;
  size: number;
  lastModified: string;
  etag?: string;
}

function Artifacts() {
  // Set page-specific header
  usePageHeader('Artifacts', 'File and content management');

  const { executeTool, isConnected } = useDashboardServer();
  const { success, error } = useNotifications();
  const { currentOrganization } = useOrganization();
  const { user: authUser } = useAuth();
  const [selectedFile, setSelectedFile] = createSignal<ArtifactItem | null>(null);
  const [uploadContent, setUploadContent] = createSignal('');
  const [uploadKey, setUploadKey] = createSignal('');
  const [uploadContentType, setUploadContentType] = createSignal('text/plain');
  const [searchPrefix, setSearchPrefix] = createSignal('');
  const [showUploadModal, setShowUploadModal] = createSignal(false);
  const [showContentModal, setShowContentModal] = createSignal(false);
  const [fileContent, setFileContent] = createSignal('');
  const [isDragging, setIsDragging] = createSignal(false);
  const [uploadedFileName, setUploadedFileName] = createSignal('');
  const [isUploading, setIsUploading] = createSignal(false);
  const [showDropZone, setShowDropZone] = createSignal(false);

  let fileInputRef: HTMLInputElement | undefined;
  let dragCounter = 0; // Track drag enter/leave to prevent flickering

  // Build context-aware prefix based on current organization
  const buildContextPrefix = () => {
    const customPrefix = searchPrefix();
    const org = currentOrganization();
    const user = authUser();

    // If user provided custom prefix, use it
    if (customPrefix) {
      return customPrefix;
    }

    // Build context-aware prefix (same pattern as ArtifactService)
    if (org?.id) {
      return `orgs/${org.id}/`;
    } else if (user?.userId) {
      return `users/${user.userId}/`;
    }

    return '';
  };

  // Load artifacts list via event-driven WebSocket with context-aware prefix
  const [artifactsList, { refetch: refetchArtifacts }] = createResource(
    () => isConnected() ? buildContextPrefix() : null,
    async (prefix) => {
      try {
        const result = await executeTool('artifacts_list', { prefix: prefix || undefined });
        return result.items || [];
      } catch (error) {
        console.error('Failed to load artifacts:', error);
        return [];
      }
    }
  );

  // Auto-detect content type from file extension
  const detectContentType = (filename: string): string => {
    const ext = filename.split('.').pop()?.toLowerCase();
    const mimeTypes: Record<string, string> = {
      'txt': 'text/plain',
      'json': 'application/json',
      'md': 'text/markdown',
      'html': 'text/html',
      'htm': 'text/html',
      'css': 'text/css',
      'js': 'application/javascript',
      'ts': 'application/typescript',
      'xml': 'application/xml',
      'csv': 'text/csv',
      'pdf': 'application/pdf',
      'png': 'image/png',
      'jpg': 'image/jpeg',
      'jpeg': 'image/jpeg',
      'gif': 'image/gif',
      'svg': 'image/svg+xml',
      'webp': 'image/webp',
      'zip': 'application/zip',
      'gz': 'application/gzip',
    };
    return mimeTypes[ext || ''] || 'application/octet-stream';
  };

  // Handle file selection from browser - upload via HTTP POST
  const handleFileSelect = async (file: File) => {
    setIsUploading(true);

    try {
      const formData = new FormData();
      formData.append('file', file);

      // Build context-aware key for the uploaded file
      const contextPrefix = buildContextPrefix();
      const fileKey = contextPrefix ? `${contextPrefix}${file.name}` : file.name;
      formData.append('key', fileKey);

      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';
      const response = await fetch(`${apiUrl}/api/artifacts/upload`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`Upload failed: ${response.statusText}`);
      }

      const result = await response.json();

      success(`Successfully uploaded ${file.name}`, {
        title: 'Upload Complete',
        duration: 3000
      });

      refetchArtifacts();
      setShowDropZone(false);
    } catch (err) {
      console.error('Upload failed:', err);

      error(`Failed to upload ${file.name}`, {
        title: 'Upload Failed',
        duration: 5000
      });

      setShowDropZone(false);
    } finally {
      setIsUploading(false);
    }
  };

  // Drag and drop handlers - track at document level
  const handleDocumentDragEnter = (e: DragEvent) => {
    e.preventDefault();
    dragCounter++;
    if (dragCounter === 1) {
      setShowDropZone(true);
      setIsDragging(true);
    }
  };

  const handleDocumentDragLeave = (e: DragEvent) => {
    e.preventDefault();
    dragCounter--;
    if (dragCounter === 0) {
      setShowDropZone(false);
      setIsDragging(false);
    }
  };

  const handleDrop = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter = 0;
    setIsDragging(false);

    const files = e.dataTransfer?.files;
    if (files && files.length > 0) {
      handleFileSelect(files[0]);
    } else {
      setShowDropZone(false);
    }
  };

  const handleDragOverPreventDefault = (e: Event) => e.preventDefault();

  // Setup drag listeners properly in onMount
  onMount(() => {
    document.addEventListener('dragenter', handleDocumentDragEnter as EventListener);
    document.addEventListener('dragleave', handleDocumentDragLeave as EventListener);
    document.addEventListener('dragover', handleDragOverPreventDefault);
    document.addEventListener('drop', handleDrop as EventListener);

    onCleanup(() => {
      document.removeEventListener('dragenter', handleDocumentDragEnter as EventListener);
      document.removeEventListener('dragleave', handleDocumentDragLeave as EventListener);
      document.removeEventListener('dragover', handleDragOverPreventDefault);
      document.removeEventListener('drop', handleDrop as EventListener);
    });
  });

  const handleBrowseFiles = () => {
    fileInputRef?.click();
  };

  const handleFileInputChange = (e: Event) => {
    const input = e.target as HTMLInputElement;
    const files = input.files;
    if (files && files.length > 0) {
      handleFileSelect(files[0]);
    }
  };

  const getDropZoneClasses = () => {
    const baseClasses = 'card relative transition-all border-2 border-dashed';
    if (isDragging()) {
      return `${baseClasses} border-blue-500 bg-blue-50 dark:bg-blue-900/20`;
    }
    if (isUploading()) {
      return `${baseClasses} border-green-500 bg-green-50 dark:bg-green-900/20`;
    }
    return `${baseClasses} border-slate-200 dark:border-slate-700`;
  };

  const handleUpload = async () => {
    if (!uploadKey() || !uploadContent()) return;

    try {
      await executeTool('artifacts_put', {
        key: uploadKey(),
        content: uploadContent(),
        content_type: uploadContentType()
      });
      setUploadKey('');
      setUploadContent('');
      setUploadContentType('text/plain');
      setUploadedFileName('');
      setShowUploadModal(false);
      refetchArtifacts();
    } catch (error) {
      console.error('Upload failed:', error);
    }
  };

  const handleDownload = async (item: ArtifactItem) => {
    try {
      const result = await executeTool('artifacts_get', { key: item.key });
      setFileContent(result.content);
      setSelectedFile(item);
      setShowContentModal(true);
    } catch (error) {
      console.error('Download failed:', error);
    }
  };

  const downloadAsFile = () => {
    const file = selectedFile();
    if (!file) return;

    const blob = new Blob([fileContent()], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = file.key.split('/').pop() || 'download.txt';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div class="page space-y-6">
      {/* Header with Search and Upload */}
      <div class="card p-4">
        <div class="flex items-center gap-3">
          <Search class="w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder={
              currentOrganization()
                ? `Filter ${currentOrganization()?.name || 'organization'} artifacts (e.g., 'docs/', 'images/')`
                : "Filter personal artifacts (e.g., 'docs/', 'images/')"
            }
            value={searchPrefix()}
            onInput={(e) => setSearchPrefix(e.currentTarget.value)}
            class="flex-1 bg-transparent border-none outline-none text-slate-900 dark:text-white placeholder-slate-400"
          />
          <button
            type="button"
            onClick={() => refetchArtifacts()}
            class="btn btn-sm btn-secondary"
            disabled={!isConnected()}
          >
            Search
          </button>
          <button
            type="button"
            onClick={handleBrowseFiles}
            class="btn btn-sm btn-primary"
            disabled={!isConnected() || isUploading()}
          >
            <Upload class="w-4 h-4" />
            Upload File
          </button>
          <input
            ref={fileInputRef}
            type="file"
            class="hidden"
            onChange={handleFileInputChange}
            accept="*/*"
            aria-label="Upload file"
          />
        </div>
      </div>

      {/* Drag & Drop Zone - Only shown during drag or upload */}
      <Show when={showDropZone() || isUploading()}>
        <div class={getDropZoneClasses()}>
          <div class="p-8 text-center">
            <Show when={isUploading()}>
              <div class="w-12 h-12 mx-auto mb-3">
                <div class="animate-spin w-12 h-12 border-4 border-green-200 border-t-green-600 dark:border-green-800 dark:border-t-green-400 rounded-full" />
              </div>
              <h3 class="font-medium text-slate-900 dark:text-white mb-1">
                Uploading...
              </h3>
              <p class="text-sm text-slate-500 dark:text-slate-400">
                Please wait while we upload your file to S3
              </p>
            </Show>
            <Show when={!isUploading()}>
              <FileUp class={`w-12 h-12 mx-auto mb-3 ${
                isDragging()
                  ? 'text-blue-600 dark:text-blue-400'
                  : 'text-slate-300 dark:text-slate-600'
              }`} />
              <h3 class="font-medium text-slate-900 dark:text-white mb-1">
                Drop file here to upload
              </h3>
              <p class="text-sm text-slate-500 dark:text-slate-400">
                Release to start uploading to S3
              </p>
            </Show>
          </div>
        </div>
      </Show>

      {/* Artifacts List */}
      <div class="card">
        <div class="p-4 border-b border-slate-200 dark:border-slate-700">
          <div class="flex items-center justify-between">
            <div>
              <h2 class="font-medium text-slate-900 dark:text-white">
                {currentOrganization() ? `${currentOrganization()?.name || 'Organization'} Files` : 'Personal Files'}
              </h2>
              <Show when={searchPrefix()}>
                <p class="text-sm text-slate-500 dark:text-slate-400 mt-1">
                  Custom filter: <code class="bg-slate-100 dark:bg-slate-800 px-1 rounded">{searchPrefix()}</code>
                </p>
              </Show>
              <Show when={!searchPrefix()}>
                <p class="text-sm text-slate-500 dark:text-slate-400 mt-1">
                  Showing {currentOrganization() ? 'organization' : 'personal'} artifacts
                  {buildContextPrefix() && ` (${buildContextPrefix()})`}
                </p>
              </Show>
            </div>
          </div>
        </div>

        <Show when={artifactsList.loading}>
          <div class="p-8 text-center">
            <div class="animate-spin w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full mx-auto" />
            <p class="text-sm text-slate-500 dark:text-slate-400 mt-2">Loading artifacts...</p>
          </div>
        </Show>

        <Show when={!artifactsList.loading && artifactsList()?.length === 0}>
          <div class="p-8 text-center">
            <FolderOpen class="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
            <h3 class="font-medium text-slate-900 dark:text-white mb-1">No artifacts found</h3>
            <p class="text-sm text-slate-500 dark:text-slate-400">
              {searchPrefix() ? 'No files match the current filter' : 'Upload your first artifact to get started'}
            </p>
          </div>
        </Show>

        <div class="divide-y divide-slate-200 dark:divide-slate-700">
          <For each={artifactsList()}>
            {(item) => (
              <div class="p-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                <div class="flex items-center justify-between">
                  <div class="flex items-center gap-3 min-w-0 flex-1">
                    <File class="w-5 h-5 text-slate-400 flex-shrink-0" />
                    <div class="min-w-0 flex-1">
                      <p class="font-medium text-slate-900 dark:text-white truncate">{item.key}</p>
                      <div class="flex items-center gap-4 text-sm text-slate-500 dark:text-slate-400">
                        <span>{formatFileSize(item.size)}</span>
                        <span>{formatDate(item.lastModified)}</span>
                      </div>
                    </div>
                  </div>
                  <div class="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleDownload(item)}
                      class="btn btn-sm btn-secondary"
                      title="View content"
                    >
                      <Download class="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            )}
          </For>
        </div>
      </div>

      {/* Upload Modal */}
      <Show when={showUploadModal()}>
        <div class="modal-overlay" onClick={() => setShowUploadModal(false)}>
          <div class="modal-content" onClick={(e) => e.stopPropagation()}>
            <div class="flex items-center justify-between mb-4">
              <div>
                <h3 class="text-lg font-semibold text-slate-900 dark:text-white">Upload Artifact</h3>
                <Show when={uploadedFileName()}>
                  <p class="text-sm text-slate-500 dark:text-slate-400 mt-1">
                    File: {uploadedFileName()}
                  </p>
                </Show>
              </div>
              <button
                type="button"
                onClick={() => setShowUploadModal(false)}
                class="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                aria-label="Close"
              >
                ×
              </button>
            </div>

            <div class="space-y-4">
              <div>
                <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Key (file path in S3)
                </label>
                <input
                  type="text"
                  placeholder="e.g., documents/report.txt or images/logo.png"
                  value={uploadKey()}
                  onInput={(e) => setUploadKey(e.currentTarget.value)}
                  class="input w-full"
                />
                <p class="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Use folders like 'docs/', 'images/', or 'users/userid/' to organize files
                </p>
              </div>

              <div>
                <label
                  for="content-type-select"
                  class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1"
                >
                  Content Type
                </label>
                <select
                  id="content-type-select"
                  value={uploadContentType()}
                  onChange={(e) => setUploadContentType(e.currentTarget.value)}
                  class="input w-full"
                  title="Select the file content type"
                >
                  <option value="text/plain">Text (.txt)</option>
                  <option value="application/json">JSON (.json)</option>
                  <option value="text/markdown">Markdown (.md)</option>
                  <option value="text/html">HTML (.html)</option>
                  <option value="text/css">CSS (.css)</option>
                  <option value="application/javascript">JavaScript (.js)</option>
                  <option value="text/csv">CSV (.csv)</option>
                  <option value="application/xml">XML (.xml)</option>
                  <option value="image/png">PNG Image</option>
                  <option value="image/jpeg">JPEG Image</option>
                  <option value="image/gif">GIF Image</option>
                  <option value="application/pdf">PDF Document</option>
                  <option value="application/zip">ZIP Archive</option>
                  <option value="application/octet-stream">Binary/Other</option>
                </select>
                <Show when={uploadedFileName()}>
                  <p class="text-xs text-green-600 dark:text-green-400 mt-1">
                    Auto-detected from file extension
                  </p>
                </Show>
              </div>

              <div>
                <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Content
                </label>
                <Show when={uploadContentType().startsWith('image/') || uploadContentType() === 'application/pdf'}>
                  <p class="text-xs text-slate-500 dark:text-slate-400 mb-2">
                    Binary file - content encoded as base64
                  </p>
                </Show>
                <textarea
                  placeholder="Enter file content here or drop/browse a file..."
                  value={uploadContent()}
                  onInput={(e) => setUploadContent(e.currentTarget.value)}
                  class="input w-full h-32 resize-y font-mono text-sm"
                  readOnly={!!uploadedFileName()}
                />
              </div>

              <div class="flex gap-2 justify-end pt-4 border-t border-slate-200 dark:border-slate-700">
                <button
                  type="button"
                  onClick={() => setShowUploadModal(false)}
                  class="btn btn-secondary"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleUpload}
                  class="btn btn-primary"
                  disabled={!uploadKey() || !uploadContent()}
                >
                  <Upload class="w-4 h-4" />
                  Upload to S3
                </button>
              </div>
            </div>
          </div>
        </div>
      </Show>

      {/* Content View Modal */}
      <Show when={showContentModal()}>
        <div class="modal-overlay" onClick={() => setShowContentModal(false)}>
          <div class="modal-content max-w-4xl" onClick={(e) => e.stopPropagation()}>
            <div class="flex items-center justify-between mb-4">
              <div>
                <h3 class="text-lg font-semibold text-slate-900 dark:text-white">
                  {selectedFile()?.key}
                </h3>
                <p class="text-sm text-slate-500 dark:text-slate-400">
                  {formatFileSize(selectedFile()?.size || 0)} • {formatDate(selectedFile()?.lastModified || '')}
                </p>
              </div>
              <div class="flex items-center gap-2">
                <button
                  type="button"
                  onClick={downloadAsFile}
                  class="btn btn-sm btn-secondary"
                  title="Download file"
                >
                  <Download class="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setShowContentModal(false)}
                  class="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                  aria-label="Close"
                >
                  ×
                </button>
              </div>
            </div>

            <div class="border border-slate-200 dark:border-slate-700 rounded-lg">
              <pre class="p-4 text-sm bg-slate-50 dark:bg-slate-900 rounded-lg overflow-auto max-h-96 whitespace-pre-wrap font-mono">
                {fileContent()}
              </pre>
            </div>

            <div class="flex justify-end pt-4 border-t border-slate-200 dark:border-slate-700">
              <button
                type="button"
                onClick={() => setShowContentModal(false)}
                class="btn btn-secondary"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      </Show>
    </div>
  );
}

export default Artifacts;