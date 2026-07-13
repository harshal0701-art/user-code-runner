const express = require('express');
const path = require('path');
// Import the workflow monitor logic function from pipeline-monitor.js
const { runCompilerWorkflow } = require('./pipeline-monitor');

const app = express();
const PORT = process.env.PORT || 80; // Standard Web Port

// Enable JSON parsing payload capacity
app.use(express.json());

// Serve static elements from public directory assets
app.use(express.static(path.join(__dirname, 'public')));

// REST Endpoint linking UI trigger calls straight into the CodePipeline execution loop
app.post('/api/compile', async (req, res) => {
    const { filename, code } = req.body;
    
    if (!filename || !code) {
        return res.status(400).json({ success: false, output: "Error: Missing filename or code contents parameters." });
    }

    console.log(`Received compile request instance handling token for: ${filename}`);
    const processResult = await runCompilerWorkflow(filename, code);
    
    res.json(processResult);
});

app.listen(PORT, () => {
    console.log(`EC2 Web Compiler Server operational platform listening on port: ${PORT}`);
});