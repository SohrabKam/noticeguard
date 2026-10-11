const BASE_URL = "https://api.iplicit.com"

export interface IplicitCredentials {
  domain: string
  username: string
  userApiKey: string
}

interface SessionToken {
  sessionToken: string
  tokenDue: string
  domain: string
  apiVer: string
}

export class IplicitClient {
  private token: SessionToken | null = null
  private credentials: IplicitCredentials

  constructor(credentials: IplicitCredentials) {
    this.credentials = credentials
  }

  private async ensureSession(): Promise<string> {
    // Reuse token if still valid (with 60s safety margin)
    if (this.token && new Date(this.token.tokenDue).getTime() > Date.now() + 60_000) {
      return this.token.sessionToken
    }

    const res = await fetch(`${BASE_URL}/api/Session/create/api`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Domain: this.credentials.domain,
      },
      body: JSON.stringify({
        username: this.credentials.username,
        userApiKey: this.credentials.userApiKey,
      }),
    })

    if (!res.ok) {
      const body = await res.text()
      throw new Error(`iplicit auth failed (${res.status}): ${body}`)
    }

    this.token = await res.json()
    return this.token!.sessionToken
  }

  private async request<T>(
    path: string,
    options?: { method?: string; body?: unknown }
  ): Promise<T> {
    const token = await this.ensureSession()
    const url = path.startsWith("http") ? path : `${BASE_URL}${path}`

    const headers: Record<string, string> = {
      Authorization: `Bearer ${token}`,
      Domain: this.credentials.domain,
      "Content-Type": "application/json",
    }

    const res = await fetch(url, {
      method: options?.method ?? "GET",
      headers,
      ...(options?.body ? { body: JSON.stringify(options.body) } : {}),
    })

    if (!res.ok) {
      const body = await res.text()
      throw new Error(
        `iplicit API error (${res.status}) on ${options?.method ?? "GET"} ${path}: ${body.slice(0, 500)}`
      )
    }

    // Some endpoints return 204 No Content
    if (res.status === 204) return undefined as T

    return res.json()
  }

  async get<T>(path: string): Promise<T> {
    return this.request<T>(path)
  }

  async post<T>(path: string, body: unknown): Promise<T> {
    return this.request<T>(path, { method: "POST", body })
  }

  /** Fetch all pages for a paginated endpoint */
  async getAll<T>(
    path: string,
    params: Record<string, string>,
    pageSize = 100
  ): Promise<T[]> {
    const results: T[] = []
    let skip = 0

    while (true) {
      const query = new URLSearchParams({ ...params, skip: String(skip), take: String(pageSize) })
      const page = await this.get<T[]>(`${path}?${query.toString()}`)
      results.push(...page)

      if (page.length < pageSize) break
      skip += pageSize
    }

    return results
  }
}