import express from "express";
import axios from "axios";

const router = express.Router();

// Supported Judge0 CE Language IDs (https://ce.judge0.com/languages)
export const JUDGE0_LANGUAGE_MAP = {
  python: 109, // Python (3.13.2)
  py: 109,
  python3: 109,
  javascript: 102, // JavaScript (Node.js 22.08.0)
  js: 102,
  node: 102,
  typescript: 101, // TypeScript (5.6.2)
  ts: 101,
  java: 91, // Java (JDK 17.0.6)
  cpp: 105, // C++ (GCC 14.1.0)
  "c++": 105,
  c: 103, // C (GCC 14.1.0)
  rust: 108, // Rust (1.85.0)
  rs: 108,
  go: 107, // Go (1.23.5)
  golang: 107,
  php: 98, // PHP (8.3.11)
  ruby: 72, // Ruby (2.7.0)
  rb: 72,
  bash: 46, // Bash (5.0.0)
  sh: 46,
  sql: 82, // SQL (SQLite 3.27.2)
  csharp: 51, // C# (Mono 6.6)
  cs: 51,
  kotlin: 111, // Kotlin (2.1.10)
  kt: 111,
  dart: 90
};

export async function executeJudge0Code(params = {}) {
  const {
    language,
    language_id,
    code,
    source_code,
    input,
    stdin,
    name
  } = params;
  const normLang = (language || "").toLowerCase().trim();

  // HTML / CSS visual previews
  if (normLang === "html" || normLang === "css") {
    return {
      success: true,
      output: "Compiled successfully. Live web page preview generated in preview viewport tab!",
      isVisual: true,
      executionTimeMs: 5
    };
  }

  let finalSourceCode = (source_code ?? code ?? "").trim();
  let finalStdin = stdin ?? input ?? "";

  // Java normalization for Judge0 runtime
  let scannerUsedWithoutInput = false;
  if (normLang === "java") {
    // 0. Comment out package declarations that cause ClassNotFoundException in Judge0 single-file compilation
    finalSourceCode = finalSourceCode.replace(/^(\s*package\s+[^;]+;)/gm, "// $1");

    // 1. Automatically ensure Scanner import is present if Scanner is used
    if (finalSourceCode.includes("Scanner") && !finalSourceCode.includes("import java.util")) {
      finalSourceCode = "import java.util.Scanner;\nimport java.util.*;\n" + finalSourceCode;
    }

    // 2. Normalize class name to Main for Judge0's java Main execution
    const publicClassMatch = finalSourceCode.match(/public\s+class\s+([A-Za-z0-9_$]+)/);
    if (publicClassMatch) {
      const origClassName = publicClassMatch[1];
      if (origClassName !== "Main") {
        finalSourceCode = finalSourceCode.replace(
          new RegExp(`public\\s+class\\s+${origClassName}\\b`, "g"),
          "public class Main"
        );
        finalSourceCode = finalSourceCode.replace(
          new RegExp(`\\b${origClassName}\\s*\\(`, "g"),
          "Main("
        );
      }
    } else {
      const classWithMain = finalSourceCode.match(/class\s+([A-Za-z0-9_$]+)[\s\S]*?public\s+static\s+void\s+main/);
      if (classWithMain) {
        const origClassName = classWithMain[1];
        if (origClassName !== "Main") {
          finalSourceCode = finalSourceCode.replace(
            new RegExp(`class\\s+${origClassName}\\b`, "g"),
            "public class Main"
          );
          finalSourceCode = finalSourceCode.replace(
            new RegExp(`\\b${origClassName}\\s*\\(`, "g"),
            "Main("
          );
        }
      }
    }

    // 3. Stdin fallback if Scanner is used and stdin is empty
    if (!finalStdin && (finalSourceCode.includes("Scanner") || finalSourceCode.includes("System.in"))) {
      finalStdin = "0\n0\n0\ninput\ntest\n";
      scannerUsedWithoutInput = true;
    }
  }

  // Determine language ID: either provided explicitly or mapped from language string
  const resolvedLangId = language_id || JUDGE0_LANGUAGE_MAP[normLang] || 109;

  try {
    const response = await axios.post(
      "https://ce.judge0.com/submissions?wait=true",
      {
        language_id: resolvedLangId,
        source_code: finalSourceCode,
        stdin: finalStdin
      },
      {
        headers: {
          "Content-Type": "application/json"
        },
        timeout: 15000
      }
    );

    const data = response.data || {};
    const { stdout, stderr, compile_output, message, time, memory, status } = data;

    let outputText = "";
    if (compile_output) {
      outputText += `[Compiler Output / Errors]\n${compile_output}\n`;
    }
    if (stderr) {
      outputText += `[Runtime Stderr]\n${stderr}\n`;
      if (stderr.includes("NoSuchElementException") && (finalSourceCode.includes("Scanner") || finalSourceCode.includes("System.in"))) {
        outputText += `\n💡 Tip: Your Java program uses Scanner to read from console. Please provide your input values in the '⌨ Stdin' box above the terminal and run again.\n`;
      }
    }
    if (stdout) {
      outputText += stdout;
    }
    if (scannerUsedWithoutInput) {
      outputText += `\n[💡 Stdin Notice]: Scanner was detected without console input. Provided fallback stream. You can enter custom input anytime using the '⌨ Stdin' drawer above.\n`;
    }
    if (!outputText && message) {
      outputText = `[Judge0 System Message]\n${message}`;
    }
    if (!outputText) {
      outputText = `Program executed with status: ${status?.description || "Success"} (exit code 0).`;
    }

    const durationMs = time ? Math.round(parseFloat(time) * 1000) : 10;

    return {
      success: true,
      output: outputText,
      stdout,
      stderr,
      compile_output,
      time,
      memory,
      status,
      executionTimeMs: durationMs,
      isVisual: false
    };
  } catch (err) {
    const errMsg = err?.response?.data?.message || err?.message || "Execution error";
    return {
      success: false,
      output: `Judge0 Execution Notice: ${errMsg}\nFalling back to local execution engine...`,
      error: errMsg,
      isVisual: false
    };
  }
}

// Support both /execute and /run routes
router.post("/execute", async (req, res) => {
  const result = await executeJudge0Code(req.body);
  res.json(result);
});

router.post("/run", async (req, res) => {
  const result = await executeJudge0Code({
    ...req.body,
    code: req.body.code || req.body.content
  });
  res.json(result);
});

export default router;