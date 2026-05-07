// lib/supabaseAuthHelper.ts
import { createClient } from '@/lib/supabaseServer'
import { NextResponse } from 'next/server'

export async function getAuthenticatedUser() {
  try {
    const supabase = await createClient()
    
    // First try to get the user directly
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    
    if (userError) {
      console.error('Error getting user:', userError)
      return { error: 'Authentication failed', status: 401 }
    }

    if (!user) {
      console.error('No user found')
      return { error: 'Unauthorized - No user found', status: 401 }
    }

    // Get user profile with role
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profileError || !profile) {
      console.error('Profile error:', profileError)
      return { error: 'Profile not found', status: 404 }
    }

    return { 
      user, 
      profile, 
      supabase,
      error: null 
    }
  } catch (error: any) {
    console.error('Unexpected error in getAuthenticatedUser:', error)
    return { error: 'Internal server error', status: 500 }
  }
}