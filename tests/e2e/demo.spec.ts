import { expect, test } from "@playwright/test";

/** El guion de 90 s del pitch, de punta a punta, en viewport de iPhone. */
test("guion de la demo", async ({ page }) => {
  // 1. Entrar como Ana
  await page.goto("/login");
  await page.getByRole("button", { name: "Entrar como Ana (demo)" }).click();
  await expect(page).toHaveURL(/\/inicio/);

  // 2. Inicio: racha, avance por especialidad, tema débil
  await expect(
    page.getByText("Demo — uso educativo, no sustituye el criterio clínico"),
  ).toBeVisible();
  const streakBefore = Number(await page.getByTestId("streak-count").textContent());
  expect(streakBefore).toBeGreaterThan(0);
  await expect(page.getByTestId("weak-topic-name")).toHaveText("Bronquiolitis aguda");
  await expect(page.getByText("Avance por área")).toBeVisible();
  // Ruta tipo camino: el nodo actual es el tema débil y abre su tarjeta
  await page.getByTestId("path-node-current").click();
  await expect(page.getByTestId("path-practice-weak")).toBeVisible();
  await page.getByTestId("path-node-current").click();

  // 3. Caso del tema débil: respuesta incorrecta → se revela la correcta y el tutor explica
  await page.getByTestId("practice-weak-topic").click();
  await expect(page).toHaveURL(/\/practicar\?topic=weak/);
  await expect(page.getByText("Tema débil")).toBeVisible();
  // Caso real del banco (RZ-PED-032-I); ya no hay etiqueta de contenido de ejemplo.
  await expect(page.getByText(/CONTENIDO DE EJEMPLO/)).toHaveCount(0);
  await page.getByTestId("option-a").click();
  await page.getByTestId("submit-answer").click();
  // 4. Feedback del error (la correcta de RZ-PED-032-I es la e): GPC citada primero
  const feedback = page.getByTestId("feedback");
  await expect(feedback).toHaveAttribute("data-correct", "false");
  await expect(feedback.getByTestId("wrong-summary")).toContainText("e)");
  await expect(page.getByTestId("option-e")).toHaveClass(/emerald/);
  const explanation = feedback.getByTestId("tutor-explanation");
  await expect(explanation).toBeVisible({ timeout: 25_000 });
  await expect(explanation.getByTestId("tutor-gpc")).toContainText("IMSS-032-08");
  await expect(explanation.getByTestId("citation")).toContainText(/p\. \d+/);
  // La cita abre el PDF de la GPC en la página citada (json/fuentes: url → url_pdf → pdfUrl)
  await expect(explanation.getByTestId("citation-pdf").first()).toHaveAttribute(
    "href",
    /^https:\/\/www\.imss\.gob\.mx\/.+\/032GER\.pdf#page=\d+$/,
  );
  await expect(explanation.getByTestId("socratic-dialog")).toContainText("?");
  await expect(explanation.getByTestId("tutor-personal")).toContainText("Ana");
  await expect(explanation.getByTestId("tutor-fundamentals").locator("li").first()).toBeVisible();
  await expect(explanation.getByTestId("tutor-distractors")).toContainText("TU ELECCIÓN");
  const concept = explanation.getByTestId("concept-diagram");
  await expect(concept).toHaveAttribute("data-kind", /^(arbol|flujo|escala|comparacion)$/);
  await expect(concept.getByTestId("concept-node").first()).toBeVisible();
  await page.screenshot({ path: "test-results/explicacion-practica.png", fullPage: true });
  // Recursos de aprendizaje: primero los de su error (eligió a: razonamiento)
  const resources = feedback.getByTestId("learning-resources");
  await expect(resources).toBeVisible();
  await expect(
    resources.getByTestId("resource").first().getByTestId("resource-for-you"),
  ).toHaveText(/razonamiento/);
  const flashcard = resources.locator('[data-testid="resource"][data-type="flashcard"]').first();
  await expect(flashcard.getByTestId("flashcard-back")).toBeHidden();
  await flashcard.getByTestId("flashcard-toggle").click();
  await expect(flashcard.getByTestId("flashcard-back")).toBeVisible();
  await resources.getByTestId("more-resources").click();
  await expect(resources.getByTestId("resource-diagram").first()).toHaveAttribute(
    "data-state",
    "ready",
    { timeout: 20_000 },
  );
  await expect(resources.getByTestId("resource-diagram").first().locator("svg")).toBeVisible();
  const image = resources.locator('[data-testid="resource"][data-type="image"] img');
  await expect(image).toBeVisible();
  expect(await image.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0);

  // 5. Examen simulado global: 2 en vivo + "Completar examen (demo)"
  await page.getByRole("link", { name: "Examen", exact: true }).click();
  await expect(page.getByTestId("exam-scope-global")).toHaveAttribute("aria-pressed", "true");
  await page.getByTestId("start-exam").click();
  await expect(page).toHaveURL(/\/examen\/[0-9a-f-]{36}$/);
  await expect(page.getByTestId("exam-timer")).toBeVisible();
  await expect(page.getByText(/Tutor apagado/)).toBeVisible();
  await page.getByTestId("exam-option-c").click();
  await expect(page.getByText("1/10 respondidos")).toBeVisible();
  await page.getByTestId("exam-next").click();
  await page.getByTestId("exam-option-a").click();
  await expect(page.getByText("2/10 respondidos")).toBeVisible();
  await page.getByTestId("complete-exam-demo").click();

  // 6. Resultados
  await expect(page).toHaveURL(/\/resultados$/);
  await expect(page.getByTestId("exam-score")).toContainText("/10 aciertos");
  await expect(page.getByText("Aciertos por área")).toBeVisible();
  await expect(page.getByTestId("review-item")).toHaveCount(10);
  await page.getByTestId("review-item").first().locator(":scope > summary").click();
  await expect(
    page.getByTestId("review-item").first().getByTestId("citation").first(),
  ).toBeVisible();
  await page.getByTestId("review-item").first().getByTestId("load-explanation").click();
  await expect(page.getByTestId("review-item").first().getByTestId("concept-diagram")).toBeVisible({
    timeout: 25_000,
  });
  await expect(page.getByTestId("practice-weak-topic")).toBeVisible();

  // 7. Progreso: la racha sube y el tema débil se actualiza
  await page.getByRole("link", { name: "Progreso", exact: true }).click();
  await expect(page.getByTestId("streak-count")).toHaveText(String(streakBefore + 1));
  await expect(page.getByTestId("weak-topic-delta")).toBeVisible();
});

