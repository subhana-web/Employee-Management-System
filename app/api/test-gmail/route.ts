// app/api/test-gmail/route.ts
import { NextResponse } from 'next/server';
import { sendHREmail } from '@/lib/emailServiceGmail';

export async function GET() {
  try {
    const result = await sendHREmail(
      'Test Email from EMS',
      '<h1>Hello!</h1><p>This is a test email from EMS Portal using Gmail SMTP.</p>',
      'This is a test email from EMS Portal using Gmail SMTP.'
    );
    
    if (result.success) {
      return NextResponse.json({ 
        success: true, 
        message: 'Test email sent successfully!' 
      });
    } else {
      return NextResponse.json({ 
        success: false, 
        error: result.error 
      }, { status: 500 });
    }
  } catch (error: any) {
    return NextResponse.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 });
  }
}