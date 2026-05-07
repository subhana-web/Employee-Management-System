// app/api/alerts/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabaseServer';

export async function POST(req: NextRequest) {
  try {
    const { type, message, sent_by, alertId, target } = await req.json();
    
    if (!type || !message) {
      return NextResponse.json(
        { error: 'Type and message are required' },
        { status: 400 }
      );
    }

    // Create admin client for database operations
    const supabase = await createAdminClient();
    
    // 1. If alertId is provided, update existing alert
    if (alertId) {
      const { error } = await supabase
        .from('alerts')
        .update({ status: 'sending' })
        .eq('id', alertId);
      
      if (error) throw error;
    }

    // 2. Determine recipients
    let recipients: Array<{ email: string; name: string }> = [];
    
    if (target === 'all' || !target) {
      const { data: employees, error: empError } = await supabase
        .from('employees')
        .select('email, first_name, last_name');

      if (empError) throw empError;
      
      recipients = (employees || []).map(emp => ({
        email: emp.email,
        name: `${emp.first_name} ${emp.last_name || ''}`.trim()
      }));
    } else if (target) {
      const { data: employee, error: empError } = await supabase
        .from('employees')
        .select('email, first_name, last_name')
        .eq('employee_id', parseInt(target))
        .single();

      if (empError) throw empError;
      
      recipients = [{
        email: employee.email,
        name: `${employee.first_name} ${employee.last_name || ''}`.trim()
      }];
    }

    if (recipients.length === 0) {
      return NextResponse.json(
        { error: 'No recipients found' },
        { status: 404 }
      );
    }

    // 3. Create professional email template
    const typeLabels = {
      urgent: 'URGENT NOTICE',
      warning: 'WARNING',
      event: 'EVENT ANNOUNCEMENT',
      security: 'SECURITY NOTICE',
      general: 'ANNOUNCEMENT'
    };

    const subject = `[ORA TECH] ${typeLabels[type as keyof typeof typeLabels] || 'Announcement'}`;

    const emailHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.5; color: #1a1a1a;">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; margin: 0 auto; border-collapse: collapse;">
          <!-- Header -->
          <tr>
            <td style="padding: 24px 0 8px 0; border-bottom: 2px solid #eaeef2;">
              <h1 style="margin: 0; font-size: 24px; font-weight: 600; color: #1e3a8a;">ORA TECH</h1>
              <p style="margin: 4px 0 0 0; font-size: 14px; color: #64748b;">Employee Management System</p>
            </td>
          </tr>
          
          <!-- Subject Line -->
          <tr>
            <td style="padding: 24px 0 8px 0;">
              <p style="margin: 0; font-size: 14px; font-weight: 600; color: #475569; text-transform: uppercase; letter-spacing: 0.5px;">${typeLabels[type as keyof typeof typeLabels] || 'ANNOUNCEMENT'}</p>
            </td>
          </tr>
          
          <!-- Message -->
          <tr>
            <td style="padding: 0 0 16px 0;">
              <p style="margin: 0; font-size: 16px; color: #1a1a1a; white-space: pre-line;">${message}</p>
            </td>
          </tr>
          
          <!-- Metadata -->
          <tr>
            <td style="padding: 16px 0; border-top: 1px solid #eaeef2; border-bottom: 1px solid #eaeef2;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="padding: 4px 0;">
                    <span style="font-size: 14px; color: #475569;">From:</span>
                    <span style="font-size: 14px; color: #1a1a1a; margin-left: 8px;">${sent_by || 'Administrator'}</span>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 4px 0;">
                    <span style="font-size: 14px; color: #475569;">Date:</span>
                    <span style="font-size: 14px; color: #1a1a1a; margin-left: 8px;">${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="padding: 24px 0;">
              <p style="margin: 0; font-size: 13px; color: #94a3b8;">This is an automated message from the ORA TECH Employee Management System. Please do not reply to this email.</p>
              <p style="margin: 16px 0 0 0; font-size: 13px; color: #94a3b8;">© ${new Date().getFullYear()} ORA TECH. All rights reserved.</p>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `;

    // 4. Send emails
    const emailResults = [];
    const errors = [];

    for (const recipient of recipients) {
      try {
        const emailResponse = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/email/send`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            to: recipient.email,
            subject,
            html: emailHtml,
            employeeName: recipient.name,
          }),
        });

        if (emailResponse.ok) {
          emailResults.push(recipient.email);
        } else {
          errors.push({ email: recipient.email, error: 'Failed to send' });
        }
      } catch (error) {
        errors.push({ email: recipient.email, error });
      }
    }

    // 5. Update alert status
    if (alertId) {
      await supabase
        .from('alerts')
        .update({ 
          status: errors.length === 0 ? 'sent' : 'partial',
          sent_at: new Date().toISOString() 
        })
        .eq('id', alertId);
    }

    return NextResponse.json({ 
      success: true, 
      sentCount: emailResults.length,
      errorCount: errors.length,
      errors: errors.length > 0 ? errors : undefined
    });
  } catch (error: any) {
    console.error('Error in alerts API:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}