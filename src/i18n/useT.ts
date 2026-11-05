import { es, type MessageKey } from './es'

const t = (key: MessageKey): string => es[key]

export const useT = () => ({ t })