test("examen por tema: el caso índice y su variante", async ({ page }) => {
  await page.goto("/login");
  await page.getByRole("button", { name: "Entrar como Ana (demo)" }).click();
  await expect(page).toHaveURL(/\/inicio/);
  await page.getByRole("link", { name: "Examen", exact: true }).click();
  await page.getByTestId("exam-scope-tema").click();
  await page.getByTestId("exam-topic").selectOption("bronquiolitis_aguda");
  await expect(page.getByTestId("exam-count")).toContainText("2 reactivos");
  await page.getByTestId("start-exam").click();
  await expect(page).toHaveURL(/\/examen\/[0-9a-f-]{36}$/);
  await expect(page.getByText("Examen de Bronquiolitis aguda")).toBeVisible();
  await page.getByTestId("exam-option-a").click();
  await expect(page.getByText("1/2 respondidos")).toBeVisible();
  await page.getByTestId("complete-exam-demo").click();
  await expect(page).toHaveURL(/\/resultados$/);
  await expect(page.getByTestId("review-item")).toHaveCount(2);
  await expect(page.getByText("Aciertos por tema")).toBeVisible();
  // La opción a es incorrecta en RZ-PED-032-I: la revisión explica el tipo de error.
  await page.getByTestId("review-item").first().locator(":scope > summary").click();
  await expect(page.getByTestId("review-item").first().getByTestId("error-type")).toBeVisible();
  await expect(
    page.getByTestId("review-item").first().getByTestId("learning-resources"),
  ).toContainText("Para tu error de razonamiento");
});

test("examen por área", async ({ page }) => {
  await page.goto("/login");
  await page.getByRole("button", { name: "Entrar como Ana (demo)" }).click();
  await expect(page).toHaveURL(/\/inicio/);
  await page.getByRole("link", { name: "Examen", exact: true }).click();
  await page.getByTestId("exam-scope-grupo").click();
  await page.getByTestId("exam-group").selectOption("neonatologia");
  await expect(page.getByTestId("exam-count")).toContainText("10 reactivos");
  await page.getByTestId("start-exam").click();
  await expect(page.getByText("Examen de Neonatología")).toBeVisible();
  await expect(page.getByText(/0\/10 respondidos/)).toBeVisible();
});

test("las rutas de la app requieren sesión", async ({ page }) => {
  await page.goto("/progreso");
  // Pide entrar y recuerda a dónde iba.
  await expect(page).toHaveURL(/\/login\?next=%2Fprogreso$/);
});

test("las APIs rechazan peticiones sin sesión", async ({ request }) => {
  const res = await request.post("/api/session", { data: {} });
  expect(res.status()).toBe(401);
  const progress = await request.get("/api/progress");
  expect(progress.status()).toBe(401);
});

test("la explicación no se entrega para un caso sin resolver", async ({ page }) => {
  await page.goto("/login");
  await page.getByRole("button", { name: "Entrar como Ana (demo)" }).click();
  await expect(page).toHaveURL(/\/inicio/);
  const session = await page.request.post("/api/session", { data: {} });
  const { sessionId } = await session.json();
  const res = await page.request.post("/api/explain", { data: { sessionId } });
  expect(res.status()).toBe(409);
  const unauth = await page.request.post("/api/explain", {
    data: { examId: "00000000-0000-4000-8000-000000000000", itemId: "ex-mi-01" },
  });
  expect(unauth.status()).toBe(404);
});
