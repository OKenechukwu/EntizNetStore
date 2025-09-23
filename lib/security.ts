// Security utilities and age verification
export const AGE_VERIFICATION_REQUIRED = 18

export function isValidAge(dateOfBirth: string): boolean {
  if (!dateOfBirth) return false
  
  const birthDate = new Date(dateOfBirth)
  const today = new Date()
  const age = today.getFullYear() - birthDate.getFullYear()
  const monthDiff = today.getMonth() - birthDate.getMonth()
  
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    return age - 1 >= AGE_VERIFICATION_REQUIRED
  }
  
  return age >= AGE_VERIFICATION_REQUIRED
}

export function sanitizeInput(input: string): string {
  return input
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<[^>]*>?/gm, '')
    .trim()
}

export function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}

export function validatePassword(password: string): {
  isValid: boolean
  errors: string[]
} {
  const errors: string[] = []
  
  if (password.length < 8) {
    errors.push('Password must be at least 8 characters long')
  }
  
  if (!/(?=.*[a-z])/.test(password)) {
    errors.push('Password must contain at least one lowercase letter')
  }
  
  if (!/(?=.*[A-Z])/.test(password)) {
    errors.push('Password must contain at least one uppercase letter')
  }
  
  if (!/(?=.*\d)/.test(password)) {
    errors.push('Password must contain at least one number')
  }
  
  if (!/(?=.*[!@#$%^&*])/.test(password)) {
    errors.push('Password must contain at least one special character (!@#$%^&*)')
  }
  
  return {
    isValid: errors.length === 0,
    errors
  }
}

// Secure encryption system for EntizNetStore using Web Crypto API
export class MessageEncryption {
  private static readonly ALGORITHM = 'AES-GCM'
  private static readonly KEY_LENGTH = 256

  // Generate a new encryption key for conversations
  static async generateConversationKey(): Promise<CryptoKey> {
    return await crypto.subtle.generateKey(
      {
        name: this.ALGORITHM,
        length: this.KEY_LENGTH,
      },
      true, // extractable for storage
      ['encrypt', 'decrypt']
    )
  }

  // Export key to store in database (encrypted with user's master key)
  static async exportKey(key: CryptoKey): Promise<string> {
    const exported = await crypto.subtle.exportKey('raw', key)
    return btoa(String.fromCharCode(...new Uint8Array(exported)))
  }

  // Import key from database
  static async importKey(keyData: string): Promise<CryptoKey> {
    const rawKey = new Uint8Array(
      atob(keyData)
        .split('')
        .map(char => char.charCodeAt(0))
    )
    
    return await crypto.subtle.importKey(
      'raw',
      rawKey,
      { name: this.ALGORITHM },
      true,
      ['encrypt', 'decrypt']
    )
  }

  // Encrypt a message
  static async encryptMessage(message: string, key: CryptoKey): Promise<{
    encrypted: string
    iv: string
  }> {
    const encoder = new TextEncoder()
    const data = encoder.encode(message)
    const iv = crypto.getRandomValues(new Uint8Array(12)) // 96-bit IV for AES-GCM

    const encrypted = await crypto.subtle.encrypt(
      {
        name: this.ALGORITHM,
        iv: iv,
      },
      key,
      data
    )

    return {
      encrypted: btoa(String.fromCharCode(...new Uint8Array(encrypted))),
      iv: btoa(String.fromCharCode(...iv))
    }
  }

  // Decrypt a message
  static async decryptMessage(
    encryptedData: string, 
    ivData: string, 
    key: CryptoKey
  ): Promise<string> {
    try {
      const encrypted = new Uint8Array(
        atob(encryptedData)
          .split('')
          .map(char => char.charCodeAt(0))
      )
      
      const iv = new Uint8Array(
        atob(ivData)
          .split('')
          .map(char => char.charCodeAt(0))
      )

      const decrypted = await crypto.subtle.decrypt(
        {
          name: this.ALGORITHM,
          iv: iv,
        },
        key,
        encrypted
      )

      const decoder = new TextDecoder()
      return decoder.decode(decrypted)
    } catch (error) {
      console.error('Decryption failed:', error)
      return '[Message could not be decrypted]'
    }
  }

  // Generate conversation key ID from participant IDs
  static generateConversationId(userId1: string, userId2: string): string {
    const sortedIds = [userId1, userId2].sort()
    return btoa(sortedIds.join(':'))
  }
}

export function encryptSensitiveData(data: string): string {
  // Use proper base64 encoding for non-message sensitive data
  return btoa(unescape(encodeURIComponent(data)))
}

export function decryptSensitiveData(encryptedData: string): string {
  try {
    return decodeURIComponent(escape(atob(encryptedData)))
  } catch {
    return encryptedData
  }
}