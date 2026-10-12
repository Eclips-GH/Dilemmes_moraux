import express from "express";
import helmet from "helmet";
import { rateLimit } from "express-rate-limit";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));

function integer(value, fallback, minimum, maximum, name) {
  const number = value === undefined ? fallback : Number(value);
  if (!Number.isInteger(number) || number < minimum || number > maximum) {
    throw new Error(`Configuration invalide : ${name}`);
  }
  return number;
}

export function readConfig(env = process.env) {
  const production = env.NODE_ENV === "production";
  const host = env.HOST || "127.0.0.1";
  const trustProxy = env.TRUST_PROXY || "false";
  if (!["false", "loopback"].includes(trustProxy)) {
    throw new Error("TRUST_PROXY doit valoir false ou loopback.");
  }
  let origin = null;
  if (production) {
    const url = new URL(env.PUBLIC_ORIGIN || "https://configuration-manquante.invalid");
    if (!env.PUBLIC_ORIGIN || url.protocol !== "https:" || url.username || url.password ||
        url.pathname !== "/" || url.search || url.hash || url.hostname.endsWith(".invalid")) {
      throw new Error("PUBLIC_ORIGIN doit être l'origine HTTPS publique, sans chemin ni identifiants.");
    }
    if (!["127.0.0.1", "::1"].includes(host) || trustProxy !== "loopback") {
      throw new Error("En production, utiliser HOST=127.0.0.1 (ou ::1) et TRUST_PROXY=loopback derrière un proxy HTTPS local.");
    }
    origin = url.origin;
  }
  return {
    production, host, origin, trustProxy,
    port: integer(env.PORT, 8000, 1, 65535, "PORT"),
    requestLimit: integer(env.RATE_LIMIT_MAX, 180, 1, 10000, "RATE_LIMIT_MAX"),
    windowMs: 60000,
  };
}

export function createApp(config = readConfig()) {
  const app = express();
  app.disable("x-powered-by");
  app.set("env", config.production ? "production" : "development");
  app.set("query parser", false);
  app.set("trust proxy", config.trustProxy === "loopback" ? "loopback" : false);
  app.use(helmet({
    contentSecurityPolicy: {
      useDefaults: false,
      directives: {
        defaultSrc: ["'self'"], scriptSrc: ["'self'"], scriptSrcAttr: ["'none'"],
        styleSrc: ["'self'"],
        // Conserve les styles d'attributs existants et ceux du graphique.
        styleSrcAttr: ["'unsafe-inline'"],
        imgSrc: ["'self'", "data:", "blob:"], fontSrc: ["'self'", "data:"],
        connectSrc: ["'none'"], objectSrc: ["'none'"], baseUri: ["'none'"],
        frameAncestors: ["'none'"], formAction: ["'none'"], workerSrc: ["'none'"],
        upgradeInsecureRequests: config.production ? [] : null,
      },
    },
    strictTransportSecurity: config.production
      ? { maxAge: 31536000, includeSubDomains: false, preload: false } : false,
    referrerPolicy: { policy: "no-referrer" }, xFrameOptions: { action: "deny" },
  }));
  app.use((req, res, next) => {
    if (req.originalUrl.length > 2048) return res.status(414).send("Adresse trop longue.");
    if (!["GET", "HEAD"].includes(req.method)) {
      return res.set("Allow", "GET, HEAD").status(405).send("Méthode non autorisée.");
    }
    const allowedHosts = config.production
      ? [new URL(config.origin).hostname] : ["localhost", "127.0.0.1", "[::1]", "::1"];
    if (!allowedHosts.includes(req.hostname?.toLowerCase())) return res.status(421).send("Nom d'hôte non autorisé.");
    next();
  });
  app.use(rateLimit({
    windowMs: config.windowMs, limit: config.requestLimit,
    standardHeaders: "draft-8", legacyHeaders: false,
    message: "Trop de requêtes. Réessayez dans une minute.",
  }));
  app.use((req, res, next) => {
    if (config.production && !req.secure) {
      // Origine fixe : aucune redirection construite depuis un en-tête client.
      return res.redirect(308, config.origin + req.originalUrl);
    }
    next();
  });
  app.get("/test", (_req, res) => res.set("Cache-Control", "no-store").send("OK - serveur fonctionne"));
  app.use(express.static(path.join(root, "public"), {
    dotfiles: "deny", index: "index.html", redirect: false,
    setHeaders(res, file) {
      res.setHeader("Cache-Control", file.includes(`${path.sep}vendor${path.sep}`)
        ? "public, max-age=86400" : "no-cache");
    },
  }));
  app.use((_req, res) => res.status(404).send("Ressource introuvable."));
  app.use((error, _req, res, _next) => {
    const status = Number.isInteger(error.status) && error.status >= 400 && error.status < 600
      ? error.status : 500;
    if (status >= 500) console.error("Erreur serveur interne.");
    res.set("Cache-Control", "no-store").status(status).send(
      status >= 500 ? "Erreur interne du serveur." : "Requête non valide.",
    );
  });
  return app;
}

export function startServer(config = readConfig()) {
  const server = createApp(config).listen(config.port, config.host, () => {
    console.log(`Serveur local : http://${config.host}:${config.port}`);
  });
  server.requestTimeout = 15000;
  server.headersTimeout = 10000;
  server.keepAliveTimeout = 5000;
  server.timeout = 30000;
  server.maxRequestsPerSocket = 100;
  return server;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) startServer();
