import { describe, it, expect } from "vitest"
import { escapeHtml } from "./escape-html"

describe("escapeHtml", () => {
  it("escapes all five reserved HTML characters", () => {
    expect(escapeHtml(`<script>alert("x") & 'y'</script>`)).toBe(
      "&lt;script&gt;alert(&quot;x&quot;) &amp; &#39;y&#39;&lt;/script&gt;"
    )
  })

  it("leaves plain text untouched", () => {
    expect(escapeHtml("Columbia Construction Ltd")).toBe("Columbia Construction Ltd")
  })

  it("neutralises an injected tag so it can't break out of the template", () => {
    const malicious = `Acme<img src=x onerror=alert(1)>`
    const escaped = escapeHtml(malicious)
    expect(escaped).not.toContain("<img")
    expect(escaped).toContain("&lt;img")
  })
})
