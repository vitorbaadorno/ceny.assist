# Testes executados, reprodução e plano de validação

Referências E01–E28: [catálogo de evidências](<C:/Users/games/Documents/ChatGPT/Ceny - Programa/docs/auditoria-ceny/02-auditoria-tecnica.md>). Para escopo e limites, consulte o [resumo executivo](<C:/Users/games/Documents/ChatGPT/Ceny - Programa/docs/auditoria-ceny/00-resumo-executivo.md>).

## Resultado efetivo em 23/10/2026

47 verificações isoladas, 47 comportamentos confirmados, zero falhas do harness. Parte das verificações **confirma defeitos**, não aprovação de produto. Nenhuma gravação em banco remoto, storage ou chamada de IA real ocorreu. Somente dados sintéticos em memória; nenhum currículo pessoal lido.

Node v24.19.0, PowerShell, diretório de origem D:/Projetos/Ceny/ceny.assist-main. Código TypeScript puro foi importado pelo suporte nativo do Node. Para handlers, stripTypeScriptTypes remove tipos em memória; imports são substituídos por adaptadores instrumentados. Para upload, extrai-se somente o corpo de handleFiles. Nenhum arquivo TypeScript original foi editado.

### Alcance dos testes

- scoreCandidate e funções de idade: execução direta do arquivo original, sem mock da regra.
- callAiJson: execução direta do helper, com fetch substituído por respostas sintéticas em memória e chave fictícia do processo de teste. Não carrega .env.
- processResume, rankJobCandidates e archiveCandidate: corpo original com createServerFn/serviços simulados; validam orquestração e tratamento de falhas, **não** banco/RLS/transação real.
- handleFiles: corpo original, com React state, storage e extração simulados; não prova comportamento DOM/seletor de arquivos.
- requireSupabaseAuth: mocks de request/cliente/getClaims; não prova validação criptográfica real, expiração ou revogação.
- inputValidator dos handlers é ignorado pelo adaptador; Zod não foi exercitado. Middleware da aplicação não é exercitado pelos testes dos handlers.
- Testes de defeito usam assert do comportamento atual para provar reprodução. Na implementação futura, criar testes de regressão com o comportamento esperado corrigido.

## Resultado por verificação

| ID | Categoria | Comportamento confirmado |
|---|---|---|
| S01 | controle | Match literal = 100 |
| S02 | controle | Normaliza caixa/acentos |
| S03 | defeito | JavaScript satisfaz Java = 100 |
| S04 | defeito | Negação satisfaz Excel = 100 |
| S05 | defeito | Nome do candidato satisfaz habilidade = 100 |
| S06 | defeito | Sinônimo JS não reconhecido = 45 |
| S07 | defeito | Candidato vazio e vaga vazia = 100 |
| S08 | limitação | Nenhuma evidência do único obrigatório ainda dá 45 |
| S09 | defeito | Cidade vazia atende Recife |
| S10 | controle | Cidade nula não atende Recife |
| S11 | defeito | Ensino médio incompleto atende ensino médio |
| S12 | defeito | Duplicar requisito atendido sobe 73 para 82 |
| S13 | defeito | Nome da chave JSON atende requisito email |
| S14 | controle | Experiência proporcional gera 5/10 pontos |
| S15 | controle | Mesmo input produz mesmo resultado |
| A01 | controle | Aniversário calculado corretamente |
| A02 | controle | Limite de 14 anos do código |
| A03 | regra a revisar | Inclui idade 24, exclui 25 |
| A04 | defeito | Nascimento ausente exclui em vez de indicar revisão |
| A05 | defeito | Data inválida 2000-99-99 aceita, retorna 25 |
| A06 | controle | Data futura devolve null |
| I01 | controle | SSE delta normal é interpretado |
| I02 | controle | Chunks de transporte divididos são recombinados |
| I03 | defeito | JSON fora do schema aceito sem validação local |
| I04 | defeito | Evento response.failed após JSON é ignorado |
| I05 | robustez | Fim de stream sem newline perde buffer final (stream truncado) |
| I06 | controle | 429 tem mensagem amigável |
| I07 | controle | 402 tem mensagem amigável |
| I08 | controle | JSON inválido rejeitado |
| I09 | defeito | null aceito apesar do schema objeto |
| I10 | controle | Chave ausente falha antes de fetch |
| R01 | defeito | Erro e revisão manual são ranqueados; vaga sem critérios dá 100 |
| R02 | defeito | Ranking anterior apagado antes de falhar gravação do novo |
| D01 | defeito | Arquivo removido mesmo quando arquivamento falha depois |
| P01 | controle | Extração sintética válida persiste os campos esperados em mock |
| P02 | defeito | Campo incerto não impõe revisão quando confiança alta e contato presente |
| P03 | limitação | Confiança abaixo de 0.6 impõe revisão |
| P04 | defeito | Reprocessamento sobrescreve correções e não marca processando no início |
| P05 | controle | Arquivo vazio marca erro em mock |
| U01 | defeito | Upload seguido de falha no cadastro não remove arquivo órfão |
| U02 | defeito | Lote com 100% de erro ainda dispara toast.success |
| U03 | defeito | Handler envia arquivo de tipo arbitrário e tamanho 1 GiB (metadados simulados) |
| U04 | controle | Dois arquivos processados sequencialmente em mock |
| H01 | controle | Sem Bearer é rejeitado antes do cliente |
| H02 | controle | Token malformado é rejeitado |
| H03 | controle | Erro de verificação de claims é rejeitado (mock) |
| H04 | controle | Claims válidos propagam userId e Bearer em mock; empresa/papel não verificados |

## Comandos e resultados relevantes

