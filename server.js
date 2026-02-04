import express from "express";
import path from "path";
import { fileURLToPath } from "url";

const app = express();
const PORT = 8000;

// Pour reconstituer __dirname en ES module
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Servir le dossier public
app.use(express.static(path.join(__dirname, "public")));

// Route test
app.get("/test", (req, res) => {
  res.send("OK - serveur fonctionne");
});

// Écoute sur toutes les interfaces
app.listen(PORT, "0.0.0.0", () => {
  console.log(`Serveur lancé sur http://0.0.0.0:${PORT}`);
});
