#!/usr/bin/env node
/**
 * FairGig monorepo bootstrap:
 *   - installs Python deps for auth / earnings / anomaly / analytics
 *   - installs Node deps for grievance / certificate / frontend
 *   - seeds demo data
 *
 * Usage: `npm run setup` from repo root.
 */
const { spawnSync } = require("node:child_process");
const path = require("node:path");
const fs = require("node:fs");

const ROOT = path.resolve(__dirname, "..");
const isWin = process.platform === "win32";
const PY = process.env.PYTHON || (isWin ? "python" : "python3");

function run(cmd, args, opts = {}) {
  console.log(`\n> ${cmd} ${args.join(" ")}  (cwd: ${opts.cwd || ROOT})`);
  const r = spawnSync(cmd, args, { stdio: "inherit", shell: isWin, ...opts });
  if (r.status !== 0) {
    console.error(`Command failed: ${cmd} ${args.join(" ")}`);
    process.exit(r.status || 1);
  }
}

const pyServices = ["auth", "earnings", "anomaly", "analytics"];
for (const svc of pyServices) {
  const cwd = path.join(ROOT, "services", svc);
  if (!fs.existsSync(path.join(cwd, "requirements.txt"))) continue;
  run(PY, ["-m", "pip", "install", "-q", "-r", "requirements.txt"], { cwd });
}

const nodeProjects = [
  ["services/grievance", ["install"]],
  ["services/certificate", ["install"]],
  ["frontend", ["install"]],
  [".", ["install"]],
];
for (const [rel, args] of nodeProjects) {
  run("npm", args, { cwd: path.join(ROOT, rel) });
}

console.log("\n> Seeding demo data ...");
run(PY, [path.join("seed", "seed.py")], { cwd: ROOT });

console.log("\nSetup complete. Run `npm run dev` to start all services.\n");
