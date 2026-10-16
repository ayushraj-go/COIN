// api mode — the store talks to the COIN API server (filled in with the client integration)
import type { StoreApi } from 'zustand'

export const API_MODE = (import.meta.env?.VITE_DATA_MODE as string | undefined) === 'api'

export function remoteStore(_set: StoreApi<unknown>['setState'], _get: StoreApi<unknown>['getState']): Record<string, unknown> {
  throw new Error('api mode is not available in this build')
}
