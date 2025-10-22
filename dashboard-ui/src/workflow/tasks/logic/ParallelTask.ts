// Parallel Task - Concurrent Execution
// Execute multiple workflow branches concurrently for performance optimization

import {
  WorkflowTask,
  WorkflowContext,
  ValidationResult,
  TaskConfigSchema,
  TaskDisplayInfo,
  Logger,
  TaskExecutionError,
  NODE_CATEGORIES
} from '../../types';

export interface ParallelInput {
  branches: Array<{
    id: string;
    name?: string;
    contextData?: Record<string, any>;
  }>;
  waitForAll?: boolean;
  waitForCount?: number;
  failOnError?: boolean;
  timeout?: number;
  maxConcurrency?: number;
}

export interface ParallelOutput {
  totalBranches: number;
  completedBranches: number;
  failedBranches: number;
  timedOutBranches: number;
  results: Array<{
    branchId: string;
    branchName?: string;
    status: 'completed' | 'failed' | 'timeout' | 'skipped';
    result?: any;
    error?: string;
    duration: number;
    startTime: string;
    endTime?: string;
  }>;
  totalDuration: number;
  timestamp: string;
}

export class ParallelTask implements WorkflowTask<ParallelInput, ParallelOutput> {
  readonly type = 'parallel';

  constructor(private logger?: Logger) {}

  async execute(input: ParallelInput, context: WorkflowContext): Promise<ParallelOutput> {
    const startTime = Date.now();
    const branches = input.branches || [];
    const waitForAll = input.waitForAll !== false; // Default true
    const waitForCount = input.waitForCount || (waitForAll ? branches.length : 1);
    const failOnError = input.failOnError !== false; // Default true
    const timeout = input.timeout || 300000; // 5 minutes default
    const maxConcurrency = input.maxConcurrency || branches.length;

    this.logger?.info(
      `Starting parallel execution: ${branches.length} branches, ` +
      `waitForAll=${waitForAll}, maxConcurrency=${maxConcurrency}`
    );

    if (branches.length === 0) {
      throw new TaskExecutionError(
        'At least one branch is required',
        this.type,
        context.nodeId,
        input
      );
    }

    const results: ParallelOutput['results'] = [];
    const promises: Array<Promise<void>> = [];
    let completedCount = 0;
    let failedCount = 0;
    let timedOutCount = 0;

    // Semaphore for concurrency control
    const runningBranches = new Set<string>();
    const pendingBranches = [...branches];

    // Process branches with concurrency limit
    const executeBranch = async (branch: typeof branches[0]): Promise<void> => {
      const branchStartTime = Date.now();
      const branchStartTimeISO = new Date().toISOString();

      // Wait for available slot
      while (runningBranches.size >= maxConcurrency) {
        await new Promise(resolve => setTimeout(resolve, 10));
      }

      runningBranches.add(branch.id);

      this.logger?.debug(`Branch ${branch.id} (${branch.name}) started`);

      try {
        // Create isolated context for this branch
        const branchContext = {
          ...context.data,
          ...(branch.contextData || {}),
          branchId: branch.id,
          branchName: branch.name
        };

        // In a real implementation, this would execute child nodes
        // For now, we simulate execution
        const result = await this.simulateBranchExecution(branch, branchContext, timeout);

        const duration = Date.now() - branchStartTime;

        results.push({
          branchId: branch.id,
          branchName: branch.name,
          status: 'completed',
          result,
          duration,
          startTime: branchStartTimeISO,
          endTime: new Date().toISOString()
        });

        completedCount++;
        this.logger?.debug(`Branch ${branch.id} completed in ${duration}ms`);

      } catch (error) {
        const duration = Date.now() - branchStartTime;

        if (error.message?.includes('timeout')) {
          results.push({
            branchId: branch.id,
            branchName: branch.name,
            status: 'timeout',
            error: 'Branch execution timed out',
            duration,
            startTime: branchStartTimeISO,
            endTime: new Date().toISOString()
          });
          timedOutCount++;
          this.logger?.warn(`Branch ${branch.id} timed out after ${duration}ms`);
        } else {
          results.push({
            branchId: branch.id,
            branchName: branch.name,
            status: 'failed',
            error: error.message,
            duration,
            startTime: branchStartTimeISO,
            endTime: new Date().toISOString()
          });
          failedCount++;
          this.logger?.error(`Branch ${branch.id} failed:`, error);
        }

        if (failOnError) {
          throw error;
        }

      } finally {
        runningBranches.delete(branch.id);
      }
    };

    // Start all branches
    for (const branch of branches) {
      promises.push(executeBranch(branch));
    }

    // Wait based on strategy
    if (waitForAll) {
      // Wait for all branches
      await Promise.allSettled(promises);
    } else if (waitForCount > 0) {
      // Wait for N branches to complete
      let completed = 0;
      const checkCompletion = async (): Promise<void> => {
        while (completed < waitForCount && (completedCount + failedCount + timedOutCount) < waitForCount) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      };
      await checkCompletion();
    }

    const totalDuration = Date.now() - startTime;

    const output: ParallelOutput = {
      totalBranches: branches.length,
      completedBranches: completedCount,
      failedBranches: failedCount,
      timedOutBranches: timedOutCount,
      results,
      totalDuration,
      timestamp: new Date().toISOString()
    };

    this.logger?.info(
      `Parallel execution completed: ${completedCount}/${branches.length} succeeded, ` +
      `${failedCount} failed, ${timedOutCount} timed out in ${totalDuration}ms`
    );

    // Store results in context
    context.data.parallelResults = results;
    context.data.parallelCompletedCount = completedCount;
    context.data.parallelFailedCount = failedCount;
    context.data.parallelTotalDuration = totalDuration;

    // Fail if any branch failed and failOnError is true
    if (failOnError && (failedCount > 0 || timedOutCount > 0)) {
      throw new TaskExecutionError(
        `Parallel execution had ${failedCount} failures and ${timedOutCount} timeouts`,
        this.type,
        context.nodeId,
        input
      );
    }

    return output;
  }

