// Enhanced Workflow Editor with Save/Load functionality
// Integrates the workflow builder with the storage system

import { createSignal, createEffect, onMount, Show } from 'solid-js';
import { 
  Save, FileText, Settings, Play, Download, Upload, 
  ArrowLeft, Share2, Copy, Eye, Clock, Tag, User,
  AlertCircle, CheckCircle, Loader2
} from 'lucide-solid';
import { WorkflowDefinition } from '../workflow/types';
import { WorkflowStorageService } from '../services/WorkflowStorageService';
import WorkflowBrowser from './WorkflowBrowser';

interface WorkflowEditorProps {
  workflowStorage: WorkflowStorageService;
  onExecuteWorkflow: (workflow: WorkflowDefinition) => void;
  initialWorkflow?: WorkflowDefinition;
}

type EditorMode = 'browser' | 'editor';
type SaveStatus = 'saved' | 'unsaved' | 'saving' | 'error';

export default function WorkflowEditor(props: WorkflowEditorProps) {
  const [mode, setMode] = createSignal<EditorMode>('browser');
  const [currentWorkflow, setCurrentWorkflow] = createSignal<WorkflowDefinition | null>(props.initialWorkflow || null);
  const [workflowId, setWorkflowId] = createSignal<string | null>(null);
  const [saveStatus, setSaveStatus] = createSignal<SaveStatus>('saved');
  const [lastSaved, setLastSaved] = createSignal<string | null>(null);
  
  // Workflow editing state
  const [workflowName, setWorkflowName] = createSignal('');
  const [workflowDescription, setWorkflowDescription] = createSignal('');
  const [workflowTags, setWorkflowTags] = createSignal<string[]>([]);
  const [workflowCategory, setWorkflowCategory] = createSignal('');
  
  // UI state
  const [showSettings, setShowSettings] = createSignal(false);
  const [autoSave, setAutoSave] = createSignal(true);
  const [isModified, setIsModified] = createSignal(false);

  // Initialize workflow data when workflow changes
  createEffect(() => {
    const workflow = currentWorkflow();
    if (workflow) {
      setWorkflowName(workflow.name);
      setWorkflowDescription(workflow.description);
      setWorkflowTags(workflow.metadata?.tags || []);
      setWorkflowCategory(workflow.metadata?.category || '');
      setWorkflowId(workflow.metadata?.id || null);
      setIsModified(false);
      setSaveStatus('saved');
    }
  });

  // Auto-save functionality
  createEffect(() => {
    if (autoSave() && isModified() && currentWorkflow()) {
      const timeoutId = setTimeout(() => {
        handleSave();
      }, 2000); // Auto-save after 2 seconds of inactivity
      
      return () => clearTimeout(timeoutId);
    }
  });

  // Track modifications
  const markAsModified = () => {
    setIsModified(true);
    setSaveStatus('unsaved');
  };

  // Handlers
  const handleNewWorkflow = () => {
    const newWorkflow: WorkflowDefinition = {
      version: '1.0',
      created: new Date().toISOString(),
      name: 'Untitled Workflow',
      description: 'A new workflow',
      nodes: [],
      connections: [],
      metadata: {
        author: props.workflowStorage.getCurrentUserId(),
        tags: [],
        version: '1.0.0'
      }
    };
    
    setCurrentWorkflow(newWorkflow);
    setMode('editor');
    setIsModified(true);
  };

  const handleLoadWorkflow = (workflow: WorkflowDefinition) => {
    if (isModified() && !confirm('You have unsaved changes. Continue?')) {
      return;
    }
    
    setCurrentWorkflow(workflow);
    setMode('editor');
  };

  const handleEditWorkflow = async (id: string) => {
    if (isModified() && !confirm('You have unsaved changes. Continue?')) {
      return;
    }
    
    const workflow = await props.workflowStorage.loadWorkflow(id);
    if (workflow) {
      setCurrentWorkflow(workflow);
      setMode('editor');
    }
  };

  const handleSave = async () => {
    const workflow = currentWorkflow();
    if (!workflow) return;

    setSaveStatus('saving');
    
    try {
      const updatedWorkflow: WorkflowDefinition = {
        ...workflow,
        name: workflowName(),
        description: workflowDescription(),
        metadata: {
          ...workflow.metadata,
          tags: workflowTags(),
          category: workflowCategory(),
          modified: new Date().toISOString()
        }
      };

      const savedId = await props.workflowStorage.saveWorkflow(updatedWorkflow, {
        updateModified: true,
        createBackup: !!workflowId()
      });

      setWorkflowId(savedId);
      setCurrentWorkflow(updatedWorkflow);
      setIsModified(false);
      setSaveStatus('saved');
      setLastSaved(new Date().toLocaleTimeString());

      console.log(`✅ Workflow saved: ${savedId}`);
    } catch (error) {
      console.error('Failed to save workflow:', error);
      setSaveStatus('error');
    }
  };

  const handleSaveAs = async () => {
    const newName = prompt('Enter new workflow name:', `${workflowName()} Copy`);
    if (!newName) return;

    const workflow = currentWorkflow();
    if (!workflow) return;

    setSaveStatus('saving');
    
    try {
      const newWorkflow: WorkflowDefinition = {
        ...workflow,
        name: newName,
        metadata: {
          ...workflow.metadata,
          id: undefined, // Generate new ID
          created: new Date().toISOString(),
          version: '1.0.0'
        }
      };

      const savedId = await props.workflowStorage.saveWorkflow(newWorkflow);
      setWorkflowId(savedId);
      setCurrentWorkflow(newWorkflow);
      setWorkflowName(newName);
      setIsModified(false);
      setSaveStatus('saved');
      setLastSaved(new Date().toLocaleTimeString());
    } catch (error) {
      console.error('Failed to save workflow as:', error);
      setSaveStatus('error');
    }
  };

  const handleExecute = () => {
    const workflow = currentWorkflow();
    if (workflow) {
      // Save before executing if modified
      if (isModified()) {
        handleSave().then(() => {
          props.onExecuteWorkflow(workflow);
        });
      } else {
        props.onExecuteWorkflow(workflow);
      }
    }
  };

  const handleExport = () => {
    const workflow = currentWorkflow();
    if (!workflow) return;

    const dataStr = JSON.stringify(workflow, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `${workflowName().replace(/[^a-zA-Z0-9]/g, '-')}.json`;
    a.click();
    
    URL.revokeObjectURL(url);
  };

  const handleImport = (event: Event) => {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    if (isModified() && !confirm('You have unsaved changes. Continue?')) {
      input.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const workflow = JSON.parse(e.target?.result as string) as WorkflowDefinition;
        setCurrentWorkflow(workflow);
        setMode('editor');
        setIsModified(true);
      } catch (error) {
        alert('Invalid workflow file');
      }
      input.value = '';
    };
    reader.readAsText(file);
  };

  const handleBackToBrowser = () => {
    if (isModified() && !confirm('You have unsaved changes. Continue?')) {
      return;
    }
    setMode('browser');
    setCurrentWorkflow(null);
  };

  const getSaveStatusIcon = () => {
    switch (saveStatus()) {
      case 'saving': return <Loader2 class="w-4 h-4 animate-spin text-blue-500" />;
      case 'saved': return <CheckCircle class="w-4 h-4 text-green-500" />;
      case 'unsaved': return <AlertCircle class="w-4 h-4 text-yellow-500" />;
      case 'error': return <AlertCircle class="w-4 h-4 text-red-500" />;
      default: return null;
    }
  };

  const getSaveStatusText = () => {
    switch (saveStatus()) {
      case 'saving': return 'Saving...';
      case 'saved': return lastSaved() ? `Saved at ${lastSaved()}` : 'Saved';
      case 'unsaved': return 'Unsaved changes';
      case 'error': return 'Save failed';
      default: return '';
    }
  };

  return (
    <div class="flex flex-col h-full bg-white">
      <Show 
        when={mode() === 'editor' && currentWorkflow()}
        fallback={
          <WorkflowBrowser
            workflowStorage={props.workflowStorage}
            onWorkflowSelect={handleLoadWorkflow}
            onNewWorkflow={handleNewWorkflow}
            onEditWorkflow={handleEditWorkflow}
            onExecuteWorkflow={props.onExecuteWorkflow}
          />
        }
      >
        {/* Editor Header */}
        <div class="flex-shrink-0 border-b border-gray-200 bg-white">
          <div class="flex items-center justify-between p-4">
            <div class="flex items-center gap-4">
              <button
                onClick={handleBackToBrowser}
                class="flex items-center gap-2 px-3 py-1.5 text-gray-600 hover:bg-gray-100 rounded"
              >
                <ArrowLeft class="w-4 h-4" />
                Back
              </button>
              
              <div class="flex items-center gap-2">
                <FileText class="w-5 h-5 text-gray-600" />
                <input
                  type="text"
                  value={workflowName()}
                  onInput={(e) => { setWorkflowName(e.target.value); markAsModified(); }}
                  class="text-lg font-semibold text-gray-900 bg-transparent border-none outline-none focus:bg-gray-50 rounded px-2 py-1"
                  placeholder="Workflow Name"
                />
              </div>
              
              <div class="flex items-center gap-2 text-sm">
                {getSaveStatusIcon()}
                <span class={`${
                  saveStatus() === 'error' ? 'text-red-600' :
                  saveStatus() === 'unsaved' ? 'text-yellow-600' :
                  saveStatus() === 'saving' ? 'text-blue-600' :
                  'text-green-600'
                }`}>
                  {getSaveStatusText()}
                </span>
              </div>
            </div>

            <div class="flex items-center gap-2">
              <label class="flex items-center gap-2 px-3 py-1.5 border border-gray-300 rounded hover:bg-gray-50 cursor-pointer">
                <Upload class="w-4 h-4" />
                Import
                <input
                  type="file"
                  accept=".json"
                  class="hidden"
                  onChange={handleImport}
                />
              </label>
              
              <button
                onClick={handleExport}
                class="flex items-center gap-2 px-3 py-1.5 border border-gray-300 rounded hover:bg-gray-50"
              >
                <Download class="w-4 h-4" />
                Export
              </button>
              
              <button
                onClick={handleSaveAs}
                class="flex items-center gap-2 px-3 py-1.5 border border-gray-300 rounded hover:bg-gray-50"
              >
                <Copy class="w-4 h-4" />
                Save As
              </button>
              
              <button
                onClick={handleSave}
                disabled={saveStatus() === 'saving'}
                class="flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
              >
                <Save class="w-4 h-4" />
                Save
              </button>
              
              <button
                onClick={handleExecute}
                class="flex items-center gap-2 px-3 py-1.5 bg-green-600 text-white rounded hover:bg-green-700"
              >
                <Play class="w-4 h-4" />
                Run
              </button>
              
              <button
                onClick={() => setShowSettings(!showSettings())}
                class="p-2 text-gray-600 hover:bg-gray-100 rounded"
              >
                <Settings class="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Workflow metadata */}
          <div class="px-4 pb-4">
            <textarea
              value={workflowDescription()}
              onInput={(e) => { setWorkflowDescription(e.target.value); markAsModified(); }}
              placeholder="Workflow description"
              class="w-full text-sm text-gray-600 bg-transparent border-none outline-none resize-none focus:bg-gray-50 rounded px-2 py-1"
              rows="2"
            />
            
            {/* Tags and category */}
            <div class="flex items-center gap-4 mt-2">
              <div class="flex items-center gap-2">
                <Tag class="w-4 h-4 text-gray-500" />
                <input
                  type="text"
                  value={workflowTags().join(', ')}
                  onInput={(e) => {
                    const tags = e.target.value.split(',').map(t => t.trim()).filter(Boolean);
                    setWorkflowTags(tags);
                    markAsModified();
                  }}
                  placeholder="Tags (comma separated)"
                  class="text-sm text-gray-600 bg-transparent border-none outline-none focus:bg-gray-50 rounded px-2 py-1"
                />
              </div>
              
              <div class="flex items-center gap-2">
                <User class="w-4 h-4 text-gray-500" />
                <input
                  type="text"
                  value={workflowCategory()}
                  onInput={(e) => { setWorkflowCategory(e.target.value); markAsModified(); }}
                  placeholder="Category"
                  class="text-sm text-gray-600 bg-transparent border-none outline-none focus:bg-gray-50 rounded px-2 py-1"
                />
              </div>
            </div>
          </div>

          {/* Settings panel */}
          <Show when={showSettings()}>
            <div class="border-t border-gray-200 p-4 bg-gray-50">
              <div class="flex items-center gap-6">
                <label class="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={autoSave()}
                    onChange={(e) => setAutoSave(e.target.checked)}
                    class="rounded text-blue-600"
                  />
                  <span class="text-sm text-gray-700">Auto-save</span>
                </label>
                
                <div class="text-sm text-gray-600">
                  <span class="font-medium">Version:</span> {currentWorkflow()?.metadata?.version || '1.0.0'}
                </div>
                
                <div class="text-sm text-gray-600">
                  <span class="font-medium">Nodes:</span> {currentWorkflow()?.nodes.length || 0}
                </div>
                
                <div class="text-sm text-gray-600">
                  <span class="font-medium">Connections:</span> {currentWorkflow()?.connections?.length || 0}
                </div>
                
                <Show when={workflowId()}>
                  <div class="text-sm text-gray-600">
                    <span class="font-medium">ID:</span> {workflowId()}
                  </div>
                </Show>
              </div>
            </div>
          </Show>
        </div>

        {/* Editor Content */}
        <div class="flex-1 overflow-hidden">
          {/* This would be where your actual workflow builder component goes */}
          <div class="h-full flex items-center justify-center bg-gray-50">
            <div class="text-center">
              <FileText class="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 class="text-lg font-medium text-gray-900 mb-2">Workflow Editor</h3>
              <p class="text-gray-500 mb-4">
                The visual workflow builder would be integrated here.
                <br />
                This would replace the existing WorkflowBuilder component.
              </p>
              <div class="space-y-2 text-sm text-gray-600">
                <div>Current workflow: <strong>{workflowName()}</strong></div>
                <div>Nodes: <strong>{currentWorkflow()?.nodes.length || 0}</strong></div>
                <div>Connections: <strong>{currentWorkflow()?.connections?.length || 0}</strong></div>
                <Show when={isModified()}>
                  <div class="text-yellow-600 font-medium">⚠️ Unsaved changes</div>
                </Show>
              </div>
            </div>
          </div>
        </div>
      </Show>
      
      {/* Keyboard shortcuts handler */}
      <div
        tabIndex={-1}
        onKeyDown={(e) => {
          if (mode() === 'editor') {
            if ((e.ctrlKey || e.metaKey) && e.key === 's') {
              e.preventDefault();
              handleSave();
            }
            if ((e.ctrlKey || e.metaKey) && e.key === 'r') {
              e.preventDefault();
              handleExecute();
            }
          }
        }}
        class="fixed inset-0 pointer-events-none"
      />
    </div>
  );
}