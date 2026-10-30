import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
export const runtime="nodejs";
const allowed=new Set(["application/pdf","text/plain","text/markdown","text/csv","application/vnd.openxmlformats-officedocument.wordprocessingml.document"]);
export async function POST(request:NextRequest){
 try{
  const token=request.headers.get("authorization")?.replace(/^Bearer\\s+/i,""); if(!token)return NextResponse.json({error:"Sign in to upload a file."},{status:401});
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL, anon=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY||process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, service=process.env.SUPABASE_SERVICE_ROLE_KEY;
  if(!url||!anon||!service)return NextResponse.json({error:"File storage is not configured."},{status:503});
  const userDb=createClient(url,anon,{global:{headers:{Authorization:"Bearer "+token}},auth:{persistSession:false}});
  const {data:userData,error:userError}=await userDb.auth.getUser(token);if(userError||!userData.user)return NextResponse.json({error:"Session expired. Sign in again."},{status:401});
  const form=await request.formData(),file=form.get("file"),businessId=String(form.get("businessId")||"");
  if(!(file instanceof File)||!businessId)return NextResponse.json({error:"Choose a file and business."},{status:400});
  if(!allowed.has(file.type))return NextResponse.json({error:"Supported formats: PDF, DOCX, TXT, Markdown and CSV."},{status:415});
  if(file.size<1||file.size>10*1024*1024)return NextResponse.json({error:"Files must be smaller than 10 MB."},{status:413});
  const {data:membership}=await userDb.from("business_members").select("business_id").eq("business_id",businessId).eq("user_id",userData.user.id).maybeSingle();
  if(!membership)return NextResponse.json({error:"You do not have access to this workspace."},{status:403});
  const db=createClient(url,service,{auth:{persistSession:false}});
  const name=file.name.replace(/[^a-zA-Z0-9._-]/g,"_").slice(0,120),path=businessId+"/"+crypto.randomUUID()+"-"+name,bytes=new Uint8Array(await file.arrayBuffer());
  const {error:storeError}=await db.storage.from("business-knowledge").upload(path,bytes,{contentType:file.type,upsert:false});if(storeError)throw storeError;
  const textFile=["text/plain","text/markdown","text/csv"].includes(file.type), extracted=textFile?new TextDecoder().decode(bytes).slice(0,12000):"";
  const {error:insertError}=await db.from("knowledge_sources").insert({business_id:businessId,source_type:"file",title:file.name,content:extracted||"File securely uploaded. This format still needs text extraction before the content can be searched.",source_url:path,processing_status:extracted?"ready":"pending",created_by:userData.user.id});
  if(insertError){await db.storage.from("business-knowledge").remove([path]);throw insertError;}
  await db.from("usage_events").insert({business_id:businessId,event_type:"file_upload",quantity:1,metadata:{mime:file.type,bytes:file.size}});
  return NextResponse.json({uploaded:true,extracted:Boolean(extracted),message:extracted?"File uploaded and indexed.":"File stored securely; PDF/DOCX extraction is not yet enabled."});
 }catch(error){console.error("P1llar upload:",error);return NextResponse.json({error:error instanceof Error?error.message:"Upload failed."},{status:500});}
}