  private async simulateBranchExecution(
    branch: ParallelInput['branches'][0],
    branchContext: any,
    timeout: number
  ): Promise<any> {
    // Simulate async work
    const workDuration = Math.random() * 1000 + 500; // 500-1500ms

    const workPromise = new Promise(resolve => {
      setTimeout(() => {
        resolve({
          branchId: branch.id,
          completed: true,
          data: branchContext
        });
      }, workDuration);
    });

    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error('Branch execution timeout'));
      }, timeout);
    });

    return Promise.race([workPromise, timeoutPromise]);
  }

  validate(input: ParallelInput): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!input.branches || input.branches.length === 0) {
      errors.push('At least one branch is required');
    }

    if (input.branches && input.branches.length > 100) {
      warnings.push('Very high branch count (>100) may impact performance');
    }

    // Validate branch IDs are unique
    if (input.branches) {
      const ids = input.branches.map(b => b.id);
      const uniqueIds = new Set(ids);
      if (ids.length !== uniqueIds.size) {
        errors.push('Branch IDs must be unique');
      }

      // Check for empty IDs
      if (ids.some(id => !id || id.trim().length === 0)) {
        errors.push('All branches must have non-empty IDs');
      }
    }

    if (input.waitForCount !== undefined) {
      if (input.waitForCount < 1) {
        errors.push('waitForCount must be at least 1');
      }
      if (input.branches && input.waitForCount > input.branches.length) {
        errors.push('waitForCount cannot exceed number of branches');
      }
    }

    if (input.timeout && input.timeout < 1000) {
      warnings.push('Timeout is very short (<1s), branches may timeout prematurely');
    }

    if (input.maxConcurrency && input.maxConcurrency < 1) {
      errors.push('maxConcurrency must be at least 1');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  getSchema(): TaskConfigSchema {
    return {
      type: 'object',
      title: 'Parallel Execution',
      description: 'Execute multiple branches concurrently',
      properties: {
        branches: {
          type: 'array',
          title: 'Branches',
          description: 'Branches to execute in parallel',
          items: {
            type: 'object',
            properties: {
              id: {
                type: 'string',
                title: 'Branch ID',
                description: 'Unique identifier for this branch'
              },
              name: {
                type: 'string',
                title: 'Branch Name',
                description: 'Display name for this branch'
              },
              contextData: {
                type: 'object',
                title: 'Context Data',
                description: 'Data to pass to this branch'
              }
            },
            required: ['id']
          },
          minItems: 1
        },
        waitForAll: {
          type: 'boolean',
          title: 'Wait for All',
          description: 'Wait for all branches to complete',
          default: true
        },
        waitForCount: {
          type: 'number',
          title: 'Wait for Count',
          description: 'Number of branches to wait for (overrides waitForAll)',
          minimum: 1
        },
        failOnError: {
          type: 'boolean',
          title: 'Fail on Error',
          description: 'Fail entire task if any branch fails',
          default: true
        },
        timeout: {
          type: 'number',
          title: 'Timeout (ms)',
          description: 'Timeout per branch in milliseconds',
          default: 300000,
          minimum: 1000
        },
        maxConcurrency: {
          type: 'number',
          title: 'Max Concurrency',
          description: 'Maximum number of branches to run simultaneously',
          minimum: 1
        }
      },
      required: ['branches'],
      examples: [
        {
          branches: [
            { id: 'fetch-users', name: 'Fetch Users' },
            { id: 'fetch-products', name: 'Fetch Products' },
            { id: 'fetch-orders', name: 'Fetch Orders' }
          ],
          waitForAll: true,
          failOnError: false
        },
        {
          branches: [
            { id: 'api-1', contextData: { endpoint: '/api/users' } },
            { id: 'api-2', contextData: { endpoint: '/api/products' } }
          ],
          maxConcurrency: 2,
          timeout: 10000
        }
      ]
    };
  }

  getDisplayInfo(): TaskDisplayInfo {
    return {
      category: NODE_CATEGORIES.DATA_PROCESSING,
      label: 'Parallel',
      icon: '⚡',
      color: 'bg-purple-500',
      description: 'Execute multiple branches concurrently for performance',
      tags: ['parallel', 'concurrent', 'async', 'performance', 'optimization']
    };
  }
}
