import { expect, test } from "@playwright/test";

const unique = () => `alumna.${Date.now()}${Math.floor(Math.random() * 1000)}@razona.local`;

test("registrarse después de un intento fallido de entrar crea la cuenta", async ({ page }) => {
  const email = unique();
  await page.goto("/login");
  // 1. Intenta entrar sin tener cuenta
  await page.getByLabel("Correo").fill(email);
  await page.getByLabel("Contraseña", { exact: true }).fill("clave-segura-123");
  await page
    .getByTestId("signin-form")
    .getByRole("button", { name: "Entrar", exact: true })
    .click();
  await expect(page.getByTestId("signin-form").getByRole("alert")).toHaveText(
    "Correo o contraseña incorrectos",
  );

  // 2. Cambia a "Crear cuenta": el error anterior no se queda y el correo se conserva
  await page.getByTestId("auth-mode-signup").click();
  await expect(page.getByTestId("signup-form").getByRole("alert")).toHaveCount(0);
  await expect(page.getByLabel("Correo")).toHaveValue(email);
  await page.getByLabel("¿Cómo te llamas?").fill("María");
  await page.getByLabel("Contraseña", { exact: true }).fill("clave-segura-123");
  await page
    .getByTestId("signup-form")
    .getByRole("button", { name: "Crear cuenta", exact: true })
    .click();

  // 3. Entra con su nombre y un botón claro para empezar
  await expect(page).toHaveURL(/\/inicio\?bienvenida=1$/);
  await expect(page.getByText("¡Hola, María!")).toBeVisible();
  await expect(page.getByTestId("inicio-notice")).toBeVisible();
  await expect(page.getByTestId("first-steps")).toBeVisible();
  await page.getByTestId("start-practice").click();
  await expect(page).toHaveURL(/\/practicar$/);
});

test("los errores del formulario salen en español y se puede ver la contraseña", async ({
  page,
}) => {
  await page.goto("/login");
  await page.getByTestId("auth-mode-signup").click();
  await page.getByLabel("¿Cómo te llamas?").fill("Luz");
  await page.getByLabel("Correo").fill("no-es-correo");
  await page.getByLabel("Contraseña", { exact: true }).fill("corta");
  await page
    .getByTestId("signup-form")
    .getByRole("button", { name: "Crear cuenta", exact: true })
    .click();
  await expect(page.getByTestId("signup-form").getByRole("alert")).toContainText("correo válido");

  await page.getByLabel("Correo").fill(unique());
  await page.getByLabel("Contraseña", { exact: true }).fill("corta");
  await page
    .getByTestId("signup-form")
    .getByRole("button", { name: "Crear cuenta", exact: true })
    .click();
  await expect(page.getByTestId("signup-form").getByRole("alert")).toContainText(
    "al menos 8 caracteres",
  );

  const password = page.getByLabel("Contraseña", { exact: true });
  await password.fill("secreta-123");
  await expect(password).toHaveAttribute("type", "password");
  await page.getByTestId("toggle-password").click();
  await expect(password).toHaveAttribute("type", "text");
});

test("después de entrar vuelve a la página a la que iba", async ({ page }) => {
  await page.goto("/examen");
  await expect(page).toHaveURL(/\/login\?next=%2Fexamen$/);
  await page.getByRole("button", { name: "Entrar como Ana (demo)" }).click();
  // El demo entra a Inicio; con correo y contraseña se respeta next:
  await expect(page).toHaveURL(/\/inicio/);
  await page.getByTestId("logout").click();
  await expect(page).toHaveURL(/\/login$/);

  const email = unique();
  await page.goto("/login?modo=registro");
  await page.getByLabel("¿Cómo te llamas?").fill("Edgar");
  await page.getByLabel("Correo").fill(email);
  await page.getByLabel("Contraseña", { exact: true }).fill("clave-segura-123");
  await page
    .getByTestId("signup-form")
    .getByRole("button", { name: "Crear cuenta", exact: true })
    .click();
  await expect(page).toHaveURL(/\/inicio/);
  await page.getByTestId("logout").click();

  await page.goto("/progreso");
  await expect(page).toHaveURL(/\/login\?next=%2Fprogreso$/);
  await page.getByLabel("Correo").fill(email);
  await page.getByLabel("Contraseña", { exact: true }).fill("clave-segura-123");
  await page
    .getByTestId("signin-form")
    .getByRole("button", { name: "Entrar", exact: true })
    .click();
  await expect(page).toHaveURL(/\/progreso$/);
});

test("recuperar contraseña no revela si la cuenta existe", async ({ page }) => {
  await page.goto("/login");
  await page.getByTestId("forgot-password").click();
  await page.getByLabel("Correo").fill("nadie@razona.local");
  await page.getByRole("button", { name: "Enviar enlace" }).click();
  await expect(page.getByTestId("reset-form").getByRole("status")).toContainText(
    "Si nadie@razona.local tiene cuenta",
  );
  await page.getByRole("button", { name: "Volver a entrar" }).click();
  await expect(page.getByTestId("signin-form")).toBeVisible();
});

test("un ?next hacia otro sitio se ignora", async ({ page }) => {
  await page.goto("/login?next=//evil.com");
  await page.getByRole("button", { name: "Entrar como Ana (demo)" }).click();
  await expect(page).toHaveURL(/localhost:\d+\/inicio/);
});
