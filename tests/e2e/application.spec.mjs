import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";

async function download(page, id) {
  const pending = page.waitForEvent("download");
  await page.locator(`#${id}`).click();
  const file = await pending;
  expect(await file.failure()).toBeNull();
  await file.saveAs(test.info().outputPath(file.suggestedFilename()));
  return { name: file.suggestedFilename(), bytes: await readFile(await file.path()) };
}

async function complete(page, count) {
  for (let i = 0; i < count; i++) {
    if (i < count - 1) await expect(page.locator("#nextBtn")).toBeDisabled();
    await page.locator(".option").nth(i % 3).click();
    await page.locator(i === count - 1 ? "#finishBtn" : "#nextBtn").click();
  }
  await expect(page.locator("#resultSection")).toBeVisible();
}

for (const [mode, count] of [["full", 30], ["fast", 12]]) {
  test(`${mode} : parcours complet, scores, reprise et quatre exports réels`, async ({ page }) => {
    const errors = [];
    const violations = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.goto("/");
    await page.evaluate(() => {
      window.securityViolations = [];
      document.addEventListener("securitypolicyviolation", event => window.securityViolations.push(event.violatedDirective));
    });
    const questions = await download(page, "dlQuestionsJsonBtn");
    expect(questions.name).toBe("dilemmes_questions.json");
    expect(JSON.parse(questions.bytes).questions).toHaveLength(30);
    const questionsPdf = await download(page, "dlQuestionsPdfBtn");
    expect(questionsPdf.name).toBe("dilemmes_questions.pdf");
    expect(questionsPdf.bytes.subarray(0, 5).toString()).toBe("%PDF-");
    expect(questionsPdf.bytes.toString("latin1")).toContain("%%EOF");
    expect(questionsPdf.bytes.toString("latin1")).toContain("Le portefeuille");
    await page.locator("#mode").selectOption(mode);
    await page.locator("#userName").fill("Alice <img src=x>");
    await page.locator("#startBtn").click();
    await complete(page, count);
    await expect(page.locator("#answersReview .answerCard")).toHaveCount(count);
    await expect(page.locator("#resultSubtitle")).toContainText("Alice <img src=x>");
    await expect(page.locator("#resultSection img")).toHaveCount(0);
    const json = await download(page, "dlResultJsonBtn");
    expect(json.name).toBe("dilemmes_resultat.json");
    const result = JSON.parse(json.bytes);
    expect(result.completed).toBe(true);
    expect(result.answers).toHaveLength(count);
    expect(Object.values(result.scores.norm).every(value => Number.isFinite(value) && value >= 0 && value <= 100)).toBe(true);
    const pdf = await download(page, "dlResultPdfBtn");
    expect(pdf.name).toBe("dilemmes_resultat.pdf");
    expect(pdf.bytes.subarray(0, 5).toString()).toBe("%PDF-");
    expect(pdf.bytes.toString("latin1")).toContain("%%EOF");
    expect(pdf.bytes.toString("latin1")).toContain("Le portefeuille");
    expect(pdf.bytes.toString("latin1")).toContain("Je le rends");
    expect(pdf.bytes.length).toBeGreaterThan(3000);
    expect(await page.evaluate(() => document.querySelector("#radarChart").getContext("2d")
      .getImageData(0, 0, 300, 200).data.some(value => value !== 0))).toBe(true);
    violations.push(...await page.evaluate(() => window.securityViolations));
    await page.reload();
    await expect(page.locator("#resultSection")).toBeVisible();
    const again = await download(page, "dlResultJsonBtn");
    expect(JSON.parse(again.bytes)).toEqual(result);
    await page.locator("#resetBtn").evaluate(button => button.click());
    await expect(page.locator("#configSection")).toBeVisible();
    expect(await page.evaluate(() => localStorage.getItem("dm_local_v3"))).toBeNull();
    expect(errors).toEqual([]);
    expect(violations).toEqual([]);
  });
}

