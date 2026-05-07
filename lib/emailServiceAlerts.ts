// lib/emailServiceAlerts.ts
import nodemailer from 'nodemailer';
import { createAdminClient } from './supabaseServer';

// Create transporter using Gmail SMTP
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: 'oratechems@gmail.com',
    pass: process.env.GMAIL_APP_PASSWORD,
  },
});

export async function sendEmployeeEmail(
  to: string,
  subject: string,
  htmlContent: string,
  employeeName: string
): Promise<{ success: boolean; error?: any }> {
  try {
    console.log(`📧 Sending email to employee: ${employeeName} (${to})`);
    console.log('Subject:', subject);
    
    // Verify connection configuration
    await transporter.verify();
    
    // Send email
    const info = await transporter.sendMail({
      from: '"ORA TECH EMS" <oratechems@gmail.com>',
      to: to,
      subject: subject,
      html: htmlContent,
    });
    
    console.log('✅ Email sent successfully! Message ID:', info.messageId);
    
    // Log to database
    const supabase = await createAdminClient();
    await supabase.from('email_logs').insert({
      recipient: to,
      recipient_name: employeeName,
      subject: subject,
      sent_at: new Date().toISOString(),
      message_id: info.messageId,
    });
    
    return { success: true };
  } catch (error) {
    console.error('❌ Failed to send email:', error);
    return { success: false, error };
  }
}

// New function to send bulk emails to multiple employees
export async function sendBulkEmployeeEmail(
  recipients: Array<{ email: string; name: string }>,
  subject: string,
  htmlContent: string
): Promise<{ success: boolean; sentCount: number; errors: any[] }> {
  const results = {
    success: true,
    sentCount: 0,
    errors: [] as any[]
  };

  for (const recipient of recipients) {
    try {
      const result = await sendEmployeeEmail(
        recipient.email,
        subject,
        htmlContent,
        recipient.name
      );
      
      if (result.success) {
        results.sentCount++;
      } else {
        results.errors.push({ email: recipient.email, error: result.error });
      }
    } catch (error) {
      results.errors.push({ email: recipient.email, error });
    }
  }

  results.success = results.errors.length === 0;
  return results;
}

