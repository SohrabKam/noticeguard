// Escapes text for safe interpolation into an HTML string. Statutory notice
// emails build their HTML by string interpolation rather than a templating
// engine, so every tenant-editable value (org/subcontractor/project names,
// references, basis of assessment, signatory) must be run through this
// before it goes anywhere near the template — otherwise a malicious or
// compromised account can inject markup into a legally-binding notice.
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}
