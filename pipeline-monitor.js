const { S3Client, GetObjectCommand, DeleteObjectCommand } = require("@aws-sdk/client-s3");
const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const s3 = new S3Client({
    region: "ap-south-1"
});

const BUCKET_NAME = "compiler-output-bucket-2026";

async function runCompilerWorkflow(filename, userCode) {

    try {

        console.log("===== STARTING COMPILER WORKFLOW =====");

        const s3Key = `outputs/${filename}.txt`;

        // Delete previous output
        try {
            await s3.send(new DeleteObjectCommand({
                Bucket: BUCKET_NAME,
                Key: s3Key
            }));
        } catch (err) {}

        // ---------------------------
        // Sync latest GitHub changes
        // ---------------------------
        console.log("Syncing repository...");

        execSync("git fetch origin", { stdio: "inherit" });
        execSync("git reset --hard origin/main", { stdio: "inherit" });
        execSync("git clean -fd", { stdio: "inherit" });

        // ---------------------------
        // Create folders
        // ---------------------------
        if (!fs.existsSync("python")) {
            fs.mkdirSync("python");
        }

        if (!fs.existsSync("java")) {
            fs.mkdirSync("java");
        }

        // ---------------------------
        // Delete previous files
        // ---------------------------
        try {
            execSync("rm -f python/*.py", { stdio: "ignore" });
        } catch (e) {}

        try {
            execSync("rm -f java/*.java", { stdio: "ignore" });
        } catch (e) {}

        // ---------------------------
        // Decide destination
        // ---------------------------
        let filePath;

        if (filename.endsWith(".py")) {

            filePath = path.join("python", filename);

        } else if (filename.endsWith(".java")) {

            filePath = path.join("java", filename);

        } else {

            return {
                success: false,
                output: "Only Python and Java files are supported."
            };

        }

        // ---------------------------
        // Save source code
        // ---------------------------
        fs.writeFileSync(filePath, userCode);

        // ---------------------------
        // Commit
        // ---------------------------
        execSync("git add .", {
            stdio: "inherit"
        });

        try {

            execSync(`git commit -m "Execute ${filename}"`, {
                stdio: "inherit"
            });

        } catch (e) {

            console.log("Nothing to commit.");

        }

        // ---------------------------
        // Push
        // ---------------------------
        execSync("git push origin main", {
            stdio: "inherit"
        });

        console.log("Pipeline triggered.");

        // ---------------------------
        // Wait for CodeBuild output
        // ---------------------------
        const maxAttempts = 120;

        for (let i = 0; i < maxAttempts; i++) {

            await new Promise(resolve => setTimeout(resolve, 4000));

            try {

                const response = await s3.send(new GetObjectCommand({
                    Bucket: BUCKET_NAME,
                    Key: s3Key
                }));

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

        console.error(err);

        return {
            success: false,
            output: err.message
        };

    }

}

module.exports = {
    runCompilerWorkflow
};
