/* =========================
   Dilemmes Moraux — App JS
   (Local-only, sans partage/commentaires)
   ========================= */

const STORAGE_KEY = "dm_local_v3";
// Bump this number if you change the shape of the saved state.
const STATE_SCHEMA_VERSION = 1;

/* =========================
   Utils
   ========================= */
const $ = (id) => document.getElementById(id);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

/* =========================
   Axes
   ========================= */
const AXES = [
  { key: "U", label: "Utilitarisme" },
  { key: "E", label: "Empathie" },
  { key: "R", label: "Risque" },
  { key: "A", label: "Autorité / ordre" },
  { key: "H", label: "Honnêteté" },
  { key: "L", label: "Loyauté" },
  { key: "J", label: "Justice punitive" },
  { key: "F", label: "Liberté" },
  { key: "P", label: "Pragmatisme" },
  { key: "S", label: "Solidarité" },
];

const w = (obj) => obj;

/* =========================
   Questions
   ========================= */
const QUESTIONS = [
  {
    id: "q1", title: "Le portefeuille", text: "Tu trouves un portefeuille avec beaucoup d’argent et une pièce d’identité.",
    options: [
      { key: "A", title: "Je le rends", desc: "Tu contactes le propriétaire et rends tout.", w: w({ H: +3, S: +2, E: +2, L: +1, J: +1 }) },
      { key: "B", title: "Je garde l’argent", desc: "Tu gardes l’argent sans rien dire.", w: w({ H: -3, S: -2, E: -2, P: +1, R: +1 }) },
      { key: "C", title: "Je prends une partie", desc: "Tu gardes une partie, rends le reste.", w: w({ H: -1, P: +2 }) },
    ]
  },
  {
    id: "q2", title: "Mensonge protecteur", text: "Un ami te demande un avis sur un projet nul. Dire la vérité le blesse.",
    options: [
      { key: "A", title: "Vérité brutale", desc: "Tu dis clairement que c’est mauvais.", w: w({ H: +3, E: -1 }) },
      { key: "B", title: "Mensonge gentil", desc: "Tu complimentes pour le protéger.", w: w({ H: -2, E: +2, S: +1 }) },
      { key: "C", title: "Vérité douce", desc: "Tu critiques avec tact et pistes.", w: w({ H: +2, E: +2, S: +1, P: +1 }) },
    ]
  },
  {
    id: "q3", title: "Vol par nécessité", text: "Tu vois quelqu’un voler de la nourriture pour nourrir ses enfants.",
    options: [
      { key: "A", title: "Je le dénonce", desc: "Règles avant tout.", w: w({ A: +2, J: +3, F: -1 }) },
      { key: "B", title: "Je l’aide", desc: "Tu paies/tu l’aides à trouver une solution.", w: w({ E: +3, S: +3, U: +1 }) },
      { key: "C", title: "Je fais semblant de rien", desc: "Tu ignores la scène.", w: w({ E: +1, S: +1, H: -1 }) },
    ]
  },
  {
    id: "q4", title: "Secret professionnel", text: "Tu sais une info grave sur un collègue. La révéler peut le ruiner, la cacher peut nuire.",
    options: [
      { key: "A", title: "Je révèle", desc: "Transparence / sécurité.", w: w({ H: +3, A: +1, J: +2, S: +1 }) },
      { key: "B", title: "Je cache", desc: "Loyauté, éviter le scandale.", w: w({ L: +3, H: -2, F: +1 }) },
      { key: "C", title: "Je cherche une voie intermédiaire", desc: "Alerte interne / solution.", w: w({ P: +3, H: +2, E: +1 }) },
    ]
  },
  {
    id: "q5", title: "Sacrifier un pour sauver cinq", text: "Dilemme classique : pousser une personne pour en sauver cinq.",
    options: [
      { key: "A", title: "Je sacrifie", desc: "Maximiser les vies.", w: w({ U: +3, R: +1, J: -1, E: -1 }) },
      { key: "B", title: "Je ne sacrifie pas", desc: "Principe : ne pas tuer.", w: w({ H: +1, J: +2, E: +1, U: -2 }) },
      { key: "C", title: "Je cherche une autre option", desc: "Tenter autre chose, même risqué.", w: w({ P: +3, R: +2 }) },
    ]
  },
  {
    id: "q6", title: "Loi injuste", text: "Une loi te semble injuste, mais la respecter évite le chaos.",
    options: [
      { key: "A", title: "Je respecte", desc: "Stabilité/ordre.", w: w({ A: +3, J: +1, F: -1 }) },
      { key: "B", title: "Je désobéis", desc: "Résistance morale.", w: w({ F: +3, A: -2, H: +1 }) },
      { key: "C", title: "Je contourne légalement", desc: "Trouver une faille/recours.", w: w({ P: +3, H: +1 }) },
    ]
  },
  {
    id: "q7", title: "Dénoncer un ami", text: "Ton ami triche à un examen. Si tu le dénonces, il échoue; si tu te tais, injustice.",
    options: [
      { key: "A", title: "Je dénonce", desc: "Justice/équité.", w: w({ J: +3, H: +2, L: -2 }) },
      { key: "B", title: "Je me tais", desc: "Loyauté.", w: w({ L: +3, H: -2, J: -1 }) },
      { key: "C", title: "Je lui parle d’abord", desc: "Solution humaine.", w: w({ E: +2, P: +2, H: +1 }) },
    ]
  },
  {
    id: "q8", title: "Surveillance", text: "Plus de caméras réduit le crime mais réduit la vie privée.",
    options: [
      { key: "A", title: "Pour", desc: "Sécurité avant tout.", w: w({ A: +2, F: -3, U: +1 }) },
      { key: "B", title: "Contre", desc: "Liberté / vie privée.", w: w({ F: +3, A: -1 }) },
      { key: "C", title: "Pour mais encadré", desc: "Limites et contrôle.", w: w({ P: +3, A: +1, F: -1 }) },
    ]
  },
  {
    id: "q9", title: "Punition vs réparation", text: "Quelqu’un commet un délit mineur. Punir ou réparer ?",
    options: [
      { key: "A", title: "Punir", desc: "Dissuasion.", w: w({ J: +3, A: +1 }) },
      { key: "B", title: "Réparer", desc: "Réinsertion.", w: w({ E: +2, S: +2, J: -2 }) },
      { key: "C", title: "Mixte", desc: "Sanction + réparation.", w: w({ P: +3, J: +1 }) },
    ]
  },
  {
    id: "q10", title: "Aider un inconnu", text: "Tu es pressé, un inconnu a besoin d’aide immédiate.",
    options: [
      { key: "A", title: "Je m’arrête", desc: "Solidarité.", w: w({ S: +3, E: +2 }) },
      { key: "B", title: "Je continue", desc: "Priorités perso.", w: w({ S: -2, P: +2 }) },
      { key: "C", title: "J’appelle quelqu’un", desc: "Aide indirecte.", w: w({ P: +2, S: +2 }) },
    ]
  },
  {
    id: "q11", title: "Dossier médical", text: "On te demande de partager une info médicale d’un proche pour ‘son bien’.",
    options: [
      { key: "A", title: "Je partage", desc: "Prévention/soin.", w: w({ U: +2, S: +2, H: +1 }) },
      { key: "B", title: "Je refuse", desc: "Confidentialité.", w: w({ F: +2, H: +2, L: +1 }) },
      { key: "C", title: "Je demande son accord", desc: "Respect + pragmatisme.", w: w({ P: +3, H: +1 }) },
    ]
  },
  {
    id: "q12", title: "Témoin d’une bagarre", text: "Intervenir peut aider mais te met en danger.",
    options: [
      { key: "A", title: "J’interviens", desc: "Courage/solidarité.", w: w({ S: +3, R: +2, E: +1 }) },
      { key: "B", title: "Je reste à distance", desc: "Prudence.", w: w({ R: -2, P: +2 }) },
      { key: "C", title: "J’appelle la police", desc: "Sécurité + action.", w: w({ A: +2, P: +2 }) },
    ]
  },
  {
    id: "q13", title: "Choix professionnel", text: "Tu peux choisir un job mieux payé mais peu éthique ou un job moins payé mais utile.",
    options: [
      { key: "A", title: "Mieux payé", desc: "Sécurité financière.", w: w({ P: +3, S: -1 }) },
      { key: "B", title: "Plus éthique", desc: "Valeurs.", w: w({ S: +2, H: +2 }) },
      { key: "C", title: "Compromis", desc: "Trouver un rôle acceptable.", w: w({ P: +2, H: +1 }) },
    ]
  },
  {
    id: "q14", title: "Données personnelles", text: "Une app gratuite te demande beaucoup de données pour fonctionner.",
    options: [
      { key: "A", title: "J’accepte", desc: "Confort.", w: w({ P: +2, F: -2 }) },
      { key: "B", title: "Je refuse", desc: "Vie privée.", w: w({ F: +3, A: -1 }) },
      { key: "C", title: "Je limite", desc: "Réglages/permissions.", w: w({ P: +3, F: +1 }) },
    ]
  },
  {
    id: "q15", title: "Dilemme familial", text: "Ta famille te demande un service qui te met mal à l’aise.",
    options: [
      { key: "A", title: "J’accepte", desc: "Loyauté.", w: w({ L: +3, S: +1 }) },
      { key: "B", title: "Je refuse", desc: "Limites.", w: w({ F: +2, H: +1 }) },
      { key: "C", title: "Je négocie", desc: "Compromis.", w: w({ P: +3, E: +1 }) },
    ]
  },
  {
    id: "q16", title: "Vengeance", text: "On t’a fait du mal et tu peux te venger sans conséquence.",
    options: [
      { key: "A", title: "Je me venge", desc: "Justice personnelle.", w: w({ J: +2, R: +1, E: -1 }) },
      { key: "B", title: "Je pardonne", desc: "Empathie.", w: w({ E: +3, S: +2, J: -2 }) },
      { key: "C", title: "Je passe à autre chose", desc: "Pragmatisme.", w: w({ P: +3 }) },
    ]
  },
  {
    id: "q17", title: "Éthique au travail", text: "Ton boss te demande de ‘gonfler’ un chiffre. Refuser te pénalise.",
    options: [
      { key: "A", title: "Je refuse", desc: "Intégrité.", w: w({ H: +3, A: -1 }) },
      { key: "B", title: "J’accepte", desc: "Carrière.", w: w({ P: +2, H: -3 }) },
      { key: "C", title: "Je propose une alternative", desc: "Sortie honorable.", w: w({ P: +3, H: +1 }) },
    ]
  },
  {
    id: "q18", title: "Alerte publique", text: "Tu peux avertir le public d’un risque, mais ça crée une panique.",
    options: [
      { key: "A", title: "J’avertis", desc: "Transparence.", w: w({ H: +3, U: +2 }) },
      { key: "B", title: "Je tais", desc: "Éviter panique.", w: w({ A: +1, P: +2, H: -2 }) },
      { key: "C", title: "J’avertis avec prudence", desc: "Mesuré.", w: w({ P: +3, H: +1 }) },
    ]
  },
  {
    id: "q19", title: "Don d’argent", text: "Tu as un surplus d’argent. Donner à une cause ou garder ?",
    options: [
      { key: "A", title: "Je donne", desc: "Solidarité.", w: w({ S: +3, E: +1 }) },
      { key: "B", title: "Je garde", desc: "Sécurité.", w: w({ P: +2, S: -2 }) },
      { key: "C", title: "Je donne un peu", desc: "Équilibre.", w: w({ P: +1, S: +2 }) },
    ]
  },
  {
    id: "q20", title: "Animal vs humain", text: "Tu peux sauver un animal ou un humain, pas les deux.",
    options: [
      { key: "A", title: "Humain", desc: "Priorité humaine.", w: w({ U: +2, E: +1 }) },
      { key: "B", title: "Animal", desc: "Empathie universelle.", w: w({ E: +2, S: +2, U: -1 }) },
      { key: "C", title: "Je cherche autre option", desc: "Risque/solution.", w: w({ P: +3, R: +1 }) },
    ]
  },
  {
    id: "q21", title: "Mentir à la police", text: "Mentir pour protéger quelqu’un qui a fait une bêtise mineure.",
    options: [
      { key: "A", title: "Je mens", desc: "Loyauté.", w: w({ L: +3, H: -3 }) },
      { key: "B", title: "Je dis la vérité", desc: "Intégrité.", w: w({ H: +3, J: +1 }) },
      { key: "C", title: "Je reste vague", desc: "Éviter conflit.", w: w({ P: +2, H: -1 }) },
    ]
  },
  {
    id: "q22", title: "Écologie", text: "Une action écolo te coûte cher mais réduit ton impact.",
    options: [
      { key: "A", title: "Je le fais", desc: "Impact global.", w: w({ U: +3, S: +1 }) },
      { key: "B", title: "Je ne le fais pas", desc: "Coût/contraintes.", w: w({ P: +2, U: -2 }) },
      { key: "C", title: "Partiellement", desc: "Compromis.", w: w({ P: +2, U: +1 }) },
    ]
  },
  {
    id: "q23", title: "Sanction d’un enfant", text: "Un enfant a fait une grosse bêtise. Punition ou pédagogie ?",
    options: [
      { key: "A", title: "Punition", desc: "Cadre strict.", w: w({ A: +2, J: +2 }) },
      { key: "B", title: "Pédagogie", desc: "Comprendre/éduquer.", w: w({ E: +3, S: +2, J: -2 }) },
      { key: "C", title: "Les deux", desc: "Cadre + dialogue.", w: w({ P: +3, A: +1 }) },
    ]
  },
  {
    id: "q24", title: "Tricherie mineure", text: "Tricher un peu te donne un avantage sans ‘victime’ directe.",
    options: [
      { key: "A", title: "Je triche", desc: "Bénéfice perso.", w: w({ H: -2, P: +2 }) },
      { key: "B", title: "Je ne triche pas", desc: "Valeurs.", w: w({ H: +3, J: +1 }) },
      { key: "C", title: "Je triche si nécessaire", desc: "Pragmatisme.", w: w({ P: +3, H: -1 }) },
    ]
  },
  {
    id: "q25", title: "Amitié toxique", text: "Un ami te tire vers le bas, mais il a besoin de toi.",
    options: [
      { key: "A", title: "Je coupe", desc: "Se protéger.", w: w({ F: +2, S: -1 }) },
      { key: "B", title: "Je reste", desc: "Loyauté/solidarité.", w: w({ L: +2, S: +2, E: +1 }) },
      { key: "C", title: "Je mets des limites", desc: "Compromis.", w: w({ P: +3, F: +1 }) },
    ]
  },
  {
    id: "q26", title: "Confession", text: "Tu peux avouer une faute ancienne, mais ça fait souffrir.",
    options: [
      { key: "A", title: "J’avoue", desc: "Honnêteté.", w: w({ H: +3 }) },
      { key: "B", title: "Je garde", desc: "Éviter souffrance.", w: w({ E: +1, H: -2 }) },
      { key: "C", title: "Je prépare puis j’avoue", desc: "Pragmatisme.", w: w({ P: +3, H: +1 }) },
    ]
  },
  {
    id: "q27", title: "Don d’organe", text: "Tu peux donner un organe et sauver une vie, mais tu prends un risque.",
    options: [
      { key: "A", title: "Je donne", desc: "Altruisme.", w: w({ S: +3, E: +2, R: +1 }) },
      { key: "B", title: "Je refuse", desc: "Prudence.", w: w({ R: -2, P: +2 }) },
      { key: "C", title: "Je réfléchis/conditions", desc: "Équilibre.", w: w({ P: +3, S: +1 }) },
    ]
  },
  {
    id: "q28", title: "Règles vs compassion", text: "Appliquer une règle strictement va faire du mal à quelqu’un.",
    options: [
      { key: "A", title: "J’applique", desc: "Ordre.", w: w({ A: +3, J: +1 }) },
      { key: "B", title: "J’assouplis", desc: "Compassion.", w: w({ E: +3, S: +2, A: -1 }) },
      { key: "C", title: "Je cherche exception", desc: "Pragmatisme.", w: w({ P: +3 }) },
    ]
  },
  {
    id: "q29", title: "Harcèlement", text: "Tu vois du harcèlement. Intervenir t’expose socialement.",
    options: [
      { key: "A", title: "J’interviens", desc: "Courage.", w: w({ S: +3, H: +1, R: +1 }) },
      { key: "B", title: "Je me tais", desc: "Éviter ennuis.", w: w({ S: -2, P: +1 }) },
      { key: "C", title: "Je soutiens la victime ensuite", desc: "Aide indirecte.", w: w({ E: +2, S: +2, P: +1 }) },
    ]
  },
  {
    id: "q30", title: "Assumer l’erreur", text: "Erreur de ta faute : avouer te fait perdre en réputation, te taire risque d’accuser quelqu’un d’autre.",
    options: [
      { key: "A", title: "J’avoue", desc: "Responsabilité.", w: w({ U: +2, E: +1, R: +1, A: +1, H: +3, S: +2 }) },
      { key: "B", title: "Je me tais", desc: "Auto-protection.", w: w({ U: -2, E: -1, H: -3, F: +1, S: -2 }) },
      { key: "C", title: "Partiellement", desc: "Limiter dégâts.", w: w({ U: +2, H: +1, P: +3, S: +1 }) },
    ]
  },
];