// Alert Templates for Employees
export const employeeAlertTemplates = {
  leaveApproved: (data: {
    employeeName: string;
    leaveType: string;
    startDate: string;
    endDate: string;
    duration: number;
  }) => ({
    subject: `✅ Leave Request Approved - ${data.employeeName}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 5px;">
        <div style="text-align: center; margin-bottom: 20px;">
          <h2 style="color: #1e3a8a; margin: 0;">ORA TECH EMS</h2>
        </div>
        
        <h3 style="color: #059669; border-bottom: 2px solid #059669; padding-bottom: 10px;">Leave Request Approved ✅</h3>
        
        <div style="margin: 20px 0; padding: 15px; background-color: #f9f9f9; border-radius: 5px;">
          <p><strong>Employee:</strong> ${data.employeeName}</p>
          <p><strong>Leave Type:</strong> ${data.leaveType}</p>
          <p><strong>Duration:</strong> ${data.startDate} to ${data.endDate} (${data.duration} days)</p>
        </div>
        
        <div style="margin-top: 20px; padding: 15px; background-color: #d1fae5; border-left: 4px solid #059669; border-radius: 3px;">
          <p style="margin: 0; color: #065f46;">
            <strong>Status:</strong> Your leave request has been approved. Enjoy your time off!
          </p>
        </div>
        
        <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e0e0e0; font-size: 12px; color: #666;">
          <p>This is an automated message from the ORA TECH Employee Management System.</p>
        </div>
      </div>
    `,
  }),

  leaveRejected: (data: {
    employeeName: string;
    leaveType: string;
    startDate: string;
    endDate: string;
    duration: number;
    reason: string;
  }) => ({
    subject: `❌ Leave Request Rejected - ${data.employeeName}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 5px;">
        <div style="text-align: center; margin-bottom: 20px;">
          <h2 style="color: #1e3a8a; margin: 0;">ORA TECH EMS</h2>
        </div>
        
        <h3 style="color: #dc2626; border-bottom: 2px solid #dc2626; padding-bottom: 10px;">Leave Request Rejected ❌</h3>
        
        <div style="margin: 20px 0; padding: 15px; background-color: #f9f9f9; border-radius: 5px;">
          <p><strong>Employee:</strong> ${data.employeeName}</p>
          <p><strong>Leave Type:</strong> ${data.leaveType}</p>
          <p><strong>Duration:</strong> ${data.startDate} to ${data.endDate} (${data.duration} days)</p>
        </div>
        
        <div style="margin-top: 20px; padding: 15px; background-color: #fee2e2; border-left: 4px solid #dc2626; border-radius: 3px;">
          <p style="margin: 0; color: #991b1b;">
            <strong>Reason for Rejection:</strong> ${data.reason}
          </p>
        </div>
        
        <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e0e0e0; font-size: 12px; color: #666;">
          <p>This is an automated message from the ORA TECH Employee Management System.</p>
        </div>
      </div>
    `,
  }),

  leaveRequest: (data: {
    employeeName: string;
    leaveType: string;
    startDate: string;
    endDate: string;
    duration: number;
  }) => ({
    subject: `📝 Leave Request Submitted - ${data.employeeName}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 5px;">
        <div style="text-align: center; margin-bottom: 20px;">
          <h2 style="color: #1e3a8a; margin: 0;">ORA TECH EMS</h2>
        </div>
        
        <h3 style="color: #f59e0b; border-bottom: 2px solid #f59e0b; padding-bottom: 10px;">Leave Request Submitted 📝</h3>
        
        <div style="margin: 20px 0; padding: 15px; background-color: #f9f9f9; border-radius: 5px;">
          <p><strong>Employee:</strong> ${data.employeeName}</p>
          <p><strong>Leave Type:</strong> ${data.leaveType}</p>
          <p><strong>Duration:</strong> ${data.startDate} to ${data.endDate} (${data.duration} days)</p>
        </div>
        
        <div style="margin-top: 20px; padding: 15px; background-color: #fff3cd; border-left: 4px solid #f59e0b; border-radius: 3px;">
          <p style="margin: 0; color: #856404;">
            <strong>Status:</strong> Your leave request has been submitted and is pending approval.
          </p>
        </div>
        
        <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e0e0e0; font-size: 12px; color: #666;">
          <p>This is an automated message from the ORA TECH Employee Management System.</p>
        </div>
      </div>
    `,
  }),

  generalAlert: (data: {
    type: string;
    message: string;
    sentBy: string;
  }) => {
    const typeIcons = {
      event: '🎉',
      security: '🚨',
      warning: '⚠️',
      urgent: '🔥',
      general: '📢',
    };
    
    const icon = typeIcons[data.type as keyof typeof typeIcons] || '📢';
    
    return {
      subject: `${icon} ${data.type.toUpperCase()}: New Alert from Admin`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 10px;">
          <div style="background: white; padding: 30px; border-radius: 8px;">
            <div style="text-align: center; margin-bottom: 20px;">
              <h2 style="color: #1e3a8a; margin: 0;">ORA TECH EMS</h2>
              <p style="color: #64748b; margin: 5px 0 0;">Employee Alert System</p>
            </div>
            
            <div style="background-color: #f8fafc; padding: 20px; border-radius: 8px; margin-bottom: 20px; border-left: 4px solid ${
              data.type === 'urgent' ? '#dc2626' : 
              data.type === 'warning' ? '#f59e0b' : 
              data.type === 'security' ? '#9333ea' : 
              data.type === 'event' ? '#3b82f6' : '#475569'
            }">
              <h3 style="margin: 0 0 10px 0; color: #1e293b;">${data.type.toUpperCase()} ALERT</h3>
              <p style="font-size: 1.1rem; line-height: 1.6; color: #334155; margin: 0;">${data.message}</p>
            </div>
            
            <div style="background-color: #f1f5f9; padding: 15px; border-radius: 8px;">
              <p style="margin: 0; color: #475569; font-size: 0.9rem;">
                <strong>Sent by:</strong> ${data.sentBy}<br>
                <strong>Date:</strong> ${new Date().toLocaleString()}
              </p>
            </div>
            
            <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e2e8f0; font-size: 12px; color: #94a3b8; text-align: center;">
              <p>This is an automated alert from ORA TECH Employee Management System.</p>
              <p>Please take necessary action if required.</p>
            </div>
          </div>
        </div>
      `,
    };
  },
};