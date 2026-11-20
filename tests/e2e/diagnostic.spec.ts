import { expect, test } from "@playwright/test";

const AGENT_URL = process.env.AGENT_API_URL ?? "http://127.0.0.1:8080";

/** Diagnóstico con el agente de Python (requiere `uv run python -m razona_agent.server`). */
test("diagnóstico con el agente desde la app web", async ({ page, request }) => {
  const health = await request.get(`${AGENT_URL}/salud`).catch(() => null);
  test.skip(!health?.ok(), "El servidor del agente no está corriendo");

  await page.goto("/login");
  await page.getByRole("button", { name: "Entrar como Ana (demo)" }).click();
  await expect(page).toHaveURL(/\/inicio/);

  await page.getByRole("link", { name: "Examen", exact: true }).click();
  await page.getByTestId("open-diagnostic").click();
  await expect(page).toHaveURL(/\/diagnostico$/);
  await page.getByTestId("start-diagnostic").click();

  const progress = page.getByTestId("diagnostic-progress");
  await expect(progress).toHaveText(/^0\/\d+ respondidos$/);
  const total = Number((await progress.textContent())?.match(/\/(\d+)/)?.[1]);
  expect(total).toBeGreaterThan(0);

  for (let i = 1; i <= total; i++) {
    await expect(page.getByTestId("diagnostic-item")).toContainText(`Reactivo ${i} de ${total}`);
    await page.getByTestId("diagnostic-option-a").click();
    await expect(progress).toHaveText(`${i}/${total} respondidos`);
  }
  await expect(page.getByTestId("diagnostic-item")).toHaveCount(0);

  await page.getByTestId("grade-diagnostic").click();
  const result = page.getByTestId("diagnostic-result");
  await expect(result).toContainText(`/${total} aciertos`);
  await expect(result.getByTestId("practice-weak-topic")).toBeVisible();
  await result.locator("details").first().locator("summary").click();
  await expect(result.getByTestId("citation").first()).toBeVisible();
});

test("la API de diagnóstico exige sesión", async ({ request }) => {
  const res = await request.post("/api/diagnostico/start", { data: {} });
  expect(res.status()).toBe(401);
});
