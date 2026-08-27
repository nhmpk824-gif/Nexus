export declare const NET_IPC_ERROR_CODES: {
  readonly TIMEOUT: 'NEXUS_ERR_NET_TIMEOUT'
}

export type NetIpcErrorCode = (typeof NET_IPC_ERROR_CODES)[keyof typeof NET_IPC_ERROR_CODES]

export declare function extractNetIpcErrorCode(error: unknown): NetIpcErrorCode | null
