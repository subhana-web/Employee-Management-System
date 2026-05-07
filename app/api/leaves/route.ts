// app/api/leaves/route.ts
import { NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabaseServer';
import { sendHREmail, emailTemplates } from '@/lib/emailService';
import { sendEmployeeEmail, employeeAlertTemplates } from '@/lib/emailServiceAlerts';

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized - Please log in' },
        { status: 401 }
      );
    }

    const adminClient = await createAdminClient();
    
    const { data: profile } = await adminClient
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (!profile || profile.role !== 'employee') {
      return NextResponse.json(
        { error: 'Only employees can apply for leave' },
        { status: 403 }
      );
    }

    const { data: emp, error: empErr } = await adminClient
      .from('employees')
      .select('employee_id, first_name, last_name, email')
      .eq('email', user.email)
      .single();

    if (empErr || !emp) {
      return NextResponse.json(
        { error: 'Employee not found' },
        { status: 404 }
      );
    }

    const body = await request.json();
    const { leave_type, start_date, end_date, reason } = body;

    const start = new Date(start_date);
    const end = new Date(end_date || start_date);
    const daysDiff = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    const duration = leave_type === 'half-day' ? 0.5 : daysDiff;

    const leaveData = {
      employee_id: emp.employee_id,
      leave_type,
      start_date,
      end_date: end_date || start_date,
      duration,
      reason,
      status: 'pending',
    };

    const { data, error } = await adminClient
      .from('leave_requests')
      .insert(leaveData)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    // Send emails
    const employeeName = `${emp.first_name} ${emp.last_name || ''}`.trim();
    
    const hrTemplate = emailTemplates.leaveRequest({
      employeeName,
      leaveType: leave_type,
      startDate: start_date,
      endDate: end_date || start_date,
      duration,
      reason,
      leaveId: data.leave_id,
    });
    sendHREmail(hrTemplate.subject, hrTemplate.html).catch(console.error);

    const employeeTemplate = employeeAlertTemplates.leaveRequest({
      employeeName,
      leaveType: leave_type,
      startDate: start_date,
      endDate: end_date || start_date,
      duration,
    });
    sendEmployeeEmail(emp.email, employeeTemplate.subject, employeeTemplate.html, employeeName)
      .catch(console.error);

    return NextResponse.json(data, { status: 201 });
  } catch (error: any) {
    console.error('Error in POST:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const adminClient = await createAdminClient();

    const { data: profile } = await adminClient.from('profiles').select('role').eq('id', user.id).single();
    const role = profile?.role;

    let query = adminClient
      .from('leave_requests')
      .select('*')
      .order('created_at', { ascending: false });

    if (role === 'employee') {
      const { data: emp } = await adminClient.from('employees').select('employee_id').eq('email', user.email).single();
      if (emp) query = query.eq('employee_id', emp.employee_id);
    }

    const { data, error } = await query;
    if (error) throw error;

    return NextResponse.json(data || []);
  } catch (error: any) {
    console.error('Leaves GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}



export async function PUT(request: Request) {
  try {
    const supabase = await createClient();
    
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const adminClient = await createAdminClient();
    
    const { data: profile } = await adminClient
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (!profile || !['admin', 'manager', 'hr'].includes(profile.role)) {
      return NextResponse.json(
        { error: 'Only HR, Admin, or Manager can approve/reject leaves' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { leave_id, status, rejection_reason } = body;

    const { data: leaveRequest, error: fetchError } = await adminClient
      .from('leave_requests')
      .select('*, employee:employee_id(*)')
      .eq('leave_id', leave_id)
      .single();

    if (fetchError || !leaveRequest) {
      return NextResponse.json({ error: 'Leave request not found' }, { status: 404 });
    }

    const updates: any = { status };
    if (status === 'rejected') {
      updates.rejection_reason = rejection_reason;
    }

    const { data: updatedLeave, error: updateErr } = await adminClient
      .from('leave_requests')
      .update(updates)
      .eq('leave_id', leave_id)
      .select()
      .single();

    if (updateErr) {
      return NextResponse.json({ error: updateErr.message }, { status: 400 });
    }

    const employee = leaveRequest.employee;
    const employeeName = `${employee.first_name} ${employee.last_name || ''}`.trim();

    if (status === 'approved') {
      const template = employeeAlertTemplates.leaveApproved({
        employeeName,
        leaveType: updatedLeave.leave_type,
        startDate: updatedLeave.start_date,
        endDate: updatedLeave.end_date,
        duration: updatedLeave.duration,
      });
      sendEmployeeEmail(employee.email, template.subject, template.html, employeeName)
        .catch(console.error);
    }

    if (status === 'rejected') {
      const template = employeeAlertTemplates.leaveRejected({
        employeeName,
        leaveType: updatedLeave.leave_type,
        startDate: updatedLeave.start_date,
        endDate: updatedLeave.end_date,
        duration: updatedLeave.duration,
        reason: updatedLeave.rejection_reason || 'No reason provided',
      });
      sendEmployeeEmail(employee.email, template.subject, template.html, employeeName)
        .catch(console.error);
    }

    return NextResponse.json(updatedLeave);
  } catch (error: any) {
    console.error('Error in PUT:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}