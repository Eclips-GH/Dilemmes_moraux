import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { readFile } from "node:fs/promises";

const source = await readFile(new URL("../public/app.js", import.meta.url), "utf8");

function storage(initial = {}, failure = false) {
  const data = new Map(Object.entries(initial));
  return {
    data,
    getItem(key) { if (failure) throw new Error("Accès refusé"); return data.get(key) ?? null; },
    setItem(key, value) { if (failure) throw new Error("Quota dépassé"); data.set(key, value); },
    removeItem(key) { if (failure) throw new Error("Accès refusé"); data.delete(key); },
  };
}

function browser(local = storage(), session = storage()) {
  const nodes = new Map();
  class Element {
    constructor() { this.children = []; this.style = {}; this.listeners = {}; this.value = ""; this.checked = true; }
    appendChild(child) { this.children.push(child); return child; }
    replaceChildren(...children) { this.children = children; }
    set textContent(text) { this.text = String(text); this.children = []; }
    get textContent() { return this.text || this.children.map(child => child.textContent).join(""); }
    set innerHTML(_text) { throw new Error("Rendu HTML interdit dans ce test"); }
    addEventListener(name, handler) { this.listeners[name] = handler; }
    getContext() { return {}; }
    remove() {}
    click() { this.listeners.click?.(); }
  }
  const document = {
    getElementById(id) { if (!nodes.has(id)) nodes.set(id, new Element()); return nodes.get(id); },
    createElement() { return new Element(); },
    createTextNode(text) { const element = new Element(); element.textContent = text; return element; },
    body: new Element(),
  };
  const window = { localStorage: local, sessionStorage: session, addEventListener() {} };
  const context = vm.createContext({ window, document, console, Date, Blob,
    URL: { createObjectURL() { return "blob:test"; }, revokeObjectURL() {} },
    requestAnimationFrame: callback => callback(), confirm: () => true,
  });
  vm.runInContext(source, context);
  return { local, session, nodes, run: code => vm.runInContext(code, context),
    state: () => JSON.parse(vm.runInContext("JSON.stringify(state)", context)) };
}

function legacy(finished = false, mode = "fast") {
  const page = browser();
  return JSON.parse(page.run(`JSON.stringify({ schemaVersion: 1, userName: 'Alice', mode: '${mode}',
    qIds: getQuestionSet('${mode}'), index: 0, finished: ${finished},
    answers: ${finished ? `Object.fromEntries(getQuestionSet('${mode}').map(id => [id, 'A']))` : "{ q1: 'A' }"},
    result: { date: '2026-01-16T12:00:00.000Z', scores: { norm: { U: '<img src=x onerror=alert(1)>' } },
      profile: { title: 'faux' }, answers: [{ title: '<script>malveillant</script>' }] }
  })`));
}

test("migration des anciennes sauvegardes sans faire confiance au HTML ou aux scores", async () => {
  const value = legacy(true);
  const page = browser(storage({ dm_local_v3: JSON.stringify(value) }));
  await page.run("init()");
  const result = page.state().result;
  assert.equal(result.answers.length, 12);
  assert.equal(result.date, value.result.date);
  assert.notEqual(result.profile.title, "faux");
  assert.equal(typeof result.scores.norm.U, "number");
  assert.ok(result.answers.every(answer => !answer.title.includes("script")));
  const saved = JSON.parse(page.local.data.get("dm_local_v3"));
  assert.equal(saved.schemaVersion, 2);
  assert.equal(saved.result, undefined);
  assert.equal(saved.answers.q1, "A");
});

