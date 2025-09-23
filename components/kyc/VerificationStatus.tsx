'use client'

import { useBrand } from '@/components/BrandProvider'

interface VerificationStatusProps {
  sellerId: string
  kycData: any
  onComplete?: (data: any) => void
  verificationLevel: 'standard' | 'elite'
}

export default function VerificationStatus({ 
  sellerId, 
  kycData, 
  onComplete, 
  verificationLevel 
}: VerificationStatusProps) {
  const { brand, theme } = useBrand()

  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'pending':
        return {
          icon: '⏳',
          title: brand === 'primediscreet' ? 'Elite Review Pending' : 'Review Pending',
          description: brand === 'primediscreet' 
            ? 'Your elite application is being reviewed by our specialist team'
            : 'Your application is being reviewed by our team',
          color: '#FFC107',
          estimatedTime: brand === 'primediscreet' ? '24 hours' : '2-3 business days'
        }
      case 'documents_uploaded':
        return {
          icon: '📄',
          title: 'Documents Received',
          description: 'Your documents have been received and are being processed',
          color: '#17A2B8',
          estimatedTime: brand === 'primediscreet' ? '24 hours' : '2-3 business days'
        }
      case 'identity_verified':
        return {
          icon: '🔍',
          title: brand === 'primediscreet' ? 'Elite Verification in Progress' : 'Verification in Progress',
          description: brand === 'primediscreet' 
            ? 'Final elite verification checks are being completed'
            : 'Final verification checks are being completed',
          color: '#6F42C1',
          estimatedTime: brand === 'primediscreet' ? '12 hours' : '1-2 business days'
        }
      case 'approved':
        return {
          icon: '🎉',
          title: brand === 'primediscreet' ? 'Elite Access Granted!' : 'Verification Approved!',
          description: brand === 'primediscreet' 
            ? 'Welcome to the elite marketplace! You now have full access to premium seller features.'
            : 'Congratulations! You are now a verified seller and can start listing products.',
          color: '#28A745',
          estimatedTime: null
        }
      case 'rejected':
        return {
          icon: '❌',
          title: 'Verification Declined',
          description: 'Unfortunately, we cannot approve your application at this time. Please see details below.',
          color: '#DC3545',
          estimatedTime: null
        }
      case 'requires_additional_info':
        return {
          icon: '📋',
          title: 'Additional Information Required',
          description: 'We need some additional information to complete your verification.',
          color: '#FD7E14',
          estimatedTime: null
        }
      default:
        return {
          icon: '❓',
          title: 'Status Unknown',
          description: 'Please contact support for assistance.',
          color: '#6C757D',
          estimatedTime: null
        }
    }
  }

  const statusConfig = getStatusConfig(kycData?.status || 'pending')

  const getNextSteps = (status: string) => {
    switch (status) {
      case 'pending':
      case 'documents_uploaded':
      case 'identity_verified':
        return [
          'We will review your application and documents',
          'You may be contacted for additional information',
          'You will receive an email notification once review is complete',
          'Check back here for real-time status updates'
        ]
      case 'approved':
        return brand === 'primediscreet' ? [
          'Start creating your elite product listings',
          'Access premium seller analytics and tools',
          'Enjoy reduced platform fees (8% vs 10%)',
          'Receive priority customer support',
          'Showcase your products to exclusive buyers'
        ] : [
          'Start creating and publishing your product listings',
          'Set up your seller profile and storefront',
          'Configure your payment and shipping settings',
          'Begin reaching customers on our marketplace'
        ]
      case 'rejected':
        return [
          'Review the feedback provided below',
          'Address any issues mentioned in the rejection reason',
          'Gather any additional required documentation',
          'Submit a new application when ready'
        ]
      case 'requires_additional_info':
        return [
          'Check the specific information requested',
          'Gather the required documents or details',
          'Submit the additional information promptly',
          'Your application will resume review once received'
        ]
      default:
        return ['Contact support for assistance']
    }
  }

  const getTimelineEvents = () => {
    const events = [
      {
        title: 'Application Started',
        description: 'KYC verification process initiated',
        completed: true,
        timestamp: kycData?.created_at
      },
      {
        title: 'Documents Uploaded',
        description: 'Required documents submitted for review',
        completed: ['documents_uploaded', 'identity_verified', 'approved'].includes(kycData?.status),
        timestamp: kycData?.documents_uploaded_at
      },
      {
        title: 'Identity Verified',
        description: 'Personal and business information confirmed',
        completed: ['identity_verified', 'approved'].includes(kycData?.status),
        timestamp: kycData?.identity_verified_at
      },
      {
        title: brand === 'primediscreet' ? 'Elite Review Complete' : 'Review Complete',
        description: brand === 'primediscreet' ? 'Elite team review and approval' : 'Final approval and account activation',
        completed: kycData?.status === 'approved',
        timestamp: kycData?.approved_at
      }
    ]

    return events
  }

  const formatDate = (dateString: string) => {
    if (!dateString) return null
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  return (
    <div className="space-y-8">
      {/* Status Header */}
      <div className="text-center p-8 rounded-lg" style={{ 
        backgroundColor: statusConfig.color + '10',
        border: `2px solid ${statusConfig.color}40`
      }}>
        <div className="text-6xl mb-4">{statusConfig.icon}</div>
        <h2 className="text-2xl font-bold mb-2" style={{ color: statusConfig.color }}>
          {statusConfig.title}
        </h2>
        <p className="text-lg" style={{ color: theme.colors.text.primary }}>
          {statusConfig.description}
        </p>
        {statusConfig.estimatedTime && (
          <p className="text-sm mt-2" style={{ color: theme.colors.text.secondary }}>
            Estimated completion time: {statusConfig.estimatedTime}
          </p>
        )}
      </div>

      {/* Timeline */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold" style={{ color: theme.colors.text.primary }}>
          Verification Timeline
        </h3>
        
        <div className="space-y-4">
          {getTimelineEvents().map((event, index) => (
            <div key={index} className="flex items-start gap-4">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                event.completed ? 'text-white' : 'border-2'
              }`}
              style={{
                backgroundColor: event.completed ? '#28A745' : 'transparent',
                borderColor: event.completed ? '#28A745' : theme.colors.glass.border,
                color: event.completed ? 'white' : theme.colors.text.secondary
              }}>
                {event.completed ? '✓' : index + 1}
              </div>
              
              <div className="flex-1">
                <h4 className="font-medium" style={{ color: theme.colors.text.primary }}>
                  {event.title}
                </h4>
                <p className="text-sm" style={{ color: theme.colors.text.secondary }}>
                  {event.description}
                </p>
                {event.timestamp && (
                  <p className="text-xs mt-1" style={{ color: theme.colors.text.secondary }}>
                    {formatDate(event.timestamp)}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Next Steps */}
      <div className="p-6 rounded-lg" style={{ backgroundColor: theme.colors.surface }}>
        <h3 className="text-lg font-semibold mb-4" style={{ color: theme.colors.text.primary }}>
          {kycData?.status === 'approved' ? 'Get Started' : 'Next Steps'}
        </h3>
        
        <ul className="space-y-2">
          {getNextSteps(kycData?.status || 'pending').map((step, index) => (
            <li key={index} className="flex items-start gap-3">
              <span style={{ color: theme.colors.accent }}>•</span>
              <span style={{ color: theme.colors.text.primary }}>{step}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Action Buttons */}
      {kycData?.status === 'approved' && (
        <div className="text-center">
          <button
            onClick={() => window.location.href = '/seller/products/new'}
            className="px-8 py-3 rounded-lg font-semibold text-lg transition-all"
            style={{
              backgroundColor: theme.colors.accent,
              color: brand === 'primediscreet' ? theme.colors.background : theme.colors.text.primary
            }}
          >
            {brand === 'primediscreet' ? 'Create Elite Product' : 'Create Your First Product'}
          </button>
        </div>
      )}

      {kycData?.status === 'rejected' && (
        <div className="text-center">
          <button
            onClick={() => window.location.reload()}
            className="px-8 py-3 rounded-lg font-semibold transition-all mr-4"
            style={{
              backgroundColor: theme.colors.surface,
              color: theme.colors.text.primary,
              border: `1px solid ${theme.colors.glass.border}`
            }}
          >
            Start New Application
          </button>
          <button
            onClick={() => window.location.href = '/support'}
            className="px-8 py-3 rounded-lg font-semibold transition-all"
            style={{
              backgroundColor: theme.colors.accent,
              color: brand === 'primediscreet' ? theme.colors.background : theme.colors.text.primary
            }}
          >
            Contact Support
          </button>
        </div>
      )}

      {/* Support Information */}
      <div className="p-4 rounded-lg" style={{ backgroundColor: theme.colors.background }}>
        <div className="flex items-start gap-3">
          <div className="text-lg">💬</div>
          <div>
            <h4 className="font-medium" style={{ color: theme.colors.text.primary }}>
              Need Help?
            </h4>
            <p className="text-sm mt-1" style={{ color: theme.colors.text.secondary }}>
              {brand === 'primediscreet' 
                ? 'Our elite support team is available 24/7 to assist with your verification process.'
                : 'Our support team is here to help with any questions about the verification process.'
              }
            </p>
            <button 
              className="text-sm mt-2 underline"
              style={{ color: theme.colors.accent }}
              onClick={() => window.location.href = '/support'}
            >
              Contact Support →
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}