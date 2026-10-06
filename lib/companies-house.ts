// Companies House public API integration — insolvency watch.
// Deterministic REST call, cached 24h. Free tier: 600 req/5min.

export interface CompanyStatus {
  companyNumber: string
  companyName: string
  status: string // "Active", "Dissolved", "Liquidation", "Administration", etc.
  dateOfCreation: string | null
  lastAccountsDate: string | null
  overdueAccounts: boolean
  hasCCJs: boolean // best-effort from public data
  hasInsolvencyHistory: boolean
  riskLevel: "green" | "amber" | "red"
  fetchedAt: string
}

const BASE = "https://api.companieshouse.gov.uk"
const CACHE_TTL = 24 * 60 * 60 * 1000 // 24 hours

// Simple in-memory cache (per-process — resets on deploy, which is fine for 24h TTL)
const cache = new Map<string, { data: CompanyStatus; fetchedAt: number }>()

function getApiKey(): string {
  // Companies House API key (free registration at
  // https://developer.company-information.service.gov.uk/)
  const key = process.env.COMPANIES_HOUSE_API_KEY
  if (!key) throw new Error("COMPANIES_HOUSE_API_KEY is not configured")
  return key
}

function riskLevel(status: string, overdue: boolean, insolvent: boolean): CompanyStatus["riskLevel"] {
  if (status === "Liquidation" || status === "Administration" || status === "Dissolved") return "red"
  if (insolvent || overdue || status === "Active — Proposal to Strike off") return "amber"
  return "green"
}

export async function fetchCompanyStatus(companyNumber: string): Promise<CompanyStatus> {
  // Normalise
  const cn = companyNumber.replace(/\s/g, "").toUpperCase()

  // Check cache
  const cached = cache.get(cn)
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL) {
    return { ...cached.data, fetchedAt: new Date(cached.fetchedAt).toISOString() }
  }

  const key = getApiKey()
  const headers = { Authorization: `Basic ${Buffer.from(key + ":").toString("base64")}` }

  let profile: Record<string, unknown> | null = null
  let insolvent = false
  let overdue = false
  let ccjs = false

  try {
    // Company profile
    const profileRes = await fetch(`${BASE}/company/${cn}`, { headers })
    if (profileRes.status === 404) {
      return {
        companyNumber: cn,
        companyName: "Unknown",
        status: "Not found",
        dateOfCreation: null,
        lastAccountsDate: null,
        overdueAccounts: false,
        hasCCJs: false,
        hasInsolvencyHistory: false,
        riskLevel: "amber",
        fetchedAt: new Date().toISOString(),
      }
    }
    if (!profileRes.ok) throw new Error(`Companies House API error: ${profileRes.status}`)
    profile = await profileRes.json() as Record<string, unknown>

    // Check insolvency history (separate endpoint — 404 = no history, which is fine)
    try {
      const insolRes = await fetch(`${BASE}/company/${cn}/insolvency`, { headers })
      insolvent = insolRes.ok
    } catch {
      // Non-critical
    }

    // Check accounts overdue
    const accounts = profile?.accounts as Record<string, unknown> | undefined
    if (accounts?.overdue) overdue = true

    // CCJ check — Companies House doesn't directly expose CCJs, but
    // we flag companies with "Proposal to Strike off" as elevated risk
    const status = String(profile?.company_status ?? "Unknown")

    const result: CompanyStatus = {
      companyNumber: cn,
      companyName: String(profile?.company_name ?? "Unknown"),
      status,
      dateOfCreation: profile?.date_of_creation ? String(profile.date_of_creation) : null,
      lastAccountsDate: (accounts as Record<string, Record<string, string>>)?.last_accounts?.made_up_to ?? null,
      overdueAccounts: overdue,
      hasCCJs: ccjs,
      hasInsolvencyHistory: insolvent,
      riskLevel: riskLevel(status, overdue, insolvent),
      fetchedAt: new Date().toISOString(),
    }

    // Cache
    cache.set(cn, { data: result, fetchedAt: Date.now() })
    return result
  } catch (error) {
    // Return cached if available, even if expired
    const stale = cache.get(cn)
    if (stale) {
      return { ...stale.data, fetchedAt: new Date(stale.fetchedAt).toISOString() }
    }
    throw error
  }
}

/** Minimal check — call this from the subcontract detail page.
 *  Returns null if no company number is stored on the subcontractor. */
export async function checkSubcontractorHealth(
  companyNumber: string | null,
): Promise<CompanyStatus | null> {
  if (!companyNumber) return null
  try {
    return await fetchCompanyStatus(companyNumber)
  } catch {
    return null // graceful degradation
  }
}