test("les deux questionnaires conservent les scores, résultats et reprise", async () => {
  // Valeurs de référence calculées depuis la version initiale de main, avant correction.
  const expectedScores = {
    full: { raw: { U: 15, E: 7, R: 7, A: 14, H: 20, L: 5, J: 17, F: -5, P: 7, S: 22 },
      norm: { U: 58, E: 54, R: 54, A: 58, H: 61, L: 53, J: 59, F: 47, P: 54, S: 62 } },
    fast: { raw: { U: 10, E: 2, R: 3, A: 7, H: 8, L: 1, J: 6, F: -7, P: 4, S: 6 },
      norm: { U: 64, E: 53, R: 54, A: 60, H: 61, L: 51, J: 58, F: 40, P: 56, S: 58 } },
  };
  for (const mode of ["full", "fast"]) {
    const page = browser();
    await page.run("init()");
    page.run(`$('mode').value = '${mode}'; $('userName').value = '<img src=x onerror=alert(1)>'; startNew();`);
    page.run("state.qIds.forEach((id, i) => { state.index = i; state.answers[id] = 'A'; renderQuestion(); }); finish();");
    const expected = page.state().result;
    assert.deepEqual(expected.scores, expectedScores[mode]);
    assert.equal(expected.questionsCount, mode === "full" ? 30 : 12);
    assert.equal(expected.completed, true);
    assert.ok(Object.values(expected.scores.norm).every(n => Number.isFinite(n) && n >= 0 && n <= 100));
    const reopened = browser(page.local);
    await reopened.run("init()");
    assert.deepEqual(reopened.state().result, expected);
    assert.ok(reopened.nodes.get("resetBtn").listeners.click);
  }
});

test("sauvegardes incohérentes, volumineuses, avec clés inattendues ou expirées rejetées", async () => {
  const corrupt = ["{", "x".repeat(65537), JSON.stringify({ ...legacy(), index: -1 }),
    JSON.stringify({ ...legacy(), answers: { q1: "Z" } }),
    JSON.stringify({ ...legacy(), qIds: ["q_inconnue"] }),
    JSON.stringify({ ...legacy(), answers: { constructor: "A" } }),
    JSON.stringify({ ...legacy(), schemaVersion: 2, savedAt: 0, expiresAt: 1 })];
  for (const value of corrupt) {
    const page = browser(storage({ dm_local_v3: value }));
    await page.run("init()");
    assert.equal(page.state().qIds.length, 0);
    assert.ok(page.nodes.get("resetBtn").listeners.click);
    assert.equal(page.local.data.has("dm_local_v3"), false);
  }
});

test("stockage refusé : questionnaire et réinitialisation restent disponibles", async () => {
  const page = browser(storage({}, true), storage({}, true));
  await page.run("init()");
  page.run("$('mode').value = 'fast'; startNew(); state.answers.q1 = 'A'; saveState();");
  assert.equal(page.state().qIds.length, 12);
  assert.match(page.nodes.get("storageNotice").textContent, /indisponible/);
  page.nodes.get("resetBtn").listeners.click();
  assert.equal(page.state().qIds.length, 0);
});

test("choix temporaire : transfert sans perte, reprise d'onglet et effacement limité au projet", async () => {
  const page = browser(storage({ autre_application: "à conserver" }));
  await page.run("init()");
  page.run("$('mode').value = 'fast'; startNew(); state.answers.q1 = 'B'; saveState();");
  page.nodes.get("persistProgress").checked = false;
  page.nodes.get("persistProgress").listeners.change();
  assert.equal(page.local.data.has("dm_local_v3"), false);
  assert.ok(page.session.data.has("dm_local_v3"));
  const reopened = browser(page.local, page.session);
  await reopened.run("init()");
  assert.equal(reopened.state().answers.q1, "B");
  reopened.nodes.get("persistProgress").listeners.change();
  assert.ok(page.session.data.has("dm_local_v3"), "Une notification sans changement ne doit pas effacer la sauvegarde");
  reopened.run("resetState()");
  assert.equal(page.local.data.get("autre_application"), "à conserver");
  assert.equal(page.session.data.has("dm_local_v3"), false);
});

test("transfert vers un stockage indisponible : ancienne progression préservée", async () => {
  const page = browser(storage(), storage({}, true));
  await page.run("init()");
  page.run("$('mode').value = 'fast'; startNew();");
  page.nodes.get("persistProgress").checked = false;
  page.nodes.get("persistProgress").listeners.change();
  assert.ok(page.local.data.has("dm_local_v3"));
  assert.equal(page.nodes.get("persistProgress").checked, true);
});
