export async function releaseShell(application, interception, completed, step) {
  if (completed !== true) return "rejection-retained-until-process-exit";
  await step("restore-shell", () => application.evaluate(({ shell }, value) => {
    if (shell.openExternal !== value.rejected) throw Error("Unexpected shell adapter mutation");
    shell.openExternal = value.original;
  }, interception), 5000);
  return "restored-after-successful-settled-flow";
}
