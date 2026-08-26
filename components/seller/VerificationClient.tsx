'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

type DocumentType =
  | 'identity'
  | 'business_license'
  | 'tax_document'
  | 'address_proof'
  | 'bank_statement';

type KYCDocument = {
  id: string;
  document_type: DocumentType;
  file_name: string;
  file_size: number;
  mime_type: string;
  verification_status: 'pending' | 'approved' | 'rejected';
  rejection_reason?: string | null;
  uploaded_at: string;
  reviewed_at?: string | null;
};

type VerificationRequest = {
  id: string;
  verification_status:
    | 'pending'
    | 'incomplete'
    | 'under_review'
    | 'needs_information'
    | 'approved'
    | 'rejected';
  reviewer_notes?: string | null;
  required_documents: DocumentType[];
  submitted_documents: DocumentType[];
};

type StatusPayload = {
  sellerStatus: string;
  verificationRequest: VerificationRequest;
  documents: KYCDocument[];
};

const DOCUMENT_TYPES: Record<DocumentType, { label: string; description: string }> = {
  identity: {
    label: 'Government ID',
    description: "Valid passport, driver's license, or national ID card",
  },
  business_license: {
    label: 'Business License',
    description: 'Business registration or operating license',
  },
  tax_document: {
    label: 'Tax Document',
    description: 'Tax registration or equivalent business tax document',
  },
  address_proof: {
    label: 'Address Verification',
    description: 'Recent utility bill, bank statement, or accepted proof of address',
  },
  bank_statement: {
    label: 'Bank Statement',
    description: 'Optional supporting document for payout verification',
  },
};

const MAX_BYTES = 10 * 1024 * 1024;
const ACCEPTED_TYPES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
]);

