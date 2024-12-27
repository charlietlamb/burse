'use client'

import { Input } from '@burse/design-system/components/ui/input'
import { cn } from '@burse/design-system/lib/utils'
import { ChevronDown, Phone } from 'lucide-react'
import React, { forwardRef } from 'react'
import * as RPNInput from 'react-phone-number-input'
import flags from 'react-phone-number-input/flags'
import { TanstackForm } from '../tanstack-form'
import FieldInfo from '../field-info'
import { useFormContext } from '../form-context'
import RequiredLabel from '@burse/design-system/components/misc/required-label'

interface PhoneNumberInputProps {
  form: TanstackForm<any>
  name: string
  label: string
  placeholder?: string
  required?: boolean
  className?: string
}

export default function PhoneNumberInput({
  form,
  name,
  label,
  placeholder = 'Enter phone number',
  required,
  className,
}: PhoneNumberInputProps) {
  const { attemptSubmitted } = useFormContext()

  return (
    <form.Field name={name}>
      {(field) => (
        <div className={cn('flex flex-col gap-1', className)}>
          <RequiredLabel
            htmlFor={field.name}
            className="font-heading text-foreground text-base font-semibold"
          >
            {label}
          </RequiredLabel>
          <div className="relative">
            <RPNInput.default
              className="shadow-black/5 flex rounded-lg shadow-sm"
              international
              flagComponent={FlagComponent}
              countrySelectComponent={CountrySelect}
              inputComponent={PhoneInput}
              id={field.name}
              name={field.name}
              placeholder={placeholder}
              value={field.state.value ?? ''}
              onChange={(value) => field.handleChange(value ?? '')}
              onBlur={field.handleBlur}
            />
          </div>
          {attemptSubmitted && <FieldInfo field={field} />}
        </div>
      )}
    </form.Field>
  )
}

const PhoneInput = forwardRef<HTMLInputElement, React.ComponentProps<'input'>>(
  ({ className, ...props }, ref) => {
    return (
      <Input
        className={cn(
          '-ms-px rounded-s-none shadow-none focus-visible:z-10',
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)

PhoneInput.displayName = 'PhoneInput'

type CountrySelectProps = {
  disabled?: boolean
  value: RPNInput.Country
  onChange: (value: RPNInput.Country) => void
  options: { label: string; value: RPNInput.Country | undefined }[]
}

const CountrySelect = ({
  disabled,
  value,
  onChange,
  options,
}: CountrySelectProps) => {
  const handleSelect = (event: React.ChangeEvent<HTMLSelectElement>) => {
    onChange(event.target.value as RPNInput.Country)
  }

  return (
    <div className="relative inline-flex items-center self-stretch rounded-s-lg border border-input bg-background py-2 pe-2 ps-3 text-muted-foreground transition-shadow focus-within:z-10 focus-within:border-ring focus-within:outline-none focus-within:ring-[3px] focus-within:ring-ring/20 hover:bg-accent hover:text-foreground has-[:disabled]:pointer-events-none has-[:disabled]:opacity-50">
      <div className="inline-flex items-center gap-1" aria-hidden="true">
        <FlagComponent country={value} countryName={value} aria-hidden="true" />
        <span className="text-muted-foreground/80">
          <ChevronDown size={16} strokeWidth={2} aria-hidden="true" />
        </span>
      </div>
      <select
        disabled={disabled}
        value={value}
        onChange={handleSelect}
        className="absolute inset-0 text-sm opacity-0"
        aria-label="Select country"
      >
        <option key="default" value="">
          Select a country
        </option>
        {options
          .filter((x) => x.value)
          .map((option, i) => (
            <option key={option.value ?? `empty-${i}`} value={option.value}>
              {option.label}{' '}
              {option.value &&
                `+${RPNInput.getCountryCallingCode(option.value)}`}
            </option>
          ))}
      </select>
    </div>
  )
}

const FlagComponent = ({ country, countryName }: RPNInput.FlagProps) => {
  const Flag = flags[country]

  return (
    <span className="w-5 overflow-hidden rounded-sm">
      {Flag ? (
        <Flag title={countryName} />
      ) : (
        <Phone size={16} aria-hidden="true" />
      )}
    </span>
  )
}
