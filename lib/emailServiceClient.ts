// lib/emailServiceClient.ts
// This is a client-safe version that doesn't use server modules
// It's meant to be used in client components for logging only

export async function getHREmail(): Promise<string> {
  // In client components, we'll fetch this from an API endpoint
  try {
    const response = await fetch('/api/settings/hr-email');
    const data = await response.json();
    return data.email || 'oratechems@gmail.com';
  } catch (error) {
    console.error('Error fetching HR email:', error);
    return 'oratechems@gmail.com';
  }
}

// This function is just for logging in client components
// Actual email sending happens in server API routes
export function logEmailAttempt(
  subject: string, 
  to: string,
  type: string
): void {
  console.log(`📧 [CLIENT] Would send email:`, {
    to,
    subject,
    type,
    timestamp: new Date().toISOString()
  });
}