const FAST_IDS = new Set(["q1", "q3", "q5", "q6", "q8", "q11", "q14", "q16", "q17", "q20", "q24", "q30"]);

const state = {
  userName: "",
  mode: "full",
  qIds: [],
  index: 0,
  answers: {},
  finished: false,
  result: null
};

let radarChart = null;

function getQuestionSet(mode) {
  const base = QUESTIONS.map(q => q.id);
  return mode === "fast" ? base.filter(id => FAST_IDS.has(id)) : base;
}

function saveState() {
  const payload = { schemaVersion: STATE_SCHEMA_VERSION, ...state };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
}
function loadState() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return false;
  try {
    const parsed = JSON.parse(raw);
    if (parsed?.schemaVersion !== STATE_SCHEMA_VERSION) {
      // Incompatible saved data => reset.
      localStorage.removeItem(STORAGE_KEY);
      return false;
    }
    // Remove schemaVersion from assignment.
    const { schemaVersion, ...rest } = parsed;
    Object.assign(state, rest);
    return true;
  } catch {
    return false;
  }
}
function resetState() {
  localStorage.removeItem(STORAGE_KEY);
  state.userName = ""; state.mode = "full"; state.qIds = []; state.index = 0;
  state.answers = {}; state.finished = false; state.result = null;
}

