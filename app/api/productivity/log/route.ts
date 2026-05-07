// app/api/productivity/log/route.ts
import { NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabaseServer';

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const adminClient = await createAdminClient();

    const { data: emp } = await adminClient
      .from('employees')
      .select('employee_id')
      .eq('email', user.email)
      .single();

    if (!emp) {
      return NextResponse.json({ error: 'Employee record not found' }, { status: 404 });
    }

    const body = await request.json();
    const { work_hours = 8, meeting_hours = 1, tasks_completed = 5 } = body;

    const today = new Date().toISOString().split('T')[0];

    const productivity_score = Math.round(
      (work_hours * 0.4) +
      (tasks_completed * 0.3) +
      (meeting_hours * 0.2) +
      (8 * 0.1)
    );

    const { error } = await adminClient
      .from('productivity_metrics')
      .upsert({
        employee_id: emp.employee_id,
        date: today,
        work_hours,
        meeting_hours,
        tasks_completed,
        productivity_score,
      }, { onConflict: 'employee_id,date' });

    if (error) throw error;

    return NextResponse.json({ 
      success: true, 
      score: productivity_score 
    });

  } catch (error: any) {
    console.error('Productivity log error:', error);
    return NextResponse.json({ 
      error: 'Failed to log productivity', 
      details: error.message 
    }, { status: 500 });
  }
}