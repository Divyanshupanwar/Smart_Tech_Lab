const { spawn } = require("child_process");

const BACKEND_URL = "http://localhost:3000";
const FRONTEND_URL = "http://localhost:5173";

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForServerReady(child, { timeoutMs = 20000, readyText, name }) {
  return new Promise((resolve, reject) => {
    let stdout = "";
    let stderr = "";

    const timer = setTimeout(() => {
      cleanup();
      reject(new Error(`${name} did not start in time.\nSTDOUT:\n${stdout}\nSTDERR:\n${stderr}`));
    }, timeoutMs);

    const onStdout = (data) => {
      const text = data.toString();
      stdout += text;
      if (text.includes(readyText)) {
        cleanup();
        resolve({ stdout, stderr });
      }
    };

    const onStderr = (data) => {
      stderr += data.toString();
    };

    const onExit = (code) => {
      cleanup();
      reject(new Error(`${name} exited early with code ${code}.\nSTDOUT:\n${stdout}\nSTDERR:\n${stderr}`));
    };

    function cleanup() {
      clearTimeout(timer);
      child.stdout.off("data", onStdout);
      child.stderr.off("data", onStderr);
      child.off("exit", onExit);
    }

    child.stdout.on("data", onStdout);
    child.stderr.on("data", onStderr);
    child.on("exit", onExit);
  });
}

function updateCookieJar(cookieJar, response) {
  const setCookies = response.headers.getSetCookie ? response.headers.getSetCookie() : [];
  for (const cookie of setCookies) {
    const [pair] = cookie.split(";");
    const [name, value] = pair.split("=");
    cookieJar.set(name, value);
  }
}

function getCookieHeader(cookieJar) {
  return Array.from(cookieJar.entries())
    .map(([key, value]) => `${key}=${value}`)
    .join("; ");
}

async function request(path, { method = "GET", body, cookieJar } = {}) {
  const headers = {};
  if (body) {
    headers["Content-Type"] = "application/json";
  }
  if (cookieJar && cookieJar.size) {
    headers["Cookie"] = getCookieHeader(cookieJar);
  }

  const response = await fetch(`${BACKEND_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  updateCookieJar(cookieJar, response);

  const text = await response.text();
  let data = text;
  try {
    data = JSON.parse(text);
  } catch {}

  return { status: response.status, data, headers: response.headers };
}

async function main() {
  const backend = spawn("node", ["src/index.js"], {
    cwd: process.cwd(),
    stdio: ["ignore", "pipe", "pipe"],
  });
  let frontend;

  const cookieJar = new Map();
  const email = `codex.flow.${Date.now()}@example.com`;
  const password = "StrongPass1!";
  const results = {};

  try {
    await waitForServerReady(backend, {
      readyText: "Server listening at port number: 3000",
      name: "Backend",
    });
    frontend = spawn("node", [".\\node_modules\\vite\\bin\\vite.js", "--host", "0.0.0.0"], {
      cwd: `${process.cwd()}\\Frontend\\frontend`,
      stdio: ["ignore", "pipe", "pipe"],
    });
    await waitForServerReady(frontend, {
      readyText: "Local",
      name: "Frontend",
    });
    await sleep(500);

    const register = await request("/user/register", {
      method: "POST",
      body: { firstName: "Codex Tester", emailID: email, password },
      cookieJar,
    });
    results.register = register;

    const checkAfterRegister = await request("/user/check", { cookieJar });
    results.checkAfterRegister = checkAfterRegister;

    const allProblems = await request("/problem/getAllProblem", { cookieJar });
    results.allProblems = {
      status: allProblems.status,
      count: allProblems.data.count,
    };

    const subjectStats = await request("/problem/subjectStats", { cookieJar });
    results.subjectStats = subjectStats;

    const subjectCounts = {};
    for (const subject of ["DSA", "DAA", "OOPs", "CProgramming"]) {
      const response = await request(`/problem/bySubject/${subject}`, { cookieJar });
      subjectCounts[subject] = {
        status: response.status,
        count: response.data.count,
      };
    }
    results.subjectCounts = subjectCounts;

    const problemId = allProblems.data.problems[0]._id;
    const problemDetail = await request(`/problem/problemById/${problemId}`, { cookieJar });
    results.problemDetail = {
      status: problemDetail.status,
      subject: problemDetail.data.problem.subject,
      difficulty: problemDetail.data.problem.difficulty,
      title: problemDetail.data.problem.title,
      visibleCount: problemDetail.data.problem.visibleTestCases.length,
      starterCount: problemDetail.data.problem.startCode.length,
      solutionCount: problemDetail.data.problem.referenceSolution.length,
    };

    const solvedBefore = await request("/problem/problemSolvedbyUser", { cookieJar });
    results.solvedBefore = {
      status: solvedBefore.status,
      count: solvedBefore.data.problems.length,
    };

    const jsSolution = problemDetail.data.problem.referenceSolution.find(
      (solution) => solution.language === "JavaScript"
    );
    if (!jsSolution) {
      throw new Error("No JavaScript reference solution found");
    }

    const runResult = await request(`/submission/run/${problemId}`, {
      method: "POST",
      body: { code: jsSolution.completeCode, language: "javascript" },
      cookieJar,
    });
    results.runResult = runResult;

    const submitResult = await request(`/submission/submit/${problemId}`, {
      method: "POST",
      body: { code: jsSolution.completeCode, language: "javascript" },
      cookieJar,
    });
    results.submitResult = submitResult;

    const solvedAfter = await request("/problem/problemSolvedbyUser", { cookieJar });
    results.solvedAfter = {
      status: solvedAfter.status,
      count: solvedAfter.data.problems.length,
    };

    const submissionHistory = await request(`/problem/submittedProblem/${problemId}`, { cookieJar });
    results.submissionHistory = {
      status: submissionHistory.status,
      count: submissionHistory.data.submissions.length,
      latest: submissionHistory.data.submissions[0],
    };

    const logout = await request("/user/logout", {
      method: "POST",
      cookieJar,
    });
    results.logout = logout;

    const checkAfterLogout = await request("/user/check", { cookieJar });
    results.checkAfterLogout = checkAfterLogout;

    const frontendRoot = await fetch(FRONTEND_URL);
    results.frontendRoot = { status: frontendRoot.status };

    results.testUser = email;
    console.log(JSON.stringify(results, null, 2));
  } finally {
    backend.kill("SIGTERM");
    if (frontend) {
      frontend.kill("SIGTERM");
    }
  }
}

main().catch((error) => {
  console.error("FLOW_ERROR");
  console.error(error);
  process.exit(1);
});
