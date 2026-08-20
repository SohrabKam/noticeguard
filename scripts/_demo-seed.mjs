/* Demo seed: populate the dedicated demo org ("Demo — Apex Builders Ltd") with
   realistic data so a QS can play with the full working picture.
   Covers: 4 subcontractors, 2 projects, 4 subcontract orders with BOQ lines,
   payment schedules + 52 generated cycles (mixed statuses), retention ledgers,
   compliance docs. Idempotent (cleans previous demo seed data first). */
import { PrismaClient } from "../lib/generated/prisma/client"
import { PrismaNeon } from "@prisma/adapter-neon"
import { generateCycles } from "../lib/dates/cycle-generator"

const db = new PrismaClient({ adapter: new PrismaNeon({ connectionString: process.env.DATABASE_URL }) })
const DEMO_ORG_ID = "cmt1yu8bn0000kl2g8qja7uc3"

async function main() {
  console.log("Seeding demo org:", DEMO_ORG_ID)

  // ── Clean previous demo seed data ──
  await db.subcontractOrder.deleteMany({ where: { organisationId: DEMO_ORG_ID, reference: { startsWith: "DEMO-" } } })
  await db.project.deleteMany({ where: { organisationId: DEMO_ORG_ID, reference: { startsWith: "DEMO-" } } })
  await db.subcontractor.deleteMany({ where: { organisationId: DEMO_ORG_ID, name: { startsWith: "[DEMO]" } } })

  // ── Projects ──
  const [proj1, proj2] = await Promise.all([
    db.project.create({ data: { organisationId: DEMO_ORG_ID, name: "Highfield Gardens — Phase 2", reference: "DEMO-PRJ-001", address: "Highfield Road, Birmingham B15 3QR", isActive: true } }),
    db.project.create({ data: { organisationId: DEMO_ORG_ID, name: "Elmwood Heights — Block B", reference: "DEMO-PRJ-002", address: "Elmwood Lane, Solihull B91 2PH", isActive: true } }),
  ])
  console.log("Projects:", proj1.name, "|", proj2.name)

  // ── Subcontractors ──
  const subs = await Promise.all([
    db.subcontractor.create({ data: { organisationId: DEMO_ORG_ID, name: "[DEMO] Apex Groundworks Ltd", contactEmails: ["accounts@apexgroundworks.co.uk"], cisStatus: "GROSS_20" } }),
    db.subcontractor.create({ data: { organisationId: DEMO_ORG_ID, name: "[DEMO] Midland Steel Frame", contactEmails: ["estimating@midlandsteel.co.uk"], cisStatus: "GROSS_20" } }),
    db.subcontractor.create({ data: { organisationId: DEMO_ORG_ID, name: "[DEMO] Premier M&E", contactEmails: ["admin@premierme.co.uk"], cisStatus: "NET_30" } }),
    db.subcontractor.create({ data: { organisationId: DEMO_ORG_ID, name: "[DEMO] Cladwell Cladding", contactEmails: ["office@cladwell.co.uk"], cisStatus: "GROSS_20" } }),
  ])
  console.log("Subcontractors:", subs.length)

  // ── Compliance docs ──
  for (const [sub, status, days] of [
    [subs[0], "VALID", 45], [subs[1], "VALID", 120], [subs[2], "EXPIRING_SOON", 12], [subs[3], "EXPIRED", -5],
  ]) {
    await db.complianceDocument.create({
      data: {
        subcontractorId: sub.id,
        documentType: "Employers Liability",
        status,
        expiryDate: new Date(Date.now() + days * 86400000),
      },
    })
  }

  // ── Helper: build BOQ lines ──
  const boq = (items) => items.map(([ref, desc, val], i) => ({
    sortOrder: i + 1, itemRef: ref, description: desc, contractValue: val, isVariation: false, indentLevel: ref.includes(".") ? 1 : 0,
  }))

  // ── Subcontract orders + payment schedules + cycles ──
  const orders = []

  // SC-001 Groundworks on proj1 (the flagship demo package)
  const gw = await db.subcontractOrder.create({
    data: {
      organisationId: DEMO_ORG_ID, projectId: proj1.id, subcontractorId: subs[0].id,
      reference: "DEMO-SC-001", contractSum: 285000, retentionPct: 0.05,
      noticeRecipients: ["commercial@demobuilders.co.uk"],
      scheduleLines: { create: boq([
        ["A", "Preliminary Works", 27000],
        ["A.1", "Site establishment, welfare & management", 12000],
        ["A.2", "Temporary works & hoarding", 15000],
        ["A.2.1", "Hoarding & security fencing", 8000],
        ["A.2.2", "Site cabins & welfare facilities", 7000],
        ["B", "Earthworks", 65000],
        ["B.1", "Strip topsoil & stockpile (allow 2,500 m³)", 8000],
        ["B.2", "Bulk excavation to formation level", 35000],
        ["B.2.1", "Excavation by machine to reduced levels", 22000],
        ["B.2.2", "Cart away & disposal to approved tip", 13000],
        ["B.3", "Backfill, compaction & granular blinding", 22000],
        ["C", "Piling", 95000],
        ["C.1", "Pile design & load testing (4 nr test piles)", 18000],
        ["C.2", "CFA bearing piles — 150 nr x 450mm dia", 62000],
        ["C.3", "Pile caps, capping beams & starter bars", 15000],
        ["D", "Site Drainage", 48000],
        ["D.1", "Foul water drainage, manholes & connections", 18000],
        ["D.2", "Surface water drainage", 22000],
        ["D.2.1", "SW pipework, gullies & inspection chambers", 11000],
        ["E", "External Works", 50000],
        ["E.1", "Kerb & footpath construction", 20000],
        ["E.2", "Roadbase & wearing course", 30000],
      ]) },
      paymentSchedule: {
        create: {
          appDueDateRule: "FIXED_DAY_OF_MONTH",
          appDueDayOfMonth: 25,
          dueDateOffsetDays: 7, dueDateOffsetType: "CALENDAR",
          paymentNoticeDeadlineDays: 5, paymentNoticeDeadlineType: "CALENDAR",
          finalDateOffsetDays: 21, finalDateOffsetType: "CALENDAR",
          payLessDeadlineDays: 7, payLessDeadlineType: "CALENDAR",
          scheduleStartDate: new Date(Date.now() - 60 * 86400000),
          scheduleEndDate: new Date(Date.now() + 300 * 86400000),
        },
      },
      retentionLedger: { create: { totalHeld: 11250 } },
    },
  })
  orders.push(gw)

  // SC-002 Steel Frame on proj1
  const sw = await db.subcontractOrder.create({
    data: {
      organisationId: DEMO_ORG_ID, projectId: proj1.id, subcontractorId: subs[1].id,
      reference: "DEMO-SC-002", contractSum: 420000, retentionPct: 0.05,
      noticeRecipients: ["commercial@demobuilders.co.uk"],
      scheduleLines: { create: boq([
        ["1", "Prelims & Design", 35000],
        ["1.1", "Connection design & calculations", 15000],
        ["1.2", "Mobilisation & site setup", 20000],
        ["2", "Structural Steel Frame", 280000],
        ["2.1", "Fabricated steelwork to site (280t)", 180000],
        ["2.2", "Erection of frame (craneage incl.)", 100000],
        ["3", "Metal Decking", 75000],
        ["3.1", "Supply & install metal deck (2,400 m²)", 75000],
        ["4", "Edge Protection & Miscellaneous", 30000],
      ]) },
      paymentSchedule: {
        create: {
          appDueDateRule: "FIXED_DAY_OF_MONTH", appDueDayOfMonth: 28,
          dueDateOffsetDays: 7, dueDateOffsetType: "CALENDAR",
          paymentNoticeDeadlineDays: 5, paymentNoticeDeadlineType: "CALENDAR",
          finalDateOffsetDays: 21, finalDateOffsetType: "CALENDAR",
          payLessDeadlineDays: 7, payLessDeadlineType: "CALENDAR",
          scheduleStartDate: new Date(Date.now() - 45 * 86400000),
          scheduleEndDate: new Date(Date.now() + 330 * 86400000),
        },
      },
      retentionLedger: { create: { totalHeld: 18500 } },
    },
  })
  orders.push(sw)

  // SC-003 M&E on proj2
  const me = await db.subcontractOrder.create({
    data: {
      organisationId: DEMO_ORG_ID, projectId: proj2.id, subcontractorId: subs[2].id,
      reference: "DEMO-SC-003", contractSum: 195000, retentionPct: 0.05,
      noticeRecipients: ["commercial@demobuilders.co.uk"],
      scheduleLines: { create: boq([
        ["M", "M&E Prelims", 20000],
        ["M.1", "Design development & coordination", 12000],
        ["M.2", "Mobilisation", 8000],
        ["1", "First Fix", 95000],
        ["1.1", "Containment — tray, trunking, conduit", 45000],
        ["1.2", "Plumbing first fix", 30000],
        ["1.3", "Ductwork & ventilation rough-in", 20000],
        ["2", "Second Fix", 65000],
        ["2.1", "Wiring accessories & fittings", 40000],
        ["2.2", "Sanitaryware & final connections", 25000],
        ["3", "Testing & Commissioning", 15000],
      ]) },
      paymentSchedule: {
        create: {
          appDueDateRule: "FIXED_DAY_OF_MONTH", appDueDayOfMonth: 30,
          dueDateOffsetDays: 7, dueDateOffsetType: "CALENDAR",
          paymentNoticeDeadlineDays: 5, paymentNoticeDeadlineType: "CALENDAR",
          finalDateOffsetDays: 21, finalDateOffsetType: "CALENDAR",
          payLessDeadlineDays: 7, payLessDeadlineType: "CALENDAR",
          scheduleStartDate: new Date(Date.now() - 30 * 86400000),
          scheduleEndDate: new Date(Date.now() + 360 * 86400000),
        },
      },
      retentionLedger: { create: { totalHeld: 7250 } },
    },
  })
  orders.push(me)

  // SC-004 Cladding on proj2 — retention has a PC release date set
  const cl = await db.subcontractOrder.create({
    data: {
      organisationId: DEMO_ORG_ID, projectId: proj2.id, subcontractorId: subs[3].id,
      reference: "DEMO-SC-004", contractSum: 340000, retentionPct: 0.05,
      noticeRecipients: ["commercial@demobuilders.co.uk"],
      scheduleLines: { create: boq([
        ["C", "Cladding Prelims", 25000],
        ["1", "Rainscreen Cladding", 240000],
        ["1.1", "Support rails & brackets", 80000],
        ["1.2", "Insulation & membrane", 60000],
        ["1.3", "Cladding panels & fixings", 100000],
        ["2", "Copings & Trim", 45000],
        ["3", "Sealants & Interfaces", 30000],
      ]) },
      paymentSchedule: {
        create: {
          appDueDateRule: "FIXED_DAY_OF_MONTH", appDueDayOfMonth: 26,
          dueDateOffsetDays: 7, dueDateOffsetType: "CALENDAR",
          paymentNoticeDeadlineDays: 5, paymentNoticeDeadlineType: "CALENDAR",
          finalDateOffsetDays: 21, finalDateOffsetType: "CALENDAR",
          payLessDeadlineDays: 7, payLessDeadlineType: "CALENDAR",
          scheduleStartDate: new Date(Date.now() - 15 * 86400000),
          scheduleEndDate: new Date(Date.now() + 390 * 86400000),
        },
      },
      retentionLedger: {
        create: {
          totalHeld: 16250,
          pcReleaseDate: new Date(Date.now() + 240 * 86400000),
          pcReleaseAmount: 8125,
        },
      },
    },
  })
  orders.push(cl)

  // ── Generate cycles for all 4 packages ──
  for (const order of orders) {
    const full = await db.subcontractOrder.findUnique({ where: { id: order.id }, include: { paymentSchedule: true } })
    const cycles = generateCycles(full.paymentSchedule)
    await db.paymentCycle.createMany({
      data: cycles.map((c) => ({
        paymentScheduleId: full.paymentSchedule.id,
        cycleNumber: c.cycleNumber,
        applicationExpectedDate: c.applicationExpectedDate,
        dueDate: c.dueDate,
        paymentNoticeDeadline: c.paymentNoticeDeadline,
        finalDateForPayment: c.finalDateForPayment,
        payLessDeadline: c.payLessDeadline,
        status: "AWAITING_APPLICATION",
        dateDerivation: c.dateDerivation,
      })),
    })
  }
  console.log("Generated payment cycles for all 4 contracts")

  // ── Set a few cycle statuses so the dashboard shows RAG variety ──
  const allCycles = await db.paymentCycle.findMany({
    where: { paymentSchedule: { subcontractOrder: { organisationId: DEMO_ORG_ID } } },
    orderBy: [{ paymentScheduleId: "asc" }, { cycleNumber: "asc" }],
  })

  // Groundworks: cycle 1 PAID, cycle 2 NOTICE_SERVED (urgent), cycle 3 APPLICATION_RECEIVED (breached), rest awaiting
  const gwCycles = allCycles.filter(c => c.paymentScheduleId === gw.paymentSchedule?.id || true)
  // Simpler: assign by schedule
  const schedules = [gw, sw, me, cl]
  for (let i = 0; i < schedules.length; i++) {
    const sc = schedules[i]
    const cycles = allCycles.filter(c => c.paymentScheduleId === sc.paymentSchedule?.id)
    // cycle 1 PAID
    if (cycles[0]) await db.paymentCycle.update({ where: { id: cycles[0].id }, data: { status: "PAID" } })
    // cycle 2 NOTICE_SERVED (urgent)
    if (cycles[1]) await db.paymentCycle.update({ where: { id: cycles[1].id }, data: { status: "NOTICE_SERVED" } })
    // cycle 3 APPLICATION_RECEIVED (breached for demo)
    if (cycles[2]) await db.paymentCycle.update({ where: { id: cycles[2].id }, data: { status: "APPLICATION_RECEIVED" } })
  }

  // Final counts
  const counts = {
    projects: await db.project.count({ where: { organisationId: DEMO_ORG_ID } }),
    subcontractors: await db.subcontractor.count({ where: { organisationId: DEMO_ORG_ID } }),
    orders: await db.subcontractOrder.count({ where: { organisationId: DEMO_ORG_ID } }),
    cycles: await db.paymentCycle.count({ where: { paymentSchedule: { subcontractOrder: { organisationId: DEMO_ORG_ID } } } }),
    complianceDocs: await db.complianceDocument.count({ where: { subcontractor: { organisationId: DEMO_ORG_ID } } }),
  }
  console.log("\n✅ Demo org seeded:", JSON.stringify(counts, null, 2))
}

main().catch(e => { console.error(e); process.exit(1) }).finally(() => db.$disconnect())
