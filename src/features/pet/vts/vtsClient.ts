const VTS_API_NAME = 'VTubeStudioPublicAPI'
const VTS_API_VERSION = '1.0'
const PLUGIN_NAME = 'Nexus Companion'
const PLUGIN_DEVELOPER = 'FanyinLiu'

type VTSMessageType =
  | 'AuthenticationTokenRequest'
  | 'AuthenticationRequest'
  | 'ParameterCreationRequest'
  | 'InjectParameterDataRequest'
  | 'HotkeyTriggerRequest'
  | 'HotkeysInCurrentModelRequest'
  | 'CurrentModelRequest'
  | 'APIStateRequest'

type VTSResponse = {
  messageType: string
  data: Record<string, unknown>
}

type VTSEventHandler = {
  onConnect?: () => void
  onDisconnect?: () => void
  onAuthRequired?: () => void
  onError?: (error: string) => void
}

let requestCounter = 0
function nextRequestId(): string {
  return `nexus-${++requestCounter}`
}

export class VTSClient {
  private ws: WebSocket | null = null
  private port: number
  private handlers: VTSEventHandler
  private pendingRequests = new Map<string, {
    resolve: (data: Record<string, unknown>) => void
    reject: (error: Error) => void
  }>()
  private _authenticated = false
  private _connected = false
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null

  get connected() { return this._connected }
  get authenticated() { return this._authenticated }

  constructor(port: number, handlers: VTSEventHandler = {}) {
    this.port = port
    this.handlers = handlers
  }

  connect() {
    this.disconnect()
    try {
      this.ws = new WebSocket(`ws://localhost:${this.port}`)
      this.ws.onopen = () => {
        this._connected = true
        this.handlers.onConnect?.()
      }
      this.ws.onclose = () => {
        this._connected = false
        this._authenticated = false
        this.rejectAllPending('Connection closed')
        this.handlers.onDisconnect?.()
      }
      this.ws.onerror = () => {
        this.handlers.onError?.('WebSocket connection failed')
      }
      this.ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(String(event.data)) as VTSResponse
          const requestId = (msg as Record<string, unknown>).requestID as string
          const pending = this.pendingRequests.get(requestId)
          if (pending) {
            this.pendingRequests.delete(requestId)
            pending.resolve(msg.data ?? {})
          }
        } catch { /* ignore malformed messages */ }
      }
    } catch {
      this.handlers.onError?.('Failed to create WebSocket')
    }
  }

  disconnect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
    this.rejectAllPending('Disconnected')
    if (this.ws) {
      this.ws.onclose = null
      this.ws.onerror = null
      this.ws.onmessage = null
      try { this.ws.close() } catch { /* ignore */ }
      this.ws = null
    }
    this._connected = false
    this._authenticated = false
  }

  private rejectAllPending(reason: string) {
    for (const [, pending] of this.pendingRequests) {
      pending.reject(new Error(reason))
    }
    this.pendingRequests.clear()
  }

  private send(messageType: VTSMessageType, data: Record<string, unknown> = {}): Promise<Record<string, unknown>> {
    return new Promise((resolve, reject) => {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
        reject(new Error('Not connected to VTube Studio'))
        return
      }
      const requestID = nextRequestId()
      this.pendingRequests.set(requestID, { resolve, reject })
      this.ws.send(JSON.stringify({
        apiName: VTS_API_NAME,
        apiVersion: VTS_API_VERSION,
        requestID,
        messageType,
        data,
      }))
      setTimeout(() => {
        if (this.pendingRequests.has(requestID)) {
          this.pendingRequests.delete(requestID)
          reject(new Error(`VTS request ${messageType} timed out`))
        }
      }, 5000)
    })
  }

  async requestAuthToken(): Promise<string> {
    const result = await this.send('AuthenticationTokenRequest', {
      pluginName: PLUGIN_NAME,
      pluginDeveloper: PLUGIN_DEVELOPER,
    })
    const token = result.authenticationToken as string
    if (!token) throw new Error('No auth token received')
    return token
  }

  async authenticate(token: string): Promise<boolean> {
    const result = await this.send('AuthenticationRequest', {
      pluginName: PLUGIN_NAME,
      pluginDeveloper: PLUGIN_DEVELOPER,
      authenticationToken: token,
    })
    this._authenticated = result.authenticated === true
    return this._authenticated
  }

  async createParameter(parameterName: string, min = -30, max = 30, defaultValue = 0): Promise<void> {
    await this.send('ParameterCreationRequest', {
      parameterName,
      explanation: `Nexus companion parameter: ${parameterName}`,
      min,
      max,
      defaultValue,
    })
  }

  async injectParameters(parameters: Array<{ id: string; value: number; weight?: number }>): Promise<void> {
    if (!this._authenticated || !parameters.length) return
    await this.send('InjectParameterDataRequest', {
      faceFound: true,
      mode: 'set',
      parameterValues: parameters.map((p) => ({
        id: p.id,
        value: p.value,
        weight: p.weight ?? 1,
      })),
    })
  }

  async getHotkeys(): Promise<Array<{ name: string; type: string; file: string; hotkeyID: string }>> {
    const result = await this.send('HotkeysInCurrentModelRequest', {})
    return (result.availableHotkeys as Array<{ name: string; type: string; file: string; hotkeyID: string }>) ?? []
  }

  async triggerHotkey(hotkeyID: string): Promise<void> {
    await this.send('HotkeyTriggerRequest', { hotkeyID })
  }

  async getCurrentModel(): Promise<{ modelLoaded: boolean; modelName: string; modelID: string }> {
    const result = await this.send('CurrentModelRequest', {})
    return {
      modelLoaded: result.modelLoaded === true,
      modelName: String(result.modelName ?? ''),
      modelID: String(result.modelID ?? ''),
    }
  }
}
