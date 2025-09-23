// Server-side validation utilities for EntizNetStore
import { AGE_VERIFICATION_REQUIRED, isValidAge, sanitizeInput } from './security'

export interface ValidationResult {
  isValid: boolean
  errors: string[]
}

export interface ProfileValidationData {
  dateOfBirth?: string
  country?: string
  displayName?: string
  bio?: string
  businessType?: string
}

// Age verification for adult content marketplace
export function validateAge(dateOfBirth: string): ValidationResult {
  const errors: string[] = []
  
  if (!dateOfBirth) {
    errors.push('Date of birth is required for age verification')
    return { isValid: false, errors }
  }

  if (!isValidAge(dateOfBirth)) {
    errors.push(`You must be at least ${AGE_VERIFICATION_REQUIRED} years old to use this platform`)
    return { isValid: false, errors }
  }

  return { isValid: true, errors: [] }
}

// Validate and sanitize profile data
export function validateProfileData(data: ProfileValidationData): ValidationResult {
  const errors: string[] = []
  
  // Age verification if date of birth provided
  if (data.dateOfBirth) {
    const ageValidation = validateAge(data.dateOfBirth)
    if (!ageValidation.isValid) {
      errors.push(...ageValidation.errors)
    }
  }

  // Validate display name
  if (data.displayName) {
    const sanitized = sanitizeInput(data.displayName)
    if (sanitized.length === 0) {
      errors.push('Display name cannot be empty or contain only invalid characters')
    }
    if (sanitized.length > 50) {
      errors.push('Display name cannot exceed 50 characters')
    }
  }

  // Validate bio content
  if (data.bio) {
    const sanitized = sanitizeInput(data.bio)
    if (sanitized.length > 500) {
      errors.push('Bio cannot exceed 500 characters')
    }
    // Check for inappropriate content patterns
    if (containsInappropriateContent(sanitized)) {
      errors.push('Bio contains inappropriate content')
    }
  }

  // Validate business type for sellers
  if (data.businessType) {
    const validBusinessTypes = ['individual', 'business', 'creator']
    if (!validBusinessTypes.includes(data.businessType)) {
      errors.push('Invalid business type')
    }
  }

  // Validate country
  if (data.country) {
    const sanitized = sanitizeInput(data.country)
    if (sanitized.length === 0) {
      errors.push('Invalid country selection')
    }
  }

  return { isValid: errors.length === 0, errors }
}

// Content validation for products
export interface ProductValidationData {
  title: string
  description: string
  ageRestriction?: number
  tags?: string[]
  basePrice: number
}

export function validateProductData(data: ProductValidationData): ValidationResult {
  const errors: string[] = []

  // Validate title
  const sanitizedTitle = sanitizeInput(data.title)
  if (sanitizedTitle.length === 0) {
    errors.push('Product title is required')
  }
  if (sanitizedTitle.length > 100) {
    errors.push('Product title cannot exceed 100 characters')
  }

  // Validate description
  const sanitizedDescription = sanitizeInput(data.description)
  if (sanitizedDescription.length === 0) {
    errors.push('Product description is required')
  }
  if (sanitizedDescription.length > 2000) {
    errors.push('Product description cannot exceed 2000 characters')
  }

  // Check for inappropriate content
  if (containsInappropriateContent(sanitizedTitle) || 
      containsInappropriateContent(sanitizedDescription)) {
    errors.push('Product content contains inappropriate material')
  }

  // Validate age restriction
  if (data.ageRestriction !== undefined) {
    if (data.ageRestriction < 18 || data.ageRestriction > 21) {
      errors.push('Age restriction must be between 18 and 21')
    }
  }

  // Validate price
  if (data.basePrice <= 0) {
    errors.push('Product price must be greater than 0')
  }
  if (data.basePrice > 10000) {
    errors.push('Product price cannot exceed $10,000')
  }

  // Validate tags
  if (data.tags && data.tags.length > 0) {
    const sanitizedTags = data.tags.map(tag => sanitizeInput(tag)).filter(tag => tag.length > 0)
    if (sanitizedTags.length > 10) {
      errors.push('Cannot have more than 10 tags')
    }
    for (const tag of sanitizedTags) {
      if (tag.length > 30) {
        errors.push('Tags cannot exceed 30 characters each')
      }
    }
  }

  return { isValid: errors.length === 0, errors }
}

// Message content validation
export function validateMessageContent(content: string): ValidationResult {
  const errors: string[] = []
  
  const sanitized = sanitizeInput(content)
  if (sanitized.length === 0) {
    errors.push('Message cannot be empty')
  }
  
  if (sanitized.length > 1000) {
    errors.push('Message cannot exceed 1000 characters')
  }

  // Check for spam patterns
  if (containsSpamPatterns(sanitized)) {
    errors.push('Message appears to contain spam content')
  }

  return { isValid: errors.length === 0, errors }
}

// Helper function to detect inappropriate content
function containsInappropriateContent(text: string): boolean {
  // Basic content filtering - in production, use more sophisticated filters
  const inappropriatePatterns = [
    /\b(illegal|underage|minor)\b/i,
    /\b(violence|harm|abuse)\b/i,
    /\b(drugs|illegal substances)\b/i
  ]

  return inappropriatePatterns.some(pattern => pattern.test(text))
}

// Helper function to detect spam patterns
function containsSpamPatterns(text: string): boolean {
  // Basic spam detection
  const spamPatterns = [
    /(.)\1{10,}/, // Repeated characters
    /\b(buy now|click here|free money|guaranteed)\b/i,
    /(http|www\.)/gi // URL detection in messages
  ]

  // Check for excessive repetition
  if ((text.match(/(.)\1{5,}/g) || []).length > 3) {
    return true
  }

  return spamPatterns.some(pattern => pattern.test(text))
}

// Sanitize and validate file uploads
export interface FileValidationData {
  fileName: string
  fileSize: number
  mimeType: string
  maxSize?: number
  allowedTypes?: string[]
}

export function validateFileUpload(data: FileValidationData): ValidationResult {
  const errors: string[] = []
  
  const maxSize = data.maxSize || 10 * 1024 * 1024 // 10MB default
  const allowedTypes = data.allowedTypes || [
    'application/pdf',
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/webp'
  ]

  // Validate file size
  if (data.fileSize > maxSize) {
    errors.push(`File size exceeds maximum allowed size of ${Math.round(maxSize / (1024 * 1024))}MB`)
  }

  // Validate file type
  if (!allowedTypes.includes(data.mimeType)) {
    errors.push('File type not allowed. Please upload PDF or image files only.')
  }

  // Validate file name
  const sanitizedFileName = sanitizeInput(data.fileName)
  if (sanitizedFileName.length === 0) {
    errors.push('Invalid file name')
  }

  // Check for suspicious file extensions
  const suspiciousExtensions = ['.exe', '.bat', '.sh', '.php', '.js', '.html']
  if (suspiciousExtensions.some(ext => data.fileName.toLowerCase().endsWith(ext))) {
    errors.push('File type not allowed for security reasons')
  }

  return { isValid: errors.length === 0, errors }
}