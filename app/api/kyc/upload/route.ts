import { NextRequest, NextResponse } from 'next/server'
import { ObjectStorageService } from '@/server/objectStorage'
import { getCurrentUser } from '@/lib/auth'

export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Only sellers can upload KYC documents
    if (user.user_metadata?.role !== 'seller') {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    const { documentType } = await request.json()
    
    if (!documentType) {
      return NextResponse.json({ error: 'Document type is required' }, { status: 400 })
    }

    // Validate document type
    const validTypes = ['identity', 'business_license', 'tax_document', 'address_proof', 'bank_statement']
    if (!validTypes.includes(documentType)) {
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