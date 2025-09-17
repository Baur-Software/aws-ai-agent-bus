import { Upload } from "lucide-solid";

import { useNotifications } from "../contexts/NotificationContext";

export default function WorkflowImport(props) {
  let fileInputRef;
  const { error: toastError, success: toastSuccess } = useNotifications();

  const handleButtonClick = () => {
    fileInputRef.click();
  };

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const text = await file.text();
    try {
      const workflow = JSON.parse(text);
      props.onImport(workflow);
      toastSuccess("Workflow imported successfully.");
    } catch (err) {
      toastError("Invalid workflow JSON.");
    }
  };

  return (
    <div class="flex flex-col">
      <button
        type="button"
        class="btn btn-secondary flex items-center gap-2 text-sm"
        onClick={handleButtonClick}
      >
        <Upload class="w-4 h-4" />
        Import
      </button>
      <input
        type="file"
        accept=".json"
        ref={el => (fileInputRef = el)}
        style={{ display: "none" }}
        onChange={handleFileChange}
      />
    </div>
  );
}