function resetAndGoToConfig() {
  resetState();

  // Nettoyage UI
  $("userName").value = "";
  $("mode").value = "full";

  // Détruire le radar s’il existe
  if (radarChart) {
    radarChart.destroy();
    radarChart = null;
  }

  showConfig();
}


function computeScores() {
  const raw = {}; AXES.forEach(a => raw[a.key] = 0);

  for (const qid of state.qIds) {
    const chosenKey = state.answers[qid];
    if (!chosenKey) continue;
    const q = QUESTIONS.find(x => x.id === qid);
    const opt = q.options.find(o => o.key === chosenKey);
    const weights = opt.w || {};
    for (const a of AXES) raw[a.key] += (weights[a.key] ?? 0);
  }

  const n = state.qIds.length || 1;
  const maxAbs = 3 * n;
  const norm = {};
  for (const a of AXES) {
    const v = raw[a.key];
    norm[a.key] = Math.round(clamp(((v + maxAbs) / (2 * maxAbs)) * 100, 0, 100));
  }
  return { raw, norm };
}

function describeAxis(key, val) {
  const high = val >= 62, low = val <= 38;
  const map = {
    U: { high: "Orienté impact global", low: "Orienté principes/limites", mid: "Équilibré conséquences/principes" },
    E: { high: "Très empathique", low: "Plus détaché", mid: "Empathie modérée" },
    R: { high: "Prend des risques", low: "Prudent", mid: "Risque maîtrisé" },
    A: { high: "Recherche d’ordre", low: "Anti-contrainte", mid: "Pragmatique sur l’ordre" },
    H: { high: "Très honnête", low: "Protecteur (vérité filtrée)", mid: "Honnêteté nuancée" },
    L: { high: "Très loyal", low: "Impartial/indépendant", mid: "Loyauté contextuelle" },
    J: { high: "Sanctions fortes", low: "Réparateur/réinsertion", mid: "Justice équilibrée" },
    F: { high: "Liberté prioritaire", low: "Sécurité/contrôle prioritaire", mid: "Libertés encadrées" },
    P: { high: "Très pragmatique", low: "Plus idéaliste", mid: "Pragmatisme modéré" },
    S: { high: "Altruiste", low: "Auto-protection", mid: "Aide mesurée" },
  };
  const e = map[key]; if (!e) return null;
  return high ? e.high : (low ? e.low : e.mid);
}

