# Log IoT Fleet Indexing Metrics to CloudWatch

An AWS Lambda (or NodeJS) function that takes data from IoT Fleet Indexing and puts it into CloudWatch metrics:

- Connectivity stats
  - number connected
  - number disconnected
- Individual Thing stats
  - Alive status (1 or 0)
  - Uptime in days

## Requirements

Requires IAM roles:

- AWSLambdaBasicExecutionRole
- CloudWatchFullAccess
- AWSIoTFleetHubFederationAccess

## Installation

Create in AWS Lambda for NodeJS 12.x

Execute every 5 minutes by creating a time-based CloudWatch Event / Amazon EventBridge routine.
Should then create metrics in CloudWatch for the namespace you define ("Custom" by default)
