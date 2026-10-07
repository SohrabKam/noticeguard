import { UserButton, OrganizationSwitcher } from "@clerk/nextjs"

export async function Topbar() {
  return (
    <header className="h-14 border-b bg-white flex items-center justify-between px-6 shrink-0">
      <div className="flex items-center gap-3">
        <OrganizationSwitcher
          hidePersonal
          appearance={{
            elements: {
              rootBox: "flex items-center",
              organizationSwitcherTrigger: "text-sm font-medium text-slate-600 hover:text-slate-900 px-2 py-1 rounded-md",
            },
          }}
        />
      </div>
      <UserButton />
    </header>
  )
}