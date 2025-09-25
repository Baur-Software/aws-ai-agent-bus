
import { createSignal } from 'solid-js';

/**
 * AgentMarkdownEditor
 * UI for creating/editing agent markdown definitions
 * Props:
 *   - initialMarkdown: string (optional)
 *   - initialName: string (optional)
 *   - onSave: (markdown: string, name: string) => void
 */
export function AgentMarkdownEditor(props: {
  initialMarkdown?: string;
  initialName?: string;
  onSave: (markdown: string, name: string) => void;
}) {
  const [markdown, setMarkdown] = createSignal(props.initialMarkdown || '');
  const [name, setName] = createSignal(props.initialName || '');
  const [saving, setSaving] = createSignal(false);

  const handleSave = async () => {
    setSaving(true);
    await props.onSave(markdown(), name());
    setSaving(false);
  };

  return (
    <div class="agent-markdown-editor">
      <label>
        Agent Name:
        <input
          type="text"
          value={name()}
          onInput={e => setName(e.currentTarget.value)}
          placeholder="Agent name"
          class="input input-bordered mb-2"
        />
      </label>
      <label>
        Markdown Definition:
        <textarea
          value={markdown()}
          onInput={e => setMarkdown(e.currentTarget.value)}
          rows={16}
          class="textarea textarea-bordered w-full mb-2"
          placeholder="Write agent definition in markdown..."
        />
      </label>
      <button
        class="btn btn-primary"
        onClick={handleSave}
        disabled={saving() || !name() || !markdown()}
      >
        {saving() ? 'Saving...' : 'Save Agent'}
      </button>
    </div>
  );
}
