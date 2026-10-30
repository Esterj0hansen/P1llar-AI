import { NextResponse } from "next/server";
export const dynamic = "force-dynamic";
export function GET() {
 const checks={supabase:Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL&&(process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY||process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)),databaseAdmin:Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),aiProvider:Boolean(process.env.OPENROUTER_API_KEY),stripe:Boolean(process.env.STRIPE_SECRET_KEY&&process.env.STRIPE_WEBHOOK_SECRET)};
 const ready=checks.supabase&&checks.databaseAdmin&&checks.aiProvider;
 return NextResponse.json({service:"p1llar-ai",status:ready?"configured":"needs_configuration",checks,note:"Configuration presence only; this endpoint does not claim external services or customer flows passed end-to-end tests."},{status:ready?200:503});
}