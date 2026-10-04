/* Seed the caller's organisation with realistic demo data —
   2 projects, 4 subcontractors, 4 subcontract orders with BOQ lines,
   payment schedules + generated cycles, retention ledgers.
   Idempotent — cleans previous demo-flagged data first. */

import { NextRequest, NextResponse } from "next/server"
import { requireOrgRoute } from "@/lib/auth"
import { db } from "@/lib/db"
import { generateCycles } from "@/lib/dates/cycle-generator"

export async function POST(req: NextRequest) {
  const auth = await requireOrgRoute({ minRole: "ADMIN" })
  if (!auth.ok) return auth.response
  const { org } = auth

  // Clean previous demo data for this org
  await db.subcontractOrder.deleteMany({ where: { organisationId: org.id, reference: { startsWith: "DEMO-" } } })
  await db.project.deleteMany({ where: { organisationId: org.id, reference: { startsWith: "DEMO-" } } })
  await db.subcontractor.deleteMany({ where: { organisationId: org.id, name: { startsWith: "[DEMO]" } } })

  // Create projects
  const [proj1, proj2] = await Promise.all([
    db.project.create({ data: { organisationId: org.id, name: "Highfield Gardens — Phase 2", reference: "DEMO-PRJ-001", address: "Highfield Road, Birmingham B15 3QR", isActive: true } }),
    db.project.create({ data: { organisationId: org.id, name: "Elmwood Heights — Block B", reference: "DEMO-PRJ-002", address: "Elmwood Lane, Solihull B91 2PH", isActive: true } }),
  ])

  // Create subcontractors
  const subs = await Promise.all([
    db.subcontractor.create({ data: { organisationId: org.id, name: "[DEMO] Apex Groundworks Ltd", contactEmails: ["accounts@apex.co.uk"], cisStatus: "GROSS_20" } }),
    db.subcontractor.create({ data: { organisationId: org.id, name: "[DEMO] Midland Steel Frame", contactEmails: ["estimating@midlandsteel.co.uk"], cisStatus: "GROSS_20" } }),
    db.subcontractor.create({ data: { organisationId: org.id, name: "[DEMO] Premier M&E", contactEmails: ["admin@premierme.co.uk"], cisStatus: "NET_30" } }),
    db.subcontractor.create({ data: { organisationId: org.id, name: "[DEMO] Cladwell Cladding", contactEmails: ["office@cladwell.co.uk"], cisStatus: "GROSS_20" } }),
  ])

  const boqItem = (r: string, d: string, v: number, i: number) => ({ sortOrder: i + 1, itemRef: r, description: d, contractValue: v, isVariation: false, indentLevel: r.includes(".") ? 1 : 0 })

  type BoqRow = [string, string, number]
  const ordersData: { proj: typeof proj1; sub: (typeof subs)[number]; ref: string; sum: number; boq: BoqRow[] }[] = [
    { proj: proj1, sub: subs[0], ref: "DEMO-SC-001", sum: 285000, boq: [["A","Preliminary Works",27000],["A.1","Site establishment",12000],["A.2","Temporary works",15000],["B","Earthworks",65000],["B.1","Topsoil strip",8000],["B.2","Bulk excavation",35000],["C","Piling",95000],["C.1","Pile design & test",18000],["C.2","CFA piles 150nr",62000]] },
    { proj: proj1, sub: subs[1], ref: "DEMO-SC-002", sum: 420000, boq: [["1","Prelims & Design",35000],["2","Steel Frame",280000],["2.1","Fabricated steelwork",180000],["2.2","Erection of frame",100000],["3","Metal Decking",75000]] },
    { proj: proj2, sub: subs[2], ref: "DEMO-SC-003", sum: 195000, boq: [["M","M&E Prelims",20000],["1","First Fix",95000],["1.1","Containment",45000],["1.2","Plumbing first fix",30000],["2","Second Fix",65000]] },
    { proj: proj2, sub: subs[3], ref: "DEMO-SC-004", sum: 340000, boq: [["C","Cladding Prelims",25000],["1","Rainscreen Cladding",240000],["1.1","Support rails",80000],["1.2","Insulation & membrane",60000],["2","Copings & Trim",45000]] },
  ]

  let cycleCount = 0
  for (const o of ordersData) {
    const order = await db.subcontractOrder.create({
      data: {
        organisationId: org.id, projectId: o.proj.id, subcontractorId: o.sub.id,
        reference: o.ref, contractSum: o.sum, retentionPct: 0.05,
        noticeRecipients: ["commercial@demo.co.uk"],
        scheduleLines: { create: o.boq.map((x, i) => boqItem(x[0], x[1], x[2], i)) },
        paymentSchedule: { create: { appDueDateRule: "FIXED_DAY_OF_MONTH", appDueDayOfMonth: 25, dueDateOffsetDays: 7, dueDateOffsetType: "CALENDAR", paymentNoticeDeadlineDays: 5, paymentNoticeDeadlineType: "CALENDAR", finalDateOffsetDays: 21, finalDateOffsetType: "CALENDAR", payLessDeadlineDays: 7, payLessDeadlineType: "CALENDAR", scheduleStartDate: new Date(Date.now() - 45 * 86400000), scheduleEndDate: new Date(Date.now() + 330 * 86400000) } },
        retentionLedger: { create: { totalHeld: o.sum * 0.05 * 0.5 } },
      },
    })
    const full = await db.subcontractOrder.findUnique({ where: { id: order.id }, include: { paymentSchedule: true } })
    if (!full?.paymentSchedule) continue
    const cycles = generateCycles(full.paymentSchedule)
    await db.paymentCycle.createMany({ data: cycles.map(c => ({ paymentScheduleId: full.paymentSchedule!.id, cycleNumber: c.cycleNumber, applicationExpectedDate: c.applicationExpectedDate, dueDate: c.dueDate, paymentNoticeDeadline: c.paymentNoticeDeadline, finalDateForPayment: c.finalDateForPayment, payLessDeadline: c.payLessDeadline, status: "AWAITING_APPLICATION", dateDerivation: c.dateDerivation })) })
    cycleCount += cycles.length
  }

  // Set mixed statuses on first few cycles for RAG variety
  const allCycles = await db.paymentCycle.findMany({ where: { paymentSchedule: { subcontractOrder: { organisationId: org.id } } }, orderBy: [{ cycleNumber: "asc" }], take: 5 })
  if (allCycles[0]) await db.paymentCycle.update({ where: { id: allCycles[0].id }, data: { status: "PAID" } })
  if (allCycles[1]) await db.paymentCycle.update({ where: { id: allCycles[1].id }, data: { status: "NOTICE_SERVED" } })
  if (allCycles[2]) await db.paymentCycle.update({ where: { id: allCycles[2].id }, data: { status: "APPLICATION_RECEIVED" } })
  if (allCycles[3]) await db.paymentCycle.update({ where: { id: allCycles[3].id }, data: { status: "UNDER_ASSESSMENT" } })
  if (allCycles[4]) await db.paymentCycle.update({ where: { id: allCycles[4].id }, data: { status: "NOTICE_SERVED" } })

  return NextResponse.json({ ok: true, projects: 2, subcontractors: subs.length, orders: ordersData.length, cycles: cycleCount })
}