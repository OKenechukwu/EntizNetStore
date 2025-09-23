'use client'

import { useState } from 'react'
import { useBrand } from '@/components/BrandProvider'

interface IdentityVerificationProps {
  sellerId: string
  kycData: any
  onComplete: (data: any) => void
  verificationLevel: 'standard' | 'elite'
}

export default function IdentityVerification({ 
  sellerId, 
  kycData, 
  onComplete, 
  verificationLevel 
}: IdentityVerificationProps) {
  const { brand, theme } = useBrand()
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    dateOfBirth: '',
    nationality: '',
    phoneNumber: '',
    businessName: '',
    businessType: '',
    businessAddress: {
      street: '',
      city: '',
      state: '',
      zipCode: '',
      country: 'US'
    },
    bankAccountInfo: {
      accountHolderName: '',
      bankName: '',
      accountType: 'checking',
      routingNumber: '',
      accountNumber: ''
    },
    additionalInfo: {
      yearsInBusiness: '',
      expectedMonthlyVolume: '',
      productCategories: [],
      hasBusinessLicense: false,
      agreeToTerms: false,
      agreeToBackgroundCheck: false
    }
  })
  const [currentSection, setCurrentSection] = useState(1)
  const [submitting, setSubmitting] = useState(false)

  const sections = [
    {
      id: 1,
      title: 'Personal Information',
      icon: '👤'
    },
    {
      id: 2,
      title: 'Business Information',
      icon: '🏢'
    },
    {
      id: 3,
      title: 'Banking Information',
      icon: '🏦'
    },
    {
      id: 4,
      title: 'Additional Details',
      icon: '📋'
    }
  ]

  const productCategories = [
    'Adult Toys & Accessories',
    'Lingerie & Intimate Apparel',
    'Wellness & Health Products',
    'Educational Materials',
    'Couples\' Products',
    'Premium Collections',
    ...(verificationLevel === 'elite' ? [
      'Luxury Artisan Products',
      'Custom/Bespoke Items',
      'Exclusive Collections'
    ] : [])
  ]

  const updateFormData = (section: string, field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      [section]: {
        ...prev[section as keyof typeof prev],
        [field]: value
      }
    }))
  }

  const handleCategoryToggle = (category: string) => {
    const currentCategories = formData.additionalInfo.productCategories
    const isSelected = currentCategories.includes(category)
    
    updateFormData('additionalInfo', 'productCategories', 
      isSelected 
        ? currentCategories.filter(c => c !== category)
        : [...currentCategories, category]
    )
  }

  const validateSection = (sectionId: number) => {
    switch (sectionId) {
      case 1:
        return formData.firstName && formData.lastName && formData.dateOfBirth && formData.nationality
      case 2:
        return formData.businessAddress.street && formData.businessAddress.city && formData.businessAddress.state
      case 3:
        return formData.bankAccountInfo.accountHolderName && formData.bankAccountInfo.bankName
      case 4:
        return formData.additionalInfo.agreeToTerms && formData.additionalInfo.agreeToBackgroundCheck
      default:
        return false
    }
  }

  const handleSubmit = async () => {
    if (!validateSection(4)) {
      alert('Please complete all required fields and accept the terms')
      return
    }

    setSubmitting(true)
    
    try {
      // Simulate identity verification API call
      await new Promise(resolve => setTimeout(resolve, 2000))
      
      onComplete({
        personalInfo: {
          firstName: formData.firstName,
          lastName: formData.lastName,
          dateOfBirth: formData.dateOfBirth,
          nationality: formData.nationality,
          phoneNumber: formData.phoneNumber
        },
        businessInfo: {
          businessName: formData.businessName,
          businessType: formData.businessType,
          businessAddress: formData.businessAddress
        },
        bankingInfo: {
          accountHolderName: formData.bankAccountInfo.accountHolderName,
          bankName: formData.bankAccountInfo.bankName,
          accountType: formData.bankAccountInfo.accountType
        },
        additionalInfo: formData.additionalInfo,
        verificationLevel,
        completedAt: new Date().toISOString()
      })
    } catch (error) {
      console.error('Identity verification error:', error)
      alert('Verification failed. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-xl font-semibold mb-2" style={{ color: theme.colors.text.primary }}>
          {brand === 'primediscreet' ? 'Elite Identity Verification' : 'Identity Verification'}
        </h2>
        <p style={{ color: theme.colors.text.secondary }}>
          {brand === 'primediscreet' 
            ? 'Complete your elite seller profile with enhanced verification'
            : 'Complete your seller profile and business information'
          }
        </p>
      </div>

      {/* Section Navigation */}
      <div className="flex justify-center">
        <div className="flex space-x-4">
          {sections.map(section => (
            <button
              key={section.id}
              onClick={() => setCurrentSection(section.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${
                currentSection === section.id ? 'border-2' : 'border'
              }`}
              style={{
                borderColor: currentSection === section.id ? theme.colors.accent : theme.colors.glass.border,
                backgroundColor: currentSection === section.id ? theme.colors.surface : 'transparent',
                color: theme.colors.text.primary
              }}
            >
              <span>{section.icon}</span>
              <span className="text-sm font-medium">{section.title}</span>
              {validateSection(section.id) && (
                <span className="text-green-500">✓</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Section Content */}
      <div className="max-w-2xl mx-auto">
        {/* Personal Information */}
        {currentSection === 1 && (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold" style={{ color: theme.colors.text.primary }}>
              Personal Information
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: theme.colors.text.primary }}>
                  First Name *
                </label>
                <input
                  type="text"
                  value={formData.firstName}
                  onChange={(e) => setFormData(prev => ({ ...prev, firstName: e.target.value }))}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2"
                  style={{
                    backgroundColor: theme.colors.surface,
                    borderColor: theme.colors.glass.border,
                    color: theme.colors.text.primary
                  }}
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: theme.colors.text.primary }}>
                  Last Name *
                </label>
                <input
                  type="text"
                  value={formData.lastName}
                  onChange={(e) => setFormData(prev => ({ ...prev, lastName: e.target.value }))}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2"
                  style={{
                    backgroundColor: theme.colors.surface,
                    borderColor: theme.colors.glass.border,
                    color: theme.colors.text.primary
                  }}
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: theme.colors.text.primary }}>
                  Date of Birth *
                </label>
                <input
                  type="date"
                  value={formData.dateOfBirth}
                  onChange={(e) => setFormData(prev => ({ ...prev, dateOfBirth: e.target.value }))}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2"
                  style={{
                    backgroundColor: theme.colors.surface,
                    borderColor: theme.colors.glass.border,
                    color: theme.colors.text.primary
                  }}
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: theme.colors.text.primary }}>
                  Nationality *
                </label>
                <select
                  value={formData.nationality}
                  onChange={(e) => setFormData(prev => ({ ...prev, nationality: e.target.value }))}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2"
                  style={{
                    backgroundColor: theme.colors.surface,
                    borderColor: theme.colors.glass.border,
                    color: theme.colors.text.primary
                  }}
                  required
                >
                  <option value="">Select nationality</option>
                  <option value="US">United States</option>
                  <option value="CA">Canada</option>
                  <option value="GB">United Kingdom</option>
                  <option value="AU">Australia</option>
                  <option value="DE">Germany</option>
                  <option value="FR">France</option>
                  <option value="other">Other</option>
                </select>
              </div>
              
              <div className="md:col-span-2">
                <label className="block text-sm font-medium mb-2" style={{ color: theme.colors.text.primary }}>
                  Phone Number
                </label>
                <input
                  type="tel"
                  value={formData.phoneNumber}
                  onChange={(e) => setFormData(prev => ({ ...prev, phoneNumber: e.target.value }))}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2"
                  style={{
                    backgroundColor: theme.colors.surface,
                    borderColor: theme.colors.glass.border,
                    color: theme.colors.text.primary
                  }}
                  placeholder="+1 (555) 123-4567"
                />
              </div>
            </div>
          </div>
        )}

        {/* Business Information */}
        {currentSection === 2 && (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold" style={{ color: theme.colors.text.primary }}>
              Business Information
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: theme.colors.text.primary }}>
                  Business Name
                </label>
                <input
                  type="text"
                  value={formData.businessName}
                  onChange={(e) => setFormData(prev => ({ ...prev, businessName: e.target.value }))}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2"
                  style={{
                    backgroundColor: theme.colors.surface,
                    borderColor: theme.colors.glass.border,
                    color: theme.colors.text.primary
                  }}
                  placeholder="Your business or personal name"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: theme.colors.text.primary }}>
                  Business Type
                </label>
                <select
                  value={formData.businessType}
                  onChange={(e) => setFormData(prev => ({ ...prev, businessType: e.target.value }))}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2"
                  style={{
                    backgroundColor: theme.colors.surface,
                    borderColor: theme.colors.glass.border,
                    color: theme.colors.text.primary
                  }}
                >
                  <option value="">Select business type</option>
                  <option value="sole_proprietorship">Sole Proprietorship</option>
                  <option value="llc">LLC</option>
                  <option value="corporation">Corporation</option>
                  <option value="partnership">Partnership</option>
                  <option value="individual">Individual Seller</option>
                </select>
              </div>
              
              <div className="md:col-span-2">
                <label className="block text-sm font-medium mb-2" style={{ color: theme.colors.text.primary }}>
                  Business Address *
                </label>
                <input
                  type="text"
                  value={formData.businessAddress.street}
                  onChange={(e) => updateFormData('businessAddress', 'street', e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 mb-2"
                  style={{
                    backgroundColor: theme.colors.surface,
                    borderColor: theme.colors.glass.border,
                    color: theme.colors.text.primary
                  }}
                  placeholder="Street address"
                  required
                />
                
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  <input
                    type="text"
                    value={formData.businessAddress.city}
                    onChange={(e) => updateFormData('businessAddress', 'city', e.target.value)}
                    className="px-3 py-2 border rounded-lg focus:outline-none focus:ring-2"
                    style={{
                      backgroundColor: theme.colors.surface,
                      borderColor: theme.colors.glass.border,
                      color: theme.colors.text.primary
                    }}
                    placeholder="City"
                    required
                  />
                  <input
                    type="text"
                    value={formData.businessAddress.state}
                    onChange={(e) => updateFormData('businessAddress', 'state', e.target.value)}
                    className="px-3 py-2 border rounded-lg focus:outline-none focus:ring-2"
                    style={{
                      backgroundColor: theme.colors.surface,
                      borderColor: theme.colors.glass.border,
                      color: theme.colors.text.primary
                    }}
                    placeholder="State"
                    required
                  />
                  <input
                    type="text"
                    value={formData.businessAddress.zipCode}
                    onChange={(e) => updateFormData('businessAddress', 'zipCode', e.target.value)}
                    className="px-3 py-2 border rounded-lg focus:outline-none focus:ring-2"
                    style={{
                      backgroundColor: theme.colors.surface,
                      borderColor: theme.colors.glass.border,
                      color: theme.colors.text.primary
                    }}
                    placeholder="ZIP Code"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Banking Information */}
        {currentSection === 3 && (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold" style={{ color: theme.colors.text.primary }}>
              Banking Information
            </h3>
            <p className="text-sm" style={{ color: theme.colors.text.secondary }}>
              Required for seller payouts and tax reporting
            </p>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium mb-2" style={{ color: theme.colors.text.primary }}>
                  Account Holder Name *
                </label>
                <input
                  type="text"
                  value={formData.bankAccountInfo.accountHolderName}
                  onChange={(e) => updateFormData('bankAccountInfo', 'accountHolderName', e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2"
                  style={{
                    backgroundColor: theme.colors.surface,
                    borderColor: theme.colors.glass.border,
                    color: theme.colors.text.primary
                  }}
                  placeholder="Full name as it appears on bank account"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: theme.colors.text.primary }}>
                  Bank Name *
                </label>
                <input
                  type="text"
                  value={formData.bankAccountInfo.bankName}
                  onChange={(e) => updateFormData('bankAccountInfo', 'bankName', e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2"
                  style={{
                    backgroundColor: theme.colors.surface,
                    borderColor: theme.colors.glass.border,
                    color: theme.colors.text.primary
                  }}
                  placeholder="Bank name"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: theme.colors.text.primary }}>
                  Account Type
                </label>
                <select
                  value={formData.bankAccountInfo.accountType}
                  onChange={(e) => updateFormData('bankAccountInfo', 'accountType', e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2"
                  style={{
                    backgroundColor: theme.colors.surface,
                    borderColor: theme.colors.glass.border,
                    color: theme.colors.text.primary
                  }}
                >
                  <option value="checking">Checking</option>
                  <option value="savings">Savings</option>
                  <option value="business">Business</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {/* Additional Details */}
        {currentSection === 4 && (
          <div className="space-y-6">
            <h3 className="text-lg font-semibold" style={{ color: theme.colors.text.primary }}>
              Additional Details
            </h3>
            
            {/* Product Categories */}
            <div>
              <label className="block text-sm font-medium mb-3" style={{ color: theme.colors.text.primary }}>
                Product Categories (select all that apply)
              </label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {productCategories.map(category => (
                  <label key={category} className="flex items-center space-x-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.additionalInfo.productCategories.includes(category)}
                      onChange={() => handleCategoryToggle(category)}
                      className="rounded"
                    />
                    <span style={{ color: theme.colors.text.primary }}>{category}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Terms and Agreements */}
            <div className="space-y-4 pt-4 border-t" style={{ borderColor: theme.colors.glass.border }}>
              <label className="flex items-start space-x-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.additionalInfo.agreeToTerms}
                  onChange={(e) => updateFormData('additionalInfo', 'agreeToTerms', e.target.checked)}
                  className="rounded mt-1"
                  required
                />
                <span style={{ color: theme.colors.text.primary }}>
                  I agree to the{' '}
                  <span style={{ color: theme.colors.accent }}>Seller Terms of Service</span>
                  {brand === 'primediscreet' && (
                    <> and <span style={{ color: theme.colors.accent }}>Elite Marketplace Agreement</span></>
                  )}
                  *
                </span>
              </label>

              <label className="flex items-start space-x-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.additionalInfo.agreeToBackgroundCheck}
                  onChange={(e) => updateFormData('additionalInfo', 'agreeToBackgroundCheck', e.target.checked)}
                  className="rounded mt-1"
                  required
                />
                <span style={{ color: theme.colors.text.primary }}>
                  I consent to background verification checks and identity validation
                  {brand === 'primediscreet' && ' including enhanced elite verification procedures'}
                  *
                </span>
              </label>
            </div>
          </div>
        )}
      </div>

      {/* Navigation Buttons */}
      <div className="flex justify-between items-center pt-6">
        <button
          onClick={() => setCurrentSection(Math.max(1, currentSection - 1))}
          disabled={currentSection === 1}
          className="px-6 py-2 border rounded-lg font-medium transition-all disabled:opacity-50"
          style={{
            borderColor: theme.colors.glass.border,
            color: theme.colors.text.secondary
          }}
        >
          Previous
        </button>

        {currentSection < 4 ? (
          <button
            onClick={() => setCurrentSection(Math.min(4, currentSection + 1))}
            disabled={!validateSection(currentSection)}
            className="px-6 py-2 rounded-lg font-medium transition-all disabled:opacity-50"
            style={{
              backgroundColor: validateSection(currentSection) ? theme.colors.accent : theme.colors.background,
              color: validateSection(currentSection) 
                ? (brand === 'primediscreet' ? theme.colors.background : theme.colors.text.primary)
                : theme.colors.text.secondary
            }}
          >
            Next
          </button>
        ) : (
          <button
            onClick={handleSubmit}
            disabled={!validateSection(4) || submitting}
            className="px-8 py-2 rounded-lg font-semibold transition-all disabled:opacity-50"
            style={{
              backgroundColor: validateSection(4) ? theme.colors.accent : theme.colors.background,
              color: validateSection(4) 
                ? (brand === 'primediscreet' ? theme.colors.background : theme.colors.text.primary)
                : theme.colors.text.secondary
            }}
          >
            {submitting ? 'Submitting...' : 
             (brand === 'primediscreet' ? 'Complete Elite Verification' : 'Complete Verification')}
          </button>
        )}
      </div>
    </div>
  )
}