| Comando/verificação | Resultado |
|---|---|
| Get-Content de objetivos, AGENTS, rotas, serviços, configurações e migrações; rg --files/rg -n | Inventário e análise estática; seis migrações lidas em ordem |
| git status --short / git remote -v no workspace, antes da auditoria | Sem arquivos de aplicação e sem remote configurado |
| git ls-remote https://github.com/vitorbaadorno/ceny.assist HEAD refs/heads/main | HEAD/main: 58df482099e187f25ef2c154789321df8b0b1815; não comparado ao snapshot |
| node --version / npm --version | v24.19.0 / 11.17.0 |
| Test-Path node_modules na origem | False |
| npm run build na origem | Não iniciou compilação: vite não reconhecido |
| npm run lint na origem | Não iniciou análise: eslint não reconhecido |
| npm run test --if-present | Nenhum teste executado; script test ausente |
| npm list --global --depth=0 | Não fornece Vite/ESLint para esse projeto; não usado como instalação de dependências |
| Harness inicial via stdin | 39 verificações confirmadas |
| Harness ampliado abaixo via stdin | 47 verificações confirmadas; 8 adicionais de upload/autenticação |
| SHA-256 de todos os arquivos da origem antes/depois | 108 originais, 108 finais, zero alterados e zero removidos |
| git status --short ao gerar relatório | Somente docs/ como não rastreado |
| Consulta pública a Planalto/MTE | Referências de LGPD/aprendizagem, sem acesso a sistemas da Ceny |

Não se executou instalação, formatter, migração, push, commit, npm audit, browser E2E ou teste contra produção. Também não se executou tsc com dependências resolvidas. A impossibilidade de build/lint é uma limitação do ambiente recebido, não diagnóstico de erro de compilação no código.

## Como reproduzir sem modificar a aplicação

Usar Node com suporte a TypeScript equivalente ao v24.19.0 e ajustar CENY_AUDIT_SOURCE somente se o snapshot mudar de local. O bloco JavaScript abaixo é o harness executado. Este comando PowerShell lê o bloco do Markdown e o envia ao Node, sem criar scripts na origem:

```powershell
$auditReport = Get-Content -Raw -LiteralPath 'C:/Users/games/Documents/ChatGPT/Ceny - Programa/docs/auditoria-ceny/10-plano-de-testes.md'
$auditScript = [regex]::Match($auditReport, '(?s)```javascript\r?\n(.*?)\r?\n```').Groups[1].Value
$auditScript | node --input-type=module -
```

O harness modifica variáveis/fetch somente dentro do processo filho e restaura os valores ao final de cada grupo. Não utiliza credenciais do arquivo .env nem abre conexões externas. O aviso experimental de stripTypeScriptTypes é esperado.

