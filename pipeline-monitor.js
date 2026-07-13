const { S3Client, GetObjectCommand, DeleteObjectCommand } = require("@aws-sdk/client-s3");
const { execSync } = require("child_process");
const fs = require("fs");

const s3 = new S3Client({ region: "ap-south-1" }); // Change to your AWS Region
const BUCKET_NAME = "compiler-output-bucket-2026";

async function runCompilerWorkflow(filename, userCode) {
    try {
        // 1. Clean up old user files from the local repo track
        execSync("git rm *.py *.java --ignore-unmatch");

        // 2. Write the new code file
        fs.writeFileSync(`./${filename}`, userCode);

        // 3. Push changes to GitHub to trigger CodePipeline
        execSync("git add .");
        execSync(`git commit -m "Executing code submission: ${filename}"`);
        execSync("git push origin main");
        console.log("Pipeline triggered successfully via GitHub Push.");

        // 4. Poll S3 bucket until the processing output text file appears
        const s3Key = `outputs/${filename}.txt`;
        let attempts = 0;
        const maxAttempts = 30; // 30 attempts * 4 seconds = 2 minutes timeout limit

        // First, delete any old output file to prevent false positives
        try {
            await s3.send(new DeleteObjectCommand({ Bucket: BUCKET_NAME, Key: s3Key }));
        } catch (e) {}

        console.log("Waiting for CodePipeline execution...");
        while (attempts < maxAttempts) {
            await new Promise(resolve => setTimeout(resolve, 4000)); // wait 4 seconds
            attempts++;

            try {
                const s3Response = await s3.send(new GetObjectCommand({ Bucket: BUCKET_NAME, Key: s3Key }));
                const streamToString = await s3Response.Body.transformToString();
                
                return {
                    success: !streamToString.includes("Error:"),
                    output: streamToString
                };
            } catch (error) {
                // NoSuchKey error is expected while CodePipeline is still compiling
                if (error.name !== "NoSuchKey") throw error;
            }
        }
        throw new Error("Pipeline compilation timeout exceeded.");
    } catch (err) {
        return { success: false, output: err.message };
    }
}

module.exports = { runCompilerWorkflow };