function profileFromScores(norm) {
  const tags = AXES.map(a => describeAxis(a.key, norm[a.key])).filter(Boolean);

  const sorted = [...AXES].map(a => ({ key: a.key, label: a.label, val: norm[a.key] }))
    .sort((x, y) => y.val - x.val);
  const top1 = sorted[0], top2 = sorted[1], top3 = sorted[2];

  let title = "Profil équilibré";
  let desc = "Tes réponses montrent un équilibre global entre valeurs, conséquences et contexte.";

  if (top1.key === "U" && norm.E >= 55) { title = "Le Stratège empathique"; desc = "Impact global, avec attention marquée aux personnes."; }
  else if (top1.key === "A" && norm.J >= 60) { title = "Le Gardien de l’ordre"; desc = "Règles, stabilité, justice dissuasive."; }
  else if (top1.key === "F" && norm.A <= 45) { title = "L’Autonome"; desc = "Liberté individuelle prioritaire, peu de contraintes."; }
  else if (top1.key === "E" && norm.S >= 60) { title = "L’Humaniste"; desc = "Compassion et solidarité fortes."; }
  else if (top1.key === "H" && norm.P >= 55) { title = "Le Franc pragmatique"; desc = "Transparence + solutions concrètes."; }
  else { title = `Dominantes : ${top1.label} / ${top2.label} / ${top3.label}`; desc = "Ton profil est principalement structuré par ces axes."; }

  return { title, desc, tags };
}

