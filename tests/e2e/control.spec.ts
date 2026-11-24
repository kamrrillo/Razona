import { expect, type Page, test } from "@playwright/test";

/**
 * Versión de solo cuestionario (grupo control del estudio): se registra con /login?grupo=control.
 * Responde un intento por caso, ve la respuesta correcta y la explicación fija; nada de IA.
 */
async function signUpControl(page: Page, name = "Control") {
  const email = `control.${Date.now()}${Math.floor(Math.random() * 1000)}@razona.local`;
  await page.goto("/login?grupo=control&modo=registro");
  await expect(page.getByText("tutor")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Entrar como Ana (demo)" })).toHaveCount(0);
  await page.getByLabel("¿Cómo te llamas?").fill(name);
  await page.getByLabel("Correo").fill(email);
  await page.getByLabel("Contraseña", { exact: true }).fill("clave-segura-123");
  await page
    .getByTestId("signup-form")
    .getByRole("button", { name: "Crear cuenta", exact: true })
    .click();
  await expect(page).toHaveURL(/\/inicio/);
  return email;
}

test("grupo control: un intento por caso, solo si acertó y la correcta", async ({ page }) => {
  await signUpControl(page);
  await expect(page.getByText(/diagnóstico con IA/i)).toHaveCount(0);

  await page.getByTestId("start-practice").click();
  await expect(page.getByTestId("case-title")).toBeVisible();
  const options = page.locator('[data-testid^="option-"]');
  await options.first().click();
  await page.getByTestId("submit-answer").click();

  const feedback = page.getByTestId("quiz-feedback");
  await expect(feedback).toBeVisible();
  if ((await feedback.getAttribute("data-correct")) === "false") {
    await expect(feedback).toContainText("Incorrecto");
    await expect(feedback.getByTestId("quiz-correct-answer")).toContainText("Respuesta correcta");
  }
  // Sin explicación ni cita
  await expect(feedback.getByTestId("citation")).toHaveCount(0);
  // Nada de IA ni reintentos
  await expect(page.getByTestId("tutor-chat")).toHaveCount(0);
  await expect(page.getByTestId("tutor-explanation")).toHaveCount(0);
  await expect(page.getByTestId("learning-resources")).toHaveCount(0);
  await expect(page.getByTestId("submit-answer")).toHaveCount(0);
  for (const option of await options.all()) await expect(option).toBeDisabled();

  await page.getByTestId("next-case").click();
  await expect(page.getByTestId("quiz-feedback")).toHaveCount(0);
  await expect(page.getByTestId("submit-answer")).toBeVisible();
});

test("grupo control: las funciones con IA responden 403 y el diagnóstico no abre", async ({
  page,
}) => {
  await signUpControl(page);
  const session = await page.request.post("/api/session", { data: {} });
  const { sessionId } = await session.json();
  const tutor = await page.request.post("/api/tutor", { data: { sessionId, message: "hola" } });
  expect(tutor.status()).toBe(403);
  const explain = await page.request.post("/api/explain", { data: { sessionId } });
  expect(explain.status()).toBe(403);
  const diag = await page.request.post("/api/diagnostico/start", { data: {} });
  expect(diag.status()).toBe(403);

  await page.goto("/diagnostico");
  await expect(page).toHaveURL(/\/inicio$/);
  await page.goto("/examen");
  await expect(page.getByTestId("open-diagnostic")).toHaveCount(0);
});

test("grupo control: los resultados del examen solo dicen la respuesta correcta", async ({
  page,
}) => {
  await signUpControl(page);
  await page.goto("/examen");
  await page.getByTestId("exam-scope-tema").click();
  await page.getByTestId("exam-topic").selectOption("bronquiolitis_aguda");
  await page.getByTestId("start-exam").click();
  await expect(page).toHaveURL(/\/examen\/[0-9a-f-]{36}$/);
  await page.getByTestId("exam-option-a").click();
  await page.getByTestId("complete-exam-demo").click();
  await expect(page).toHaveURL(/\/resultados$/);

  const first = page.getByTestId("review-item").first();
  await first.locator(":scope > summary").click();
  // La opción a es incorrecta en RZ-PED-032-I
  await expect(first).toContainText("Respuesta correcta");
  await expect(first.getByTestId("citation")).toHaveCount(0);
  await expect(first.getByTestId("error-type")).toHaveCount(0);
  await expect(first.getByTestId("tutor-explanation")).toHaveCount(0);
  await expect(first.getByTestId("learning-resources")).toHaveCount(0);
});

test("la versión con IA sigue igual para las cuentas normales", async ({ page }) => {
  await page.goto("/login");
  await page.getByRole("button", { name: "Entrar como Ana (demo)" }).click();
  await expect(page).toHaveURL(/\/inicio/);
  await page.goto("/examen");
  await expect(page.getByTestId("open-diagnostic")).toBeVisible();
});
