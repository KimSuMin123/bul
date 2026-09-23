// Server-only, transport-independent SELECT format shared by local and cloud runners.
import { randomUUID } from 'node:crypto';

export const OMIT_CREDENTIAL=/password|passwd|secret|token|salt|credential/i;
export async function selectSnapshot(env=process.env,fetchImpl=fetch,options={}){
  const base=new URL(env.SUPABASE_URL||env.VITE_SUPABASE_URL||'');
  if(base.protocol!=='https:')throw new Error('HTTPS project URL required');
  const key=env.SUPABASE_SERVICE_ROLE_KEY;if(!key)throw new Error('Server service key required');
  const request=async(resource,extra={})=>{
    const response=await fetchImpl(`${base.origin}/rest/v1/${resource}`,{headers:{apikey:key,Authorization:`Bearer ${key}`,Accept:'application/json',...extra},signal:options.signal ? AbortSignal.any([options.signal,AbortSignal.timeout(20000)]) : AbortSignal.timeout(30000),redirect:'error'});
    if(!response.ok)throw new Error('Read-only data export failed');
    return {body:await response.json(),range:response.headers.get('content-range')};
  };
  let exportedBytes=0,exportedRows=0;
  const {body:schema}=await request('',{Accept:'application/openapi+json'});
  const snapshot={version:1,kind:'public-select-snapshot',jobId:randomUUID(),startedAt:new Date().toISOString(),projectHost:base.hostname,
    limitations:['Not a transactional snapshot; concurrent writes may produce inconsistent rows','DDL, indexes, RLS, functions, roles, Auth credentials and Storage object files are not backed up','Credential columns are omitted; this file alone cannot fully restore the project'],tables:{}};
  const entries=Object.entries(schema.definitions||{});let index=0;
  await Promise.all(Array.from({length:Math.min(options.concurrency||1,entries.length)},async()=>{
  for(;;){
    const entry=entries[index++];if(!entry)break;const [name,definition]=entry;
    if(!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name)||!schema.paths?.[`/${name}`]?.get)continue;
    const all=Object.keys(definition.properties||{});
    if(all.some(column=>!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(column)))throw new Error('Unsupported column name requires review');
    const columns=all.filter(column=>!OMIT_CREDENTIAL.test(column));
    if(!columns.length)continue;
    const pk=all.filter(column=>definition.properties[column].description?.includes('<pk/>'));
    const order=pk.length?pk:all.includes('id')?['id']:columns.slice(0,1);
    const rows=[];let total=null;
    for(let offset=0;;){
      const query=new URLSearchParams({select:columns.join(','),order:order.map(c=>`${c}.asc`).join(','),offset:String(offset),limit:'1000'});
      const page=await request(`${encodeURIComponent(name)}?${query}`,{Prefer:'count=exact'});
      if(!Array.isArray(page.body))throw new Error('Unexpected table response');
      const count=page.range?.match(/\/(\d+)$/)?.[1];
      if(count===undefined)throw new Error('Exact row count unavailable');
      if(total===null)total=Number(count);else if(total!==Number(count))throw new Error('Table changed during snapshot; retry later');
      exportedBytes+=Buffer.byteLength(JSON.stringify(page.body));exportedRows+=page.body.length;
      if(exportedBytes>(options.maxBytes??Infinity)||exportedRows>(options.maxRows??Infinity))throw new Error('Snapshot exceeds configured export limit');
      rows.push(...page.body.map(row=>Object.fromEntries(columns.map(column=>[column,row[column]]))));offset+=page.body.length;
      if(offset===total)break;
      if(!page.body.length||offset>total)throw new Error('Incomplete pagination');
    }
    snapshot.tables[name]={columns,omittedColumns:all.filter(c=>OMIT_CREDENTIAL.test(c)),orderBy:order,rowCount:rows.length,rows};
  }}));
  if(!Object.keys(snapshot.tables).length)throw new Error('No exportable tables discovered');
  snapshot.finishedAt=new Date().toISOString();return snapshot;
}
