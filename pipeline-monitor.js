const { S3Client, GetObjectCommand, DeleteObjectCommand } = require("@aws-sdk/client-s3");
const { execSync } = require("child_process");
const fs = require("fs");

const s3 = new S3Client({
    region: "ap-south-1"
});

const BUCKET_NAME = "compiler-output-bucket-2026";

async function runCompilerWorkflow(filename, userCode) {
    try {

        const s3Key = `outputs/${filename}.txt`;

        // Delete old output before triggering pipeline
        try {
            await s3.send(new DeleteObjectCommand({
                Bucket: BUCKET_NAME,
                Key: s3Key
            }));
            console.log("Old output removed.");
        } catch (err) {
            // Ignore if file does not exist
        }

        // Remove previous user code
        try {
            execSync("git rm -f *.py *.java", {
                stdio: "ignore"
            });
        } catch (err) {}

        // Save new code
        fs.writeFileSync(filename, userCode);

        // Commit and push
        execSync("git add .");

        try {
            execSync(`git commit -m "Execute ${filename}"`);
        } catch (err) {
            // Ignore "nothing to commit"
        }

        execSync("git push origin main");

        console.log("Pipeline triggered.");

        // Wait for output
        const maxAttempts = 120;

        for (let i = 0; i < maxAttempts; i++) {

            await new Promise(resolve => setTimeout(resolve, 4000));

            try {

                const response = await s3.send(
                    new GetObjectCommand({
                        Bucket: BUCKET_NAME,
                        Key: s3Key
                    })
                );

                const output = await response.Body.transformToString();

                return {
                    success: !output.includes("Error"),
                    output: output
                };

            } catch (err) {

                if (
                    err.name === "NoSuchKey" ||
                    err.name === "NotFound"
                ) {
                    continue;
                }

                throw err;
            }
        }

        return {
            success: false,
            output: "Pipeline compilation timeout exceeded."
        };

    } catch (err) {

        return {
            success: false,
            output: err.message
        };
    }
}

module.exports = {
    runCompilerWorkflow
};
