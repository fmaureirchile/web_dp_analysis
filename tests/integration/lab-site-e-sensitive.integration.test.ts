import request from "supertest";
import { describe, expect, it } from "vitest";

import { buildLaboratoryServer } from "../../test-lab/sites/lab-server";

describe("Etapa 4 laboratorio - Sitio E datos sensibles", () => {
  const app = buildLaboratoryServer();
  const clientId = "integration-site-e-client";

  it("expone formulario multipart con campos esperados", async () => {
    const page = await request(app).get("/sitio-e");

    expect(page.status).toBe(200);
    expect(page.text).toContain("enctype=\"multipart/form-data\"");
    expect(page.text).toContain("name=\"healthCondition\"");
    expect(page.text).toContain("name=\"medicalDocument\"");
  });

  it("acepta upload multipart sintetico y registra submission", async () => {
    const upload = await request(app)
      .post("/sitio-e/upload")
      .set("x-synthetic-client-id", clientId)
      .field("healthCondition", "asma sintetica")
      .attach("medicalDocument", Buffer.from("documento-sintetico"), "salud-sintetica.txt");

    expect(upload.status).toBe(201);
    expect(upload.body.status).toBe("ok");
    expect(upload.body.submission.multipartDetected).toBe(true);
    expect(upload.body.submission.healthCondition.provided).toBe(true);
    expect(upload.body.submission.healthCondition.value).toBe("asma sintetica");
    expect(upload.body.submission.medicalDocument.provided).toBe(true);
    expect(upload.body.submission.medicalDocument.filename).toBe("salud-sintetica.txt");
    expect(upload.body.submission.sensitivity.category).toBe("HEALTH_DATA");
    expect(upload.body.submission.sensitivity.syntheticOnly).toBe(true);

    const submissions = await request(app)
      .get("/sitio-e/submissions")
      .set("x-synthetic-client-id", clientId);

    expect(submissions.status).toBe(200);
    expect(submissions.body.count).toBeGreaterThan(0);
    expect(submissions.body.data[0].healthCondition.value).toBe("asma sintetica");
  });

  it("rechaza payload no multipart", async () => {
    const invalid = await request(app)
      .post("/sitio-e/upload")
      .set("x-synthetic-client-id", clientId)
      .send({ healthCondition: "no-multipart" });

    expect(invalid.status).toBe(415);
    expect(invalid.body.error).toBe("multipart_content_type_required");
  });
});