```javascript
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { stripTypeScriptTypes } from 'node:module';
const root = process.env.CENY_AUDIT_SOURCE || 'D:/Projetos/Ceny/ceny.assist-main';
const {scoreCandidate:score}=await import(pathToFileURL(path.join(root,'src/lib/scoring.ts')));
const {calculateAge:age,isYoungApprenticeEligible:eligible}=await import(pathToFileURL(path.join(root,'src/lib/age.ts')));
let passed=0,failed=0;
const results=[];
async function test(id,kind,fn){try{const detail=await fn();passed++;results.push({id,kind,result:'confirmado',detail});}catch(e){failed++;results.push({id,kind,result:'falhou',detail:e.message});}}
await test('S01','controle',()=>{assert.equal(score({skills:['Excel']},{requisitos_obrigatorios:['Excel']}).score,100);return 'Match literal = 100';});
await test('S02','controle',()=>{assert.equal(score({skills:['INGLÊS']},{requisitos_obrigatorios:['ingles']}).score,100);return 'Normaliza caixa/acentos';});
await test('S03','defeito',()=>{assert.equal(score({skills:['JavaScript']},{requisitos_obrigatorios:['Java']}).score,100);return 'JavaScript satisfaz Java = 100';});
await test('S04','defeito',()=>{assert.equal(score({dados_extraidos:{experiencias:[{descricao:'Não possui experiência com Excel'}]}},{requisitos_obrigatorios:['Excel']}).score,100);return 'Negação satisfaz Excel = 100';});
await test('S05','defeito',()=>{assert.equal(score({dados_extraidos:{nome_completo:'Ana Java'}},{requisitos_obrigatorios:['Java']}).score,100);return 'Nome do candidato satisfaz habilidade = 100';});
await test('S06','defeito',()=>{assert.equal(score({skills:['JS']},{requisitos_obrigatorios:['JavaScript']}).score,45);return 'Sinônimo JS não reconhecido = 45';});
await test('S07','defeito',()=>{assert.equal(score({},{}).score,100);return 'Candidato vazio e vaga vazia = 100';});
await test('S08','limitação',()=>{assert.equal(score({},{requisitos_obrigatorios:['Excel']}).score,45);return 'Nenhuma evidência do único obrigatório ainda dá 45';});
await test('S09','defeito',()=>{assert.equal(score({localizacao:''},{localizacao:'Recife'}).details.localizacao_ok,true);return 'Cidade vazia atende Recife';});
await test('S10','controle',()=>{assert.equal(score({localizacao:null},{localizacao:'Recife'}).details.localizacao_ok,false);return 'Cidade nula não atende Recife';});
await test('S11','defeito',()=>{assert.equal(score({dados_extraidos:{formacao_academica:[{curso:'Ensino médio incompleto'}]}},{formacao_exigida:'Ensino médio'}).details.formacao_ok,true);return 'Ensino médio incompleto atende ensino médio';});
await test('S12','defeito',()=>{const a=score({skills:['Excel']},{requisitos_obrigatorios:['Excel','SAP']}).score;const b=score({skills:['Excel']},{requisitos_obrigatorios:['Excel','Excel','SAP']}).score;assert.equal(a,73);assert.equal(b,82);return 'Duplicar requisito atendido sobe 73 para 82';});
await test('S13','defeito',()=>{const r=score({dados_extraidos:{email:'nao-informado'}},{requisitos_obrigatorios:['email']});assert.equal(r.details.obrigatorios_atendidos.length,1);return 'Nome da chave JSON atende requisito email';});
await test('S14','controle',()=>{const r=score({anos_experiencia:2},{experiencia_minima:4});assert.equal(r.score,95);return 'Experiência proporcional gera 5/10 pontos';});
await test('S15','controle',()=>{const c={skills:['Excel']},j={requisitos_obrigatorios:['Excel','SAP']};assert.deepEqual(score(c,j),score(c,j));return 'Mesmo input produz mesmo resultado';});
const today=new Date(2026,9,23,12);
await test('A01','controle',()=>{assert.equal(age('2008-10-24',today),17);assert.equal(age('2008-10-23',today),18);return 'Aniversário calculado corretamente';});
await test('A02','controle',()=>{assert.equal(eligible('2012-10-24',today),false);assert.equal(eligible('2012-10-23',today),true);return 'Limite de 14 anos do código';});
await test('A03','regra a revisar',()=>{assert.equal(eligible('2002-10-23',today),true);assert.equal(eligible('2001-10-23',today),false);return 'Inclui idade 24, exclui 25';});
await test('A04','defeito',()=>{assert.equal(eligible(null,today),false);return 'Nascimento ausente exclui em vez de indicar revisão';});
await test('A05','defeito',()=>{assert.equal(age('2000-99-99',today),25);return 'Data inválida 2000-99-99 aceita, retorna 25';});
await test('A06','controle',()=>{assert.equal(age('2030-01-01',today),null);return 'Data futura devolve null';});
const {callAiJson}=await import(pathToFileURL(path.join(root,'src/lib/ai.server.ts')));
const originalFetch=globalThis.fetch;
const originalKey=process.env.LOVABLE_API_KEY;
const aiOpts={instructions:'Somente teste sintético',parts:[],schemaName:'test',schema:{type:'object',required:['nome'],properties:{nome:{type:'string'}},additionalProperties:false}};
let fetchCalls=0;
function mockStream(parts,status=200){globalThis.fetch=async()=>{fetchCalls++;return new Response(new ReadableStream({start(c){for(const p of parts)c.enqueue(new TextEncoder().encode(p));c.close();}}),{status});};}
const event=(type,rest)=>'data: '+JSON.stringify({type,...rest})+'\n\n';
process.env.LOVABLE_API_KEY='synthetic-test-key-not-a-credential';
try{
await test('I01','controle',async()=>{mockStream([event('response.output_text.delta',{delta:'{"nome":"Teste"}'})]);assert.deepEqual(await callAiJson(aiOpts),{nome:'Teste'});return 'SSE delta normal é interpretado';});
await test('I02','controle',async()=>{const e=event('response.output_text.delta',{delta:'{"nome":"Teste"}'});mockStream([e.slice(0,9),e.slice(9,25),e.slice(25)]);assert.deepEqual(await callAiJson(aiOpts),{nome:'Teste'});return 'Chunks de transporte divididos são recombinados';});
await test('I03','defeito',async()=>{mockStream([event('response.output_text.delta',{delta:'{"campo_indevido":42}'})]);assert.deepEqual(await callAiJson(aiOpts),{campo_indevido:42});return 'JSON fora do schema aceito sem validação local';});
await test('I04','defeito',async()=>{mockStream([event('response.output_text.delta',{delta:'{"nome":"Teste"}'}),event('response.failed',{error:{message:'synthetic failure'}})]);assert.deepEqual(await callAiJson(aiOpts),{nome:'Teste'});return 'Evento response.failed após JSON é ignorado';});
await test('I05','robustez',async()=>{mockStream(['data: '+JSON.stringify({type:'response.output_text.delta',delta:'{"nome":"Teste"}'})]);await assert.rejects(()=>callAiJson(aiOpts),/não retornou dados/);return 'Fim de stream sem newline perde buffer final (stream truncado)';});
await test('I06','controle',async()=>{mockStream(['limite'],429);await assert.rejects(()=>callAiJson(aiOpts),/Muitas solicitações/);return '429 tem mensagem amigável';});
await test('I07','controle',async()=>{mockStream(['saldo'],402);await assert.rejects(()=>callAiJson(aiOpts),/créditos de IA acabaram/);return '402 tem mensagem amigável';});
await test('I08','controle',async()=>{mockStream([event('response.output_text.delta',{delta:'not json'})]);await assert.rejects(()=>callAiJson(aiOpts),SyntaxError);return 'JSON inválido rejeitado';});
await test('I09','defeito',async()=>{mockStream([event('response.output_text.delta',{delta:'null'})]);assert.equal(await callAiJson(aiOpts),null);return 'null aceito apesar do schema objeto';});
await test('I10','controle',async()=>{delete process.env.LOVABLE_API_KEY;const before=fetchCalls;await assert.rejects(()=>callAiJson(aiOpts),/não configurado/);assert.equal(fetchCalls,before);return 'Chave ausente falha antes de fetch';});
}finally{globalThis.fetch=originalFetch;if(originalKey===undefined)delete process.env.LOVABLE_API_KEY;else process.env.LOVABLE_API_KEY=originalKey;}
function loadHandlers(file,names,extra={}){
 const builder=()=>({middleware(){return this},inputValidator(){return this},handler(fn){return fn}});
 const source=stripTypeScriptTypes(fs.readFileSync(path.join(root,file),'utf8')).replace(/^import[^\n]*\n/gm,'').replace(/\bexport /g,'');
 const dependencies={createServerFn:builder,requireSupabaseAuth:{},scoreCandidate:score,isYoungApprenticeEligible:eligible,...extra};
 return new Function(...Object.keys(dependencies),source+'\nreturn {'+names.join(',')+'};')(...Object.values(dependencies));
}
function mockDb(responder){
 const calls=[];
 const make=(table)=>{const call={table,steps:[]};const chain=new Proxy({}, {get(_t,prop){if(prop==='then')return (resolve,reject)=>{calls.push(call);return Promise.resolve().then(()=>responder(call)).then(resolve,reject)};return(...args)=>{call.steps.push([prop,...args]);return chain}}});return chain;};
 return {calls,from:make,storage:{from(bucket){return{download(p){calls.push({download:p,bucket});return Promise.resolve(responder({download:p,bucket}))},remove(p){calls.push({remove:p,bucket});return Promise.resolve(responder({remove:p,bucket}))},createSignedUrl(p,s){calls.push({signed:p,s});return Promise.resolve(responder({signed:p,s}))}}}},rpc(name,args){calls.push({rpc:name,args});return Promise.resolve(responder({rpc:name,args}))}};
}
const {rankJobCandidates:rank}=loadHandlers('src/lib/scoring.functions.ts',['rankJobCandidates']);
await test('R01','defeito',async()=>{let rows;const db=mockDb(c=>{if(c.table==='jobs')return{data:{id:'job',categoria:'regular'},error:null};if(c.table==='candidates'){assert.deepEqual(c.steps.find(s=>s[0]==='neq'),['neq','processing_status','processando']);return{data:[{id:'erro',processing_status:'erro'},{id:'review',processing_status:'revisao_manual'}],error:null};}const u=c.steps.find(s=>s[0]==='upsert');if(u)rows=u[1];return{error:null};});assert.equal((await rank({data:{jobId:'job'},context:{supabase:db}})).count,2);assert.equal(rows[0].score,100);return 'Erro e revisão manual são ranqueados; vaga sem critérios dá 100';});
await test('R02','defeito',async()=>{let deleted=false;const db=mockDb(c=>{if(c.table==='jobs')return{data:{id:'job'},error:null};if(c.table==='candidates')return{data:[{id:'c'}],error:null};if(c.steps.some(s=>s[0]==='delete')){deleted=true;return{error:null}}return{error:{message:'synthetic upsert failure'}};});await assert.rejects(()=>rank({data:{jobId:'job'},context:{supabase:db}}),/upsert failure/);assert.equal(deleted,true);return 'Ranking anterior apagado antes de falhar gravação do novo';});
const {archiveCandidate:archive}=loadHandlers('src/lib/records.functions.ts',['archiveCandidate']);
await test('D01','defeito',async()=>{let removed=false;const db=mockDb(c=>{if(c.remove){removed=true;return{error:null}}if(c.rpc)return{error:{message:'synthetic rpc failure'}};if(c.steps.some(s=>s[0]==='select'))return{data:{id:'c',arquivo_original_path:'synthetic.pdf'},error:null};return{error:null};});await assert.rejects(()=>archive({data:{candidateId:'c'},context:{supabase:db}}),/rpc failure/);assert.equal(removed,true);return 'Arquivo removido mesmo quando arquivamento falha depois';});
const extraction={nome_completo:'Teste',email:'teste@example.invalid',telefone:null,data_nascimento:null,localizacao:'Cidade extraída',skills:['Excel'],formacao_academica:[],experiencias:[],idiomas:[],certificacoes:[],anos_experiencia_total:1,confianca:0.9,campos_incertos:[]};
const {processResume:processResume}=loadHandlers('src/lib/resumes.functions.ts',['processResume'],{callAiJson:async()=>extraction});
await test('P01','controle',async()=>{let patch;const db=mockDb(c=>{if(c.download)return{data:new Blob(['synthetic'],{type:'application/pdf'}),error:null};const u=c.steps.find(s=>s[0]==='update');if(u){patch=u[1];return{error:null}}return{data:{id:'c',arquivo_original_path:'synthetic.pdf',arquivo_nome:'synthetic.pdf'},error:null};});assert.equal((await processResume({data:{candidateId:'c'},context:{supabase:db}})).status,'concluido');assert.equal(patch.skills[0],'Excel');return 'Extração sintética válida persiste os campos esperados em mock';});
await test('P02','defeito',async()=>{extraction.campos_incertos=['telefone'];const db=mockDb(c=>c.download?{data:new Blob(['x']),error:null}:c.steps.some(s=>s[0]==='update')?{error:null}:{data:{id:'c',arquivo_original_path:'x'},error:null});assert.equal((await processResume({data:{candidateId:'c'},context:{supabase:db}})).status,'concluido');return 'Campo incerto não impõe revisão quando confiança alta e contato presente';});
await test('P03','limitação',async()=>{extraction.confianca=0.5;const db=mockDb(c=>c.download?{data:new Blob(['x']),error:null}:c.steps.some(s=>s[0]==='update')?{error:null}:{data:{id:'c',arquivo_original_path:'x'},error:null});assert.equal((await processResume({data:{candidateId:'c'},context:{supabase:db}})).status,'revisao_manual');return 'Confiança abaixo de 0.6 impõe revisão';extraction.confianca=0.9;});
await test('P04','defeito',async()=>{extraction.confianca=0.9;let patch;const db=mockDb(c=>{if(c.download)return{data:new Blob(['x']),error:null};const u=c.steps.find(s=>s[0]==='update');if(u){patch=u[1];return{error:null}}return{data:{id:'c',arquivo_original_path:'x'},error:null};});await processResume({data:{candidateId:'c'},context:{supabase:db}});assert.equal(patch.localizacao,'Cidade extraída');assert.equal(patch.data_nascimento,null);assert.equal(db.calls.some(c=>c.steps?.some(s=>s[0]==='update'&&s[1].processing_status==='processando')),false);return 'Reprocessamento sobrescreve correções e não marca processando no início';});
await test('P05','controle',async()=>{let patch;const db=mockDb(c=>{if(c.download)return{data:new Blob([]),error:null};const u=c.steps.find(s=>s[0]==='update');if(u){patch=u[1];return{error:null}}return{data:{id:'c',arquivo_original_path:'x'},error:null};});await assert.rejects(()=>processResume({data:{candidateId:'c'},context:{supabase:db}}),/vazio/);assert.equal(patch.processing_status,'erro');return 'Arquivo vazio marca erro em mock';});

function uploadHandler(db,runExtraction){
 const source=fs.readFileSync(path.join(root,'src/routes/_authenticated/upload.tsx'),'utf8');
 const begin=source.indexOf('  async function handleFiles(');
 const end=source.indexOf('\n  return (',begin);
 const body=stripTypeScriptTypes(source.slice(begin,end));
 let items=[],busy=false;const notifications=[];
 const fn=new Function('supabase','runExtraction','setItems','setBusy','toast',body+'\nreturn handleFiles;')(
  db,runExtraction,x=>{items=typeof x==='function'?x(items):x},x=>{busy=x},{success:m=>notifications.push(m)});
 return{run:fn,get:()=>({items,busy,notifications})};
}
await test('U01','defeito',async()=>{let uploaded=false;const db=mockDb(()=>({data:null,error:{message:'synthetic insert failed'}}));db.storage.from=()=>({upload:async()=>{uploaded=true;return{error:null}}});const h=uploadHandler(db,async()=>({status:'concluido'}));await h.run([{name:'synthetic.pdf',type:'application/pdf'}]);assert.equal(uploaded,true);assert.equal(h.get().items[0].state,'erro');assert.equal(db.calls.some(c=>c.remove),false);return 'Upload seguido de falha no cadastro não remove arquivo órfão';});
await test('U02','defeito',async()=>{const db=mockDb(()=>({}));db.storage.from=()=>({upload:async()=>({error:{message:'synthetic failure'}})});const h=uploadHandler(db,async()=>({status:'concluido'}));await h.run([{name:'synthetic.pdf',type:'application/pdf'}]);assert.equal(h.get().items[0].state,'erro');assert.deepEqual(h.get().notifications,['Processamento concluído.']);return 'Lote com 100% de erro ainda dispara toast.success';});
await test('U03','defeito',async()=>{let sent;const db=mockDb(()=>({data:{id:'c'},error:null}));db.storage.from=()=>({upload:async(p,file)=>{sent=file;return{error:null}}});const h=uploadHandler(db,async()=>({status:'concluido'}));await h.run([{name:'synthetic.exe',type:'application/x-msdownload',size:1024**3}]);assert.equal(sent.size,1024**3);assert.equal(h.get().items[0].state,'ok');return 'Handler envia arquivo de tipo arbitrário e tamanho 1 GiB (metadados simulados)';});
await test('U04','controle',async()=>{let active=0,max=0;const db=mockDb(()=>({data:{id:'c'},error:null}));db.storage.from=()=>({upload:async()=>({error:null})});const h=uploadHandler(db,async()=>{active++;max=Math.max(max,active);await Promise.resolve();active--;return{status:'concluido'}});await h.run([{name:'a.pdf'},{name:'b.pdf'}]);assert.equal(max,1);assert.equal(h.get().items.length,2);assert.ok(h.get().items.every(i=>i.state==='ok'));return 'Dois arquivos processados sequencialmente em mock';});
function authHandler(getRequest,createClient){
const source=stripTypeScriptTypes(fs.readFileSync(path.join(root,'src/integrations/supabase/auth-middleware.ts'),'utf8')).replace(/^import[^\n]*\n/gm,'').replace(/\bexport /g,'');
return new Function('createMiddleware','getRequest','createClient',source+'\nreturn requireSupabaseAuth;')(()=>({server:f=>f}),getRequest,createClient);
}
const savedUrl=process.env.SUPABASE_URL,savedPub=process.env.SUPABASE_PUBLISHABLE_KEY;
process.env.SUPABASE_URL='https://synthetic.invalid';process.env.SUPABASE_PUBLISHABLE_KEY='sb_publishable_synthetic';
try{
await test('H01','controle',async()=>{const auth=authHandler(()=>new Request('http://local.invalid'),()=>{throw Error('unexpected client')});await assert.rejects(()=>auth({next:()=>{}}),/No authorization header/);return 'Sem Bearer é rejeitado antes do cliente';});
await test('H02','controle',async()=>{const auth=authHandler(()=>new Request('http://local.invalid',{headers:{authorization:'Bearer bad'}}),()=>{throw Error('unexpected client')});await assert.rejects(()=>auth({next:()=>{}}),/Invalid token/);return 'Token malformado é rejeitado';});
await test('H03','controle',async()=>{const auth=authHandler(()=>new Request('http://local.invalid',{headers:{authorization:'Bearer a.b.c'}}),()=>({auth:{getClaims:async()=>({data:null,error:{message:'invalid'}})}}));await assert.rejects(()=>auth({next:()=>{}}),/Invalid token/);return 'Erro de verificação de claims é rejeitado (mock)';});
await test('H04','controle',async()=>{let forwarded;const auth=authHandler(()=>new Request('http://local.invalid',{headers:{authorization:'Bearer a.b.c'}}),(_u,_k,opts)=>{forwarded=opts.global.headers.Authorization;return{auth:{getClaims:async()=>({data:{claims:{sub:'synthetic-user'}},error:null})}}});const out=await auth({next:x=>x.context.userId});assert.equal(out,'synthetic-user');assert.equal(forwarded,'Bearer a.b.c');return 'Claims válidos propagam userId e Bearer em mock; empresa/papel não verificados';});
}finally{if(savedUrl===undefined)delete process.env.SUPABASE_URL;else process.env.SUPABASE_URL=savedUrl;if(savedPub===undefined)delete process.env.SUPABASE_PUBLISHABLE_KEY;else process.env.SUPABASE_PUBLISHABLE_KEY=savedPub;}

console.log(JSON.stringify({runtime:process.version,passed,failed,results},null,2));
if(failed)process.exitCode=1;

```

