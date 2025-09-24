// Simple exchange rates for demo purposes
// In production, you'd fetch from a real API like exchangerate-api.com
export const exchangeRates = {
  USD: 1,      // Base currency
  EUR: 0.85,   // Euro
  GBP: 0.73,   // British Pound
  CAD: 1.25,   // Canadian Dollar
  AUD: 1.35,   // Australian Dollar
  JPY: 110,    // Japanese Yen
  CHF: 0.92,   // Swiss Franc
  SEK: 8.5,    // Swedish Krona
  NOK: 8.8,    // Norwegian Krone
  DKK: 6.4,    // Danish Krone
}

export const currencySymbols = {
  USD: '$',
  EUR: '€',
  GBP: '£',
  CAD: 'C$',
  AUD: 'A$',
  JPY: '¥',
  CHF: 'CHF',
  SEK: 'kr',
  NOK: 'kr',
  DKK: 'kr',
}

export type Currency = keyof typeof exchangeRates

export function convertPrice(
  amount: number, 
  fromCurrency: Currency = 'USD', 
  toCurrency: Currency = 'USD'
): number {
  if (fromCurrency === toCurrency) return amount
  
  // Convert to USD first, then to target currency
  const usdAmount = amount / exchangeRates[fromCurrency]
  return usdAmount * exchangeRates[toCurrency]
}

export function formatCurrency(
  amount: number, 
  currency: Currency = 'USD',
  locale: string = 'en-US'
): string {
  const symbol = currencySymbols[currency]
  
  // Format based on currency
  if (currency === 'JPY') {
    // Japanese Yen doesn't use decimal places
    return `${symbol}${Math.round(amount).toLocaleString(locale)}`
  }
  
  // For most currencies, use 2 decimal places
  return `${symbol}${amount.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`
}

export function formatPrice(
  amount: number,
  fromCurrency: Currency = 'USD',
  toCurrency: Currency = 'USD',
  locale: string = 'en-US'
): string {
  const convertedAmount = convertPrice(amount, fromCurrency, toCurrency)
  return formatCurrency(convertedAmount, toCurrency, locale)
}