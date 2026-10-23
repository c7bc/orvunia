import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { clientScreen } from "./electron-dom.ts";
import type { ClientContents } from "./electron-dom.ts";

export async function verifyDesktopClient(contents: ClientContents) {
  const { evaluate, wait } = clientScreen(contents);
  await wait(".welcome-introduction");
  assert.equal(
    await evaluate(
      `document.querySelector('#app').textContent.includes('Cadence')`,
    ),
    true,
  );
  const completed = await evaluate(
    `fetch('/api/onboarding',{method:'PUT',headers:{'content-type':'application/json'},body:JSON.stringify({version:1,completed:true,skipped:true,persona:'job',mode:'technical',goal:'Synthetic desktop verification',experience:'3–5',output:'pt-BR',code:'TypeScript',tutorialComplete:false})}).then(response=>response.status)`,
  );
  assert.equal(completed, 200);
}

export async function verifyDesktopPanel(contents: ClientContents) {
  const { evaluate, wait, click } = clientScreen(contents);
  await wait(".dashboard-window");
  assert.equal(
    await evaluate(
      `document.querySelector('.dashboard-window').textContent.includes('Cadence')`,
    ),
    true,
  );
  assert.equal(
    await evaluate(
      `document.querySelector('[data-action="account-menu"]') !== null`,
    ),
    true,
  );
  const payload = (await evaluate(
    `fetch('/api/bootstrap?compact=1').then(response=>response.json()).then(value=>({sessions:value.sessions.length,workspace:value.workspaceId}))`,
  )) as { sessions: number; workspace: string };
  assert.equal(payload.sessions, 0);
  assert.equal(
    payload.workspace,
    createHash("sha256")
      .update(process.env.CADENCE_LOCAL_WORKSPACE!)
      .digest("hex")
      .slice(0, 24),
  );
  await click('[data-action="account-menu"]');
  await click('[data-page="settings"]');
  await wait(".settings-dialog");
  for (const tab of [
    "general",
    "calendar",
    "shortcuts",
    "profile",
    "security",
    "language",
    "billing",
  ]) {
    await click(`[data-settings-tab="${tab}"]`);
    await wait(`[data-settings-view="${tab}"]`);
    assert.equal(
      await evaluate(
        `document.querySelector('[data-settings-view="${tab}"]').textContent.trim().length>0`,
      ),
      true,
    );
  }
  await click('[data-action="dialog-close"]');
  await wait(".dashboard-home");
}
