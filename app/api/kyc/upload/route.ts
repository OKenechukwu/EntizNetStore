import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'
import { ObjectStorageService } from '@/server/objectStorage'

// Valid KYC document types for EntizNetStore
const VALID_DOCUMENT_TYPES = [
  'identity', 
  'business_license', 
  'tax_document', 
  'address_proof', 
  'bank_statement'
] as const

type DocumentType = typeof VALID_DOCUMENT_TYPES[number]

export async function POST(request: NextRequest) {
  try {
    // Validate the user server-side
    const supabase = await createServerSupabase()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Only sellers can upload KYC documents (capability = seller profile presence)
    const { data: sellerProfile } = await supabase
      .from('profiles_seller')
      .select('id')
      .eq('id', user.id)
      .single()
    if (!sellerProfile) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    const { documentType } = await request.json()
    
    if (!documentType) {
      return NextResponse.json({ error: 'Document type is required' }, { status: 400 })
    }

    // Validate document type
    if (!VALID_DOCUMENT_TYPES.includes(documentType as DocumentType)) {
      return NextResponse.json({ error: 'Invalid document type' }, { status: 400 })
    }

    const objectStorageService = new ObjectStorageService()
    const uploadURL = await objectStorageService.getKYCDocumentUploadURL(user.id, documentType)

    return NextResponse.json({ 
      uploadURL,
      method: 'PUT'
    })
  } catch (error) {
    console.error('Error generating upload URL:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}