export default function VerificationClient() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [selectedType, setSelectedType] = useState<DocumentType | null>(null);
  const [data, setData] = useState<StatusPayload | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [uploadingType, setUploadingType] = useState<DocumentType | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void loadStatus();
  }, []);

  async function loadStatus() {
    try {
      setIsLoading(true);
      setError(null);
      const response = await fetch('/api/kyc/status', { cache: 'no-store' });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || 'Unable to load verification status');
      setData(payload as StatusPayload);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to load verification status');
    } finally {
      setIsLoading(false);
    }
  }

  function chooseFile(documentType: DocumentType) {
    setSelectedType(documentType);
    inputRef.current?.click();
  }

  async function uploadSelectedFile(file: File | undefined) {
    const documentType = selectedType;
    if (!file || !documentType) return;
    setError(null);

    if (file.size <= 0 || file.size > MAX_BYTES || !ACCEPTED_TYPES.has(file.type.toLowerCase())) {
      setError('KYC documents must be PDF, JPEG, PNG, or WebP and no larger than 10MB.');
      return;
    }

    setUploadingType(documentType);
    try {
      const initResponse = await fetch('/api/kyc/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ documentType, fileName: file.name }),
      });
      const init = await initResponse.json().catch(() => ({}));
      if (!initResponse.ok || !init.uploadURL || !init.filePath) {
        throw new Error(init.error || 'Unable to initialize secure KYC upload');
      }

      const uploadResponse = await fetch(init.uploadURL, {
        method: 'PUT',
        headers: { 'Content-Type': file.type },
        body: file,
      });
      if (!uploadResponse.ok) throw new Error('KYC upload failed');

      const registerResponse = await fetch('/api/kyc/documents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ documentType, filePath: init.filePath, fileName: file.name }),
      });
      const registered = await registerResponse.json().catch(() => ({}));
      if (!registerResponse.ok) {
        throw new Error(registered.error || 'Unable to register KYC document');
      }

      await loadStatus();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to upload KYC document');
    } finally {
      setUploadingType(null);
      setSelectedType(null);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  async function viewDocument(documentId: string) {
    try {
      const response = await fetch(`/api/kyc/documents/download?id=${encodeURIComponent(documentId)}`);
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.url) throw new Error(payload.error || 'Unable to open document');
      window.open(payload.url, '_blank', 'noopener,noreferrer');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to open document');
    }
  }

  const latestByType = useMemo(() => {
    const map = new Map<DocumentType, KYCDocument>();
    for (const document of data?.documents ?? []) {
      if (!map.has(document.document_type)) map.set(document.document_type, document);
    }
    return map;
  }, [data?.documents]);

  if (isLoading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-accent-gold border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="opacity-80">Loading verification status...</p>
        </div>
      </div>
    );
  }

  const request = data?.verificationRequest;
  const requestStatus = request?.verification_status ?? 'incomplete';
  const required = new Set(request?.required_documents ?? []);

  const statusClasses =
    requestStatus === 'approved'
      ? 'border-green-800 bg-green-950 text-green-100'
      : requestStatus === 'rejected'
        ? 'border-red-800 bg-red-950 text-red-100'
        : requestStatus === 'under_review'
          ? 'border-blue-800 bg-blue-950 text-blue-100'
          : 'border-amber-800 bg-amber-950 text-amber-100';

  return (
    <div className="space-y-8">
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf,image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(event) => void uploadSelectedFile(event.target.files?.[0])}
      />

      <div className="glass-card p-6 md:p-8">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="font-serif text-3xl font-bold text-accent-gold mb-2">Seller Verification</h1>
            <p className="opacity-80">Secure KYC is required before products can be published.</p>
          </div>
          <span className={`w-fit rounded-full border px-4 py-2 text-sm font-medium capitalize ${statusClasses}`}>
            {requestStatus.replace('_', ' ')}
          </span>
        </div>
      </div>

      {error && (
        <div role="alert" className="rounded-lg border border-red-800 bg-red-950 p-4 text-red-100">
          {error}
        </div>
      )}

      {requestStatus === 'approved' && (
        <div className="rounded-lg border border-green-800 bg-green-950 p-4 text-green-100">
          Verification complete. Your Seller capability is verified.
        </div>
      )}
      {requestStatus === 'under_review' && (
        <div className="rounded-lg border border-blue-800 bg-blue-950 p-4 text-blue-100">
          All required documents are submitted and your verification is under review.
        </div>
      )}
      {requestStatus === 'rejected' && (
        <div className="rounded-lg border border-red-800 bg-red-950 p-4 text-red-100">
          <p className="font-semibold">Verification needs resubmission.</p>
          {request?.reviewer_notes && <p className="mt-2 text-sm">{request.reviewer_notes}</p>}
        </div>
      )}
      {requestStatus === 'needs_information' && (
        <div className="rounded-lg border border-amber-800 bg-amber-950 p-4 text-amber-100">
          <p className="font-semibold">More information is required.</p>
          {request?.reviewer_notes && <p className="mt-2 text-sm">{request.reviewer_notes}</p>}
        </div>
      )}

      <section className="glass-card p-6">
        <div className="mb-6">
          <h2 className="font-serif text-xl font-bold text-accent-gold">Verification documents</h2>
          <p className="mt-1 text-sm opacity-70">
            Files stay in private Supabase Storage. EntizNetStore validates their real byte signatures after upload.
          </p>
        </div>

        <div className="space-y-4">
          {(Object.keys(DOCUMENT_TYPES) as DocumentType[]).map((type) => {
            const config = DOCUMENT_TYPES[type];
            const document = latestByType.get(type);
            const isRequired = required.has(type);
            const isUploading = uploadingType === type;

            return (
              <div key={type} className="rounded-lg border border-white/10 p-5">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-semibold">{config.label}</h3>
                      {isRequired && (
                        <span className="rounded bg-amber-950 px-2 py-1 text-xs text-amber-100">Required</span>
                      )}
                      {document && (
                        <span className="rounded bg-white/10 px-2 py-1 text-xs capitalize">
                          {document.verification_status}
                        </span>
                      )}
                    </div>
                    <p className="mt-2 text-sm opacity-70">{config.description}</p>
                    {document && (
                      <div className="mt-3 text-xs opacity-75">
                        <p>{document.file_name}</p>
                        <p>{new Date(document.uploaded_at).toLocaleDateString()}</p>
                        {document.rejection_reason && <p className="mt-1 text-red-300">{document.rejection_reason}</p>}
                      </div>
                    )}
                  </div>

                  <div className="flex shrink-0 gap-2">
                    {document && (
                      <button type="button" onClick={() => void viewDocument(document.id)} className="luxury-button-outline px-3 py-2 text-sm">
                        View
                      </button>
                    )}
                    <button
                      type="button"
                      disabled={isUploading || requestStatus === 'approved' || data?.sellerStatus === 'suspended'}
                      onClick={() => chooseFile(type)}
                      className="luxury-button-outline px-3 py-2 text-sm disabled:opacity-50"
                    >
                      {isUploading ? 'Uploading…' : document?.verification_status === 'rejected' ? 'Replace' : 'Upload'}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
