# Fix import paths in task files
$files = @(
    "src/workflow/tasks/data/FlattenTask.ts",
    "src/workflow/tasks/data/GroupByTask.ts",
    "src/workflow/tasks/data/JoinTask.ts",
    "src/workflow/tasks/data/MapTask.ts",
    "src/workflow/tasks/data/ReduceTask.ts",
    "src/workflow/tasks/data/SplitTask.ts",
    "src/workflow/tasks/data/TemplateTask.ts",
    "src/workflow/tasks/data/ValidateTask.ts",
    "src/workflow/tasks/events/EventsAnalyticsTask.ts",
    "src/workflow/tasks/events/EventsCreateAlertTask.ts",
    "src/workflow/tasks/events/EventsCreateRuleTask.ts",
    "src/workflow/tasks/events/EventsHealthCheckTask.ts",
    "src/workflow/tasks/logic/RetryTask.ts",
    "src/workflow/tasks/output/EmailTask.ts",
    "src/workflow/tasks/storage/ArtifactsGetTask.ts",
    "src/workflow/tasks/storage/ArtifactsListTask.ts",
    "src/workflow/tasks/storage/ArtifactsPutTask.ts",
    "src/workflow/tasks/storage/CacheTask.ts"
)

foreach ($file in $files) {
    if (Test-Path $file) {
        $content = Get-Content $file -Raw
        $content = $content -replace "from '../../types/workflow'", "from '../../types'"
        $content = $content -replace "from '../../errors/TaskExecutionError'", "from '../../types'"
        $content = $content -replace "import \{ WorkflowTask, WorkflowContext \} from '../../types';\s*import \{ TaskExecutionError \} from '../../types';", "import { WorkflowTask, WorkflowContext, TaskExecutionError, ValidationResult } from '../../types';"
        Set-Content -Path $file -Value $content -NoNewline
        Write-Host "Fixed: $file"
    }
}
