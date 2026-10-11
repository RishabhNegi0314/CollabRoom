// services/judge0Service.js
//
// Thin wrapper around the Judge0 CE API. Responsible ONLY for talking to
// Judge0 and normalizing its response shape - no Express/HTTP concerns here,
// so it can be unit tested or reused by other routes (e.g. a future
// "test runner" feature) without dragging req/res along.

const JUDGE0_BASE_URL = process.env.JUDGE0_API_URL || "https://judge0-ce.p.rapidapi.com";
const JUDGE0_API_KEY = process.env.JUDGE0_API_KEY;
const JUDGE0_API_HOST = process.env.JUDGE0_API_HOST || "judge0-ce.p.rapidapi.com";

// Judge0 language ID mapping (per task requirements)
const LANGUAGE_ID_MAP = {
  python: 71,
  java: 62,
  cpp: 54,
  javascript: 63,
};

// Judge0 status IDs that mean "still working" - we poll until we leave this set.
const IN_PROGRESS_STATUS_IDS = new Set([1, 2]); // 1 = In Queue, 2 = Processing

function getLanguageId(language) {
  return LANGUAGE_ID_MAP[language] || null;
}

function buildHeaders() {
  if (!JUDGE0_API_KEY) {
    throw new Error("JUDGE0_API_KEY is not configured on the server.");
  }
  return {
    "Content-Type": "application/json",
    "X-RapidAPI-Key": JUDGE0_API_KEY,
    "X-RapidAPI-Host": JUDGE0_API_HOST,
  };
}

// Creates a submission and polls until Judge0 finishes compiling/running it.
// Returns the raw Judge0 submission object (stdout, stderr, compile_output, status, time, etc).
async function runSubmission({ language, code, input }) {
  const languageId = getLanguageId(language);
  if (!languageId) {
    const err = new Error(`Unsupported language: "${language}"`);
    err.code = "INVALID_LANGUAGE";
    throw err;
  }

  const headers = buildHeaders();

  // 1. Create the submission
  const createRes = await fetch(
    `${JUDGE0_BASE_URL}/submissions?base64_encoded=true&wait=false`,
    {
      method: "POST",
      headers,
      body: JSON.stringify({
        language_id: languageId,
        source_code: Buffer.from(code || "").toString("base64"),
        stdin: input ? Buffer.from(input).toString("base64") : undefined,
      }),
    }
  );

  if (!createRes.ok) {
    const text = await createRes.text().catch(() => "");
    throw new Error(`Judge0 submission failed (${createRes.status}): ${text}`);
  }

  const { token } = await createRes.json();
  if (!token) {
    throw new Error("Judge0 did not return a submission token.");
  }

  // 2. Poll for the result (Judge0 CE has no webhooks on the free tier, so we poll)
  const MAX_ATTEMPTS = 15;
  const POLL_INTERVAL_MS = 1000;

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const resultRes = await fetch(
      `${JUDGE0_BASE_URL}/submissions/${token}?base64_encoded=true`,
      { headers }
    );

    if (!resultRes.ok) {
      const text = await resultRes.text().catch(() => "");
      throw new Error(`Judge0 status check failed (${resultRes.status}): ${text}`);
    }

    const result = await resultRes.json();
    const statusId = result?.status?.id;

    if (!IN_PROGRESS_STATUS_IDS.has(statusId)) {
      return result; // Finished (success, compile error, runtime error, TLE, etc.)
    }

    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }

  const timeoutErr = new Error("Judge0 execution timed out while polling for a result.");
  timeoutErr.code = "TIMEOUT";
  throw timeoutErr;
}

// Decodes a base64 field from Judge0, returning "" for null/undefined.
function decodeField(value) {
  if (!value) return "";
  return Buffer.from(value, "base64").toString("utf-8");
}

// Maps a raw Judge0 submission result into the { output, error, status, executionTime }
// contract our /api/compiler/execute endpoint promises the frontend.
function mapJudge0Result(result) {
  const statusDescription = result?.status?.description || "Unknown";
  const statusId = result?.status?.id;

  const stdout = decodeField(result?.stdout);
  const stderr = decodeField(result?.stderr);
  const compileOutput = decodeField(result?.compile_output);
  const message = decodeField(result?.message);

  const executionTime = result?.time ? `${result.time}s` : undefined;

  // Judge0 status IDs: 3 = Accepted, 4 = Wrong Answer, 5 = Time Limit Exceeded,
  // 6 = Compilation Error, 7-12 = various Runtime Errors, 13 = Internal Error, 14 = Exec Format Error
  if (statusId === 6) {
    // Compilation error
    return {
      output: "",
      error: compileOutput || "Compilation failed.",
      status: "Compilation Error",
      executionTime,
    };
  }

  if (statusId === 5) {
    return {
      output: stdout,
      error: "Time limit exceeded.",
      status: "Timeout",
      executionTime,
    };
  }

  if (statusId >= 7 && statusId <= 12) {
    // Runtime error variants (SIGSEGV, SIGXFSZ, NZEC, etc.)
    return {
      output: stdout,
      error: stderr || message || statusDescription,
      status: "Runtime Error",
      executionTime,
    };
  }

  if (statusId === 3) {
    // Accepted / ran successfully
    return {
      output: stdout,
      error: stderr ? stderr : "", // some accepted runs still write to stderr (warnings)
      status: "Accepted",
      executionTime,
    };
  }

  // Fallback for any other/unexpected status (Internal Error, Exec Format Error, etc.)
  return {
    output: stdout,
    error: stderr || compileOutput || message || statusDescription,
    status: statusDescription,
    executionTime,
  };
}

module.exports = {
  getLanguageId,
  runSubmission,
  mapJudge0Result,
  LANGUAGE_ID_MAP,
};
