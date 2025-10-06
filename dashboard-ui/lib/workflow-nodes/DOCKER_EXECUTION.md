# Docker Node Execution Architecture

## Problem Statement

AWS Lambda **cannot run arbitrary Docker containers** during execution. Lambda supports:
- ✅ Being deployed **as** a container image
- ❌ Running Docker containers **inside** Lambda execution

## Execution Options

### Option 1: AWS Fargate (Recommended for Workflows)

**Architecture:**
```
Workflow Execution → Step Functions → ECS Fargate Task
                                    ↓
                              Docker Container Runs
                                    ↓
                              Returns Output to Workflow
```

**Pros:**
- Run any Docker image
- Full container capabilities (volumes, networking, etc.)
- Scales automatically
- Pay per second of execution
- No infrastructure management

**Cons:**
- Cold start ~30-60 seconds
- More expensive than Lambda for short tasks
- Minimum 1 vCPU / 2GB RAM

**Implementation:**
```typescript
// Workflow engine would call Step Functions
const params = {
  taskDefinition: 'workflow-docker-runner',
  cluster: 'workflow-cluster',
  overrides: {
    containerOverrides: [{
      name: 'worker',
      image: nodeConfig.image,
      command: nodeConfig.command ? [nodeConfig.command] : undefined,
      environment: nodeConfig.env?.map(e => ({
        name: e.key,
        value: e.value
      }))
    }]
  }
};

await ecs.runTask(params).promise();
```

### Option 2: AWS Batch

**Architecture:**
```
Workflow Execution → AWS Batch Job → EC2/Fargate
                                    ↓
                              Docker Container Runs
```

**Pros:**
- Optimized for batch/long-running jobs
- Automatic scaling and job queuing
- Spot instance support for cost savings
- Job dependencies and array jobs

**Cons:**
- More complex setup
- Higher cold start for EC2-based jobs
- Overkill for simple workflows

### Option 3: Lambda + ECS Trigger (Hybrid)

**Architecture:**
```
Workflow Node → Lambda (Orchestrator) → Trigger ECS Task
     ↓                                        ↓
Store Task ARN                         Docker Runs
     ↓                                        ↓
Poll/Wait                              ← Task Complete
     ↓
Retrieve Results from S3/EventBridge
```

