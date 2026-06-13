import { create } from 'zustand'

export interface ToastItem {
    id: number
    message: string
}

interface ToastStore {
    toasts: ToastItem[]
    show: (message: string, duration_ms?: number) => void
    dismiss: (id: number) => void
}

let next_id = 0

export const useToastStore = create<ToastStore>((set, get) => ({
    toasts: [],
    show: (message, duration_ms = 2000) => {
        const id = ++next_id
        set((state) => ({ toasts: [...state.toasts, { id, message }] }))
        window.setTimeout(() => { get().dismiss(id) }, duration_ms)
    },
    dismiss: (id) => {
        set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }))
    },
}))

export function show_toast(message: string, duration_ms?: number): void {
    useToastStore.getState().show(message, duration_ms)
}
