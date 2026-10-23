import assert from "node:assert/strict";
import { clientScreen } from "./electron-dom.ts";
import type { ClientContents } from "./electron-dom.ts";
export async function verifyDesktopModes(
  contents: ClientContents,
  panel: () => Promise<void>,
) {
  const { evaluate, wait, click } = clientScreen(contents);
  for (const mode of ["technical", "recruiter"]) {
    assert.equal(
      await evaluate(
        `fetch('/api/modes/${mode}/activate',{method:'POST'}).then(response=>response.status)`,
      ),
      200,
    );
    await panel();
    await wait('[data-action="quick-start"]');
    await click('[data-action="quick-start"]');
    await wait(".overlay-shell #question");
    assert.equal(
      await evaluate(
        `document.querySelector('[data-action="coding-context"]') !== null`,
      ),
      mode === "technical",
    );
    await click('[data-action="overlay-more"]');
    await click('[data-tab="transcripts"]');
    await wait("#transcript-form");
    await evaluate(
      `(()=>{const form=document.querySelector('#transcript-form');form.querySelector('textarea').value='Synthetic ${mode} transcript';form.requestSubmit();})()`,
    );
    await wait(".transcript-line p");
    assert.equal(
      await evaluate(
        `document.querySelector('#transcript-lines').textContent.includes('Synthetic ${mode} transcript')`,
      ),
      true,
    );
    await click('[data-action="overlay-more"]');
    await click('[data-action="end"]');
    await wait(".dashboard-home");
  }
  const rows = (await evaluate(
    `fetch('/api/bootstrap').then(response=>response.json()).then(value=>value.sessions.map(session=>({mode:session.mode,state:session.state,transcripts:session.transcripts.map(item=>item.text)})))`,
  )) as { mode: string; state: string; transcripts: string[] }[];
  assert.equal(rows.length, 2);
  for (const row of rows) {
    assert.equal(row.state, "ended");
    assert.deepEqual(row.transcripts, [`Synthetic ${row.mode} transcript`]);
  }
}
