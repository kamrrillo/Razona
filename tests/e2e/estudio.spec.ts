import { expect, type Page, test } from "@playwright/test";

async function enterStudy(page: Page, name: string) {
  // Se entra desde el login, con el botón "Participar en el estudio".
  await page.goto("/login");
  await page.getByTestId("go-estudio").click();
  await expect(page).toHaveURL(/\/estudio$/);
  await page.getByLabel("¿Cómo te llamas?").fill(name);
  await page.getByRole("button", { name: "Continuar" }).click();
  await expect(page.getByTestId("estudio-modes")).toBeVisible();
  await expect(page.getByText(`Hola, ${name}`)).toBeVisible();
}

test("estudio: nombre → sin IA → cuestionario, y el modo queda fijo", async ({ page }) => {
  const name = `Participante ${Date.now()}`;
  await enterStudy(page, name);
  // Antes de elegir modo no se puede usar la app
  await page.goto("/practicar");
  await expect(page).toHaveURL(/\/estudio$/);

  await page.getByTestId("estudio-mode-control").click();
  await expect(page).toHaveURL(/\/inicio/);
  await expect(page.getByText(`¡Hola, ${name}!`)).toBeVisible();

  // Modo sin IA: un intento, respuesta y explicación, sin tutor
  await page.getByTestId("start-practice").click();
  await page.locator('[data-testid^="option-"]').first().click();
  await page.getByTestId("submit-answer").click();
  await expect(page.getByTestId("quiz-feedback")).toBeVisible();
  await expect(page.getByTestId("tutor-chat")).toHaveCount(0);

  // Volver a /estudio no deja cambiar de modo
  await page.goto("/estudio");
  await expect(page).toHaveURL(/\/inicio/);
  const forced = await page.request.post("/api/tutor", {
    data: { sessionId: crypto.randomUUID(), message: "x" },
  });
  expect(forced.status()).toBe(403);

  // Terminar regresa a la entrada del estudio para la siguiente persona
  await page.getByTestId("logout").click();
  await expect(page).toHaveURL(/\/estudio$/);
  await expect(page.getByLabel("¿Cómo te llamas?")).toBeVisible();
});

test("estudio: nombre → con IA → tutor socrático", async ({ page }) => {
  await enterStudy(page, `Con IA ${Date.now()}`);
  await page.getByTestId("estudio-mode-ia").click();
  await expect(page).toHaveURL(/\/inicio/);
  await page.goto("/examen");
  await expect(page.getByTestId("open-diagnostic")).toBeVisible();
});

test("estudio: el nombre es obligatorio", async ({ page }) => {
  await page.goto("/estudio");
  await page.getByRole("button", { name: "Continuar" }).click();
  await expect(page.getByTestId("estudio-name-form").getByRole("alert")).toHaveText(
    "Escribe tu nombre",
  );
});