## Plano restante — NÃO EXECUTADO

| Camada | Casos mínimos | Evidência necessária para aprovar |
|---|---|---|
| Build e qualidade | instalação congelada, build, lint, tsc | logs completos e versões; sem ignorar erros de tipos |
| Auth real de teste | cadastro autorizado/não autorizado, convite, confirmação, login, recuperação, link expirado, logout, revogação | E2E em ambiente isolado; nenhuma sessão residual |
| Banco/RLS | anônimo, usuário sem empresa, A/B, papéis, membership revogado, REST/RPC/storage | todos os acessos cruzados negados e próprios permitidos |
| Upload | PDF textual/escaneado, JPG/PNG, DOCX quando implementado, vazio, grande, disfarçado, duplicado, lote | conteúdo validado, erros por item, nenhuma referência/arquivo órfão |
| Extração | corpus rotulado, contato ausente, datas, sobreposição de experiência, idiomas, campos malformados | métricas e exemplos de erro por campo; sem dados inventados críticos |
| Revisão | corrigir todos os campos, conflito, salvar, concluir, reprocessar | revisão humana preservada e auditada |
| Vagas | criar, editar, fechar, duplicar requisito, invalidar análise | versão de critérios consistente |
| Matching | negação, substring, sinônimo, contexto, ausência, formação incompleta, requisitos vazios | resultados corretos com fonte e estados de evidência |
| Ranking | volume maior que página, falha de escrita, duas execuções, mudança concorrente | versão anterior mantida e nova publicada inteira |
| Exclusão | falha em cada etapa, retry, processo concorrente, eliminação de derivados | estado convergente e comprovação de limpeza autorizada |
| UI funcional | loading/erro/403/404/vazio/filtro vazio, navegação, sessão expirada, salvar cidade livre | comportamento coerente sem falso sucesso |
| Cache | A sai/B entra, troca de tenant, duas abas | nenhum dado residual visível |
| Performance | 100/1.000/10.000 candidatos sintéticos, lotes de 10/100/1.000 | p50/p95, memória, tráfego, filas e custo dentro de orçamento aprovado |
| IA adversarial | instruções dentro do currículo, contrafactuais de nome, ordem e layout | saída fundamentada, abstenção/revisão onde necessário |
| Privacidade/operação | retenção, exportação, eliminação, restore, sanitização de logs | procedimento executável e permissões preservadas |
| Dependências | scanner atualizado do lock/instalação exata e revisão de build plugins | achados atuais classificados/corrigidos, sem afirmar “sem vulnerabilidades” só por ausência de teste |

