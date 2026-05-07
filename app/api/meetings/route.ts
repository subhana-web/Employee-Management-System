// app/api/meetings/route.ts
import { NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabaseServer';

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const adminClient = await createAdminClient();

    // Get role
    const { data: profile } = await adminClient
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    const role = profile?.role || 'employee';

    let query = adminClient
      .from('meeting_logs')
      .select(`
        *,
        employees!employee_id (
          first_name,
          last_name,
          profile_photo
        )
      `)
      .order('check_out_time', { ascending: false });

    // Employee sees ONLY their own logs
    if (role === 'employee') {
      const { data: emp } = await adminClient
        .from('employees')
        .select('employee_id')
        .eq('email', user.email)
        .single();

      if (emp) query = query.eq('employee_id', emp.employee_id);
    }

    const { data, error } = await query;

    if (error) throw error;

    return NextResponse.json(data || []);
  } catch (error: any) {
    console.error('Meetings GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const adminClient = await createAdminClient();

    // Only employees can check out
    const { data: profile } = await adminClient.from('profiles').select('role').eq('id', user.id).single();
    if (profile?.role !== 'employee') {
      return NextResponse.json({ error: 'Only employees can log meetings' }, { status: 403 });
    }

    const { data: emp } = await adminClient
      .from('employees')
      .select('employee_id')
      .eq('email', user.email)
      .single();

    if (!emp) return NextResponse.json({ error: 'Employee record not found' }, { status: 404 });

    const body = await request.json();
    const { place, purpose, commute_cost } = body;

    const { data, error } = await adminClient
      .from('meeting_logs')
      .insert({
        employee_id: emp.employee_id,
        place,
        purpose,
        check_out_time: new Date().toISOString(),
        commute_cost: commute_cost || null,
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json(data, { status: 201 });
  } catch (error: any) {
    console.error('Meetings POST error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const adminClient = await createAdminClient();

    const body = await request.json();
    const { log_id } = body;

    const { error } = await adminClient
      .from('meeting_logs')
      .update({ check_in_time: new Date().toISOString() })
      .eq('log_id', log_id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Meetings PUT error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}