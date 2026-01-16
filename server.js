import express from "express";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

const PUBLIC_DIR = path.join(__dirname, "public");

// Static files (UI)
app.use(express.static(PUBLIC_DIR));

app.listen(PORT, () => {
  console.log(`Dilemmes moraux: http://localhost:${PORT}`);
});