function buildAnswersDetailed() {
  const out = [];
  for (const qid of state.qIds) {
    const q = QUESTIONS.find(x => x.id === qid);
    const chosenKey = state.answers[qid] || null;
    const opt = chosenKey ? q.options.find(o => o.key === chosenKey) : null;
    out.push({
      qid,
      title: q.title,
      text: q.text,
      chosenKey,
      chosenTitle: opt ? opt.title : "",
      chosenDesc: opt ? opt.desc : ""
    });
  }
  return out;
}

function computeResult() {
  const done = Object.keys(state.answers).length === state.qIds.length && state.qIds.length > 0;
  const { raw, norm } = computeScores();
  const profile = profileFromScores(norm);
  return {
    version: 3,
    date: new Date().toISOString(),
    userName: state.userName || "",
    mode: state.mode,
    questionsCount: state.qIds.length,
    completed: done,
    scores: { raw, norm },
    profile,
    answers: buildAnswersDetailed(),
  };
}

/* =========================
   Radar (site: blanc sans ticks)
   ========================= */
function renderRadar(normScores) {
  const canvas = $("radarChart");
  if (!canvas) return;

  const labels = AXES.map(a => a.label);
  const data = AXES.map(a => normScores[a.key] ?? 0);

  // Couleurs alignées avec le thème du site
  const RADAR_MAIN = "rgba(31, 95, 160, 1)";      // --accent
  const RADAR_FILL = "rgba(31, 95, 160, 0.20)";
  const RADAR_GRID = "rgba(22, 38, 46, 0.20)";   // --line
  const RADAR_LABELS = "rgba(22, 38, 46, 0.85)"; // --text


  if (radarChart) {
    radarChart.data.labels = labels;
    radarChart.data.datasets[0].data = data;
    radarChart.update();
    return;
  }

  const ctx = canvas.getContext("2d");
  radarChart = new Chart(ctx, {
    type: "radar",
    data: {
      labels,
      datasets: [{
        data,
        fill: true,
        borderWidth: 2,
        borderColor: RADAR_MAIN,
        backgroundColor: RADAR_FILL,
        pointRadius: 3,
        pointHoverRadius: 5,
        pointBackgroundColor: RADAR_MAIN,
        pointBorderColor: "#ffffff"
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 1500 },
      scales: {
        r: {
          min: 0,
          max: 100,
          ticks: { display: false },
          pointLabels: { color: RADAR_LABELS, font: { size: 12 } },
          grid: { circular: true, color: RADAR_GRID },
          angleLines: { color: RADAR_GRID }
        }
      },
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: (ctx) => `${ctx.raw}%` } }
      }
    }
  });

}

