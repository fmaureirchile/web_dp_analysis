import { PrismaClient, EvidenceLevel, ExecutionState, ReviewState, AuthorizationStatus } from "@prisma/client";

const prisma = new PrismaClient();

async function main(): Promise<void> {
  const organization = await prisma.organization.create({
    data: {
      name: "Org Seed Stage2",
      correlationId: "seed-stage2"
    }
  });

  const project = await prisma.project.create({
    data: {
      organizationId: organization.id,
      name: "Project Seed Stage2",
      correlationId: "seed-stage2"
    }
  });

  const authorization = await prisma.authorization.create({
    data: {
      projectId: project.id,
      status: AuthorizationStatus.ACTIVE,
      validFrom: new Date("2026-01-01T00:00:00.000Z"),
      validTo: new Date("2026-12-31T00:00:00.000Z"),
      correlationId: "seed-stage2"
    }
  });

  const target = await prisma.target.create({
    data: {
      projectId: project.id,
      authorizationId: authorization.id,
      baseUrl: "https://seed.example.local",
      correlationId: "seed-stage2"
    }
  });

  const execution = await prisma.execution.create({
    data: {
      projectId: project.id,
      authorizationId: authorization.id,
      targetId: target.id,
      state: ExecutionState.DRAFT,
      correlationId: "seed-stage2"
    }
  });

  const page = await prisma.page.create({
    data: {
      executionId: execution.id,
      url: "https://seed.example.local/form",
      title: "Seed Form",
      correlationId: "seed-stage2"
    }
  });

  const formField = await prisma.formField.create({
    data: {
      pageId: page.id,
      name: "email",
      type: "email",
      required: true,
      correlationId: "seed-stage2"
    }
  });

  const observation = await prisma.dataObservation.create({
    data: {
      executionId: execution.id,
      pageId: page.id,
      formFieldId: formField.id,
      description: "Seed observation for email field",
      reviewState: ReviewState.PENDING,
      correlationId: "seed-stage2"
    }
  });

  const evidence = await prisma.evidence.create({
    data: {
      executionId: execution.id,
      level: EvidenceLevel.E2,
      kind: "HTML",
      location: "s3://seed-bucket/evidence-1",
      correlationId: "seed-stage2",
      observations: {
        connect: [{ id: observation.id }]
      }
    }
  });

  const finding = await prisma.finding.create({
    data: {
      projectId: project.id,
      reviewState: ReviewState.PENDING,
      summary: "Seed finding",
      correlationId: "seed-stage2",
      evidences: {
        connect: [{ id: evidence.id }]
      }
    }
  });

  await prisma.reviewDecision.create({
    data: {
      findingId: finding.id,
      reviewState: ReviewState.CONFIRMED,
      comment: "Seed review decision",
      correlationId: "seed-stage2"
    }
  });

  process.stdout.write("[db:seed] Stage 2 seed completed\n");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
