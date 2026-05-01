import { spawn, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, rm } from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { packageFlow } from "./package.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const serviceVersion = process.env.TOTALJS_FLOW_VERSION ?? "10.0.0";
const targetPlatform = process.env.TARGET_PLATFORM ?? process.platform;
const verifyPort = Number(process.env.VERIFY_PORT ?? 18111);
const messagePort = Number(process.env.VERIFY_MESSAGE_PORT ?? 18112);

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: repoRoot,
    stdio: "inherit",
    shell: false,
    ...options,
  });

  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} failed with exit code ${result.status}`);
  }
}

function archiveName(platform) {
  const ext = platform === "win32" ? "zip" : "tar.gz";
  return `lasso-totaljs-flow-${serviceVersion}-${platform}.${ext}`;
}

async function extractArchive(archivePath, destination) {
  await rm(destination, { recursive: true, force: true });
  await mkdir(destination, { recursive: true });

  if (archivePath.endsWith(".zip")) {
    run("powershell", [
      "-NoLogo",
      "-NoProfile",
      "-Command",
      `Expand-Archive -Path ${JSON.stringify(archivePath)} -DestinationPath ${JSON.stringify(destination)} -Force`,
    ]);
    return;
  }

  run("tar", ["-xzf", archivePath, "-C", destination]);
}

function requestStatus(url) {
  return new Promise((resolve, reject) => {
    const request = http.get(url, (response) => {
      response.resume();
      resolve(response.statusCode);
    });
    request.on("error", reject);
    request.setTimeout(1000, () => {
      request.destroy(new Error("timeout"));
    });
  });
}

async function waitForHealth(url, expectedStatus) {
  const deadline = Date.now() + 60_000;
  let lastError;

  while (Date.now() < deadline) {
    try {
      const status = await requestStatus(url);
      if (status === expectedStatus) {
        return;
      }
      lastError = new Error(`expected ${expectedStatus}, got ${status}`);
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  throw lastError ?? new Error("healthcheck timed out");
}

const archivePath = await packageFlow(targetPlatform, serviceVersion);
const expectedArchive = path.join(repoRoot, "dist", archiveName(targetPlatform));
if (archivePath !== expectedArchive || !existsSync(expectedArchive)) {
  throw new Error(`expected archive was not created: ${expectedArchive}`);
}

const extractRoot = path.join(repoRoot, "output", "verify", targetPlatform);
await extractArchive(expectedArchive, extractRoot);

const child = spawn(process.execPath, [path.join(extractRoot, "lasso-totaljs-flow.mjs")], {
  cwd: extractRoot,
  env: {
    ...process.env,
    SERVICE_PORT: String(verifyPort),
    FLOW_PORT: String(verifyPort),
    FLOW_HOST_URL: `http://127.0.0.1:${verifyPort}`,
    MESSAGESERVICE_PORT: String(messagePort),
    MESSAGESERVICE_URL: `http://127.0.0.1:${messagePort}`,
  },
  stdio: "inherit",
});

try {
  await waitForHealth(`http://127.0.0.1:${verifyPort}/`, 200);
  console.log(`[lasso-totaljs-flow] verified healthcheck on port ${verifyPort}`);
} finally {
  child.kill("SIGTERM");
}