/* =========================
   UI: quiz rendering
   ========================= */
function showQuiz() {
  const config = $("configSection");
  if (config) config.style.display = "none";
  $("resultSection").style.display = "none";
  $("quizSection").style.display = "block";
}


function showConfig() {
  const config = $("configSection");
  if (config) config.style.display = "block";
  $("quizSection").style.display = "none";
  $("resultSection").style.display = "none";
}


function renderQuestion() {
  const qid = state.qIds[state.index];
  const q = QUESTIONS.find(x => x.id === qid);
  if (!q) return;

  $("quizTitle").textContent = q.title;
  $("progressText").textContent = `${state.index + 1} / ${state.qIds.length}`;

  const box = $("questionBox");
  box.innerHTML = "";

  const p = document.createElement("div");
  p.className = "muted text-strong"; // <- GRAS ICI
  p.style.textAlign = "left";
  p.style.marginBottom = "10px";
  p.textContent = q.text;
  box.appendChild(p);

  const optionsWrap = document.createElement("div");
  optionsWrap.className = "options";

  const chosenKey = state.answers[qid] || null;

  for (const opt of q.options) {
    const card = document.createElement("div");
    card.className = "option" + (chosenKey === opt.key ? " selected" : "");
    card.tabIndex = 0;

    card.innerHTML = `
      <div class="optionTitle text-strong">${opt.key} — ${opt.title}</div>
      <div class="optionDesc text-strong">${opt.desc}</div>
    `;

    const choose = () => {
      state.answers[qid] = opt.key;
      saveState();
      renderQuestion();
    };

    card.addEventListener("click", choose);
    card.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        choose();
      }
    });

    optionsWrap.appendChild(card);
  }

  box.appendChild(optionsWrap);

  $("prevBtn").disabled = state.index <= 0;
  const isLast = state.index === state.qIds.length - 1;
  const hasAnswer = !!chosenKey;

  $("nextBtn").style.display = !isLast ? "inline-block" : "none";
  $("finishBtn").style.display = isLast ? "inline-block" : "none";

  // UX : on empêche d'avancer tant que la question n'est pas répondue.
  $("nextBtn").disabled = !isLast && !hasAnswer;
  $("finishBtn").disabled = isLast && !hasAnswer;
}


