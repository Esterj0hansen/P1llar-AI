import {NextRequest,NextResponse} from "next/server";
import {createHmac,timingSafeEqual} from "node:crypto";
import {createClient} from "@supabase/supabase-js";
export const runtime="nodejs";
export async function POST(req:NextRequest){
 const secret=process.env.PAYSTACK_SECRET_KEY,signature=req.headers.get("x-paystack-signature");
 if(!secret||!signature)return NextResponse.json({error:"Webhook not configured."},{status:503});
 const raw=await req.text(),expected=createHmac("sha512",secret).update(raw).digest("hex");
 const a=Buffer.from(signature),b=Buffer.from(expected);if(a.length!==b.length||!timingSafeEqual(a,b))return NextResponse.json({error:"Invalid signature."},{status:401});
 try{
  const event=JSON.parse(raw),data=event.data||{},url=process.env.NEXT_PUBLIC_SUPABASE_URL,service=process.env.SUPABASE_SERVICE_ROLE_KEY;
  if(!url||!service)return NextResponse.json({error:"Database is not configured."},{status:503});
  const db=createClient(url,service,{auth:{persistSession:false}});
  const businessId=data.metadata?.business_id;
  if(event.event==="charge.success"&&businessId){
   await db.from("business_subscriptions").upsert({business_id:businessId,provider:"paystack",provider_customer_id:data.customer?.customer_code||null,provider_subscription_id:data.subscription?.subscription_code||null,plan:data.metadata?.plan||"starter",status:"active"},{onConflict:"business_id"});
  }else if(["subscription.create","invoice.payment_success"].includes(event.event)){
   const customerCode=data.customer?.customer_code;
   if(customerCode)await db.from("business_subscriptions").update({status:"active",provider_subscription_id:data.subscription?.subscription_code||data.subscription_code||null}).eq("provider_customer_id",customerCode);
  }else if(["subscription.disable","subscription.not_renew"].includes(event.event)){
   const customerCode=data.customer?.customer_code;
   if(customerCode)await db.from("business_subscriptions").update({status:"canceled"}).eq("provider_customer_id",customerCode);
  }
  return NextResponse.json({received:true});
 }catch(e){console.error("P1llar Paystack webhook:",e);return NextResponse.json({error:"Webhook processing failed."},{status:500});}
}