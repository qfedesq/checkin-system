process.env.AUTH_SECRET ||= "test-secret";

import test from "node:test";
import assert from "node:assert/strict";
import { signFileToken, verifyFileToken } from "../src/lib/file-token";

test("verifyFileToken: token válido resuelve la url original", () => {
  const token = signFileToken("https://blob.example.com/some-file.pdf");
  const url = verifyFileToken(token);
  assert.equal(url, "https://blob.example.com/some-file.pdf");
});

test("verifyFileToken: token alterado (firma o payload) devuelve null", () => {
  const token = signFileToken("https://blob.example.com/some-file.pdf");
  const [payload, sig] = token.split(".");

  // payload alterado, firma intacta
  const tamperedPayload = `${payload}x.${sig}`;
  assert.equal(verifyFileToken(tamperedPayload), null);

  // firma alterada, payload intacto
  const tamperedSig = `${payload}.${sig.slice(0, -1)}${sig.at(-1) === "a" ? "b" : "a"}`;
  assert.equal(verifyFileToken(tamperedSig), null);
});

test("verifyFileToken: token expirado devuelve null", () => {
  const token = signFileToken("https://blob.example.com/some-file.pdf", -1000);
  assert.equal(verifyFileToken(token), null);
});

test("verifyFileToken: formato inválido devuelve null", () => {
  assert.equal(verifyFileToken(""), null);
  assert.equal(verifyFileToken("sin-separador"), null);
  assert.equal(verifyFileToken("payload-sin-firma."), null);
  assert.equal(verifyFileToken(".firma-sin-payload"), null);
  assert.equal(verifyFileToken("no-es-base64!!.tampoco-firma-valida"), null);
});
