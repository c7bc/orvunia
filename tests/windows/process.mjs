import { spawn } from "node:child_process";
export function isolatedEnvironment(environment) {
  const allowed = new Set(["path", "pathext", "systemroot", "systemdrive", "windir", "comspec", "userprofile", "localappdata",
    "appdata", "temp", "tmp", "programfiles", "programfiles(x86)", "programdata", "homedrive", "homepath", "allusersprofile",
    "number_of_processors", "processor_architecture", "github_actions", "github_repository", "github_run_id", "github_run_attempt",
    "github_sha", "runner_environment", "runner_os", "runner_temp"]);
  return { ...Object.fromEntries(Object.entries(environment).filter(([key]) => allowed.has(key.toLowerCase()))),
    CI: "true", CSC_IDENTITY_AUTO_DISCOVERY: "false", ELECTRON_BUILDER_COMPRESSION_LEVEL: "5", PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD: "1" };
}
export async function run(executable, args, { cwd, timeout = 240000 } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(executable, args, { cwd, env: isolatedEnvironment(process.env), windowsHide: true, stdio: "inherit" });
    const timer = setTimeout(() => { child.kill(); reject(Error("Owned QA process timed out; descendant cleanup unconfirmed, discard runner")); }, timeout);
    child.once("error", error => { clearTimeout(timer); reject(error); });
    child.once("exit", code => { clearTimeout(timer); code === 0 ? resolve() : reject(Error(`QA process exited ${code}`)); });
  });
}
