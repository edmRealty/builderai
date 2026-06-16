/* eslint-disable no-console */

const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const { PrismaClient } = require("@prisma/client");

function mustGetEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing env var: ${name}`);
  return value;
}

function encryptionKey() {
  const secret = mustGetEnv("SESSION_SECRET");
  return crypto.scryptSync(secret, "mfcms", 32);
}

function encryptString(plaintext) {
  const key = encryptionKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1:${iv.toString("base64")}:.${tag.toString("base64")}:.${ciphertext.toString("base64")}`;
}

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pick(arr) {
  return arr[randInt(0, arr.length - 1)];
}

function demoProjectStatusForIndex(index1Based) {
  // Deterministic distribution so dashboards always show non-zero demo counts.
  const cycle = ["LOT_ACQUIRED", "PLANNING", "UNDER_CONSTRUCTION", "COMPLETED_FOR_SALE", "COMPLETED_FOR_RENT"];
  return cycle[(index1Based - 1) % cycle.length];
}

function formatEIN() {
  // Fake EIN, format NN-NNNNNNN
  const a = randInt(10, 99);
  const b = randInt(0, 9999999).toString().padStart(7, "0");
  return `${a}-${b}`;
}

function formatPaTax() {
  // Fake PA tax id, non-official format for demo/testing.
  const n = randInt(0, 9999999).toString().padStart(7, "0");
  return `PA-${n}`;
}

async function ensureUser({ prisma, orgId, email, role, name }) {
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return existing;

  const pepper = mustGetEnv("PASSWORD_PEPPER");
  const password = "Password123!";
  const passwordHash = await bcrypt.hash(password + pepper, 12);

  return prisma.user.create({
    data: {
      orgId,
      email,
      name: name ?? null,
      phone: `555-${randInt(100, 999)}-${randInt(1000, 9999)}`,
      role,
      passwordHash,
      mfaEnabled: false
    }
  });
}