Não estabelecer SLOs ou custo por currículo como se fossem medidos. Antes do piloto, aprovar metas para tamanho de lote, latência p95, taxa de falha e orçamento. A equipe deve testar as invariantes de segurança e integridade independentemente da performance.

## Identificação do snapshot auditado

Manifesto SHA-256 calculado sem expor conteúdos/configurações secretas. Todos os 108 hashes foram comparados no encerramento da análise da origem, sem diferenças.

| Arquivo relativo à origem | SHA-256 |
|---|---|
| .env | e97e111b5f9d4acba762a86fef561831c67246c9aa871e2bcad7c223e5570ab0 |
| .gitignore | 74366d54bcd8375f43e80ebe6c1963c27bfa139cb2f384a5a4ee113a9a462e81 |
| .lovable/plan/recuperação-de-senha-jovem-aprendiz-exclusões-e-cidades-2026-09-12.md | c9e298f67435acbf30902defa033e8abbb34dbdccb71d90f7a2b0a159c82884f |
| .lovable/project.json | 58a1e159dfbd7c2be2793ec1a9320390add562236949c1cca1602012a05f221d |
| .prettierignore | 52c7c767ff0615eec4eb64cc71265877f7f423eb597d665b5e439f337c661a5a |
| .prettierrc | 1ed88d3b99eced8dc3b6f58f26645466dd1ceaca6c5a9b818531c941ac28e55b |
| AGENTS.md | 4e96b38f10a0bbf0f105f51e6d2c39a889baec12b3386ae3facec4f076714d60 |
| README.md | d69ac4e78695ec2ec13581a25b3e5edd56891b83bed918d2b0800cd05e3e01c3 |
| bun.lock | 8a8c95e98363bc27cf2e9ce4119db76175ce0a2548d5e5dfd9f5b73185a0ce9d |
| bunfig.toml | 366fc9712878c09fe0fee77df1f41a1614b45c561f673f53d9bc39a9fc7b6569 |
| components.json | 37c484818824d2521eee3367e7aa2c2abbd19635d8103d19734b6e24603d0292 |
| eslint.config.js | 3266245a1ff610a0b37dbb8b8c77b93a125e0d8758b9838cfd04b2e0a1397d56 |
| package.json | b0698c57b0e454c08e34909a7efd9b5f90cde9259639b003c4afde460c8164d5 |
| public/favicon.ico | dd821076a9b03adc2173c93956226aea3d92482d7578fc4339c5d3a2e9c24586 |
| public/robots.txt | a3d27b3ca5ce32341fa9f96f01169b521b1657c05d1860c45d1e53a6258e9e8b |
| roadmap.md | 1b7352e09c83823c2e56d4de873c027df282bd5478895a5063376fc10f6a44db |
| src/components/city-autocomplete.tsx | 9927c2d49df8ce69d446d91e1bc086e5c1f271c229bc074b730ae32f46bae44e |
| src/components/ui/accordion.tsx | 0903efcd7b746eef0a10c954a541b0dfa7aa1172f3c380a1a88f4e19a317fda3 |
| src/components/ui/alert-dialog.tsx | ee4d7f3341a1e5592787b7dac8e924bd226189492819f6704d8a7faf8fe64d20 |
| src/components/ui/alert.tsx | e7f4c2e6f78c59270905b4152b7d3ef4d5c6b9e3b2d370daa7b301aa7cbd27b3 |
| src/components/ui/aspect-ratio.tsx | d72c73d629e37995a0a71647d851d68d6fdcd7ec120797f36ab83a8ee89f2cab |
| src/components/ui/avatar.tsx | 0326c9041c5a0b1ba31ff29822c51950b6aeac485cd0985e7df714741a54e7f4 |
| src/components/ui/badge.tsx | 6519775252fe729f21c60b92c7c9feefd1fe7d0a8c2cf16d6f1c2fa7e153fe75 |
| src/components/ui/breadcrumb.tsx | d5224e87344b3ac0f8b002e5dda6a71ff8fee296db8a5fbe6b034d06bd5c2ae1 |
| src/components/ui/button.tsx | e39813b666ba434660ec088356a0349246b6803a4e99961295d0c82bab1ab862 |
| src/components/ui/calendar.tsx | e883f2245873fdf360764f77fc8f391426bef5776c6397537012c46970ebd6ee |
| src/components/ui/card.tsx | f13878a0078a5ef9f3e92af29259fc1e93ea56ea80cb992e0c4dea4e35396459 |
| src/components/ui/carousel.tsx | 568e00e8edbfab8af67ee902ca9ef5ceb6d5ed6f3045e7f9b3c15b4f7ef9e974 |
| src/components/ui/chart.tsx | 81b1f692f9334ba3030213ff37eeaf2dd762b644e5d96e51ada7072109f07430 |
| src/components/ui/checkbox.tsx | c44d02535d5c9c92807576804407dd63d01e7189dbde526e925b53885e645fd4 |
| src/components/ui/collapsible.tsx | 5f0a45d8f6ca72d37ed10bf0a85306158b67d7cbc386319186ce013ead9bc0a6 |
| src/components/ui/command.tsx | ba8c0f8b23044ce9a5066e66d7ab7be3a3c79bfc4a0ab7dfae6ffafe439145a3 |
| src/components/ui/context-menu.tsx | b299f50a0a7840b136db5670f2b2e7eec6fc62b3c06bc2ad0015800959cc381b |
| src/components/ui/dialog.tsx | e3a6de153fb15597ea95be9c4549211a297c060267787915599e3d680d476bd9 |
| src/components/ui/drawer.tsx | 478c487f66245641d5fa0f0d1c53a07d68bd60c4b3c497ec4c41ce08b482e14b |
| src/components/ui/dropdown-menu.tsx | a6b87c89f5a806225b7f3a81f13a6577289c67e5787c2a56b5a22bd1edea02ce |
| src/components/ui/form.tsx | 1ed53d4ab564a64708938643de590f2bef3718b0b2a309c1019c57e9c1fde23f |
| src/components/ui/hover-card.tsx | 69dc172ece56ac77bf3a044a1cd60ed601b0041945d16b5da4c6cc4f42116988 |
| src/components/ui/input-otp.tsx | 45b7c4fd518616f76dd611b9da13bc60bece1352e050878bf943e1cc6a4ed678 |
| src/components/ui/input.tsx | 92debb7d6d2d96d9e607a42d5ce8f37b2d63384ae5dd9ffbbf5f047b680ffb85 |
| src/components/ui/label.tsx | 9f72e2ecf16206593aa9e3c4fbc14cd8e81aa8488d57d92d4a950b30935a9fa9 |
| src/components/ui/menubar.tsx | 5bd157c3a446ea1e451867e63724b2e87ad6bba6251c8b5f1b267d1df7bd4e0e |
| src/components/ui/navigation-menu.tsx | 755aecc77b7911ab61159c9fbb9b25254009eb4c32c95b1430b6b5b7d37ed8f0 |
| src/components/ui/pagination.tsx | cbe8559c578ee2d34c7daef5ee75dc3afeb795851e294b111dec375ba44a9a2d |
| src/components/ui/popover.tsx | 861c18577ea5988c6f5ca00d1c677200319fd427cf8b424e59a5cca6ff24f830 |
| src/components/ui/progress.tsx | 418f612946a520d1380b7a0d058185bb6a6d09846846dd6d6904a0016152dd4a |
| src/components/ui/radio-group.tsx | 8c55aa0496b00a27fc4f609ca8b43a7e82c6802f6bf613998438b7632899fa96 |
| src/components/ui/resizable.tsx | f0399fec7bc334f06433b41b6ebf34255942ce4916b99173898893fa7fcc8281 |
| src/components/ui/scroll-area.tsx | b607f562455152a079d70a22538c95072b0267e0d59a1a1cf16a905a2e373a6f |
| src/components/ui/select.tsx | 6d4deee18cf7ced0354eb719300833a83caf46400de6ee9c3d1942fa4c579ad4 |
| src/components/ui/separator.tsx | bf5838b692e5f74fde7083280b99492dd402bce6966e912e79f5e23f14bc98eb |
| src/components/ui/sheet.tsx | a82f9341962e766ee925a2fe883b0a9ab5d5dd8475c402ac8e491ee37dc95fde |
| src/components/ui/sidebar.tsx | 9f44f4523271f965adec608ae1c3b8a2f350f2f45ba1401a2c7ee33bc5eda238 |
| src/components/ui/skeleton.tsx | f4c42257d73925b0b856a3500e2cbdd918fe6744fcd6be87ef28bb88e7eb7366 |
| src/components/ui/slider.tsx | d307cf3ff05b54be4a04389ef4379f9e8b4dc49720197937991ce843a8d4b5ec |
| src/components/ui/sonner.tsx | 3ad40f66c339e799b1a57c00e10b4627294c7d580d99d8a48ae0d8d4c13cf931 |
| src/components/ui/switch.tsx | c3c298df4ffb56695e4a8f0ff3e37eee08437dec542a677153ec16bed0820107 |
| src/components/ui/table.tsx | 1e945e564c2cc5ca3ef33019ba7da7a8b94cbc73feb3cbc2b7b33c36ea648d92 |
| src/components/ui/tabs.tsx | e9b454d2f987c83b36cc8870bba47d9355db4e8f5c733b310dbc1119a7d27654 |
| src/components/ui/textarea.tsx | 35617a2cf053e52c9e56983bde82d556861d38e462f9e578876c8e99a0432687 |
| src/components/ui/toggle-group.tsx | d59cd3937c967a3e221fdfcfe4ea5cd57eb97cbe37e1ac98126664c9c7db49c1 |
| src/components/ui/toggle.tsx | 62e6e21993f1ab633b9f830cbbf0c181f3d161bae3a7792dbf2d842d42a2f09c |
| src/components/ui/tooltip.tsx | 9682690fc3755d0f4b8684f2d7b1f77945876d41a45b723d0761b26804ad5010 |
| src/hooks/use-mobile.tsx | 21eff740f9e5c965c7f0782925a7e8f67ddfcdf0f58b6613550f99c3e1c454e9 |
| src/hooks/useAuth.tsx | ae9419a989a968f92832ad2adb757e53e33a87dbc4fd9d6e5a410ea28cbe966c |
| src/integrations/lovable/index.ts | 2b71954d100f88b414b15bcea1bae05450f4761727e030b3a21a0448ce9c6222 |
| src/integrations/supabase/auth-attacher.ts | 24d0dbdf8dc0fd49b391a948bd04e1db43b97a1d851acc391dd3d1b13b9797fd |
| src/integrations/supabase/auth-middleware.ts | ae40b141ce933b52252e00bfacd3e69fa7a8e6ef88a2c92809780bf7d1bb76cc |
| src/integrations/supabase/client.server.ts | 56ec7f9ac40ccdf96d8aba4f7fe33a586590ac63420b81e6cd5dc1e4777ee28e |
| src/integrations/supabase/client.ts | 73d6ad070395aa318e2667a7194b63008399a2a1f86664c8a62633b357296d6b |
| src/integrations/supabase/cron-auth.ts | 18430aa4c7faff5b44c572a8a4dfa6482daa52acbea09f384b872f087e58e738 |
| src/integrations/supabase/previewAuthStorage.ts | 5b00130146b77ecd8ed49f118c640d3e75aa7c5e76695f3b9e3f7f8833719f0a |
| src/integrations/supabase/types.ts | e9feeb4c11ebbb507ec4b34bc08cbd6a3bdb7af7c7b2480e54938cf0dbe9ac00 |
| src/lib/age.ts | f3b447e20094a3a43bc047e20320da724cb1c26e10c5612ebeea5e3499060c51 |
| src/lib/ai.server.ts | 6a298f664032f14595b137e36634858040901a8989d5c668b75e104e29cf440d |
| src/lib/error-capture.ts | d6fa7756cbc4c399f4e891b174c2dce8160e2354972c2ae68413dfd1db843088 |
| src/lib/error-page.ts | 635915886f5d44a18b6add2a53959dbe2e8ba1bb3f7e597fc714650e74157bb6 |
| src/lib/lovable-error-reporting.ts | fa4d3d0759cb8eff71be71e620d739224a4fb746babc85c6fa75408687a74857 |
| src/lib/maps.functions.ts | b75911a2bcc9fcaeeb546751a4786f3dcde19bad4022aed6bb4fea7a170534d8 |
| src/lib/records.functions.ts | 6c2a42e5860b97c2d7f6013fb43f046bccd6ca937c2eedf6b566cea09f2ae295 |
| src/lib/resumes.functions.ts | 51da3a2033b0b889d975aa9f28282e80afb96c45b95eab7376d9db90fac78f57 |
| src/lib/scoring.functions.ts | 80a7e4456694005b09536c0809881464692ccdb0868b52fd40e2d20663451a51 |
| src/lib/scoring.ts | 8c19d6acc2fca42dd7f3606f01520bb48d2decf1ed00d3e59aba39170a063b03 |
| src/lib/utils.ts | d1f1e0d62cb8d8d1e04c26e14de842d8a151f75812d81b046c65b5d1fe8e4b27 |
| src/routeTree.gen.ts | 10fb6f587f0eb32e616d95717d9dee48b233a22b2d7acdca9e0788300235be6c |
| src/router.tsx | 72b68964d3f55ba4f7dcf2a04aad9d97d7c61fabad13aec1d298f1e39ee59fcc |
| src/routes/README.md | 5c8187dbe79dac7a3c494f2600585508f5d15e75f04f21ea364d0de14de10575 |
| src/routes/__root.tsx | be38fb61f34260c674551c0c72d53f594fff03204a8184f2075ea3984f9a1fd3 |
| src/routes/_authenticated/candidatos.$id.tsx | 7f507f6f7b1e91690d7a789e29c62550e6d39885e72e7d5c490c1ef04b341a43 |
| src/routes/_authenticated/index.tsx | c379a1ba048fad652c5e918ca48420b7dd99ebdfb1eecd0d5c25246025b79eee |
| src/routes/_authenticated/route.tsx | a802347aeb67ec5b40d72d34ea7a9e18ac60cbb8070853f6e9675807dba62227 |
| src/routes/_authenticated/upload.tsx | 124c7ca288f9354014b7178217659ae270e481f14d67cb519ae543f2506ee79c |
| src/routes/_authenticated/vagas.$id.tsx | fa1b59e6359794a54f1d6cac160af9be101ee9745fcaa97008366e37f574fd19 |
| src/routes/_authenticated/vagas.index.tsx | 8d0177365b448aaccd8aea9e313b63b5a9654b0505ad78ec605285fc07d1af2d |
| src/routes/auth.tsx | 8eb65b1c6fd1ea8bc019951d14c1a888b06be3e465a677f2c639dd71b9a281e0 |
| src/routes/reset-password.tsx | df03f8db6702e26bf3a2861e7da7fba3299f0e3ae37b434c1ff26fc7b554d93f |
| src/server.ts | f0ee683067afee145f81a63a3af76b3d3767e2a1f61f0e82582f8da184ad3ef6 |
| src/start.ts | f3f07f1f6afe27708dd41bb992e3c7c470892d44a75c32eebe57abb6327ff28f |
| src/styles.css | 2776c62d6c28f3b65a8ba900920ad3363ea05527eb0932367cbe44840cba41df |
| supabase/config.toml | 2e95a44bbb41a748fbcc6924bacd0d119208cfb3fb8d55eb15c85badc9e7f7cd |
| supabase/migrations/20260912154905_5175285a-c995-4b66-990b-21838da63e3b.sql | 465a767680cc09b5e47e86c0fd1b57955e7b707ba524da89f82d05ee195f4967 |
| supabase/migrations/20260912154921_fe5f3e29-49ef-4c4b-8078-154ad5a897e7.sql | 92b16552bf8b29e4a1d77397bfce5266fe05ae060fbfc62576deef6c9a820e76 |
| supabase/migrations/20260912154939_df5ed327-7f73-42c6-8d12-7e7983713399.sql | 561fbf883a8139c9bb534312c86fcf352bdbf1ec6740710d747c8e089d35badf |
| supabase/migrations/20260912184557_5e8afe3e-1c97-400b-8eea-35a2ef29669a.sql | 5ada43668a89a44ca7038cde7e35e4a282219e9c49055101c72f456cc77ff23a |
| supabase/migrations/20260912192910_d9889010-47a5-4e53-ac48-8fd7641adfaa.sql | e30b04fba12da203285993484c5af1678eef3f6e5121e1fd4af3622b9438844c |
| supabase/migrations/20260912194830_69c4e287-5be1-42dc-a23a-4cccaa574052.sql | 91f890ac4b6f82099504cf48c11769adb1ea1c332040974f2b3c2d917b3ddded |
| tsconfig.json | 0ff5b0536ac765fe8beabcfe2202c3069c4cc43136e20e4c2f04c55f6f4ebc84 |
| vite.config.ts | 694f17daf64d3bf3481ee838ce69c26c593c60c0ed45a19209754fe5a742bcf0 |

