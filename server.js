const express = require("express");
const path = require("path");

const { runCompilerWorkflow } = require("./pipeline-monitor");

const app = express();

const PORT = process.env.PORT || 80;

app.use(express.json({
    limit: "5mb"
}));

app.use(express.static(path.join(__dirname, "public")));

app.post("/api/compile", async (req, res) => {

    const { filename, code } = req.body;

    if (!filename || !code) {
        return res.status(400).json({
            success: false,
            output: "Filename and code are required."
        });
    }

    console.log(`Compiling ${filename}`);

    const result = await runCompilerWorkflow(filename, code);

    res.json(result);
});

app.listen(PORT, () => {
    console.log(`Compiler server running on port ${PORT}`);
});
