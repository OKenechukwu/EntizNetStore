'use client'

import { useState } from 'react'
import Select, { StylesConfig, SingleValue } from 'react-select'
import { countries } from '@/data/countries'
import { useBrand } from '@/components/BrandProvider'

interface CountryOption {
  value: string
  label: string
  code: string
}

interface CountrySelectProps {
  value?: string
  onChange: (countryCode: string) => void
  placeholder?: string
  className?: string
  isDisabled?: boolean
}

const countryOptions: CountryOption[] = countries.map(country => ({
  value: country.code,
  label: country.name,
  code: country.code
}))

export default function CountrySelect({
  value,
  onChange,
  placeholder = "Select a country...",
  className = "",
  isDisabled = false
}: CountrySelectProps) {
  const { theme } = useBrand()
  const [inputValue, setInputValue] = useState('')

  const handleChange = (selectedOption: SingleValue<CountryOption>) => {
    if (selectedOption) {
      onChange(selectedOption.value)
    }
  }

  // Custom styles to match luxury theme
  const customStyles: StylesConfig<CountryOption, false> = {
    control: (provided, state) => ({
      ...provided,
      backgroundColor: theme.colors.background,
      borderColor: state.isFocused ? theme.colors.accent : theme.colors.glass.border,
      borderWidth: state.isFocused ? '2px' : '1px',
      borderRadius: '0.5rem',
      minHeight: '42px',
      boxShadow: state.isFocused ? `0 0 0 1px ${theme.colors.accent}` : 'none',
      '&:hover': {
        borderColor: theme.colors.accent
      }
    }),
    
    input: (provided) => ({
      ...provided,
      color: theme.colors.text.primary,
      fontSize: '14px'
    }),
    
    placeholder: (provided) => ({
      ...provided,
      color: theme.colors.text.secondary,
      fontSize: '14px'
    }),
    
    singleValue: (provided) => ({
      ...provided,
      color: theme.colors.text.primary,
      fontSize: '14px'
    }),
    
    menu: (provided) => ({
      ...provided,
      backgroundColor: theme.colors.surface,
      borderRadius: '0.5rem',
      border: `1px solid ${theme.colors.glass.border}`,
      boxShadow: '0 10px 25px rgba(0, 0, 0, 0.1)',
      zIndex: 50
    }),
    
    menuList: (provided) => ({
      ...provided,
      padding: '0.25rem',
      maxHeight: '200px'
    }),
    
    option: (provided, state) => ({
      ...provided,
      backgroundColor: state.isSelected 
        ? theme.colors.accent 
        : state.isFocused 
          ? `${theme.colors.accent}20`
          : 'transparent',
      color: state.isSelected 
        ? theme.colors.background 
        : theme.colors.text.primary,
      borderRadius: '0.25rem',
      margin: '0.125rem 0',
      fontSize: '14px',
      fontWeight: state.isSelected ? '500' : '400',
      cursor: 'pointer',
      '&:hover': {
        backgroundColor: state.isSelected 
          ? theme.colors.accent 
          : `${theme.colors.accent}30`
      }
    }),
    
    dropdownIndicator: (provided) => ({
      ...provided,
      color: theme.colors.text.secondary,
      '&:hover': {
        color: theme.colors.accent
      }
    }),
    
    clearIndicator: (provided) => ({
      ...provided,
      color: theme.colors.text.secondary,
      '&:hover': {
        color: theme.colors.accent
      }
    }),
    
    indicatorSeparator: (provided) => ({
      ...provided,
      backgroundColor: theme.colors.glass.border
    })
  }

  // Find the selected option
  const selectedOption = countryOptions.find(option => option.value === value)

  // Filter options based on input
  const filterOption = (option: any, rawInput: string) => {
    if (!rawInput) return true
    const input = rawInput.toLowerCase()
    return (
      option.label.toLowerCase().includes(input) ||
      (option.data?.code && option.data.code.toLowerCase().includes(input))
    )
  }

  return (
    <div className={className}>
      <Select<CountryOption>
        value={selectedOption}
        onChange={handleChange}
        options={countryOptions}
        styles={customStyles}
        placeholder={placeholder}
        isSearchable
        isClearable
        isDisabled={isDisabled}
        filterOption={filterOption}
        inputValue={inputValue}
        onInputChange={(newValue) => setInputValue(newValue)}
        formatOptionLabel={(option) => (
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono opacity-60">{option.code}</span>
            <span>{option.label}</span>
          </div>
        )}
        noOptionsMessage={({ inputValue }) => 
          inputValue ? `No countries found matching "${inputValue}"` : 'No countries available'
        }
        classNamePrefix="country-select"
        menuPortalTarget={typeof document !== 'undefined' ? document.body : null}
        menuPosition="fixed"
      />
    </div>
  )
}