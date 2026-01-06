import React, { useState } from 'react'

import { EyeIcon, EyeOffIcon } from './icons'
import { Input, type InputProps } from './Input'

/**
 * PasswordInput component that includes a visibility toggle.
 * wraps the base Input component.
 */
export const PasswordInput = React.forwardRef<HTMLInputElement, InputProps>((props, ref) => {
	const [showPassword, setShowPassword] = useState(false)

	const togglePasswordVisibility = () => {
		setShowPassword(!showPassword)
	}

	return (
		<Input
			{...props}
			ref={ref}
			type={showPassword ? 'text' : 'password'}
			rightIcon={showPassword ? <EyeOffIcon /> : <EyeIcon />}
			onRightIconClick={togglePasswordVisibility}
			rightIconAriaLabel={showPassword ? 'Hide password' : 'Show password'}
		/>
	)
})

PasswordInput.displayName = 'PasswordInput'
