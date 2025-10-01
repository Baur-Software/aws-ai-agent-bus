import { createSignal, createResource, Show, For } from 'solid-js';
import { usePageHeader } from '../contexts/HeaderContext';
import { useDashboardServer } from '../contexts/DashboardServerContext';
import { formatDate, formatFileSize } from '../utils/formatters';
import { Archive, Upload, Download, Trash2, File, FolderOpen, Search, Plus } from 'lucide-solid';

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
  const [selectedFile, setSelectedFile] = createSignal<ArtifactItem | null>(null);
  const [uploadContent, setUploadContent] = createSignal('');
  const [uploadKey, setUploadKey] = createSignal('');
  const [uploadContentType, setUploadContentType] = createSignal('text/plain');
  const [searchPrefix, setSearchPrefix] = createSignal('');
  const [showUploadModal, setShowUploadModal] = createSignal(false);
  const [showContentModal, setShowContentModal] = createSignal(false);
  const [fileContent, setFileContent] = createSignal('');

  // Load artifacts list
  const [artifactsList, { refetch: refetchArtifacts }] = createResource(
    () => isConnected() ? searchPrefix() : null,
    async (prefix) => {
      try {
        const result = await artifacts.list(prefix || undefined);
        return result.items || [];
      } catch (error) {
        console.error('Failed to load artifacts:', error);
        return [];
      }
    }
  );

  const handleUpload = async () => {
    if (!uploadKey() || !uploadContent()) return;

    try {
      await artifacts.put(uploadKey(), uploadContent(), uploadContentType());
      setUploadKey('');
      setUploadContent('');
      setUploadContentType('text/plain');
      setShowUploadModal(false);
      refetchArtifacts();
    } catch (error) {
      console.error('Upload failed:', error);
    }
  };

  const handleDownload = async (item: ArtifactItem) => {
    try {
      const result = await artifacts.get(item.key);
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
      {/* Header Controls */}
      <div class="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
            <Archive class="w-5 h-5 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <h1 class="text-xl font-semibold text-slate-900 dark:text-white">Artifacts</h1>
            <p class="text-sm text-slate-500 dark:text-slate-400">S3 file and content management</p>
          </div>
        </div>

        <div class="flex gap-2">
          <button
            onClick={() => setShowUploadModal(true)}
            class="btn btn-primary flex items-center gap-2"
            disabled={!isConnected()}
          >
            <Plus class="w-4 h-4" />
            Upload
          </button>
          <button
            onClick={() => refetchArtifacts()}
            class="btn btn-secondary"
            disabled={!isConnected()}
          >
            Refresh
          </button>
        </div>
      </div>

      {/* Search/Filter */}
      <div class="card p-4">
        <div class="flex items-center gap-3">
          <Search class="w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Filter by prefix (e.g., 'docs/', 'images/')"
            value={searchPrefix()}
            onInput={(e) => setSearchPrefix(e.currentTarget.value)}
            class="flex-1 bg-transparent border-none outline-none text-slate-900 dark:text-white placeholder-slate-400"
          />
          <button
            onClick={() => refetchArtifacts()}
            class="btn btn-sm btn-secondary"
            disabled={!isConnected()}
          >
            Search
          </button>
        </div>
      </div>

      {/* Connection Status */}
      <Show when={!isConnected()}>
        <div class="card p-6 border-orange-200 bg-orange-50 dark:bg-orange-900/20 dark:border-orange-800">
          <div class="flex items-center gap-3">
            <div class="w-8 h-8 bg-orange-100 dark:bg-orange-900/30 rounded-full flex items-center justify-center">
              <Archive class="w-4 h-4 text-orange-600 dark:text-orange-400" />
            </div>
            <div>
              <h3 class="font-medium text-orange-900 dark:text-orange-100">MCP Server Disconnected</h3>
              <p class="text-sm text-orange-700 dark:text-orange-300">Connect to MCP server to manage artifacts</p>
            </div>
          </div>
        </div>
      </Show>

      {/* Artifacts List */}
      <div class="card">
        <div class="p-4 border-b border-slate-200 dark:border-slate-700">
          <h2 class="font-medium text-slate-900 dark:text-white">Files</h2>
          <Show when={searchPrefix()}>
            <p class="text-sm text-slate-500 dark:text-slate-400 mt-1">
              Filtering by: <code class="bg-slate-100 dark:bg-slate-800 px-1 rounded">{searchPrefix()}</code>
            </p>
          </Show>
        </div>

        <Show when={artifactsList.loading}>
          <div class="p-8 text-center">
            <div class="animate-spin w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full mx-auto"></div>
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
              <h3 class="text-lg font-semibold text-slate-900 dark:text-white">Upload Artifact</h3>
              <button
                onClick={() => setShowUploadModal(false)}
                class="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
              >
                ×
              </button>
            </div>

            <div class="space-y-4">
              <div>
                <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Key (file path)
                </label>
                <input
                  type="text"
                  placeholder="e.g., documents/report.txt"
                  value={uploadKey()}
                  onInput={(e) => setUploadKey(e.currentTarget.value)}
                  class="input w-full"
                />
              </div>

              <div>
                <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Content Type
                </label>
                <select
                  value={uploadContentType()}
                  onChange={(e) => setUploadContentType(e.currentTarget.value)}
                  class="input w-full"
                >
                  <option value="text/plain">Text (.txt)</option>
                  <option value="application/json">JSON (.json)</option>
                  <option value="text/markdown">Markdown (.md)</option>
                  <option value="text/html">HTML (.html)</option>
                  <option value="text/csv">CSV (.csv)</option>
                  <option value="application/xml">XML (.xml)</option>
                </select>
              </div>

              <div>
                <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Content
                </label>
                <textarea
                  placeholder="Enter file content here..."
                  value={uploadContent()}
                  onInput={(e) => setUploadContent(e.currentTarget.value)}
                  class="input w-full h-32 resize-y"
                />
              </div>

              <div class="flex gap-2 justify-end pt-4 border-t border-slate-200 dark:border-slate-700">
                <button
                  onClick={() => setShowUploadModal(false)}
                  class="btn btn-secondary"
                >
                  Cancel
                </button>
                <button
                  onClick={handleUpload}
                  class="btn btn-primary"
                  disabled={!uploadKey() || !uploadContent()}
                >
                  Upload
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
                  onClick={downloadAsFile}
                  class="btn btn-sm btn-secondary"
                  title="Download file"
                >
                  <Download class="w-4 h-4" />
                </button>
                <button
                  onClick={() => setShowContentModal(false)}
                  class="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
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