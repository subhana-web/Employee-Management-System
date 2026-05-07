'use server';

import { createClient } from '@/lib/supabaseServer';
import { redirect } from 'next/navigation';

export async function getUserAndRole() {
  const supabase = await createClient();

  const { data: { user }, error: userErr } = await supabase.auth.getUser();
  if (userErr || !user) redirect('/auth/login');

  const { data: profile, error: profErr } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (profErr) throw profErr; // will be caught by Next.js error boundary

// app/auth.ts (or lib/auth.ts)
const role = (profile?.role as 'admin' | 'manager' | 'hr' | 'employee') ?? 'employee';
  return { user, role };
}