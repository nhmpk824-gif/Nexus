import type { RuntimeStateSnapshot, RuntimeStoreState } from '../../types'

let runtimeSnapshot: RuntimeStateSnapshot | null = null

export function getRuntimeSnapshot() {
  return runtimeSnapshot
}

export function setRuntimeSnapshot(nextSnapshot: RuntimeStateSnapshot) {
  runtimeSnapshot = nextSnapshot
}

export function getRuntimeStoreState(): RuntimeStoreState {
  return {
    initialized: runtimeSnapshot !== null,
    hydratedAt: runtimeSnapshot?.updatedAt,
  }
}
