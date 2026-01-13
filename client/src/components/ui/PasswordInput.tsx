import React, { useState } from 'react'

import { EyeIcon, EyeOffIcon } from './icons'
import { Input, type InputProps } from './Input'

export type PasswordInputProps = Omit<
	InputProps,
	'type' | 'rightIcon' | 'onRightIconClick' | 'rightIconAriaLabel'
>

/**
 * PasswordInput component with visibility toggle.
 * Wraps the Input component and adds a toggle button to show/hide the password.
 */
export const PasswordInput = React.forwardRef<HTMLInputElement, PasswordInputProps>(
	(props, ref) => {
		const [showPassword, setShowPassword] = useState(false)

		const togglePasswordVisibility = () => {
			setShowPassword(!showPassword)
		}

		return (
			<Input
				ref={ref}
				type={showPassword ? 'text' : 'password'}
				rightIcon={
					showPassword ? (
						<EyeOffIcon className="w-5 h-5 cursor-pointer hover:text-text-primary" />
					) : (
						<EyeIcon className="w-5 h-5 cursor-pointer hover:text-text-primary" />
					)
				}
				onRightIconClick={togglePasswordVisibility}
				rightIconAriaLabel={showPassword ? 'Hide password' : 'Show password'}
				{...props}
			/>
		)
	}
)

PasswordInput.displayName = 'PasswordInput'
