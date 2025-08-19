import { jest } from '@jest/globals';

// Mock AWS SDK
jest.unstable_mockModule('@aws-sdk/client-dynamodb', () => ({
  DynamoDBClient: jest.fn().mockImplementation(() => ({
    send: jest.fn(),
  })),
}));

jest.unstable_mockModule('@aws-sdk/client-eventbridge', () => ({
  EventBridgeClient: jest.fn().mockImplementation(() => ({
    send: jest.fn(),
  })),
}));

// Add more mocks as needed

export const mockAwsResponse = (service, method, response) => {
  const client = require(`@aws-sdk/client-${service}`);
  const clientInstance = new client[`${service.charAt(0).toUpperCase() + service.slice(1)}Client`]();
  clientInstance.send.mockImplementationOnce(() => Promise.resolve(response));
  return clientInstance;
};

export const mockAwsError = (service, method, error) => {
  const client = require(`@aws-sdk/client-${service}`);
  const clientInstance = new client[`${service.charAt(0).toUpperCase() + service.slice(1)}Client`]();
  clientInstance.send.mockRejectedValueOnce(error);
  return clientInstance;
};