function startNew() {
  state.userName = $("userName").value.trim();
  state.mode = $("mode").value || "full";
  state.qIds = getQuestionSet(state.mode);
  state.index = 0;
  state.answers = {};
  state.finished = false;
  state.result = null;
  saveState();

  $("resumeBtn").style.display = "inline-block";
  showQuiz();
  renderQuestion();
}

function resume() {
  if (!state.qIds || !state.qIds.length) {
    startNew();
    return;
  }
  $("userName").value = state.userName || "";
  $("mode").value = state.mode || "full";

  if (state.finished && state.result) {
    const config = $("configSection");
    if (config) config.style.display = "none";
    renderResult();
    return;
  }

  showQuiz();
  renderQuestion();
}

function goNext() {
  if (state.index < state.qIds.length - 1) {
    state.index++; saveState(); renderQuestion();
  }
}
function goPrev() {
  if (state.index > 0) {
    state.index--; saveState(); renderQuestion();
  }
}

function finish() {
  state.result = computeResult();
  state.finished = true;
  saveState();
  renderResult();
}

/* =========================
   RESULT (nouvel ordre demandé)
   ========================= */
function renderResult() {
  const config = $("configSection");
  if (config) config.style.display = "none";
  $("quizSection").style.display = "none";
  $("resultSection").style.display = "block";

  const res = state.result || computeResult();

  const name = res.userName ? ` — ${res.userName}` : "";
  $("resultSubtitle").textContent = `Mode: ${res.mode} • ${res.questionsCount} questions${name}`;

  // (3) Profil
  $("profileTitle").textContent = res.profile.title;
  $("profileDesc").textContent = res.profile.desc;

  const chips = $("chips");
  chips.innerHTML = "";
  (res.profile.tags || []).forEach(tag => {
    const c = document.createElement("div");
    c.className = "chip";
    c.textContent = tag;
    chips.appendChild(c);
  });

  // (3) Radar
  renderRadar(res.scores.norm);

  // (2) Barres de scores — maintenant dans #scoreBars
  const scoreList = $("scoreBars");
  scoreList.innerHTML = "";

  for (const a of AXES) {
    const val = res.scores.norm[a.key] ?? 0;

    const row = document.createElement("div");
    row.className = "scoreRow";
    row.innerHTML = `<div>${a.label}</div><div><strong>${val}%</strong></div>`;
    scoreList.appendChild(row);

    const bar = document.createElement("div");
    bar.className = "bar";

    const fill = document.createElement("div");
    fill.className = "barFill";

    fill.style.width = "0%";
    requestAnimationFrame(() => {
      fill.style.width = `${val}%`;
    });

    bar.appendChild(fill);
    scoreList.appendChild(bar);
  }

  // (1) Questionnaire / réponses
  const review = $("answersReview");
  review.innerHTML = "";
  for (const a of res.answers) {
    const card = document.createElement("div");
    card.className = "answerCard";
    card.innerHTML = `
      <div class="q">${a.title}</div>
      <div class="a">${a.text}</div>
      <div class="a" style="margin-top:6px;"><strong>Réponse :</strong> ${a.chosenKey ? `${a.chosenKey} — ${a.chosenTitle}` : "—"}</div>
      ${a.chosenDesc ? `<div class="a">${a.chosenDesc}</div>` : ""}
    `;
    review.appendChild(card);
  }

  $("dlResultPdfBtn").disabled = !state.finished;
  $("dlResultJsonBtn").disabled = !state.finished;

}

/* =========================
   Exports (placeholder minimal)
   ========================= */
