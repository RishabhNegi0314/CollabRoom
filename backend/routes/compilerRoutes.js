// routes/compilerRoutes.js
//
// Real online code execution, backed by the Judge0 CE API.
// Replaces the previous offline/mock "Run Code" response.
//
// Mount this router under /api/compiler in your main server file, e.g.:
//   const compilerRoutes = require("./routes/compilerRoutes");
//   app.use("/api/compiler", compilerRoutes);

const express = require("express");
const router = express.Router();
const { getLanguageId, runSubmission, mapJudge0Result } = require("../services/judge0Service");

const SUPPORTED_LANGUAGES = ["java", "python", "cpp", "javascript"];

// POST /api/compiler/execute
// Body: { language: "java" | "python" | "cpp" | "javascript", code: string, input?: string }
// Response: { output: string, error: string, status: string, executionTime?: string }
router.post("/execute", async (req, res) => {
  const { language, code, input } = req.body || {};

  // --- Input validation -----------------------------------------------
  if (!code || typeof code !== "string" || code.trim().length === 0) {
    return res.status(400).json({
      output: "",
      error: "No code was submitted. Write some code before running it.",
      status: "Empty Code",
    });
  }

  if (!language || !SUPPORTED_LANGUAGES.includes(language)) {
    return res.status(400).json({
      output: "",
      error: `Invalid or unsupported language: "${language}". Supported languages: ${SUPPORTED_LANGUAGES.join(", ")}.`,
      status: "Invalid Language",
    });
  }

  if (!getLanguageId(language)) {
    // Defensive check in case SUPPORTED_LANGUAGES and the id map ever drift apart
    return res.status(400).json({
      output: "",
      error: `No Judge0 language mapping found for "${language}".`,
      status: "Invalid Language",
    });
  }

  try {
    // --- Judge0 execution flow -----------------------------------------
    const rawResult = await runSubmission({ language, code, input });
    const mapped = mapJudge0Result(rawResult);
    return res.status(200).json(mapped);
  } catch (err) {
    console.error("[compiler/execute] Judge0 execution failed:", err);

    if (err.code === "TIMEOUT") {
      return res.status(504).json({
        output: "",
        error: "Execution timed out. Your code may be stuck in an infinite loop or waiting on input.",
        status: "Timeout",
      });
    }

    if (err.code === "INVALID_LANGUAGE") {
      return res.status(400).json({
        output: "",
        error: err.message,
        status: "Invalid Language",
      });
    }

    if (err.message && err.message.includes("JUDGE0_API_KEY")) {
      return res.status(500).json({
        output: "",
        error: "Compiler service is not configured (missing JUDGE0_API_KEY on the server).",
        status: "Server Configuration Error",
      });
    }

    // Generic network/Judge0-outage fallback
    return res.status(502).json({
      output: "",
      error: `Failed to reach the compiler service: ${err.message}`,
      status: "Compiler Service Error",
    });
  }
});

module.exports = router;