async function main() {
  const prisma = new PrismaClient();
  try {
    let org = await prisma.organization.findFirst({ orderBy: { createdAt: "desc" } });
    if (!org) {
      org = await prisma.organization.create({ data: { name: "Demo Organization" } });
      console.log(`Created org: ${org.name} (${org.id})`);
    } else {
      console.log(`Using org: ${org.name} (${org.id})`);
    }

    const orgId = org.id;

    const existingDemoProjects = await prisma.project.findMany({
      where: { orgId, name: { startsWith: "Demo Project" } },
      orderBy: { createdAt: "asc" }
    });
    const existingCount = existingDemoProjects.length;
    if (existingCount > 0) {
      console.log(`Seed data already present (${existingCount} demo projects). Creating missing demo projects and enriching existing…`);
    }

    // Normalize demo project statuses so the dashboard always has demo rentals/for-sale items.
    // (Only touches demo projects by name prefix.)
    await Promise.all(
      existingDemoProjects.map((p, idx) => {
        const desired = demoProjectStatusForIndex(idx + 1);
        if (p.status === desired) return null;
        return prisma.project.update({ where: { id: p.id }, data: { status: desired } });
      })
    );

    // Create demo users for testing RBAC (all share Password123!)
    const demoUsers = await Promise.all([
      ensureUser({
        prisma,
        orgId,
        email: "demo-owner@mfcms.local",
        role: "OWNER",
        name: "Demo Owner"
      }),
      ensureUser({
        prisma,
        orgId,
        email: "demo-pm@mfcms.local",
        role: "PROJECT_MANAGER",
        name: "Demo PM"
      }),
      ensureUser({
        prisma,
        orgId,
        email: "demo-accountant@mfcms.local",
        role: "ACCOUNTANT",
        name: "Demo Accountant"
      }),
      ensureUser({
        prisma,
        orgId,
        email: "demo-field@mfcms.local",
        role: "FIELD_AGENT",
        name: "Demo Field"
      }),
      ensureUser({
        prisma,
        orgId,
        email: "demo-banker@mfcms.local",
        role: "BANKER",
        name: "Demo Banker"
      }),
      ensureUser({
        prisma,
        orgId,
        email: "demo-admin@mfcms.local",
        role: "ADMIN",
        name: "Demo Admin"
      })
    ]);

    const demoAdmin = demoUsers.find((u) => u.role === "ADMIN") || demoUsers[0];
    const demoField = demoUsers.find((u) => u.role === "FIELD_AGENT") || demoUsers[0];
    const demoBanker = demoUsers.find((u) => u.role === "BANKER") || demoUsers[0];

    // 15 LLCs
    const llcNames = [
      "Keystone Multifamily",
      "Maple Ridge Holdings",
      "Liberty Corner Development",
      "Allegheny Heights",
      "Riverstone Property Group",
      "Steel City Builders",
      "Susquehanna Capital",
      "Chestnut Street Partners",
      "Blue Bell Residential",
      "Lancaster Square Homes",
      "Bucks County Living",
      "Lehigh Valley Estates",
      "Pocono Peaks Development",
      "Harrisburg Harbor Holdings",
      "Scranton Summit Properties"
    ];

    const llcs = await prisma.lLC.findMany({
      where: { orgId, name: { startsWith: "Demo LLC" } },
      orderBy: { createdAt: "asc" }
    });

    // Create missing demo LLCs to reach 15 total.
    for (let i = llcs.length; i < llcNames.length; i++) {
      const baseName = llcNames[i];
      const establishedAt = new Date(Date.now() - randInt(180, 2000) * 24 * 60 * 60 * 1000);
      llcs.push(
        await prisma.lLC.create({
          data: {
            orgId,
            name: `Demo LLC ${String(i + 1).padStart(2, "0")} - ${baseName} LLC`,
            legalName: `${baseName} LLC`,
            einEnc: encryptString(formatEIN()),
            paTaxNumberEnc: encryptString(formatPaTax()),
            establishedAt,
            oneDriveFolderUrl: `https://example.com/onedrive/${encodeURIComponent(baseName)}`
          }
        })
      );
    }

    let qbConnections = await prisma.quickBooksConnection.findMany({
      where: { orgId, displayName: { startsWith: "Demo " } },
      orderBy: { createdAt: "asc" }
    });

    // Ensure one demo QB connection per demo LLC.
    const connByLlc = new Map(qbConnections.map((c) => [c.llcId, c]));
    for (let i = 0; i < llcs.length; i++) {
      const llc = llcs[i];
      if (connByLlc.has(llc.id)) continue;
      const baseName = llcNames[i] ?? llc.name;
      const type = i < 10 ? "QBO" : "QBD";
      const conn = await prisma.quickBooksConnection.create({
        data: {
          orgId,
          llcId: llc.id,
          type,
          status: "ACTIVE",
          displayName: `Demo ${type} - ${baseName}`,
          qbdCompanyFileName: type === "QBD" ? `${String(baseName).replace(/\s+/g, "_")}.qbw` : null
        }
      });
      qbConnections.push(conn);
      connByLlc.set(llc.id, conn);
    }

    // Vendors
    const vendorSeeds = [
      { name: "Demo Vendor - ABC Plumbing", email: "ap@abcplumbing.example" },
      { name: "Demo Vendor - Keystone Electric", email: "billing@keystoneelectric.example" },
      { name: "Demo Vendor - Prime Concrete", email: "invoices@primeconcrete.example" },
      { name: "Demo Vendor - Ridge Roofing", email: "ar@ridgeroofing.example" },
      { name: "Demo Vendor - Steel Framing Co", email: "billing@steelframing.example" },
      { name: "Demo Vendor - HVAC Pros", email: "billing@hvacpros.example" },
      { name: "Demo Vendor - Window World", email: "invoices@windowworld.example" },
      { name: "Demo Vendor - Paint & Finish", email: "ar@paintfinish.example" },
      { name: "Demo Vendor - Sitework & Grading", email: "billing@sitework.example" },
      { name: "Demo Vendor - Fire Safety", email: "ap@firesafety.example" }
    ];

    const existingVendors = await prisma.vendor.findMany({
      where: { orgId, name: { startsWith: "Demo Vendor -" } },
      orderBy: { name: "asc" }
    });

    const vendorsByName = new Map(existingVendors.map((v) => [v.name, v]));
    for (const v of vendorSeeds) {
      if (!vendorsByName.has(v.name)) {
        const created = await prisma.vendor.create({
          data: {
            orgId,
            name: v.name,
            email: v.email,
            phone: `555-${randInt(100, 999)}-${randInt(1000, 9999)}`,
            contactName: "Accounts Payable",
            einEnc: encryptString(formatEIN()),
            onboardingStep: "DONE",
            onboardingCompletedAt: new Date(),
            w9Url: "https://example.com/vendor/w9.pdf",
            insuranceUrl: "https://example.com/vendor/coi.pdf",
            w9OnFile: Math.random() < 0.6,
            coiOnFile: Math.random() < 0.6,
            approvedVendor: true,
            performanceScore: randInt(70, 98) / 10
          }
        });
        existingVendors.push(created);
        vendorsByName.set(created.name, created);
      }
    }
    const vendors = existingVendors;

    // Banks + templates
    const bankSeeds = ["Demo Bank - First National", "Demo Bank - Community Lenders", "Demo Bank - Metro Capital"];
    const banksExisting = await prisma.bank.findMany({
      where: { orgId, name: { in: bankSeeds } },
      orderBy: { createdAt: "asc" }
    });
    const banksByName = new Map(banksExisting.map((b) => [b.name, b]));
    for (const name of bankSeeds) {
      if (!banksByName.has(name)) {
        const b = await prisma.bank.create({
          data: { orgId, name, contactName: "Demo Banker", contactEmail: "banker@example.com" }
        });
        banksExisting.push(b);
        banksByName.set(name, b);
      }
    }
    const banks = banksExisting;

    const templatesExisting = await prisma.drawTemplate.findMany({
      where: { orgId, name: "Standard Draw", version: 1, bankId: { in: banks.map((b) => b.id) } },
      orderBy: { createdAt: "asc" }
    });

    const templateByBank = new Map(templatesExisting.map((t) => [t.bankId, t]));
    const templates = [...templatesExisting];
    for (const bank of banks) {
      if (templateByBank.has(bank.id)) continue;
      const t = await prisma.drawTemplate.create({
        data: {
          orgId,
          bankId: bank.id,
          name: "Standard Draw",
          version: 1,
          config: {
            columns: ["label", "scheduled", "previous", "thisDraw", "retainage", "percentComplete"],
            requireDocs: [],
            retainage: { mode: "commitmentDefault" }
          }
        }
      });
      templates.push(t);
      templateByBank.set(bank.id, t);
    }

    // Partners / investors (demo)
    const partnerSeeds = [
      { name: "Demo Partner - River Capital", email: "river@example.com" },
      { name: "Demo Partner - Keystone Equity", email: "keystone@example.com" },
      { name: "Demo Partner - Maple Ventures", email: "maple@example.com" },
      { name: "Demo Partner - Liberty Partners", email: "liberty@example.com" },
      { name: "Demo Partner - Allegheny Group", email: "allegheny@example.com" },
      { name: "Demo Partner - Susquehanna Fund", email: "susq@example.com" }
    ];

    const existingPartners = await prisma.partner.findMany({
      where: { orgId, name: { startsWith: "Demo Partner -" } },
      orderBy: { name: "asc" }
    });
    const partnersByName = new Map(existingPartners.map((p) => [p.name, p]));
    const partners = [...existingPartners];
    for (const p of partnerSeeds) {
      if (partnersByName.has(p.name)) continue;
      const created = await prisma.partner.create({
        data: {
          orgId,
          name: p.name,
          email: p.email,
          phone: `555-${randInt(100, 999)}-${randInt(1000, 9999)}`
        }
      });
      partners.push(created);
      partnersByName.set(created.name, created);
    }

    // LLC partners (default 100% to one partner, editable in UI)
    for (const llc of llcs) {
      const existing = await prisma.llcPartner.findMany({ where: { orgId, llcId: llc.id } });
      if (existing.length > 0) continue;
      const partner = pick(partners);
      await prisma.llcPartner.create({
        data: {
          orgId,
          llcId: llc.id,
          partnerId: partner.id,
          ownershipBps: 10000
        }
      });
      await prisma.llcDocument.create({
        data: {
          orgId,
          llcId: llc.id,
          createdByUserId: demoAdmin.id,
          title: "Operating Agreement (demo link)",
          url: "https://example.com/llc/operating-agreement.pdf"
        }
      });
    }

    // Org-level dashboard to-dos (demo)
    const todoCount = await prisma.orgTodo.count({ where: { orgId, completedAt: null } });
    if (todoCount === 0) {
      await prisma.orgTodo.createMany({
        data: [
          { orgId, createdByUserId: demoAdmin.id, body: "Review permit expirations", dueAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000) },
          { orgId, createdByUserId: demoField.id, body: "Upload new framing photos", dueAt: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000) },
          { orgId, createdByUserId: demoAdmin.id, body: "Prepare next bank draw package", dueAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) }
        ]
      });
    }

    // Identifier definitions (apply to all projects)
    const identifierDefs = [
      { label: "PA Tax #", applyToAllProjects: true, sortOrder: 10 },
      { label: "State Tax #", applyToAllProjects: true, sortOrder: 20 },
      { label: "Utility Account #", applyToAllProjects: true, sortOrder: 30 }
    ];
    for (const def of identifierDefs) {
      await prisma.identifierDefinition.upsert({
        where: { orgId_scope_label: { orgId, scope: "PROJECT", label: def.label } },
        update: { applyToAllProjects: def.applyToAllProjects, sortOrder: def.sortOrder },
        create: {
          orgId,
          scope: "PROJECT",
          label: def.label,
          applyToAllProjects: def.applyToAllProjects,
          sortOrder: def.sortOrder,
          createdByUserId: demoAdmin.id
        }
      });
    }

    const projectIdentifierDefs = await prisma.identifierDefinition.findMany({
      where: { orgId, scope: "PROJECT" },
      orderBy: [{ sortOrder: "asc" }, { label: "asc" }]
    });

    // Global custom sections (apply to all projects)
    const globalViolations =
      (await prisma.projectCustomSection.findFirst({
        where: { orgId, projectId: null, title: "Violations" }
      })) ??
      (await prisma.projectCustomSection.create({
        data: {
          orgId,
          title: "Violations",
          sortOrder: 10
        }
      }));

    const violationsItems = await prisma.projectCustomSectionItem.findMany({
      where: { orgId, sectionId: globalViolations.id }
    });
    const violationsByTitle = new Map(violationsItems.map((i) => [i.title, i]));
    const violationsSeedItems = [
      { title: "City violations portal", url: "https://example.com/violations" },
      { title: "Violation log (shared)", url: "https://example.com/shared/violation-log" }
    ];
    for (const it of violationsSeedItems) {
      if (violationsByTitle.has(it.title)) continue;
      await prisma.projectCustomSectionItem.create({
        data: { orgId, sectionId: globalViolations.id, title: it.title, url: it.url }
      });
    }

    const globalUtilities =
      (await prisma.projectCustomSection.findFirst({
        where: { orgId, projectId: null, title: "Utilities" }
      })) ??
      (await prisma.projectCustomSection.create({
        data: {
          orgId,
          title: "Utilities",
          sortOrder: 20
        }
      }));

    const utilitiesItems = await prisma.projectCustomSectionItem.findMany({
      where: { orgId, sectionId: globalUtilities.id }
    });
    const utilitiesByTitle = new Map(utilitiesItems.map((i) => [i.title, i]));
    if (!utilitiesByTitle.has("Electric account notes")) {
      await prisma.projectCustomSectionItem.create({
        data: {
          orgId,
          sectionId: globalUtilities.id,
          title: "Electric account notes",
          url: "https://example.com/utilities/electric"
        }
      });
    }
    if (!utilitiesByTitle.has("Gas account notes")) {
      await prisma.projectCustomSectionItem.create({
        data: {
          orgId,
          sectionId: globalUtilities.id,
          title: "Gas account notes",
          url: "https://example.com/utilities/gas"
        }
      });
    }
    if (!utilitiesByTitle.has("Water / sewer account notes")) {
      await prisma.projectCustomSectionItem.create({
        data: {
          orgId,
          sectionId: globalUtilities.id,
          title: "Water / sewer account notes",
          url: "https://example.com/utilities/water"
        }
      });
    }
    if (!utilitiesByTitle.has("Internet / ISP info")) {
      await prisma.projectCustomSectionItem.create({
        data: {
          orgId,
          sectionId: globalUtilities.id,
          title: "Internet / ISP info",
          url: "https://example.com/utilities/internet"
        }
      });
    }

    // 20 projects across 15 LLCs (first 5 LLCs get 2 projects each)
    const cities = [
      { city: "Philadelphia", zip: "19103" },
      { city: "Pittsburgh", zip: "15222" },
      { city: "Harrisburg", zip: "17101" },
      { city: "Allentown", zip: "18101" },
      { city: "Scranton", zip: "18503" },
      { city: "Lancaster", zip: "17602" },
      { city: "Reading", zip: "19601" },
      { city: "Bethlehem", zip: "18015" },
      { city: "Erie", zip: "16501" },
      { city: "York", zip: "17401" }
    ];
    const streets = [
      "Main St",
      "Market St",
      "Chestnut St",
      "Walnut St",
      "Broad St",
      "Spring Garden St",
      "2nd Ave",
      "3rd Ave",
      "Oak St",
      "Maple Ave",
      "Pine St",
      "Cedar St",
      "Washington Blvd",
      "Liberty Ave",
      "Ridge Ave"
    ];

    const projects = [...existingDemoProjects];
    let projectIndex = existingDemoProjects.length;
    for (let llcIdx = 0; llcIdx < llcs.length; llcIdx++) {
      const count = llcIdx < 5 ? 2 : 1;
      for (let j = 0; j < count; j++) {
        if (projects.length >= 20) continue;
        projectIndex++;
        const addrNum = 100 + projectIndex * 7;
        const street = streets[(projectIndex - 1) % streets.length];
        const loc = cities[(projectIndex - 1) % cities.length];
        const llc = llcs[llcIdx];
        const qbConn = qbConnections[llcIdx];

        const status = demoProjectStatusForIndex(projectIndex);
        const unitCount = randInt(4, 48);
        const budgetTotalCents = randInt(850000, 4500000) * 100;

        const p = await prisma.project.create({
          data: {
            orgId,
            llcId: llc.id,
            qbConnectionId: qbConn.id,
            name: `Demo Project ${String(projectIndex).padStart(2, "0")} - ${addrNum} ${street}`,
            addressLine1: `${addrNum} ${street}`,
            addressLine2: null,
            city: loc.city,
            state: "PA",
            zip: loc.zip,
            unitCount,
            cityNumber: `${loc.city.slice(0, 3).toUpperCase()}-${String(projectIndex).padStart(3, "0")}`,
            status,
            budgetTotalCents
          }
        });
        projects.push(p);

        // Demo project identifiers (beyond built-in fields like City #)
        for (const def of projectIdentifierDefs) {
          const exists = await prisma.projectIdentifier.findFirst({
            where: { orgId, projectId: p.id, definitionId: def.id }
          });
          if (exists) continue;

          let value = "";
          if (def.label === "PA Tax #") value = formatPaTax();
          else if (def.label === "State Tax #") value = `ST-${randInt(1000000, 9999999)}`;
          else if (def.label === "Utility Account #") value = `UTIL-${randInt(100000, 999999)}`;
          else value = `DEMO-${randInt(1000, 9999)}`;

          await prisma.projectIdentifier.create({
            data: { orgId, projectId: p.id, definitionId: def.id, value }
          });
        }

        // Assign field agent to a subset of projects
        if (demoField) {
          await prisma.projectAssignment.create({
            data: { orgId, projectId: p.id, userId: demoField.id }
          });
        }

        // Add a couple permits for some projects (to show expiring alerts)
        if (projectIndex % 2 === 0) {
          const days = projectIndex % 4 === 0 ? 14 : 45;
          await prisma.permit.create({
            data: {
              orgId,
              projectId: p.id,
              permitType: "Building Permit",
              jurisdiction: `${loc.city} Dept. of Licenses`,
              permitNumber: `BP-${randInt(10000, 99999)}`,
              status: "ISSUED",
              issuedAt: new Date(Date.now() - randInt(10, 60) * 24 * 60 * 60 * 1000),
              expiresAt: new Date(Date.now() + days * 24 * 60 * 60 * 1000),
              checklist: [{ label: "Posted on site", done: true }],
              notes: "Demo permit record"
            }
          });
        }

        // Abatement (some)
        if (projectIndex % 5 === 0) {
          await prisma.abatement.create({
            data: {
              orgId,
              projectId: p.id,
              programName: "Demo Tax Abatement",
              status: "ACTIVE",
              termStart: new Date(Date.now() - 120 * 24 * 60 * 60 * 1000),
              termEnd: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
              checklist: [{ label: "Annual filing", done: false }],
              notes: "Demo abatement tracker"
            }
          });
        }

        // Project update feed
        await prisma.projectUpdate.create({
          data: {
            orgId,
            projectId: p.id,
            authorId: demoField?.id ?? demoAdmin.id,
            body: `Demo update: site walk complete for ${p.addressLine1}.`,
            tags: ["demo", status === "COMPLETED_FOR_SALE" || status === "COMPLETED_FOR_RENT" ? "closeout" : "field"],
            photoDocIds: []
          }
        });

        // Commitments: 3 per project
        const commitmentSeeds = [
          { scope: "Plumbing rough-in", costCode: "0300", min: 45000, max: 120000, retainageBps: 500 },
          { scope: "Electrical rough-in", costCode: "0400", min: 55000, max: 150000, retainageBps: 500 },
          { scope: "Framing package", costCode: "0200", min: 90000, max: 280000, retainageBps: 1000 }
        ];

        for (let k = 0; k < commitmentSeeds.length; k++) {
          const seed = commitmentSeeds[k];
          const vendor = vendors[(projectIndex + k) % vendors.length];
          const agreed = randInt(seed.min, seed.max) * 100;

          const paidPct = [0, 0.25, 0.5, 0.75, 1][(projectIndex + k) % 5];
          const paidToDate = Math.round(agreed * paidPct);

          const status =
            paidPct >= 1
              ? "PAID"
              : paidPct >= 0.75
                ? "INVOICED"
                : paidPct >= 0.25
                  ? "IN_PROGRESS"
                  : "NOT_STARTED";

          const commitment = await prisma.commitment.create({
            data: {
              orgId,
              projectId: p.id,
              vendorId: vendor.id,
              createdByUserId: demoAdmin.id,
              code: `DEMO-${p.id.slice(-6)}-${k + 1}-${crypto.randomBytes(3).toString("hex").toUpperCase()}`,
              scope: seed.scope,
              costCode: seed.costCode,
              agreedCents: agreed,
              retainageBps: seed.retainageBps,
              status,
              startDate: new Date(Date.now() - randInt(1, 45) * 24 * 60 * 60 * 1000),
              targetCompleteDate: new Date(Date.now() + randInt(15, 90) * 24 * 60 * 60 * 1000),
              completedAt: status === "PAID" || status === "INVOICED" ? new Date() : null,
              paidToDateCents: paidToDate,
              invoicedNotPaidCents: Math.max(0, Math.round(agreed * 0.1) - paidToDate)
            }
          });

          // Expected invoice heads-up if completed but not paid
          if (commitment.status === "COMPLETED" || commitment.status === "INVOICED") {
            await prisma.expectedInvoice.create({
              data: { orgId, commitmentId: commitment.id }
            });
          }
        }

        // Loan + draw request (pipeline)
        const bank = banks[(projectIndex - 1) % banks.length];
        const template = templates[(projectIndex - 1) % templates.length];
        const totalLoanCents = randInt(900000, 6000000) * 100;
        const paidLoanCents = Math.round(totalLoanCents * pick([0.05, 0.12, 0.2, 0.33, 0.48]));
        const loan = await prisma.loan.create({
          data: {
            orgId,
            projectId: p.id,
            bankId: bank.id,
            name: `Construction Loan - ${bank.name.replace("Demo Bank - ", "")}`,
            loanNumber: `LN-${randInt(100000, 999999)}`,
            retainageBpsDefault: 500,
            totalLoanCents,
            paidToDateCents: paidLoanCents
          }
        });

        // assign banker to loan for testing banker portal
        if (demoBanker) {
          await prisma.loanBanker.create({
            data: { orgId, loanId: loan.id, userId: demoBanker.id }
          });
        }

        const statusCycle = ["DRAFT", "READY_FOR_BANK_REVIEW", "APPROVED", "NEEDS_INFO"];
        const drawStatus = statusCycle[(projectIndex - 1) % statusCycle.length];

        const draw = await prisma.drawRequest.create({
          data: {
            orgId,
            projectId: p.id,
            loanId: loan.id,
            templateId: template.id,
            status: drawStatus,
            deliveryEmailTo: ["office@example.com", "bank@example.com"],
            approvedAt: drawStatus === "APPROVED" ? new Date() : null,
            approvedByUserId: drawStatus === "APPROVED" ? demoBanker?.id ?? null : null,
            approvedComment: drawStatus === "NEEDS_INFO" ? "Please attach updated permit." : null,
            lockedAt: drawStatus === "APPROVED" ? new Date() : null
          }
        });

        await prisma.drawLineItem.createMany({
          data: [
            {
              orgId,
              drawRequestId: draw.id,
              label: "General Conditions",
              costCode: "0100",
              scheduledCents: randInt(25000, 60000) * 100,
              previousDrawCents: randInt(0, 20000) * 100,
              thisDrawCents: randInt(5000, 25000) * 100,
              retainageCents: randInt(0, 2500) * 100,
              percentComplete: randInt(10, 90)
            },
            {
              orgId,
              drawRequestId: draw.id,
              label: "Hard Costs (Trades)",
              costCode: "0200",
              scheduledCents: randInt(120000, 400000) * 100,
              previousDrawCents: randInt(20000, 120000) * 100,
              thisDrawCents: randInt(15000, 90000) * 100,
              retainageCents: randInt(0, 9000) * 100,
              percentComplete: randInt(10, 90)
            }
          ]
        });

        // Units (demo): create up to 12 units with bed/bath/sqft
        const unitsToCreate = Math.min(unitCount, 12);
        for (let u = 1; u <= unitsToCreate; u++) {
          const bed = pick([0, 1, 1, 2, 2, 3]);
          const bath = pick([1, 1, 1.5, 2]);
          const sqft = bed === 0 ? randInt(420, 520) : bed === 1 ? randInt(600, 780) : bed === 2 ? randInt(820, 1100) : randInt(1100, 1450);

          const baseRent = bed === 0 ? randInt(1050, 1350) : bed === 1 ? randInt(1350, 1750) : bed === 2 ? randInt(1750, 2350) : randInt(2350, 3100);
          const marketRent = baseRent + randInt(50, 250);
          const isRental = status === "COMPLETED_FOR_RENT";
          const rentalStatus = isRental ? pick(["OCCUPIED", "OCCUPIED", "AVAILABLE", "OFF_MARKET"]) : "AVAILABLE";
          const tenantName = rentalStatus === "OCCUPIED" ? pick(["Demo Tenant - Smith", "Demo Tenant - Johnson", "Demo Tenant - Williams", "Demo Tenant - Brown"]) : null;
          const leaseStart = rentalStatus === "OCCUPIED" ? new Date(Date.now() - randInt(10, 280) * 24 * 60 * 60 * 1000) : null;
          const leaseEnd = rentalStatus === "OCCUPIED" ? new Date(Date.now() + randInt(30, 360) * 24 * 60 * 60 * 1000) : null;
          const availableOn = rentalStatus === "AVAILABLE" ? new Date(Date.now() + randInt(0, 30) * 24 * 60 * 60 * 1000) : null;

          await prisma.unit.create({
            data: {
              orgId,
              projectId: p.id,
              unitNumber: `Unit ${u}`,
              bedrooms: bed,
              baths: bath,
              sqft,
              rentalStatus,
              rentCents: isRental ? baseRent * 100 : null,
              marketRentCents: isRental ? marketRent * 100 : null,
              availableOn,
              currentTenantName: tenantName,
              leaseStart,
              leaseEnd,
              buildiumUnitId: isRental ? `DEMO-BUILDIUM-${projectIndex}-${u}` : null
            }
          });
        }

        // Partner allocations (demo): 2 partners per project
        const partnerA = partners[(projectIndex - 1) % partners.length];
        const partnerB = partners[(projectIndex + 1) % partners.length];
        const aBps = pick([6000, 6500, 7000, 7500]);
        const bBps = 10000 - aBps;
        await prisma.projectPartner.createMany({
          data: [
            {
              orgId,
              projectId: p.id,
              partnerId: partnerA.id,
              ownershipBps: aBps,
              initialInvestmentCents: randInt(150000, 650000) * 100
            },
            {
              orgId,
              projectId: p.id,
              partnerId: partnerB.id,
              ownershipBps: bBps,
              initialInvestmentCents: randInt(80000, 420000) * 100
            }
          ]
        });

        // Project photos (demo): 2 per project
        await prisma.projectPhoto.createMany({
          data: [
            {
              orgId,
              projectId: p.id,
              title: "Exterior",
              url: `https://picsum.photos/seed/mfcms-${projectIndex}-ext/900/600`
            },
            {
              orgId,
              projectId: p.id,
              title: "Interior",
              url: `https://picsum.photos/seed/mfcms-${projectIndex}-int/900/600`
            }
          ]
        });

        // One project-specific custom section for a few projects
        if (projectIndex % 4 === 0) {
          const section = await prisma.projectCustomSection.create({
            data: { orgId, projectId: p.id, title: "Notes", sortOrder: 5 }
          });
          await prisma.projectCustomSectionItem.create({
            data: {
              orgId,
              sectionId: section.id,
              title: "Dropbox folder",
              url: "https://example.com/dropbox/project-folder"
            }
          });
        }
      }
    }

    // Enrich existing demo projects with missing related data (units, loans, photos, partners).
    for (const p of projects) {
      const [unitCountExisting, photoCountExisting, partnerCountExisting, loanCountExisting, planCountExisting, inspectionCountExisting, reminderCountExisting] = await Promise.all([
        prisma.unit.count({ where: { orgId, projectId: p.id } }),
        prisma.projectPhoto.count({ where: { orgId, projectId: p.id } }),
        prisma.projectPartner.count({ where: { orgId, projectId: p.id } }),
        prisma.loan.count({ where: { orgId, projectId: p.id } }),
        prisma.planSet.count({ where: { orgId, projectId: p.id } }),
        prisma.inspection.count({ where: { orgId, projectId: p.id } }),
        prisma.reminder.count({ where: { orgId, projectId: p.id } })
      ]);

      if (unitCountExisting === 0) {
        const unitCount = p.unitCount ?? randInt(4, 48);
        const unitsToCreate = Math.min(unitCount, 12);
        for (let u = 1; u <= unitsToCreate; u++) {
          const bed = pick([0, 1, 1, 2, 2, 3]);
          const bath = pick([1, 1, 1.5, 2]);
          const sqft =
            bed === 0
              ? randInt(420, 520)
              : bed === 1
                ? randInt(600, 780)
                : bed === 2
                  ? randInt(820, 1100)
                  : randInt(1100, 1450);

          const baseRent = bed === 0 ? randInt(1050, 1350) : bed === 1 ? randInt(1350, 1750) : bed === 2 ? randInt(1750, 2350) : randInt(2350, 3100);
          const marketRent = baseRent + randInt(50, 250);
          const isRental = p.status === "COMPLETED_FOR_RENT" || p.status === "RENTAL_READY";
          const rentalStatus = isRental ? pick(["OCCUPIED", "OCCUPIED", "AVAILABLE", "OFF_MARKET"]) : "AVAILABLE";
          const tenantName = rentalStatus === "OCCUPIED" ? pick(["Demo Tenant - Smith", "Demo Tenant - Johnson", "Demo Tenant - Williams", "Demo Tenant - Brown"]) : null;
          const leaseStart = rentalStatus === "OCCUPIED" ? new Date(Date.now() - randInt(10, 280) * 24 * 60 * 60 * 1000) : null;
          const leaseEnd = rentalStatus === "OCCUPIED" ? new Date(Date.now() + randInt(30, 360) * 24 * 60 * 60 * 1000) : null;
          const availableOn = rentalStatus === "AVAILABLE" ? new Date(Date.now() + randInt(0, 30) * 24 * 60 * 60 * 1000) : null;

          await prisma.unit.create({
            data: {
              orgId,
              projectId: p.id,
              unitNumber: `Unit ${u}`,
              bedrooms: bed,
              baths: bath,
              sqft,
              rentalStatus,
              rentCents: isRental ? baseRent * 100 : null,
              marketRentCents: isRental ? marketRent * 100 : null,
              availableOn,
              currentTenantName: tenantName,
              leaseStart,
              leaseEnd,
              buildiumUnitId: isRental ? `DEMO-BUILDIUM-${String(p.id).slice(-6)}-${u}` : null
            }
          }).catch(() => null);
        }
      }

      // Ensure completed-for-rent projects have demo rent/status fields even if units already existed from older seeds.
      if (p.status === "COMPLETED_FOR_RENT" || p.status === "RENTAL_READY") {
        const existingUnits = await prisma.unit.findMany({ where: { orgId, projectId: p.id }, take: 50 });
        for (const u of existingUnits) {
          if (u.rentCents != null || u.marketRentCents != null || u.currentTenantName != null) continue;
          const bed = u.bedrooms ?? 1;
          const baseRent = bed === 0 ? randInt(1050, 1350) : bed === 1 ? randInt(1350, 1750) : bed === 2 ? randInt(1750, 2350) : randInt(2350, 3100);
          const marketRent = baseRent + randInt(50, 250);
          const rentalStatus = pick(["OCCUPIED", "OCCUPIED", "AVAILABLE", "OFF_MARKET"]);
          const tenantName = rentalStatus === "OCCUPIED" ? pick(["Demo Tenant - Smith", "Demo Tenant - Johnson", "Demo Tenant - Williams", "Demo Tenant - Brown"]) : null;
          const leaseStart = rentalStatus === "OCCUPIED" ? new Date(Date.now() - randInt(10, 280) * 24 * 60 * 60 * 1000) : null;
          const leaseEnd = rentalStatus === "OCCUPIED" ? new Date(Date.now() + randInt(30, 360) * 24 * 60 * 60 * 1000) : null;
          const availableOn = rentalStatus === "AVAILABLE" ? new Date(Date.now() + randInt(0, 30) * 24 * 60 * 60 * 1000) : null;
          await prisma.unit.update({
            where: { id: u.id },
            data: {
              rentalStatus,
              rentCents: baseRent * 100,
              marketRentCents: marketRent * 100,
              availableOn,
              currentTenantName: tenantName,
              leaseStart,
              leaseEnd,
              buildiumUnitId: u.buildiumUnitId ?? `DEMO-BUILDIUM-${String(p.id).slice(-6)}-${u.unitNumber.replaceAll(" ", "")}`
            }
          }).catch(() => null);
        }
      }

      if (photoCountExisting === 0) {
        const idx = Number(String(p.name).match(/Demo Project\\s+(\\d+)/)?.[1] ?? "1");
        await prisma.projectPhoto.createMany({
          data: [
            { orgId, projectId: p.id, title: "Exterior", url: `https://picsum.photos/seed/mfcms-${idx}-ext/900/600` },
            { orgId, projectId: p.id, title: "Interior", url: `https://picsum.photos/seed/mfcms-${idx}-int/900/600` }
          ]
        }).catch(() => null);
      }

      if (partnerCountExisting === 0 && partners.length >= 2) {
        const idx = Number(String(p.name).match(/Demo Project\\s+(\\d+)/)?.[1] ?? "1");
        const partnerA = partners[(idx - 1) % partners.length];
        const partnerB = partners[(idx + 1) % partners.length];
        const aBps = pick([6000, 6500, 7000, 7500]);
        const bBps = 10000 - aBps;
        await prisma.projectPartner.createMany({
          data: [
            { orgId, projectId: p.id, partnerId: partnerA.id, ownershipBps: aBps, initialInvestmentCents: randInt(150000, 650000) * 100 },
            { orgId, projectId: p.id, partnerId: partnerB.id, ownershipBps: bBps, initialInvestmentCents: randInt(80000, 420000) * 100 }
          ]
        }).catch(() => null);
      }

      if (loanCountExisting === 0 && banks.length > 0 && templates.length > 0) {
        const idx = Number(String(p.name).match(/Demo Project\\s+(\\d+)/)?.[1] ?? "1");
        const bank = banks[(idx - 1) % banks.length];
        const template = templates[(idx - 1) % templates.length];
        const totalLoanCents = randInt(900000, 6000000) * 100;
        const paidLoanCents = Math.round(totalLoanCents * pick([0.05, 0.12, 0.2, 0.33, 0.48]));
        const loan = await prisma.loan.create({
          data: {
            orgId,
            projectId: p.id,
            bankId: bank.id,
            name: `Construction Loan - ${bank.name.replace("Demo Bank - ", "")}`,
            loanNumber: `LN-${randInt(100000, 999999)}`,
            retainageBpsDefault: 500,
            totalLoanCents,
            paidToDateCents: paidLoanCents
          }
        }).catch(() => null);

        if (loan && demoBanker) {
          await prisma.loanBanker.create({
            data: { orgId, loanId: loan.id, userId: demoBanker.id }
          }).catch(() => null);
        }

        if (loan) {
          const statusCycle = ["DRAFT", "READY_FOR_BANK_REVIEW", "APPROVED", "NEEDS_INFO"];
          const drawStatus = statusCycle[(idx - 1) % statusCycle.length];

          const draw = await prisma.drawRequest.create({
            data: {
              orgId,
              projectId: p.id,
              loanId: loan.id,
              templateId: template.id,
              status: drawStatus,
              deliveryEmailTo: ["office@example.com", "bank@example.com"],
              approvedAt: drawStatus === "APPROVED" ? new Date() : null,
              approvedByUserId: drawStatus === "APPROVED" ? demoBanker?.id ?? null : null,
              approvedComment: drawStatus === "NEEDS_INFO" ? "Please attach updated permit." : null,
              lockedAt: drawStatus === "APPROVED" ? new Date() : null
            }
          }).catch(() => null);

          if (draw) {
            await prisma.drawLineItem.createMany({
              data: [
                {
                  orgId,
                  drawRequestId: draw.id,
                  label: "General Conditions",
                  costCode: "0100",
                  scheduledCents: randInt(25000, 60000) * 100,
                  previousDrawCents: randInt(0, 20000) * 100,
                  thisDrawCents: randInt(5000, 25000) * 100,
                  retainageCents: randInt(0, 2500) * 100,
                  percentComplete: randInt(10, 90)
                },
                {
                  orgId,
                  drawRequestId: draw.id,
                  label: "Hard Costs (Trades)",
                  costCode: "0200",
                  scheduledCents: randInt(120000, 400000) * 100,
                  previousDrawCents: randInt(20000, 120000) * 100,
                  thisDrawCents: randInt(15000, 90000) * 100,
                  retainageCents: randInt(0, 9000) * 100,
                  percentComplete: randInt(10, 90)
                }
              ]
            }).catch(() => null);
          }
        }
      }

      const projectLoansMissingBalances = await prisma.loan.findMany({
        where: { orgId, projectId: p.id, totalLoanCents: null },
        orderBy: { createdAt: "asc" }
      });
      for (let loanIdx = 0; loanIdx < projectLoansMissingBalances.length; loanIdx++) {
        const idx = Number(String(p.name).match(/Demo Project\s+(\d+)/)?.[1] ?? `${loanIdx + 1}`);
        const totalLoanCents = (900000 + (idx % 8) * 375000 + Math.floor(idx / 8) * 225000) * 100;
        const paidLoanCents = Math.round(totalLoanCents * pick([0.08, 0.14, 0.22, 0.31, 0.45]));
        await prisma.loan.update({
          where: { id: projectLoansMissingBalances[loanIdx].id },
          data: {
            totalLoanCents,
            paidToDateCents: paidLoanCents
          }
        }).catch(() => null);
      }

      if (planCountExisting === 0) {
        const idx = Number(String(p.name).match(/Demo Project\\s+(\\d+)/)?.[1] ?? "1");
        await prisma.planSet.create({
          data: {
            orgId,
            projectId: p.id,
            name: "Architectural Plan Set",
            version: idx % 2 === 0 ? "IFC" : "Permit",
            receivedAt: new Date(Date.now() - randInt(5, 120) * 24 * 60 * 60 * 1000),
            notes: "Demo plan set (link stored in notes)."
          }
        }).catch(() => null);
      }

      if (inspectionCountExisting === 0) {
        const createdAtBase = Date.now() - randInt(5, 90) * 24 * 60 * 60 * 1000;
        await prisma.inspection.createMany({
          data: [
            {
              orgId,
              projectId: p.id,
              name: "Foundation inspection",
              required: true,
              notes: "Demo inspection scheduled."
            },
            {
              orgId,
              projectId: p.id,
              name: "Rough-in inspection",
              required: true,
              notes: "Demo inspection scheduled."
            }
          ]
        }).catch(() => null);
        // Randomly complete one inspection for variety
        if (Math.random() < 0.4) {
          const one = await prisma.inspection.findFirst({ where: { orgId, projectId: p.id }, orderBy: { createdAt: "asc" } });
          if (one) {
            await prisma.inspection.update({ where: { id: one.id }, data: { completedAt: new Date(createdAtBase + randInt(1, 10) * 24 * 60 * 60 * 1000) } }).catch(() => null);
          }
        }
      }

      if (reminderCountExisting === 0) {
        await prisma.reminder.createMany({
          data: [
            {
              orgId,
              projectId: p.id,
              createdByUserId: demoAdmin.id,
              body: "Call utility company to confirm electric service date.",
              dueAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
            },
            {
              orgId,
              projectId: p.id,
              createdByUserId: demoAdmin.id,
              body: "Upload latest permit + inspection report to the project.",
              dueAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)
            }
          ]
        }).catch(() => null);
      }
    }

    console.log("");
    console.log("Seed complete.");
    console.log(`- LLCs: ${llcs.length}`);
    console.log(`- Projects: ${projects.length}`);
    console.log(`- Vendors: ${vendors.length}`);
    console.log("");
    console.log("Demo logins (Password123!):");
    console.log("- demo-admin@mfcms.local (ADMIN)");
    console.log("- demo-owner@mfcms.local (OWNER)");
    console.log("- demo-pm@mfcms.local (PROJECT_MANAGER)");
    console.log("- demo-accountant@mfcms.local (ACCOUNTANT)");
    console.log("- demo-field@mfcms.local (FIELD_AGENT)");
    console.log("- demo-banker@mfcms.local (BANKER)");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