function downloadJson(filename, obj) {
  const blob = new Blob([JSON.stringify(obj, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(a.href);
}

function downloadText(filename, text, type = "text/plain") {
  const blob = new Blob([text], { type });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(a.href);
}

function dlQuestionsJson() {
  downloadJson("dilemmes_questions.json", { version: 3, questions: QUESTIONS });
}

function dlResultJson() {
  if (!state.finished || !state.result) return;
  downloadJson("dilemmes_resultat.json", state.result);
}

async function dlQuestionsPdf() {
  // Export PDF simple : fallback texte si jsPDF indispo
  if (!window.jspdf || !window.jspdf.jsPDF) {
    const txt = QUESTIONS.map(q => `${q.title}\n${q.text}\n- ${q.options.map(o => `${o.key}: ${o.title}`).join("\n- ")}\n`).join("\n");
    downloadText("dilemmes_questions.txt", txt);
    return;
  }
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  let y = 12;
  doc.setFontSize(14);
  doc.text("Questionnaire — Dilemmes moraux", 10, y); y += 10;
  doc.setFontSize(10);

  for (const q of QUESTIONS) {
    const block = `${q.title}\n${q.text}\n` + q.options.map(o => `- ${o.key}: ${o.title}`).join("\n");
    const lines = doc.splitTextToSize(block, 180);
    if (y + lines.length * 5 > 285) { doc.addPage(); y = 12; }
    doc.text(lines, 10, y);
    y += lines.length * 5 + 6;
  }
  doc.save("dilemmes_questions.pdf");
}

async function dlResultPdf() {
  if (!state.finished || !state.result) return;

  if (!window.jspdf || !window.jspdf.jsPDF) {
    downloadText("dilemmes_resultat.txt", JSON.stringify(state.result, null, 2));
    return;
  }
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  const marginX = 10;
  const maxWidth = 190;
  const pageBottom = 287;
  let y = 12;

  const ensureSpace = (lineCount = 1) => {
    const needed = lineCount * 5;
    if (y + needed > pageBottom) {
      doc.addPage();
      y = 12;
    }
  };

  const addTitle = (text) => {
    ensureSpace(2);
    doc.setFontSize(12);
    doc.text(text, marginX, y);
    y += 8;
    doc.setFontSize(10);
  };

  const addPara = (text) => {
    const lines = doc.splitTextToSize(text, maxWidth);
    ensureSpace(lines.length + 1);
    doc.setFontSize(10);
    doc.text(lines, marginX, y);
    y += lines.length * 5 + 2;
  };

  // Header
  doc.setFontSize(14);
  doc.text("Résultat — Dilemmes moraux", marginX, y);
  y += 8;
  doc.setFontSize(10);

  addPara(`Mode: ${state.result.mode} • ${state.result.questionsCount} questions`);
  if (state.result.userName) addPara(`Nom: ${state.result.userName}`);
  addPara(`Profil: ${state.result.profile.title}`);
  if (state.result.profile.desc) addPara(state.result.profile.desc);

  // Scores
  addTitle("Scores (pourcentages)");
  for (const a of AXES) {
    const val = state.result.scores?.norm?.[a.key] ?? 0;
    ensureSpace(1);
    doc.text(`${a.label}: ${val}%`, marginX, y);
    y += 5;
  }

  // Reponses
  addTitle("Questionnaire / mes réponses");
  for (const ans of (state.result.answers || [])) {
    addPara(`${ans.title}`);
    addPara(ans.text);
    const rep = ans.chosenKey ? `${ans.chosenKey} — ${ans.chosenTitle}` : "—";
    addPara(`Réponse: ${rep}`);
    if (ans.chosenDesc) addPara(ans.chosenDesc);
    y += 2;
  }

  doc.save("dilemmes_resultat.pdf");
}

/* =========================
   Init
   ========================= */
async function init() {
  const hasSaved = loadState();
  if (hasSaved && state.qIds?.length) {
    $("resumeBtn").style.display = "inline-block";
    $("userName").value = state.userName || "";
    $("mode").value = state.mode || "full";
    if (state.finished && state.result) {
      renderResult();
    }
  }

  $("startBtn").addEventListener("click", startNew);
  $("resumeBtn").addEventListener("click", resume);
  $("resetBtn").addEventListener("click", () => {


    resetState();
    location.reload();
  });

  $("nextBtn").addEventListener("click", goNext);
  $("prevBtn").addEventListener("click", goPrev);
  $("finishBtn").addEventListener("click", finish);

  $("dlQuestionsJsonBtn").addEventListener("click", dlQuestionsJson);
  $("dlResultJsonBtn").addEventListener("click", dlResultJson);
  $("dlQuestionsPdfBtn").addEventListener("click", dlQuestionsPdf);
  $("dlResultPdfBtn").addEventListener("click", dlResultPdf);

  const logoBtn = $("logoBtn");
  if (logoBtn) {
    logoBtn.addEventListener("click", () => {
      const confirmReset = confirm(
        "Revenir au menu va réinitialiser le test en cours.\n\nContinuer ?"
      );
      if (confirmReset) {
        resetAndGoToConfig();
      }
    });
  }

}

window.addEventListener("DOMContentLoaded", init);
