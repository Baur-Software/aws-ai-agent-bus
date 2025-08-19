import { StartExecutionCommand, DescribeExecutionCommand } from '@aws-sdk/client-sfn';
import { stepFunctions } from './clients.js';

const STATE_MACHINE_ARN = process.env.STATE_MACHINE_ARN || 'arn:aws:states:us-west-2:123456789012:stateMachine:AgentWorkflow';

export class StepFunctionsService {
  static async startExecution(name, input = {}) {
    const command = new StartExecutionCommand({
      stateMachineArn: STATE_MACHINE_ARN,
      name: `${name}-${Date.now()}`,
      input: JSON.stringify(input),
    });
    
    const { executionArn } = await stepFunctions.send(command);
    return this.describeExecution(executionArn);
  }

  static async describeExecution(executionArn) {
    const command = new DescribeExecutionCommand({
      executionArn,
    });
    
    const execution = await stepFunctions.send(command);
    return {
      ...execution,
      input: execution.input && typeof execution.input === 'string' ? JSON.parse(execution.input) : execution.input,
      output: execution.output && typeof execution.output === 'string' ? JSON.parse(execution.output) : execution.output,
    };
  }
}

export default StepFunctionsService;