// Workflow Quota and Limits Settings Component
// Manages user quotas and resource limits for workflows

import { createSignal, createResource, Show, For } from 'solid-js';
import {
  Shield, TriangleAlert, CheckCircle, Info,
  Clock, Database, Play, FileText, Users,
  BarChart3, TrendingUp, Zap, HardDrive
} from 'lucide-solid';
import { WorkflowStorageService } from '../../services/WorkflowStorageService';

interface WorkflowQuotaSettingsProps {
  workflowStorage: WorkflowStorageService;
  userTier?: 'free' | 'pro' | 'enterprise';
}

interface QuotaLimits {
  maxWorkflows: number;
  maxExecutionsPerMonth: number;
  maxNodesPerWorkflow: number;
  maxExecutionTime: number; // seconds
  maxStorageSize: number; // bytes
  maxConcurrentExecutions: number;
  canShareTemplates: boolean;
  canExportWorkflows: boolean;
  canImportWorkflows: boolean;
  advancedAnalytics: boolean;
}

const QUOTA_LIMITS: Record<string, QuotaLimits> = {
  free: {
    maxWorkflows: 10,
    maxExecutionsPerMonth: 100,
    maxNodesPerWorkflow: 25,
    maxExecutionTime: 300, // 5 minutes
    maxStorageSize: 10 * 1024 * 1024, // 10MB
    maxConcurrentExecutions: 1,
    canShareTemplates: false,
    canExportWorkflows: true,
    canImportWorkflows: true,
    advancedAnalytics: false
  },
  pro: {
    maxWorkflows: 100,
    maxExecutionsPerMonth: 1000,
    maxNodesPerWorkflow: 100,
    maxExecutionTime: 1800, // 30 minutes
    maxStorageSize: 100 * 1024 * 1024, // 100MB
    maxConcurrentExecutions: 5,
    canShareTemplates: true,
    canExportWorkflows: true,
    canImportWorkflows: true,
    advancedAnalytics: true
  },
  enterprise: {
    maxWorkflows: -1, // unlimited
    maxExecutionsPerMonth: -1, // unlimited
    maxNodesPerWorkflow: -1, // unlimited
    maxExecutionTime: 7200, // 2 hours
    maxStorageSize: -1, // unlimited
    maxConcurrentExecutions: 20,
    canShareTemplates: true,
    canExportWorkflows: true,
    canImportWorkflows: true,
    advancedAnalytics: true
  }
};

