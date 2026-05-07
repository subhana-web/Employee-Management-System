// app/api/upload-photo/route.js
import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export async function POST(request) {
  const formData = await request.formData()
  const file = formData.get('file')
  const employee_id = formData.get('employee_id')

  if (!file || !employee_id) {
    return NextResponse.json({ error: 'File and employee_id required' }, { status: 400 })
  }

  // Correct path: profile-photos/employee_123
  const filePath = `employee_${employee_id}`

  const { data, error } = await supabaseAdmin.storage
    .from('profile-photos')
    .upload(filePath, file, {
      upsert: true,
      contentType: file.type, // Important for correct MIME type
    })

  if (error) {
    console.error('Upload error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const { data: urlData } = supabaseAdmin.storage
    .from('profile-photos')
    .getPublicUrl(filePath)

  // Save URL to employees table
  const { error: dbError } = await supabaseAdmin
    .from('employees')
    .update({ profile_photo: urlData.publicUrl })
    .eq('employee_id', employee_id)

  if (dbError) {
    console.error('DB update error:', dbError)
    return NextResponse.json({ error: dbError.message }, { status: 500 })
  }

  return NextResponse.json({ url: urlData.publicUrl })
}