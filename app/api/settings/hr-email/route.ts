// app/api/settings/hr-email/route.ts
import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabaseServer';

export async function GET() {
  try {
    const supabase = await createAdminClient();
    
    const { data, error } = await supabase
      .from('notification_settings')
      .select('setting_value')
      .eq('setting_key', 'hr_email')
      .single();
    
    if (error || !data) {
      return NextResponse.json({ email: 'oratechems@gmail.com' });
    }
    
    return NextResponse.json({ email: data.setting_value });
  } catch (error: any) {
    return NextResponse.json({ email: 'oratechems@gmail.com' });
  }
}

export async function PUT(request: Request) {
  try {
    const supabase = await createAdminClient();
    const body = await request.json();
    
    const { error } = await supabase
      .from('notification_settings')
      .upsert({ 
        setting_key: 'hr_email', 
        setting_value: body.email 
      }, { 
        onConflict: 'setting_key' 
      });
    
    if (error) throw error;
    
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}