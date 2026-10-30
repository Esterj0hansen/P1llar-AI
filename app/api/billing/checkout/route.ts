import {NextRequest,NextResponse} from "next/server";
import {createClient} from "@supabase/supabase-js";
export const runtime="nodejs";
const plans={starter:"PAYSTACK_PLAN_STARTER",growth:"PAYSTACK_PLAN_GROWTH",business:"PAYSTACK_PLAN_BUSINESS"} as const;
export async function POST(req:NextRequest){
 try{
  const token=req.headers.get("authorization")?.replace(/^Bearer\\s+/i,"");if(!token)return NextResponse.json({error:"Sign in first."},{status:401});
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL,anon=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY||process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,service=process.env.SUPABASE_SERVICE_ROLE_KEY,key=process.env.PAYSTACK_SECRET_KEY;
  if(!url||!anon||!service||!key)return NextResponse.json({error:"Billing is not configured. Add Supabase service credentials and PAYSTACK_SECRET_KEY."},{status:503});
  const body=await req.json(),businessId=String(body.businessId||""),plan=String(body.plan||"");
  if(!businessId||!(plan in plans))return NextResponse.json({error:"Choose a valid business and plan."},{status:400});
  const userDb=createClient(url,anon,{global:{headers:{Authorization:"Bearer "+token}},auth:{persistSession:false}});
  const {data:userData,error:userError}=await userDb.auth.getUser(token);if(userError||!userData.user)return NextResponse.json({error:"Session expired."},{status:401});
  const {data:member}=await userDb.from("business_members").select("business_id").eq("business_id",businessId).eq("user_id",userData.user.id).maybeSingle();if(!member)return NextResponse.json({error:"Workspace access denied."},{status:403});
  const planCode=process.env[plans[plan as keyof typeof plans]];if(!planCode)return NextResponse.json({error:"This plan is not configured in Vercel yet."},{status:503});
  const db=createClient(url,service,{auth:{persistSession:false}});
  await db.from("business_subscriptions").upsert({business_id:businessId,provider:"paystack",plan,status:"inactive"},{onConflict:"business_id"});
  const response=await fetch("https://api.paystack.co/transaction/initialize",{method:"POST",headers:{Authorization:"Bearer "+key,"Content-Type":"application/json"},body:JSON.stringify({email:userData.user.email,plan:planCode,callback_url:(process.env.NEXT_PUBLIC_SITE_URL||"https://p1llar-ai.vercel.app")+"/dashboard/billing?business="+businessId,metadata:{business_id:businessId,plan}})});
  const result=await response.json();if(!response.ok||!result.status)throw new Error(result.message||"Could not start Paystack checkout.");
  return NextResponse.json({authorizationUrl:result.data.authorization_url,reference:result.data.reference});
 }catch(e){console.error("P1llar billing checkout:",e);return NextResponse.json({error:e instanceof Error?e.message:"Billing checkout failed."},{status:500});}
}