import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { once } from "node:events";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { createApp, readConfig, startServer } from "../server.js";

async function fixture(t, overrides = {}) {
  const config = { ...readConfig({}), ...overrides };
  const server = createApp(config).listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(() => { server.closeAllConnections(); return new Promise(resolve => server.close(resolve)); });
  return (path = "/", headers = {}, method = "GET") => new Promise((resolve, reject) => {
    const request = http.request({ host: "127.0.0.1", port: server.address().port, path, method, headers }, response => {
      let body = "";
      response.setEncoding("utf8");
      response.on("data", chunk => { body += chunk; });
      response.on("end", () => resolve({ status: response.statusCode, headers: response.headers, body }));
    });
    request.on("error", reject);
    request.end();
  });
}

test("serveur local : page, route de test et fichiers publics", async t => {
  const request = await fixture(t);
  for (const file of ["/", "/app.js", "/style.css", "/logo.png", "/favicon.png"]) {
    assert.equal((await request(file)).status, 200, file);
  }
  assert.equal((await request("/test")).body, "OK - serveur fonctionne");
  assert.equal((await request("/", {}, "HEAD")).body, "");
});

test("en-têtes : CSP, absence de scripts intégrés, protection des cadres et types", async t => {
  const request = await fixture(t);
  const response = await request();
  assert.match(response.headers["content-security-policy"], /script-src 'self'/);
  assert.match(response.headers["content-security-policy"], /script-src-attr 'none'/);
  assert.match(response.headers["content-security-policy"], /connect-src 'none'/);
  assert.match(response.headers["content-security-policy"], /frame-ancestors 'none'/);
  assert.equal(response.headers["x-frame-options"], "DENY");
  assert.equal(response.headers["x-content-type-options"], "nosniff");
  assert.equal(response.headers["referrer-policy"], "no-referrer");
  assert.equal(response.headers["x-powered-by"], undefined);
  assert.equal(response.headers["strict-transport-security"], undefined);
  assert.doesNotMatch(response.headers["content-security-policy"], /upgrade-insecure-requests/);
});

test("fichiers privés, chemins malformés et traversées non divulgués", async t => {
  const request = await fixture(t);
  for (const file of ["/.env", "/.git/config", "/package.json", "/server.js", "/RAPPORT_SECURITE.md",
    "/../package.json", "/%2e%2e/package.json", "/%E0%A4%A"]) {
    const response = await request(file);
    assert.ok([400, 403, 404].includes(response.status), `${file}: ${response.status}`);
    assert.doesNotMatch(response.body, /node_modules|Error:|Users[\\/]|dependencies|dm_local_v3/);
    assert.equal(response.headers["x-content-type-options"], "nosniff");
  }
});

test("limites : méthodes, hôte et longueur d'adresse", async t => {
  const request = await fixture(t);
  assert.equal((await request("/test", {}, "POST")).status, 405);
  assert.equal((await request("/test", { Host: "attaquant.example" })).status, 421);
  assert.equal((await request("/" + "a".repeat(2100))).status, 414);
});

test("limitation du débit indépendante des adresses IP transmises en local", async t => {
  const request = await fixture(t, { requestLimit: 2 });
  assert.equal((await request("/test")).status, 200);
  assert.equal((await request("/test")).status, 200);
  const response = await request("/test", { "X-Forwarded-For": "203.0.113.12" });
  assert.equal(response.status, 429);
  assert.ok(response.headers["retry-after"]);
  assert.ok(response.headers.ratelimit);
});

test("production : origine canonique, HTTPS et proxy explicitement limité", async t => {
  const config = readConfig({ NODE_ENV: "production", PUBLIC_ORIGIN: "https://dilemmes.example", TRUST_PROXY: "loopback" });
  const request = await fixture(t, config);
  const redirect = await request("/test?x=1", { Host: "dilemmes.example" });
  assert.equal(redirect.status, 308);
  assert.equal(redirect.headers.location, "https://dilemmes.example/test?x=1");
  const https = await request("/test", { Host: "dilemmes.example", "X-Forwarded-Proto": "https" });
  assert.equal(https.status, 200);
  assert.equal((await request("/test", { Host: "DILEMMES.EXAMPLE", "X-Forwarded-Proto": "https" })).status, 200);
  assert.match(https.headers["strict-transport-security"], /max-age=31536000/);
  assert.equal((await request("/test", { Host: "evil.example", "X-Forwarded-Proto": "https" })).status, 421);
  const unusual = await request("//evil.example/path", { Host: "dilemmes.example" });
  assert.ok(unusual.headers.location.startsWith("https://dilemmes.example/"));
});

test("limitation de débit : rotation d'adresses IPv6 du même sous-réseau", async t => {
  const config = readConfig({ NODE_ENV: "production", PUBLIC_ORIGIN: "https://dilemmes.example", TRUST_PROXY: "loopback" });
  const request = await fixture(t, { ...config, requestLimit: 2 });
  for (const [index, ip] of ["2001:db8:abcd:1200::1", "2001:db8:abcd:1201::2", "2001:db8:abcd:1202::3"].entries()) {
    const response = await request("/test", { Host: "dilemmes.example", "X-Forwarded-Proto": "https", "X-Forwarded-For": ip });
    assert.equal(response.status, index < 2 ? 200 : 429);
  }
});

test("configuration de production incomplète ou dangereuse refusée", () => {
  const base = { NODE_ENV: "production", PUBLIC_ORIGIN: "https://dilemmes.example", TRUST_PROXY: "loopback" };
  assert.throws(() => readConfig({ NODE_ENV: "production" }));
  for (const origin of ["http://dilemmes.example", "https://user:secret@dilemmes.example", "https://dilemmes.example/path"]) {
    assert.throws(() => readConfig({ ...base, PUBLIC_ORIGIN: origin }));
  }
  assert.throws(() => readConfig({ ...base, HOST: "0.0.0.0" }));
  assert.throws(() => readConfig({ ...base, TRUST_PROXY: "true" }));
  assert.throws(() => readConfig({ PORT: "NaN" }));
  assert.throws(() => readConfig({ RATE_LIMIT_MAX: "0" }));
  assert.equal(readConfig({}).host, "127.0.0.1");
});

test("délais et nombre de requêtes par connexion bornés", async t => {
  const server = startServer({ ...readConfig({}), port: 0 });
  await once(server, "listening");
  t.after(() => new Promise(resolve => server.close(resolve)));
  assert.equal(server.address().address, "127.0.0.1");
  assert.equal(server.requestTimeout, 15000);
  assert.equal(server.headersTimeout, 10000);
  assert.equal(server.keepAliveTimeout, 5000);
  assert.equal(server.maxRequestsPerSocket, 100);
});

test("bibliothèques locales : versions et empreintes réellement distribuées", async t => {
  const request = await fixture(t);
  const manifest = JSON.parse(await readFile(new URL("../public/vendor/manifest.json", import.meta.url), "utf8"));
  const html = (await request()).body;
  assert.doesNotMatch(html, /cdn\.jsdelivr\.net/);
  for (const asset of Object.values(manifest)) {
    const bytes = await readFile(new URL(`../public/vendor/${asset.file}`, import.meta.url));
    assert.equal(asset.integrity, `sha384-${createHash("sha384").update(bytes).digest("base64")}`);
    assert.ok(html.includes(`integrity="${asset.integrity}"`));
    assert.equal((await request(`/vendor/${asset.file}`)).status, 200);
  }
  assert.equal(manifest.jspdf.version, "4.2.1");
  assert.equal(manifest["chart.js"].version, "4.5.1");
});
