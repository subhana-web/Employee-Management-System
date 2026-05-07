// app/api/email/send/route.ts
import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: 'oratechems@gmail.com',
    pass: process.env.GMAIL_APP_PASSWORD,
  },
});

export async function POST(request: Request) {
  try {
    const { to, subject, html, employeeName } = await request.json();

    if (!to || !subject || !html) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    console.log(`📧 Sending email to: ${employeeName || 'Employee'} (${to})`);
    
    await transporter.verify();
    
    const info = await transporter.sendMail({
      from: '"ORA TECH" <oratechems@gmail.com>', // Simplified sender name
      to: to,
      subject: subject,
      html: html,
    });
    
    console.log('✅ Email sent! ID:', info.messageId);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error sending email:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to send email' },
      { status: 500 }
    );
  }
}