**Pros:**
- Lambda stays responsive (doesn't block)
- Full Docker capabilities
- Can handle long-running containers

**Cons:**
- Async execution adds complexity
- Need result storage mechanism
- Polling or event-driven architecture required

### Option 4: Self-Hosted Docker Runner (Enterprise)

**Architecture:**
```
Workflow → API Gateway → Docker Host (EC2/EKS)
                              ↓
                        Execute Container
                              ↓
                        Return Results
```

**Pros:**
- Full control over Docker daemon
- Can use advanced features (DinD, privileged mode)
- Persistent storage options
- Custom networking

**Cons:**
- Infrastructure to manage
- Need to handle scaling
- Security considerations (Docker daemon access)

## Recommended Implementation

### Phase 1: ECS Fargate (MVP)

```typescript
// dashboard-server/src/executors/DockerExecutor.ts
export class DockerExecutor {
  async execute(nodeConfig: DockerConfig): Promise<DockerOutput> {
    // 1. Create ECS task definition override
    const taskOverride = {
      containerOverrides: [{
        name: 'workflow-runner',
        image: `${nodeConfig.image}:${nodeConfig.tag || 'latest'}`,
        command: this.buildCommand(nodeConfig),
        environment: this.buildEnv(nodeConfig),
        cpu: this.parseCpuLimit(nodeConfig.cpuLimit),
        memory: this.parseMemoryLimit(nodeConfig.memoryLimit)
      }]
    };

    // 2. Run ECS task
    const task = await this.ecs.runTask({
      cluster: process.env.ECS_CLUSTER,
      taskDefinition: 'workflow-docker-runner',
      launchType: 'FARGATE',
      networkConfiguration: {
        awsvpcConfiguration: {
          subnets: [process.env.SUBNET_ID],
          securityGroups: [process.env.SECURITY_GROUP_ID],
          assignPublicIp: 'ENABLED'
        }
      },
      overrides: taskOverride
    }).promise();

    // 3. Wait for completion (with timeout)
    const result = await this.waitForTask(
      task.tasks![0].taskArn!,
      nodeConfig.timeout || 300
    );

    // 4. Fetch logs from CloudWatch
    const logs = await this.fetchLogs(task.tasks![0].taskArn!);

    return {
      containerId: task.tasks![0].taskArn!,
      exitCode: result.exitCode,
      stdout: logs.stdout,
      stderr: logs.stderr,
      duration: result.duration,
      startedAt: result.startedAt,
      finishedAt: result.finishedAt
    };
  }

  private async waitForTask(taskArn: string, timeoutSeconds: number) {
    const startTime = Date.now();

    while (true) {
      const tasks = await this.ecs.describeTasks({
        cluster: process.env.ECS_CLUSTER!,
        tasks: [taskArn]
      }).promise();

      const task = tasks.tasks![0];

      if (task.lastStatus === 'STOPPED') {
        return {
          exitCode: task.containers![0].exitCode || 0,
          duration: (Date.now() - startTime) / 1000,
          startedAt: task.startedAt!,
          finishedAt: task.stoppedAt!
        };
      }

      if ((Date.now() - startTime) / 1000 > timeoutSeconds) {
        await this.ecs.stopTask({
          cluster: process.env.ECS_CLUSTER!,
          task: taskArn,
          reason: 'Workflow timeout exceeded'
        }).promise();
        throw new Error(`Docker execution timeout after ${timeoutSeconds}s`);
      }

      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
}
```

### Phase 2: Add Volume & Port Support

For volumes and ports, we need additional infrastructure:

**Volumes:**
- Use EFS (Elastic File System) mounted to Fargate tasks
- Or S3 for file transfer (download before, upload after)

**Ports:**
- Use AWS App Mesh or ALB for port mapping
- Or expose via API Gateway + VPC Link

### Phase 3: Result Streaming

Instead of polling, use EventBridge:

```typescript
// Task completion triggers EventBridge event
{
  "source": "ecs.task",
  "detail-type": "ECS Task State Change",
  "detail": {
    "taskArn": "...",
    "lastStatus": "STOPPED",
    "containers": [{
      "exitCode": 0,
      "containerArn": "..."
    }]
  }
}

// Lambda handler catches event and updates workflow state
```

## Infrastructure Requirements

### Terraform Module

```hcl
# infra/modules/workflow-docker-runner/main.tf

resource "aws_ecs_cluster" "workflow" {
  name = "workflow-docker-runner"
}

resource "aws_ecs_task_definition" "runner" {
  family                   = "workflow-docker-runner"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = "256"
  memory                   = "512"
  execution_role_arn       = aws_iam_role.ecs_execution.arn
  task_role_arn           = aws_iam_role.ecs_task.arn

  container_definitions = jsonencode([{
    name      = "workflow-runner"
    image     = "public.ecr.aws/docker/library/alpine:latest"  # Placeholder
    essential = true

    logConfiguration = {
      logDriver = "awslogs"
      options = {
        "awslogs-group"         = aws_cloudwatch_log_group.docker_logs.name
        "awslogs-region"        = var.region
        "awslogs-stream-prefix" = "docker"
      }
    }
  }])
}

resource "aws_cloudwatch_log_group" "docker_logs" {
  name              = "/ecs/workflow-docker-runner"
  retention_in_days = 7
}
```

### Cost Estimates

**Fargate Pricing (us-west-2):**
- 0.25 vCPU: $0.04048 per hour ($0.00001124 per second)
- 0.5 GB RAM: $0.004445 per hour ($0.000001235 per second)

**Example:**
- 30-second execution: ~$0.0004 per run
- 1000 executions/day: ~$0.40/day = $12/month

Much cheaper than maintaining dedicated EC2 instances.

## Security Considerations

1. **Image Trust**: Only allow verified Docker images
2. **Network Isolation**: Run in private subnets with NAT gateway
3. **Resource Limits**: Enforce CPU/memory limits
4. **Secrets Management**: Use AWS Secrets Manager, not env vars
5. **Execution Logs**: All stdout/stderr goes to CloudWatch
6. **IAM Permissions**: Minimal task role permissions

## Migration Path

1. **Now**: Add Docker node to UI (✅ Complete)
2. **Phase 1**: Implement ECS Fargate executor
3. **Phase 2**: Add Terraform infrastructure
4. **Phase 3**: Add volume/port support via EFS/ALB
5. **Phase 4**: Optimize with result streaming (EventBridge)

## Alternative: Docker in Step Functions

AWS Step Functions can directly integrate with ECS:

```json
{
  "Type": "Task",
  "Resource": "arn:aws:states:::ecs:runTask.sync",
  "Parameters": {
    "Cluster": "workflow-cluster",
    "TaskDefinition": "workflow-docker-runner",
    "LaunchType": "FARGATE",
    "Overrides": {
      "ContainerOverrides": [{
        "Name": "worker",
        "Image.$": "$.dockerConfig.image",
        "Command.$": "$.dockerConfig.command"
      }]
    }
  }
}
```

This handles waiting/polling automatically with `.sync` integration.
