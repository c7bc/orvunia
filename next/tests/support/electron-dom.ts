export type ClientContents = {
  executeJavaScript(script: string): Promise<unknown>;
};
export function clientScreen(contents: ClientContents) {
  const evaluate = (script: string) => contents.executeJavaScript(script);
  return {
    evaluate,
    click(selector: string) {
      return evaluate(
        `(()=>{const node=document.querySelector(${JSON.stringify(selector)});if(!node)throw Error('Missing desktop control');node.click();})()`,
      );
    },
    wait(selector: string) {
      return evaluate(`new Promise((resolve,reject)=>{
      const deadline=Date.now()+8000;
      function check(){
        if(document.querySelector(${JSON.stringify(selector)}))return resolve(true);
        if(document.querySelector('.boot h2'))return reject(Error('Desktop startup failed'));
        if(Date.now()>deadline)return reject(Error('Desktop state timed out: '+${JSON.stringify(selector)}+'; '+(document.querySelector('#toast')?.textContent||'No client error')));
        setTimeout(check,25);
      }
      check();
    })`);
    },
  };
}
