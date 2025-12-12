import { useUIStore } from '@/stores'
import { Toasts } from './Toast'

export function ErrorToasts() {
	const toasts = useUIStore((state) => state.errorToasts)
	const dismiss = useUIStore((state) => state.dismissErrorToast)

	return <Toasts toasts={toasts} variant="error" onDismiss={dismiss} />
}
