import { useUIStore } from '@/stores'
import { Toasts } from './Toast'

export function SuccessToasts() {
	const toasts = useUIStore((state) => state.successToasts)
	const dismiss = useUIStore((state) => state.dismissSuccessToast)

	return <Toasts toasts={toasts} variant="success" onDismiss={dismiss} />
}
