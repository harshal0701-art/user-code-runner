# AWS CodePipeline Remote Compiler Engine

This system uses a decoupled architecture where code submitted to an EC2 hosted dashboard is executed inside an isolated AWS CodeBuild container via an AWS CodePipeline workflow.

## Architecture Pipeline
1. User writes code (Java/Python) on the EC2 Web Portal.
2. Web portal writes the file locally, commits, and pushes to this repository.
3. CodePipeline detects the commit and triggers AWS CodeBuild.
4. CodeBuild compiles/runs the code and uploads results to an Amazon S3 Bucket.
5. EC2 polls S3 to retrieve and display the output.