test("progression partielle, retour précédent et choix temporaire", async ({ page }) => {
  await page.goto("/");
  await page.locator("#mode").selectOption("fast");
  await page.locator("#persistProgress").uncheck();
  await page.locator("#startBtn").click();
  await page.locator(".option").nth(1).press("Enter");
  await page.locator("#nextBtn").click();
  await page.locator("#prevBtn").click();
  await expect(page.locator(".option.selected")).toContainText("Je garde l’argent");
  expect(await page.evaluate(() => localStorage.getItem("dm_local_v3"))).toBeNull();
  expect(await page.evaluate(() => JSON.parse(sessionStorage.getItem("dm_local_v3")).answers.q1)).toBe("B");
  await page.reload();
  await page.locator("#resumeBtn").click();
  await expect(page.locator(".option.selected")).toContainText("Je garde l’argent");
  page.on("dialog", dialog => dialog.accept());
  await page.locator("#logoBtn").click();
  await expect(page.locator("#configSection")).toBeVisible();
  expect(await page.evaluate(() => sessionStorage.getItem("dm_local_v3"))).toBeNull();
});

test("stockage ancien malveillant : résultat reconstruit sans exécution ni exfiltration", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => {
    const qIds = ["q1", "q3", "q5", "q6", "q8", "q11", "q14", "q16", "q17", "q20", "q24", "q30"];
    localStorage.setItem("dm_local_v3", JSON.stringify({ schemaVersion: 1, userName: "Alice", mode: "fast", qIds,
      index: 11, answers: Object.fromEntries(qIds.map(id => [id, "A"])), finished: true,
      result: { scores: { norm: { U: '<img src=x onerror="window.injection=1">' } },
        profile: { title: "Profil falsifié" }, answers: [{ title: '<img src=x onerror="window.injection=1">' }] } }));
  });
  await page.reload();
  await expect(page.locator("#resultSection")).toBeVisible();
  await expect(page.locator("#resultSection img")).toHaveCount(0);
  expect(await page.evaluate(() => window.injection)).toBeUndefined();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("dm_local_v3")).result)).toBeUndefined();
  await expect(page.locator("#profileTitle")).not.toHaveText("Profil falsifié");
});

test("stockage bloqué : le navigateur permet encore de jouer et de réinitialiser", async ({ page }) => {
  await page.addInitScript(() => {
    for (const name of ["localStorage", "sessionStorage"]) {
      Object.defineProperty(window, name, { get() { throw new DOMException("Accès refusé", "SecurityError"); } });
    }
  });
  await page.goto("/");
  await page.locator("#mode").selectOption("fast");
  await page.locator("#startBtn").click();
  await complete(page, 12);
  expect(JSON.parse((await download(page, "dlResultJsonBtn")).bytes).completed).toBe(true);
  page.on("dialog", dialog => dialog.accept());
  await page.locator("#logoBtn").click();
  await expect(page.locator("#configSection")).toBeVisible();
  await expect(page.locator("#storageNotice")).toContainText("bloque");
});

test("CSP effective : événement HTML injecté et requête sortante bloqués", async ({ page }) => {
  // Si la CSP échoue, la requête réussirait même sans DNS : évite un faux positif.
  await page.route("https://exfiltration.invalid/**", route => route.fulfill({
    status: 200, headers: { "access-control-allow-origin": "*" }, body: "accessible",
  }));
  await page.goto("/");
  await page.evaluate(() => {
    window.testViolations = [];
    document.addEventListener("securitypolicyviolation", event => window.testViolations.push(event.effectiveDirective));
    const image = document.createElement("img");
    image.setAttribute("onerror", "window.inlineInjection = true");
    image.src = "/ressource-inexistante";
    document.body.appendChild(image);
  });
  await expect.poll(() => page.evaluate(() => window.testViolations.includes("script-src-attr"))).toBe(true);
  expect(await page.evaluate(() => window.inlineInjection)).toBeUndefined();
  expect(await page.evaluate(() => fetch("https://exfiltration.invalid/").then(() => false, () => true))).toBe(true);
  await expect.poll(() => page.evaluate(() => window.testViolations.includes("connect-src"))).toBe(true);
});
