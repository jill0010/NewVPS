const SUPABASE="https://gvsnbmejydgzqzzjyykt.supabase.co/functions/v1/payment-chain-monitor";
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const reply=(value,status=200)=>new Response(JSON.stringify(value),{status,headers:{"Content-Type":"application/json","Cache-Control":"no-store"}});
export default {
 async fetch(request,env){
  if(request.method==="GET"&&new URL(request.url).pathname==="/health")return reply({ok:true,service:"newvps-order-monitor"});
  if(request.method!=="POST")return reply({error:"Method not allowed"},405);
  if(!env.NEWVPS_MONITOR_SECRET||request.headers.get("x-monitor-secret")!==env.NEWVPS_MONITOR_SECRET)return reply({error:"Unauthorized"},401);
  let data;try{data=await request.json()}catch{return reply({error:"Invalid JSON"},400)}
  if(!UUID.test(data.order_id||"")||!Number.isFinite(Date.parse(data.created_at||"")))return reply({error:"Invalid order"},400);
  const created=Date.parse(data.created_at);
  if(created>Date.now()+60000||created+3600000<=Date.now())return reply({error:"Order outside monitoring window"},409);
  const id=env.ORDER_MONITORS.idFromName(data.order_id);
  console.log("monitor activation",data.order_id);
  return env.ORDER_MONITORS.get(id).fetch("https://monitor.internal/start",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({order_id:data.order_id,created_at:data.created_at})});
 }
};
export class OrderMonitor{
 constructor(state,env){this.state=state;this.env=env}
 async fetch(req){
  const {order_id,created_at}=await req.json();
  const prior=await this.state.storage.get("order");
  if(prior)return reply({ok:true,already_started:true,ends_at:new Date(prior.ends).toISOString()});
  const ends=Date.parse(created_at)+3600000;
  await this.state.storage.put("order",{order_id,ends,attempts:0});
  await this.state.storage.setAlarm(Math.min(Date.now()+1000,ends));
  console.log("alarm scheduled",order_id);
  return reply({ok:true,ends_at:new Date(ends).toISOString()});
 }
 async alarm(){
  const order=await this.state.storage.get("order");
  if(!order)return;
  console.log("alarm fired",order.order_id,order.attempts);
  if(Date.now()>=order.ends){await this.state.storage.deleteAlarm();await this.state.storage.delete("order");return}
  let done=false;
  try{
   const r=await fetch(SUPABASE,{method:"POST",headers:{"Content-Type":"application/json","x-monitor-secret":this.env.NEWVPS_MONITOR_SECRET},body:JSON.stringify({order_id:order.order_id}),signal:AbortSignal.timeout(8500)});
   if(r.ok){
    const j=await r.json();
    done=Array.isArray(j.report)&&j.report.some(x=>x.matches>0);
    console.log("monitor response",order.order_id,r.status,done);
   }
  }catch(e){console.error("monitor check failed",String(e))}
  if(done){await this.state.storage.delete("order");return}
  order.attempts++;
  await this.state.storage.put("order",order);
  if(Date.now()+10000<order.ends)await this.state.storage.setAlarm(Date.now()+10000);
  else await this.state.storage.delete("order");
 }
}
