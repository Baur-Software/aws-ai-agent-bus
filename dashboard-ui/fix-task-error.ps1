# Fix TaskExecutionError constructor calls in all task files
$files = Get-ChildItem -Path "src/workflow/tasks" -Filter "*.ts" -Recurse

foreach ($file in $files) {
    $content = Get-Content $file.FullName -Raw
    $modified = $false
    
    # Pattern 1: throw new TaskExecutionError(this.type, context.nodeId, message)
    if ($content -match 'throw new TaskExecutionError\(\s*this\.type,\s*context\.nodeId[^,]*,\s*`([^`]+)`\s*\)') {
        $content = $content -replace 'throw new TaskExecutionError\(\s*this\.type,\s*context\.nodeId([^,]*),\s*`([^`]+)`\s*\)', 'throw new TaskExecutionError(`$2`, this.type, context.nodeId$1)'
        $modified = $true
    }
    
    # Pattern 2: throw new TaskExecutionError(this.type, context.nodeId || 'unknown', message, error)
    if ($content -match 'throw new TaskExecutionError\(\s*this\.type,\s*context\.nodeId[^,]*,\s*`([^`]+)`,\s*([^)]+)\)') {
        $content = $content -replace 'throw new TaskExecutionError\(\s*this\.type,\s*context\.nodeId([^,]*),\s*`([^`]+)`,\s*([^)]+)\)', 'throw new TaskExecutionError(`$2`, this.type, context.nodeId$1, $3)'
        $modified = $true
    }
    
    if ($modified) {
        Set-Content -Path $file.FullName -Value $content -NoNewline
        Write-Host "Fixed TaskExecutionError in: $($file.FullName)"
    }
}
