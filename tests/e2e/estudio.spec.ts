import { expect, type Page, test } from "@playwright/test";

async function enterStudy(page: Page, name: string) {
  // Se entra desde el login, con el botón "Participar en el estudio".
  await page.goto("/login");
  await page.getByTestId("go-estudio").click();
  await expect(page).toHaveURL(/\/estudio$/);
  await page.getByLabel("¿Cómo te llamas?").fill(name);
  await expect(page.getByTestId("study-agreement")).toContainText("Qué guardamos");
  // Sin aceptar el acuerdo no se puede continuar
  await expect(page.getByRole("button", { name: "Continuar" })).toBeDisabled();
  await page.getByTestId("study-consent").check();
  await page.getByRole("button", { name: "Continuar" }).click();
  await expect(page.getByTestId("estudio-modes")).toBeVisible();
  await expect(page.getByText(`Hola, ${name}`)).toBeVisible();
}

/** Responde la pregunta actual con la opción a y devuelve la tarjeta de resultado. */
async function answer(page: Page, testId: "quiz-feedback" | "feedback") {
  await page.getByTestId("option-a").click();
  await page.getByTestId("submit-answer").click();
  const card = page.getByTestId(testId);
  await expect(card).toBeVisible();
  return card;
}

test("estudio sin IA: 5 preguntas, solo correcto/incorrecto y agradecimiento", async ({ page }) => {
  const name = `Participante ${Date.now()}`;
  await enterStudy(page, name);
  await page.getByTestId("estudio-mode-control").click();
  await expect(page).toHaveURL(/\/practicar$/);
  // Sin navegación de la app: solo las preguntas
  await expect(page.getByRole("link", { name: "Examen", exact: true })).toHaveCount(0);
  await page.goto("/inicio");
  await expect(page).toHaveURL(/\/practicar$/);

  for (let i = 1; i <= 5; i++) {
    await expect(page.getByTestId("study-progress")).toHaveText(`Pregunta ${i} de 5`);
    const card = await answer(page, "quiz-feedback");
    // Solo dice si acertó y, si no, la correcta: sin explicación, cita ni tutor
    await expect(card.getByTestId("citation")).toHaveCount(0);
    await expect(page.getByTestId("tutor-explanation")).toHaveCount(0);
    await expect(page.getByTestId("learning-resources")).toHaveCount(0);
    if ((await card.getAttribute("data-correct")) === "false") {
      await expect(card).toContainText("Incorrecto");
      await expect(card.getByTestId("quiz-correct-answer")).toContainText("Respuesta correcta");
    }
    if (i < 5) await page.getByTestId("next-case").click();
  }
  await page.getByTestId("finish-study").click();
  await expect(page).toHaveURL(/\/estudio\/fin$/);
  await expect(page.getByTestId("study-done")).toContainText(`¡Gracias, ${name}!`);

  // Ya terminó: no hay más preguntas ni cambio de modo
  await page.goto("/practicar");
  await expect(page).toHaveURL(/\/estudio\/fin$/);
  await page.goto("/estudio");
  await expect(page).toHaveURL(/\/estudio\/fin$/);
  const more = await page.request.post("/api/session", { data: {} });
  expect(more.status()).toBe(409);

  // Terminar deja el teléfono listo para la siguiente persona
  await page.getByTestId("study-exit").click();
  await expect(page).toHaveURL(/\/estudio$/);
  await expect(page.getByLabel("¿Cómo te llamas?")).toBeVisible();
});

test("estudio con IA: el tutor explica la respuesta", async ({ page }) => {
  await enterStudy(page, `Con IA ${Date.now()}`);
  await page.getByTestId("estudio-mode-ia").click();
  await expect(page).toHaveURL(/\/practicar$/);
  await expect(page.getByTestId("study-progress")).toHaveText("Pregunta 1 de 5");
  // La primera pregunta del estudio es Bronquiolitis aguda (RZ-PED-032-I)
  await expect(page.getByTestId("case-title")).toHaveText("Bronquiolitis aguda");
  await answer(page, "feedback");
  await expect(page.getByTestId("tutor-explanation")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId("next-case")).toHaveText("Siguiente pregunta");
});

test("estudio: el nombre es obligatorio", async ({ page }) => {
  await page.goto("/estudio");
  await page.getByTestId("study-consent").check();
  await page.getByRole("button", { name: "Continuar" }).click();
  await expect(page.getByTestId("estudio-name-form").getByRole("alert")).toHaveText(
    "Escribe tu nombre",
  );
});

test("estudio: se puede volver al login desde el nombre y desde la elección de modo", async ({
  page,
}) => {
  // Paso 1 (nombre): enlace directo
  await page.goto("/estudio");
  await page.getByTestId("back-to-login").click();
  await expect(page).toHaveURL(/\/login$/);

  // Paso 2 (modo): ya hay sesión de participante; el botón la cierra y el login se queda
  await enterStudy(page, `Sale ${Date.now()}`);
  await page.getByTestId("back-to-login").click();
  await expect(page).toHaveURL(/\/login$/);
  await page.goto("/login");
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByTestId("signin-form")).toBeVisible();
});
