import { get, post } from '@/utils/request'

export interface ClassItem {
  id: string
  name: string
}

export function getClasses(): Promise<{ success: boolean; classes: ClassItem[] }> {
  return get('/api/classes', undefined, { needAuth: false, silent: true })
}

export function createClass(params: ClassItem): Promise<{ success: boolean; id: string }> {
  return post('/api/classes', params)
}
