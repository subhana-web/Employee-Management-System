// lib/alerts.ts
// Client-safe version that uses API routes instead of direct Supabase

export interface Alert {
  id: string;
  type: 'leave' | 'absence' | 'event' | 'security' | 'general';
  message: string;
  employee_id: number | null;
  leave_id: number | null;
  status: 'active' | 'resolved' | 'dismissed';
  sent_by: string | null;
  sent_at: string;
  created_at: string;
  employees?: {
    employee_id: number;
    first_name: string;
    last_name: string | null;
    email: string;
    phone?: string;
  };
}

// Function to create a new alert
export async function createAlert(
  type: Alert['type'],
  message: string,
  sentBy?: string,
  employeeId?: number,
  leaveId?: number
): Promise<Alert> {
  const response = await fetch('/api/alerts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      type,
      message,
      sent_by: sentBy,
      employee_id: employeeId,
      leave_id: leaveId
    }),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || 'Failed to create alert');
  }

  const data = await response.json();
  return data.alert || data;
}

// Function to fetch all alerts
export async function getAlerts(options?: {
  type?: string;
  status?: string;
  limit?: number;
  employeeId?: number;
}): Promise<Alert[]> {
  const params = new URLSearchParams();
  if (options?.type) params.append('type', options.type);
  if (options?.status) params.append('status', options.status);
  if (options?.limit) params.append('limit', options.limit.toString());
  if (options?.employeeId) params.append('employeeId', options.employeeId.toString());

  const response = await fetch(`/api/alerts?${params.toString()}`);
  
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || 'Failed to fetch alerts');
  }

  return response.json();
}

// Function to resolve an alert
export async function resolveAlert(alertId: string): Promise<void> {
  const response = await fetch('/api/alerts', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: alertId, status: 'resolved' }),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || 'Failed to resolve alert');
  }
}

// Function to delete an alert
export async function deleteAlert(alertId: string): Promise<void> {
  const response = await fetch(`/api/alerts?id=${alertId}`, {
    method: 'DELETE',
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || 'Failed to delete alert');
  }
}

// Function to get all employees (for sending alerts)
export async function getAllEmployees() {
  const response = await fetch('/api/employees');
  
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || 'Failed to fetch employees');
  }

  return response.json();
}

// Function to get HR email setting
export async function getHREmailSetting(): Promise<string> {
  try {
    const response = await fetch('/api/settings/hr-email');
    const data = await response.json();
    return data.email || 'oratechems@gmail.com';
  } catch (error) {
    console.error('Error fetching HR email:', error);
    return 'oratechems@gmail.com';
  }
}

// Function to update HR email setting
export async function updateHREmailSetting(email: string): Promise<void> {
  const response = await fetch('/api/settings/hr-email', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || 'Failed to update HR email');
  }
}

// Function to send a manual alert to all employees
export async function sendManualAlert(
  type: Alert['type'],
  message: string,
  sentBy: string
): Promise<Alert> {
  return createAlert(type, message, sentBy);
}

// Function to send leave request alert (called from server)
export async function sendLeaveAlert(
  employeeId: number,
  leaveId: number,
  employeeName: string,
  leaveType: string,
  startDate: string,
  endDate: string,
  duration: number,
  reason: string
): Promise<void> {
  // This is typically called from server-side, but we'll use the API
  const response = await fetch('/api/alerts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      type: 'leave',
      message: `${employeeName} requested ${leaveType} leave (${duration} days)`,
      employee_id: employeeId,
      leave_id: leaveId
    }),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || 'Failed to send leave alert');
  }
}

// Function to send absence alert (called from cron job)
export async function sendAbsenceAlert(
  employeeId: number,
  employeeName: string,
  absenceDate: string,
  notes?: string
): Promise<void> {
  const response = await fetch('/api/alerts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      type: 'absence',
      message: `${employeeName} is absent on ${absenceDate}${notes ? `: ${notes}` : ''}`,
      employee_id: employeeId
    }),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || 'Failed to send absence alert');
  }
}