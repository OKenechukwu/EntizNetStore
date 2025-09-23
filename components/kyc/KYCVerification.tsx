'use client'

import { useState, useEffect } from 'react'
import { useBrand } from '@/components/BrandProvider'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import DocumentUpload from './DocumentUpload'
import IdentityVerification from './IdentityVerification'
import VerificationStatus from './VerificationStatus'

interface KYCVerificationProps {
  sellerId: string
  onVerificationComplete?: () => void
}

export default function KYCVerification({ sellerId, onVerificationComplete }: KYCVerificationProps) {
  const { brand, theme } = useBrand()
  const [currentStep, setCurrentStep] = useState(1)
  const [kycData, setKYCData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const supabase = createClientComponentClient()

  useEffect(() => {
    loadKYCData()
  }, [sellerId])

  const loadKYCData = async () => {
    try {
      const { data, error } = await supabase
        .from('seller_kyc')
        .select('*')
        .eq('seller_id', sellerId)
        .single()

      if (error && error.code !== 'PGRST116') {
        throw error
      }

      if (data) {
        setKYCData(data)
        setCurrentStep(getNextStepFromStatus(data.status))
      } else {
        // Create initial KYC record
        const { data: newKYC, error: createError } = await supabase
          .from('seller_kyc')
          .insert({
            seller_id: sellerId,
            status: 'pending',
            verification_level: brand === 'primediscreet' ? 'elite' : 'standard',
            created_at: new Date().toISOString()
          })
          .select()
          .single()

        if (createError) throw createError
        setKYCData(newKYC)
      }
    } catch (error) {
      console.error('Error loading KYC data:', error)
    } finally {
      setLoading(false)
    }
  }

  const getNextStepFromStatus = (status: string) => {
    switch (status) {
      case 'pending': return 1
      case 'documents_uploaded': return 2
      case 'identity_verified': return 3
      case 'approved': return 4
      case 'rejected': return 1
      default: return 1
    }
  }

  const steps = [
    {
      id: 1,
      title: brand === 'primediscreet' ? 'Elite Document Upload' : 'Document Upload',
      description: brand === 'primediscreet' 
        ? 'Upload high-quality identification and business documents for elite verification'
        : 'Upload your identification and business documents',
      component: DocumentUpload,
      required: true
    },
    {
      id: 2,
      title: brand === 'primediscreet' ? 'Elite Identity Verification' : 'Identity Verification',
      description: brand === 'primediscreet'
        ? 'Complete advanced identity verification for elite marketplace access'
        : 'Complete identity verification process',
      component: IdentityVerification,
      required: true
    },
    {
      id: 3,
      title: brand === 'primediscreet' ? 'Elite Review Process' : 'Review & Approval',
      description: brand === 'primediscreet'
        ? 'Elite team review - typically completed within 24 hours'
        : 'Our team will review your application within 2-3 business days',
      component: VerificationStatus,
      required: false
    },
    {
      id: 4,
      title: brand === 'primediscreet' ? 'Elite Access Granted' : 'Verification Complete',
      description: brand === 'primediscreet'
        ? 'Welcome to the elite marketplace! Start selling premium products.'
        : 'You\'re now a verified seller! Start listing your products.',
      component: VerificationStatus,
      required: false
    }
  ]

  const updateKYCStatus = async (newStatus: string, additionalData: any = {}) => {
    try {
      const { error } = await supabase
        .from('seller_kyc')
        .update({
          status: newStatus,
          ...additionalData,
          updated_at: new Date().toISOString()
        })
        .eq('seller_id', sellerId)

      if (error) throw error

      setKYCData(prev => ({
        ...prev,
        status: newStatus,
        ...additionalData
      }))

      if (newStatus === 'approved' && onVerificationComplete) {
        onVerificationComplete()
      }
    } catch (error) {
      console.error('Error updating KYC status:', error)
    }
  }

  const handleStepComplete = (stepId: number, data: any) => {
    switch (stepId) {
      case 1:
        updateKYCStatus('documents_uploaded', { documents: data })
        setCurrentStep(2)
        break
      case 2:
        updateKYCStatus('identity_verified', { identity_data: data })
        setCurrentStep(3)
        break
      default:
        break
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin w-8 h-8 border-4 border-current border-t-transparent rounded-full"
             style={{ color: theme.colors.accent }}></div>
      </div>
    )
  }

  const getRequirements = () => {
    const baseRequirements = [
      'Government-issued photo ID (passport, driver\'s license)',
      'Proof of address (utility bill, bank statement)',
      'Business registration documents (if applicable)',
      'Tax identification number'
    ]

    if (brand === 'primediscreet') {
      return [
        ...baseRequirements,
        'Professional references or portfolio',
        'Enhanced background verification',
        'Premium seller agreement acceptance'
      ]
    }

    return baseRequirements
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Header */}
      <div className="text-center">
        <h1 className="text-3xl font-bold mb-4" style={{ color: theme.colors.text.primary }}>
          {brand === 'primediscreet' ? 'Elite Seller Verification' : 'Seller Verification'}
        </h1>
        <p className="text-lg" style={{ color: theme.colors.text.secondary }}>
          {brand === 'primediscreet' 
            ? 'Complete elite verification to access the premium marketplace'
            : 'Complete verification to start selling on our marketplace'
          }
        </p>
      </div>

      {/* Progress Steps */}
      <div className="relative">
        <div className="flex items-center justify-between">
          {steps.map((step, index) => (
            <div key={step.id} className="flex flex-col items-center relative">
              {/* Step Circle */}
              <div className={`w-12 h-12 rounded-full flex items-center justify-center font-bold transition-all ${
                currentStep >= step.id 
                  ? 'text-white' 
                  : 'border-2'
              }`}
              style={{
                backgroundColor: currentStep >= step.id ? theme.colors.accent : 'transparent',
                borderColor: currentStep >= step.id ? theme.colors.accent : theme.colors.glass.border,
                color: currentStep >= step.id 
                  ? (brand === 'primediscreet' ? theme.colors.background : theme.colors.text.primary)
                  : theme.colors.text.secondary
              }}>
                {currentStep > step.id ? '✓' : step.id}
              </div>

              {/* Step Label */}
              <div className="mt-2 text-center max-w-32">
                <div className={`text-sm font-medium ${
                  currentStep >= step.id ? '' : 'opacity-60'
                }`} style={{ color: theme.colors.text.primary }}>
                  {step.title}
                </div>
              </div>

              {/* Connector Line */}
              {index < steps.length - 1 && (
                <div 
                  className="absolute top-6 left-full w-full h-0.5 -translate-y-1/2"
                  style={{ 
                    backgroundColor: currentStep > step.id ? theme.colors.accent : theme.colors.glass.border,
                    width: 'calc(100% - 3rem)',
                    marginLeft: '1.5rem'
                  }}
                />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Requirements Overview */}
      {currentStep === 1 && (
        <div className="p-6 rounded-lg" style={{ backgroundColor: theme.colors.surface }}>
          <h3 className="text-lg font-semibold mb-4" style={{ color: theme.colors.text.primary }}>
            {brand === 'primediscreet' ? 'Elite Verification Requirements' : 'Verification Requirements'}
          </h3>
          <ul className="space-y-2">
            {getRequirements().map((requirement, index) => (
              <li key={index} className="flex items-start gap-3">
                <span style={{ color: theme.colors.accent }}>•</span>
                <span style={{ color: theme.colors.text.primary }}>{requirement}</span>
              </li>
            ))}
          </ul>
          
          {brand === 'primediscreet' && (
            <div className="mt-4 p-4 rounded border-l-4" style={{ 
              backgroundColor: theme.colors.background,
              borderColor: theme.colors.accent
            }}>
              <div className="flex items-start gap-3">
                <div className="text-lg">👑</div>
                <div>
                  <h4 className="font-medium" style={{ color: theme.colors.text.primary }}>
                    Elite Marketplace Benefits
                  </h4>
                  <p className="text-sm mt-1" style={{ color: theme.colors.text.secondary }}>
                    • Lower platform fees (8% vs 10%)
                    • Priority customer support
                    • Enhanced seller tools and analytics
                    • Access to exclusive buyer demographics
                    • Premium branding and showcase features
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Current Step Component */}
      <div className="min-h-96">
        {steps.map(step => {
          if (step.id !== currentStep) return null
          
          const StepComponent = step.component
          return (
            <StepComponent
              key={step.id}
              sellerId={sellerId}
              kycData={kycData}
              onComplete={(data: any) => handleStepComplete(step.id, data)}
              verificationLevel={brand === 'primediscreet' ? 'elite' : 'standard'}
            />
          )
        })}
      </div>

      {/* Footer */}
      {currentStep < 3 && (
        <div className="text-center text-sm" style={{ color: theme.colors.text.secondary }}>
          🔒 {brand === 'primediscreet' 
            ? 'Elite-grade secure verification process. All information is encrypted and protected.'
            : 'Your information is secure and encrypted. We never share your personal data.'
          }
        </div>
      )}
    </div>
  )
}