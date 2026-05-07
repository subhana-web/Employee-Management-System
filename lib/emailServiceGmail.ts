// lib/emailServiceGmail.ts
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

export async function getHREmail(): Promise<string> {
  try {
    const supabase = await createAdminClient();
    const { data, error } = await supabase
      .from('notification_settings')
      .select('setting_value')
      .eq('setting_key', 'hr_email')
      .single();
    
    if (error || !data) {
      console.warn('HR email not found, using fallback');
      return 'oratechems@gmail.com';
    }
    
    return data.setting_value;
  } catch (error) {
    console.error('Error fetching HR email:', error);
    return 'oratechems@gmail.com';
  }
}

export async function sendHREmail(
  subject: string, 
  htmlContent: string, 
  textContent?: string
): Promise<{ success: boolean; error?: any; data?: any }> {  // 👈 Added data as optional
  try {
    const hrEmail = await getHREmail();
    
    console.log('📧 Sending email from: oratechems@gmail.com');
    console.log('📧 Sending email to:', hrEmail);
    console.log('Subject:', subject);
    
    // Verify connection configuration
    await transporter.verify();
    
    // Send email
    const info = await transporter.sendMail({
      from: '"EMS Portal" <oratechems@gmail.com>',
      to: hrEmail,
      subject: subject,
      html: htmlContent,
      text: textContent || htmlContent.replace(/<[^>]*>/g, ''),
    });
    
    console.log('✅ Email sent successfully! Message ID:', info.messageId);
    return { success: true, data: info };  // 👈 Now TypeScript knows data is allowed
  } catch (error) {
    console.error('❌ Failed to send email:', error);
    return { success: false, error };
  }
}

// Email templates (same as above)
export const emailTemplates = {
  leaveRequest: (data: {
    employeeName: string;
    leaveType: string;
    startDate: string;
    endDate: string;
    duration: number;
    reason: string;
    leaveId: number;
  }) => ({
    subject: `🚨 Leave Alert: ${data.employeeName} requested ${data.leaveType} leave`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 5px;">
        <h2 style="color: #333; border-bottom: 2px solid #f59e0b; padding-bottom: 10px;">New Leave Request</h2>
        
        <div style="margin: 20px 0; padding: 15px; background-color: #f9f9f9; border-radius: 5px;">
          <p><strong>Employee:</strong> ${data.employeeName}</p>
          <p><strong>Leave Type:</strong> ${data.leaveType}</p>
          <p><strong>Duration:</strong> ${data.startDate} to ${data.endDate} (${data.duration} days)</p>
          <p><strong>Reason:</strong> ${data.reason}</p>
        </div>
        
        <div style="margin-top: 20px; padding: 15px; background-color: #fff3cd; border-left: 4px solid #ffc107; border-radius: 3px;">
          <p style="margin: 0; color: #856404;">
            <strong>Action Required:</strong> Please review this leave request in the HR panel.
          </p>
        </div>
        
        <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e0e0e0; font-size: 12px; color: #666;">
          <p>This is an automated alert from the EMS system.</p>
          <p><a href="${process.env.NEXT_PUBLIC_APP_URL}/hr" style="color: #007bff;">View in HR Panel</a></p>
        </div>
      </div>
    `
  }),
  
  absenceAlert: (data: {
    employeeName: string;
    date: string;
    notes?: string;
  }) => ({
    subject: `⚠️ Absence Alert: ${data.employeeName} is absent today`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 5px;">
        <h2 style="color: #333; border-bottom: 2px solid #dc3545; padding-bottom: 10px;">Employee Absence Detected</h2>
        
        <div style="margin: 20px 0; padding: 15px; background-color: #f9f9f9; border-radius: 5px;">
          <p><strong>Employee:</strong> ${data.employeeName}</p>
          <p><strong>Date:</strong> ${data.date}</p>
          ${data.notes ? `<p><strong>Notes:</strong> ${data.notes}</p>` : ''}
        </div>
        
        <div style="margin-top: 20px; padding: 15px; background-color: #f8d7da; border-left: 4px solid #dc3545; border-radius: 3px;">
          <p style="margin: 0; color: #721c24;">
            <strong>Action Required:</strong> This employee is absent without an approved leave request.
          </p>
        </div>
      </div>
    `
  })
};