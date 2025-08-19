import StepFunctionsService from '../../aws/step-functions.js';

export class WorkflowHandler {
  static async start({ name, input = {} } = {}) {
    if (!name) {
      throw new Error('Workflow name is required');
    }

    const execution = await StepFunctionsService.startExecution(name, input);
    
    return {
      executionArn: execution.executionArn,
      startDate: execution.startDate,
      stateMachineArn: execution.stateMachineArn,
      status: execution.status,
    };
  }

  static async getStatus({ executionArn } = {}) {
    if (!executionArn) {
      throw new Error('Execution ARN is required');
    }

    const execution = await StepFunctionsService.describeExecution(executionArn);
    
    return {
      executionArn: execution.executionArn,
      status: execution.status,
      startDate: execution.startDate,
      stopDate: execution.stopDate,
      input: execution.input,
      output: execution.output,
    };
  }
}

export default WorkflowHandler;