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
  await expect(page.getByTestId("weak-topic-name")).toHaveText("Bronquiolitis");
  await expect(page.getByText("Avance por especialidad")).toBeVisible();

  // 3. Caso del tema débil: respuesta incorrecta → pregunta socrática + cita GPC
  await page.getByTestId("practice-weak-topic").click();
  await expect(page).toHaveURL(/\/practicar\?topic=weak/);
  await expect(page.getByText("Tema débil")).toBeVisible();
  await expect(
    page.getByText("CONTENIDO DE EJEMPLO — reemplazar por los ítems validados"),
  ).toBeVisible();
  await page.getByTestId("option-a").click();
  await page.getByTestId("submit-answer").click();
  const tutor = page.getByTestId("tutor-message").first();
  await expect(tutor).toContainText("?");
  await expect(tutor.getByTestId("citation")).toContainText("GPC");
  await expect(tutor.getByTestId("tutor-hint")).toBeVisible();

  // 4. Corrige y ve el feedback con la cita
  await page.getByTestId("option-b").click();
  await page.getByTestId("submit-answer").click();
  const feedback = page.getByTestId("feedback");
  await expect(feedback).toContainText("¡Correcto!");
  await expect(feedback.getByTestId("citation")).toBeVisible();

  // 5. Examen simulado: 2 en vivo + "Completar examen (demo)"
  await page.getByRole("link", { name: "Examen", exact: true }).click();
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
  await expect(page.getByText("Aciertos por especialidad")).toBeVisible();
  await expect(page.getByTestId("review-item")).toHaveCount(10);
  await page.getByTestId("review-item").first().locator("summary").click();
  await expect(page.getByTestId("review-item").first().getByTestId("citation")).toBeVisible();
  await expect(page.getByTestId("practice-weak-topic")).toBeVisible();

  // 7. Progreso: la racha sube y el tema débil se actualiza
  await page.getByRole("link", { name: "Progreso", exact: true }).click();
  await expect(page.getByTestId("streak-count")).toHaveText(String(streakBefore + 1));
  await expect(page.getByTestId("weak-topic-delta")).toBeVisible();
});

test("las rutas de la app requieren sesión", async ({ page }) => {
  await page.goto("/progreso");
  await expect(page).toHaveURL(/\/login$/);
});

test("las APIs rechazan peticiones sin sesión", async ({ request }) => {
  const res = await request.post("/api/session", { data: {} });
  expect(res.status()).toBe(401);
  const progress = await request.get("/api/progress");
  expect(progress.status()).toBe(401);
});
