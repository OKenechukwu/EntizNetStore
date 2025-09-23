import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { getCurrentUser } from '@/lib/auth'
import { ObjectStorageService } from '@/server/objectStorage'

export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Only sellers can submit KYC documents
    if (user.user_metadata?.role !== 'seller') {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    const { documentType, uploadURL, fileName, fileSize, mimeType } = await request.json()
    
    if (!documentType || !uploadURL || !fileName) {
      return NextResponse.json({ 
        error: 'Document type, upload URL, and file name are required' 
      }, { status: 400 })
    }

    // Normalize the upload URL to get the storage path
    const objectStorageService = new ObjectStorageService()
    const filePath = objectStorageService.normalizeKYCDocumentPath(uploadURL)

    // Create document record in database
    const { data: document, error: insertError } = await supabase
      .from('kyc_documents')
      .insert({
        seller_id: user.id,
        document_type: documentType,
        file_path: filePath,
        file_name: fileName,
        file_size: fileSize,
        mime_type: mimeType,
        verification_status: 'pending'
      })
      .select()
      .single()

    if (insertError) {
      console.error('Error creating document record:', insertError)
      return NextResponse.json({ error: 'Failed to save document' }, { status: 500 })
    }

    // Update verification request with submitted document
    const { data: verificationRequest } = await supabase
      .from('kyc_verification_requests')
      .select('*')
      .eq('seller_id', user.id)
      .single()

    if (verificationRequest) {
      const updatedSubmitted = Array.from(new Set([
        ...verificationRequest.submitted_documents,
        documentType
      ]))
      
      // Check if all required documents are submitted
      const isComplete = verificationRequest.required_documents.every(doc => 
        updatedSubmitted.includes(doc)
      )
      
      await supabase
        .from('kyc_verification_requests')
        .update({
          submitted_documents: updatedSubmitted,
          verification_status: isComplete ? 'under_review' : 'incomplete'
        })
        .eq('id', verificationRequest.id)
    }

    return NextResponse.json({ 
      success: true,
      document: document
    })
  } catch (error) {
    console.error('Error saving KYC document:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}