export default function WorkflowQuotaSettings(props: WorkflowQuotaSettingsProps) {
  const userTier = () => props.userTier || 'free';
  const limits = () => QUOTA_LIMITS[userTier()];

  // Load current usage
  const [usage] = createResource(async () => {
    const workflows = await props.workflowStorage.listWorkflows();
    const currentMonth = new Date().toISOString().substring(0, 7);
    
    let totalExecutions = 0;
    let totalStorageSize = 0;
    let maxNodes = 0;
    let avgExecutionTime = 0;
    let executionTimes: number[] = [];

    for (const workflow of workflows) {
      totalExecutions += workflow.executionCount;
      maxNodes = Math.max(maxNodes, workflow.nodeCount);
      
      // Estimate storage size (rough calculation)
      totalStorageSize += JSON.stringify(workflow).length;
      
      // Get execution history for timing analysis
      const history = await props.workflowStorage.getExecutionHistory(workflow.id);
      history.forEach(exec => {
        if (exec.duration) {
          executionTimes.push(exec.duration / 1000); // Convert to seconds
        }
      });
    }

    if (executionTimes.length > 0) {
      avgExecutionTime = executionTimes.reduce((a, b) => a + b, 0) / executionTimes.length;
    }

    return {
      workflowCount: workflows.length,
      totalExecutions,
      executionsThisMonth: Math.floor(totalExecutions * 0.3), // Estimate current month
      totalStorageSize,
      maxNodesUsed: maxNodes,
      avgExecutionTime: Math.round(avgExecutionTime),
      longestExecution: Math.max(...executionTimes, 0),
      recentExecutions: workflows.filter(w => w.lastExecuted && 
        new Date(w.lastExecuted) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
      ).length
    };
  });

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDuration = (seconds: number) => {
    if (seconds < 60) return `${seconds}s`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
    return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
  };

  const getUsagePercentage = (used: number, limit: number) => {
    if (limit === -1) return 0; // Unlimited
    return Math.min((used / limit) * 100, 100);
  };

  const getUsageColor = (percentage: number) => {
    if (percentage < 50) return 'text-green-600 bg-green-50';
    if (percentage < 80) return 'text-yellow-600 bg-yellow-50';
    return 'text-red-600 bg-red-50';
  };

  const getProgressColor = (percentage: number) => {
    if (percentage < 50) return 'bg-green-500';
    if (percentage < 80) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  return (
    <div class="max-w-4xl mx-auto space-y-8">
      {/* Header */}
      <div class="flex items-center justify-between">
        <div>
          <h2 class="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Shield class="w-6 h-6" />
            Usage & Limits
          </h2>
          <p class="text-gray-600">
            Your current usage and plan limits
            <span class={`ml-2 px-2 py-1 text-xs font-medium rounded-full ${
              userTier() === 'enterprise' ? 'bg-purple-100 text-purple-800' :
              userTier() === 'pro' ? 'bg-blue-100 text-blue-800' :
              'bg-gray-100 text-gray-800'
            }`}>
              {userTier().toUpperCase()} PLAN
            </span>
          </p>
        </div>
      </div>

      {/* Usage Overview */}
      <Show when={usage()}>
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Workflows */}
          <div class="bg-white border border-gray-200 rounded-lg p-4">
            <div class="flex items-center justify-between mb-2">
              <FileText class="w-5 h-5 text-blue-500" />
              <span class={`text-xs px-2 py-1 rounded-full ${
                getUsageColor(getUsagePercentage(usage()!.workflowCount, limits().maxWorkflows))
              }`}>
                {limits().maxWorkflows === -1 ? 'Unlimited' : 
                 `${usage()!.workflowCount}/${limits().maxWorkflows}`}
              </span>
            </div>
            <div class="text-2xl font-bold text-gray-900">{usage()!.workflowCount}</div>
            <div class="text-sm text-gray-600">Workflows</div>
            <Show when={limits().maxWorkflows !== -1}>
              <div class="mt-2 w-full bg-gray-200 rounded-full h-2">
                <div 
                  class={`h-2 rounded-full ${getProgressColor(getUsagePercentage(usage()!.workflowCount, limits().maxWorkflows))}`}
                  style={`width: ${getUsagePercentage(usage()!.workflowCount, limits().maxWorkflows)}%`}
                />
              </div>
            </Show>
          </div>

          {/* Executions This Month */}
          <div class="bg-white border border-gray-200 rounded-lg p-4">
            <div class="flex items-center justify-between mb-2">
              <Play class="w-5 h-5 text-green-500" />
              <span class={`text-xs px-2 py-1 rounded-full ${
                getUsageColor(getUsagePercentage(usage()!.executionsThisMonth, limits().maxExecutionsPerMonth))
              }`}>
                {limits().maxExecutionsPerMonth === -1 ? 'Unlimited' : 
                 `${usage()!.executionsThisMonth}/${limits().maxExecutionsPerMonth}`}
              </span>
            </div>
            <div class="text-2xl font-bold text-gray-900">{usage()!.executionsThisMonth}</div>
            <div class="text-sm text-gray-600">Executions This Month</div>
            <Show when={limits().maxExecutionsPerMonth !== -1}>
              <div class="mt-2 w-full bg-gray-200 rounded-full h-2">
                <div 
                  class={`h-2 rounded-full ${getProgressColor(getUsagePercentage(usage()!.executionsThisMonth, limits().maxExecutionsPerMonth))}`}
                  style={`width: ${getUsagePercentage(usage()!.executionsThisMonth, limits().maxExecutionsPerMonth)}%`}
                />
              </div>
            </Show>
          </div>

          {/* Storage */}
          <div class="bg-white border border-gray-200 rounded-lg p-4">
            <div class="flex items-center justify-between mb-2">
              <HardDrive class="w-5 h-5 text-purple-500" />
              <span class={`text-xs px-2 py-1 rounded-full ${
                getUsageColor(getUsagePercentage(usage()!.totalStorageSize, limits().maxStorageSize))
              }`}>
                {limits().maxStorageSize === -1 ? 'Unlimited' : 
                 `${formatBytes(usage()!.totalStorageSize)}/${formatBytes(limits().maxStorageSize)}`}
              </span>
            </div>
            <div class="text-2xl font-bold text-gray-900">{formatBytes(usage()!.totalStorageSize)}</div>
            <div class="text-sm text-gray-600">Storage Used</div>
            <Show when={limits().maxStorageSize !== -1}>
              <div class="mt-2 w-full bg-gray-200 rounded-full h-2">
                <div 
                  class={`h-2 rounded-full ${getProgressColor(getUsagePercentage(usage()!.totalStorageSize, limits().maxStorageSize))}`}
                  style={`width: ${getUsagePercentage(usage()!.totalStorageSize, limits().maxStorageSize)}%`}
                />
              </div>
            </Show>
          </div>

          {/* Max Complexity */}
          <div class="bg-white border border-gray-200 rounded-lg p-4">
            <div class="flex items-center justify-between mb-2">
              <BarChart3 class="w-5 h-5 text-orange-500" />
              <span class={`text-xs px-2 py-1 rounded-full ${
                getUsageColor(getUsagePercentage(usage()!.maxNodesUsed, limits().maxNodesPerWorkflow))
              }`}>
                {limits().maxNodesPerWorkflow === -1 ? 'Unlimited' : 
                 `${usage()!.maxNodesUsed}/${limits().maxNodesPerWorkflow}`}
              </span>
            </div>
            <div class="text-2xl font-bold text-gray-900">{usage()!.maxNodesUsed}</div>
            <div class="text-sm text-gray-600">Max Nodes Used</div>
            <Show when={limits().maxNodesPerWorkflow !== -1}>
              <div class="mt-2 w-full bg-gray-200 rounded-full h-2">
                <div 
                  class={`h-2 rounded-full ${getProgressColor(getUsagePercentage(usage()!.maxNodesUsed, limits().maxNodesPerWorkflow))}`}
                  style={`width: ${getUsagePercentage(usage()!.maxNodesUsed, limits().maxNodesPerWorkflow)}%`}
                />
              </div>
            </Show>
          </div>
        </div>
      </Show>

      {/* Plan Limits */}
      <div class="bg-white border border-gray-200 rounded-lg p-6">
        <h3 class="text-lg font-semibold text-gray-900 mb-4">Plan Limits</h3>
        
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div class="space-y-4">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2">
                <FileText class="w-4 h-4 text-gray-500" />
                <span class="text-sm text-gray-700">Max Workflows</span>
              </div>
              <span class="text-sm font-medium text-gray-900">
                {limits().maxWorkflows === -1 ? 'Unlimited' : limits().maxWorkflows}
              </span>
            </div>
            
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2">
                <Play class="w-4 h-4 text-gray-500" />
                <span class="text-sm text-gray-700">Executions per Month</span>
              </div>
              <span class="text-sm font-medium text-gray-900">
                {limits().maxExecutionsPerMonth === -1 ? 'Unlimited' : limits().maxExecutionsPerMonth}
              </span>
            </div>
            
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2">
                <BarChart3 class="w-4 h-4 text-gray-500" />
                <span class="text-sm text-gray-700">Max Nodes per Workflow</span>
              </div>
              <span class="text-sm font-medium text-gray-900">
                {limits().maxNodesPerWorkflow === -1 ? 'Unlimited' : limits().maxNodesPerWorkflow}
              </span>
            </div>
            
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2">
                <Clock class="w-4 h-4 text-gray-500" />
                <span class="text-sm text-gray-700">Max Execution Time</span>
              </div>
              <span class="text-sm font-medium text-gray-900">
                {formatDuration(limits().maxExecutionTime)}
              </span>
            </div>
          </div>
          
          <div class="space-y-4">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2">
                <HardDrive class="w-4 h-4 text-gray-500" />
                <span class="text-sm text-gray-700">Storage Limit</span>
              </div>
              <span class="text-sm font-medium text-gray-900">
                {limits().maxStorageSize === -1 ? 'Unlimited' : formatBytes(limits().maxStorageSize)}
              </span>
            </div>
            
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2">
                <Zap class="w-4 h-4 text-gray-500" />
                <span class="text-sm text-gray-700">Concurrent Executions</span>
              </div>
              <span class="text-sm font-medium text-gray-900">
                {limits().maxConcurrentExecutions}
              </span>
            </div>
            
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2">
                <Users class="w-4 h-4 text-gray-500" />
                <span class="text-sm text-gray-700">Share Templates</span>
              </div>
              <span class={`text-sm font-medium ${limits().canShareTemplates ? 'text-green-600' : 'text-gray-400'}`}>
                {limits().canShareTemplates ? 'Available' : 'Not Available'}
              </span>
            </div>
            
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2">
                <TrendingUp class="w-4 h-4 text-gray-500" />
                <span class="text-sm text-gray-700">Advanced Analytics</span>
              </div>
              <span class={`text-sm font-medium ${limits().advancedAnalytics ? 'text-green-600' : 'text-gray-400'}`}>
                {limits().advancedAnalytics ? 'Available' : 'Not Available'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Usage Warnings */}
      <Show when={usage()}>
        <div class="space-y-3">
          <Show when={getUsagePercentage(usage()!.workflowCount, limits().maxWorkflows) >= 80}>
            <div class="flex items-start gap-3 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <TriangleAlert class="w-5 h-5 text-yellow-600 mt-0.5" />
              <div>
                <h4 class="text-sm font-medium text-yellow-800">Workflow Limit Warning</h4>
                <p class="text-sm text-yellow-700">
                  You're approaching your workflow limit ({usage()!.workflowCount}/{limits().maxWorkflows}). 
                  Consider upgrading your plan or deleting unused workflows.
                </p>
              </div>
            </div>
          </Show>
          
          <Show when={getUsagePercentage(usage()!.executionsThisMonth, limits().maxExecutionsPerMonth) >= 80}>
            <div class="flex items-start gap-3 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <TriangleAlert class="w-5 h-5 text-yellow-600 mt-0.5" />
              <div>
                <h4 class="text-sm font-medium text-yellow-800">Execution Limit Warning</h4>
                <p class="text-sm text-yellow-700">
                  You're approaching your monthly execution limit ({usage()!.executionsThisMonth}/{limits().maxExecutionsPerMonth}).
                  Your workflows may be throttled if you exceed this limit.
                </p>
              </div>
            </div>
          </Show>
          
          <Show when={usage()!.longestExecution > limits().maxExecutionTime * 0.9}>
            <div class="flex items-start gap-3 p-4 bg-orange-50 border border-orange-200 rounded-lg">
              <Clock class="w-5 h-5 text-orange-600 mt-0.5" />
              <div>
                <h4 class="text-sm font-medium text-orange-800">Execution Time Notice</h4>
                <p class="text-sm text-orange-700">
                  Some workflows are running close to the maximum execution time limit 
                  ({formatDuration(usage()!.longestExecution)} max). Consider optimizing complex workflows.
                </p>
              </div>
            </div>
          </Show>
        </div>
      </Show>

      {/* Recommendations */}
      <div class="bg-blue-50 border border-blue-200 rounded-lg p-6">
        <h3 class="text-lg font-semibold text-blue-900 mb-4 flex items-center gap-2">
          <Info class="w-5 h-5" />
          Optimization Tips
        </h3>
        
        <div class="space-y-3">
          <Show when={userTier() === 'free'}>
            <div class="text-sm text-blue-800">
              • <strong>Upgrade to Pro</strong> for 10x more workflows and executions
            </div>
          </Show>
          
          <div class="text-sm text-blue-800">
            • <strong>Archive old workflows</strong> to free up storage space
          </div>
          
          <div class="text-sm text-blue-800">
            • <strong>Optimize complex workflows</strong> by reducing unnecessary nodes
          </div>
          
          <div class="text-sm text-blue-800">
            • <strong>Use conditions and filters</strong> to prevent unnecessary executions
          </div>
          
          <div class="text-sm text-blue-800">
            • <strong>Monitor execution patterns</strong> to identify optimization opportunities
          </div>
        </div>
      </div>
    </div>
  );
}