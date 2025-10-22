# Fix validate methods to return ValidationResult instead of Promise
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
        # Fix async validate to sync validate
        $content = $content -replace "async validate\(input: ([^)]+)\): Promise<\{ valid: boolean; errors: string\[\]; warnings: string\[\] \}>", "validate(input: `$1): ValidationResult"
        # Fix return statement from {valid, errors, warnings} to {isValid, errors, warnings}
        $content = $content -replace "return \{ valid: errors\.length === 0, errors, warnings \};", "return { isValid: errors.length === 0, errors, warnings };"
        Set-Content -Path $file -Value $content -NoNewline
        Write-Host "Fixed validate in: $file"
    }
}
