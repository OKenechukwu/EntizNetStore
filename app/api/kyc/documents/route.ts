import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { createServerSupabase } from '@/lib/supabase/server'
import { ObjectStorageService } from '@/server/objectStorage'
import { setObjectAclPolicy, ObjectAccessGroupType, ObjectPermission } from '@/server/objectAcl'
import { sanitizeInput } from '@/lib/security'

// File type validation
const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/jpg', 
  'image/png',
  'image/webp'
] as const

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB

export async function POST(request: NextRequest) {
  try {
    // Validate the user server-side
    const serverSupabase = createServerSupabase()
    const { data: { user }, error: authError } = await serverSupabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Only sellers can submit KYC documents (capability = seller profile presence)
    const { data: sellerProfile } = await serverSupabase
      .from('profiles_seller')
      .select('id')
      .eq('id', user.id)
      .single()
    if (!sellerProfile) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    const { documentType, uploadURL, fileName, fileSize, mimeType } = await request.json()
    
    if (!documentType || !uploadURL || !fileName) {
      return NextResponse.json({ 
        error: 'Document type, upload URL, and file name are required' 
      }, { status: 400 })
    }

    // Validate file size
    if (fileSize && fileSize > MAX_FILE_SIZE) {
      return NextResponse.json({ 
        error: 'File size too large. Maximum 10MB allowed.' 
      }, { status: 400 })
    }

    // Validate MIME type
    if (mimeType && !ALLOWED_MIME_TYPES.includes(mimeType as any)) {
      return NextResponse.json({ 
        error: 'Invalid file type. Only PDF and image files are allowed.' 
      }, { status: 400 })
    }

    // Sanitize inputs
    const sanitizedFileName = sanitizeInput(fileName)
    const sanitizedDocumentType = sanitizeInput(documentType)

    const objectStorageService = new ObjectStorageService()
    
    try {
      // Normalize the upload URL to get the storage path
      const filePath = objectStorageService.normalizeObjectEntityPath(uploadURL)

      // Set ACL policy for the uploaded KYC document
      await objectStorageService.trySetObjectEntityAclPolicy(uploadURL, {
        owner: user.id,
        visibility: "private", // KYC documents are always private
        aclRules: [
          {
            group: { type: ObjectAccessGroupType.SELLER_ONLY, id: user.id },
            permission: ObjectPermission.READ
          },
          {
            group: { type: ObjectAccessGroupType.KYC_REVIEWER, id: "kyc_reviewer" },
            permission: ObjectPermission.READ
          }
        ]
      })

      // Create document record in database
      const { data: document, error: insertError } = await supabase
        .from('kyc_documents')
        .insert({
          seller_id: user.id,
          document_type: sanitizedDocumentType,
          file_path: filePath,
          file_name: sanitizedFileName,
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
          sanitizedDocumentType
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
    } catch (aclError) {
      console.error('Error setting ACL policy:', aclError)
      return NextResponse.json({ error: 'Failed to secure document' }, { status: 500 })
    }
  } catch (error) {
    console.error('Error saving KYC document:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}