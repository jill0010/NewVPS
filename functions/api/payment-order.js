// Same-origin Cloudflare Pages proxy for payment-order creation.
// Forward only authenticated POST requests to the known Supabase endpoint.
export async function onRequestPost({request}) {
  const auth=request.headers.get('authorization')||'';
  if(!/^Bearer [a-f0-9]{64}$/i.test(auth))return Response.json({error:'Please sign in before creating a payment order.'},{status:401});
  let body;
  try{body=await request.text();if(body.length>4096)throw Error('Too large');}
  catch{return Response.json({error:'Invalid request'},{status:400})}
  let data;
  try{data=JSON.parse(body)}catch{return Response.json({error:'Invalid JSON'},{status:400})}
  if(data.action!=='create'||typeof data.currency!=='string'||!Number.isFinite(Number(data.usd)))return Response.json({error:'Invalid order request'},{status:400});
  const slug=data.currency.toUpperCase()==='XMR'?'newvps-xmr-gateway':'payment-order-api';
  try{
    const response=await fetch('https://gvsnbmejydgzqzzjyykt.supabase.co/functions/v1/'+slug,{
      method:'POST',headers:{'Content-Type':'application/json','Authorization':auth},
      body,signal:AbortSignal.timeout(28000)
    });
    return new Response(response.body,{status:response.status,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});
  }catch(e){
    return Response.json({error:'Payment service temporarily unreachable. Please retry.',reason:e instanceof Error?e.name:'NetworkError'},{status:502,headers:{'Cache-Control':'no-store'}});
  }
}
export function onRequestGet(){return Response.json({error:'Method not allowed'},{status:405})}
