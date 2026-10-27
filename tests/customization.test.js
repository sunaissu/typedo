import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_SETTINGS, emptyProgress, validateProgress } from '../src/storage.js';
import { generateText, createSession, enterKey, tick } from '../src/typing.js';
import { workspaceKey, createWorkspaceDraft, sanitizeWorkspaceDrafts } from '../src/workspaceDrafts.js';
test('capitalization, punctuation, numbers and symbols are independent', () => {
 for (const key of ['capitalization','punctuation','numbers','symbols']) {
  const text=generateText({...DEFAULT_SETTINGS,mode:'words',wordCount:25,[key]:true}, {},()=>0.2);
  assert.equal(/[A-Z]/.test(text), key==='capitalization');
  assert.equal(/[.,]/.test(text), key==='punctuation');
  assert.equal(/[0-9]/.test(text), key==='numbers');
  assert.equal(/[@#$%&*+=]/.test(text), key==='symbols');
 }
});
test('custom targets survive validation and reject invalid bounds',()=>{
 const p=emptyProgress();Object.assign(p.settings,{duration:75,wordCount:123,capitalization:true,symbols:true});
 assert.equal(validateProgress(p).settings.duration,75);assert.equal(validateProgress(p).settings.wordCount,123);
 for(const duration of [0,14,901,NaN,Infinity,30.5,'75']) {p.settings.duration=duration;assert.equal(validateProgress(p).settings.duration,30);}
});
test('legacy capitalization and drafts keep their meaning and category',()=>{
 const p=emptyProgress();delete p.settings.capitalization;p.settings.punctuation=true;
 assert.equal(validateProgress(p).settings.capitalization,true);
 const config={...DEFAULT_SETTINGS,duration:75,capitalization:true,symbols:true};
 let session={...createSession(generateText(config)),runId:'custom-test'};
 session=enterKey(session,session.text[0],config,1000);
 const draft=createWorkspaceDraft(session,config);
 assert.ok(sanitizeWorkspaceDrafts({[workspaceKey(config)]:draft})[workspaceKey(config)]);
 assert.equal(tick(session,config,76000).status,'finished');
 assert.notEqual(workspaceKey(config),workspaceKey({...config,capitalization:false}));
 const old={...DEFAULT_SETTINGS,punctuation:true};delete old.capitalization;delete old.symbols;
 assert.equal(workspaceKey(old),workspaceKey({...old,capitalization:true,symbols:false}));
});
