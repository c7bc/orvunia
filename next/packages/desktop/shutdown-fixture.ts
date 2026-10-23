type FixtureContents = {
  executeJavaScript(script: string): Promise<unknown>;
  send(channel: string, value: unknown): void;
  reload(): void;
};
export async function prepareShutdownFixture(contents: FixtureContents) {
  const completed = await contents.executeJavaScript(
    `fetch('/api/onboarding',{method:'PUT',headers:{'content-type':'application/json'},body:JSON.stringify({version:1,completed:true,skipped:true,persona:'job',mode:'technical',goal:'Synthetic shutdown verification',experience:'3–5',output:'pt-BR',code:'TypeScript',tutorialComplete:false})}).then(response=>response.status)`,
  );
  if (completed !== 200) throw Error("Synthetic shutdown onboarding failed");
  contents.reload();
  async function wait(expression: string) {
    await contents.executeJavaScript(`new Promise((resolve,reject)=>{
      const until=Date.now()+8000;
      function inspect(){
        if(${expression})return resolve(true);
        if(Date.now()>until)return reject(Error('Synthetic shutdown view timed out: '+${JSON.stringify(expression)}));
        setTimeout(inspect,20);
      }inspect();
    })`);
  }
  await wait("document.querySelector('.dashboard-home')");
  const session = await contents.executeJavaScript(
    `fetch('/api/sessions',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({mode:'recruiter',title:'Synthetic shutdown original'})}).then(async response=>{if(!response.ok)throw Error('Synthetic shutdown conversation failed');return (await response.json()).id;})`,
  );
  if (typeof session !== "string" || !/^[a-f0-9-]{36}$/i.test(session))
    throw Error("Invalid synthetic shutdown conversation");
  const ended = await contents.executeJavaScript(`fetch('/api/sessions/${session}',{method:'PATCH',headers:{'content-type':'application/json'},body:JSON.stringify({state:'ended'})}).then(response=>response.status)`);
  if(ended !== 200)throw Error("Synthetic shutdown conversation could not end");
  contents.send("cadence:event", { type: "navigate", data: "home" });
  const selector = JSON.stringify(`[data-session="${session}"]`);
  await wait(`document.querySelector(${selector})`);
  await contents.executeJavaScript(
    `document.querySelector(${selector}).click()`,
  );
  await wait(
    "document.querySelector('textarea[data-session-notes]')?.getAttribute('aria-busy') === 'false'",
  );
  await contents.executeJavaScript(`(()=>{
    const title=document.querySelector('input[data-session-title]');
    const notes=document.querySelector('textarea[data-session-notes]');
    title.value='Synthetic shutdown saved title';
    notes.value='Synthetic shutdown saved notes';
    notes.dispatchEvent(new Event('input',{bubbles:true}));
  })()`);
  return session;
}
