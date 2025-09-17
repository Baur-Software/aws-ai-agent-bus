import {
  SFNClient,
  StartExecutionCommand,
  DescribeExecutionCommand
} from '@aws-sdk/client-sfn';

const region = process.env.AWS_REGION || 'us-west-2';
const sfnClient = new SFNClient({ region });

export default {
  async startExecution(stateMachineArn, input, name) {
    const command = new StartExecutionCommand({
      stateMachineArn,
      input: JSON.stringify(input),
      name
    });

    return await sfnClient.send(command);
  },

  async describeExecution(executionArn) {
    const command = new DescribeExecutionCommand({
      executionArn
    });

    return await sfnClient.send(command);
  }
};