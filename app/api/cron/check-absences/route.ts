// app/api/cron/check-absences/route.ts
import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabaseServer';
import { sendAbsenceAlert } from '@/lib/alerts';

export async function GET(request: Request) {
  // Verify cron secret for security
  const authHeader = request.headers.get('authorization');
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  try {
    const supabase = await createAdminClient();
    const today = new Date().toISOString().split('T')[0];
    
    // Get all active employees
    const { data: employees, error: empError } = await supabase
      .from('employees')
      .select('employee_id, first_name, last_name, email')
      .eq('status', 'active');
    
    if (empError) throw empError;
    if (!employees || employees.length === 0) {
      return NextResponse.json({ message: 'No active employees found' });
    }
    
    const alertsSent = [];
    
    for (const employee of employees) {
      // Check if employee has approved leave for today
      const { data: approvedLeave } = await supabase
        .from('leave_requests')
        .select('leave_id')
        .eq('employee_id', employee.employee_id)
        .eq('status', 'approved')
        .lte('start_date', today)
        .gte('end_date', today)
        .maybeSingle();
      
      // Check if employee has checked in today
      const { data: checkIn } = await supabase
        .from('meeting_logs')
        .select('log_id')
        .eq('employee_id', employee.employee_id)
        .gte('check_in_time', `${today}T00:00:00`)
        .lte('check_in_time', `${today}T23:59:59`)
        .maybeSingle();
      
      // If no approved leave and no check-in, they're absent
      if (!approvedLeave && !checkIn) {
        const employeeName = `${employee.first_name} ${employee.last_name || ''}`.trim();
        
        // Check if we already sent an alert today
        const { data: existingAlert } = await supabase
          .from('alerts')
          .select('id')
          .eq('employee_id', employee.employee_id)
          .eq('type', 'absence')
          .gte('sent_at', `${today}T00:00:00`)
          .lte('sent_at', `${today}T23:59:59`)
          .maybeSingle();
        
        if (!existingAlert) {
          await sendAbsenceAlert(
            employee.employee_id,
            employeeName,
            today,
            'No check-in recorded and no approved leave'
          );
          
          alertsSent.push({
            employee_id: employee.employee_id,
            name: employeeName,
            date: today
          });
        }
      }
    }
    
    return NextResponse.json({
      message: 'Absence check completed',
      alertsSent,
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    console.error('Error in absence check:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  return GET(request);
}