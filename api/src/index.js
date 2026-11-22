import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import Database from "better-sqlite3";
import { z } from "zod";
import { provisionMinecraftServer } from "./pterodactyl.js";

const app = express();
const port = Number(process.env.PORT || 3000);
const jwtSecret = process.env.JWT_SECRET;
if (!jwtSecret || jwtSecret.length < 32) {
  console.error("JWT_SECRET tem de existir e ter pelo menos 32 caracteres.");
  process.exit(1);
}

app.set("trust proxy", 1);
app.use(helmet());
const allowedOrigins = (process.env.FRONTEND_ORIGIN || "").split(",").map((s) => s.trim()).filter(Boolean);
app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.length === 0 || allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error("Origem não autorizada pelo CORS."));
  }
}));
app.use(express.json({ limit: "20kb" }));
app.use("/api", rateLimit({ windowMs: 60_000, limit: 60, standardHeaders: "draft-7", legacyHeaders: false }));

const dbPath = process.env.DATABASE_PATH || "./data/servidor-gg.sqlite";
import fs from "node:fs";
import path from "node:path";
fs.mkdirSync(path.dirname(path.resolve(dbPath)), { recursive: true });
const db = new Database(dbPath);
db.pragma("journal_mode = WAL");
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS servers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id),
    panel_server_id INTEGER NOT NULL,
    identifier TEXT NOT NULL,
    name TEXT NOT NULL,
    software TEXT NOT NULL,
    version TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
`);

const registerSchema = z.object({
  email: z.string().email().max(190),
  password: z.string().min(10).max(72)
});
const serverSchema = z.object({
  name: z.string().trim().min(3).max(32).regex(/^[\p{L}\p{N} _.-]+$/u),
  software: z.string().regex(/^[a-z0-9_-]{2,32}$/),
  version: z.string().min(1).max(30).regex(/^[a-zA-Z0-9._+-]+$/),
  memoryMb: z.number().int().positive().optional()
});

function issueToken(user) {
  return jwt.sign({ sub: String(user.id), email: user.email }, jwtSecret, { expiresIn: "7d", issuer: "servidor-gg" });
}
function auth(req, res, next) {
  const token = (req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  try {
    const payload = jwt.verify(token, jwtSecret, { issuer: "servidor-gg" });
    req.user = { id: Number(payload.sub), email: payload.email };
    next();
  } catch {
    res.status(401).json({ error: "Inicia sessão para continuar." });
  }
}

app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    service: "servidor-gg-api",
    pterodactylConfigured: Boolean(process.env.PTERODACTYL_URL && process.env.PTERODACTYL_APPLICATION_KEY && process.env.PTERODACTYL_OWNER_ID && process.env.PTERODACTYL_ALLOCATION_ID)
  });
});

app.get("/api/catalog", async (_req, res) => {
  let versions = [];
  try {
    const response = await fetch("https://piston-meta.mojang.com/mc/game/version_manifest_v2.json");
    if (response.ok) {
      const manifest = await response.json();
      versions = manifest.versions.filter((item) => item.type === "release").slice(0, 80).map((item) => ({ id: item.id, type: item.type }));
    }
  } catch { /* O catálogo continua disponível sem a lista remota. */ }
  let eggMap = {};
  try { eggMap = JSON.parse(process.env.EGG_MAP_JSON || "{}"); } catch {}
  res.json({
    editions: ["Java"],
    software: Object.keys(eggMap).map((id) => ({ id, label: id.charAt(0).toUpperCase() + id.slice(1) })),
    versions,
    note: "Só os softwares configurados em EGG_MAP_JSON podem ser provisionados. A lista de versões não garante que cada Egg suporte todas elas."
  });
});

app.post("/api/auth/register", rateLimit({ windowMs: 60 * 60_000, limit: 8 }), async (req, res) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Email inválido ou palavra-passe demasiado curta (mínimo 10 caracteres)." });
  const email = parsed.data.email.toLowerCase();
  try {
    const hash = await bcrypt.hash(parsed.data.password, 12);
    const result = db.prepare("INSERT INTO users (email, password_hash) VALUES (?, ?)").run(email, hash);
    const user = { id: Number(result.lastInsertRowid), email };
    res.status(201).json({ token: issueToken(user), user });
  } catch (error) {
    if (String(error.code).includes("SQLITE_CONSTRAINT")) return res.status(409).json({ error: "Já existe uma conta com esse email." });
    res.status(500).json({ error: "Não foi possível criar a conta." });
  }
});

app.post("/api/auth/login", rateLimit({ windowMs: 15 * 60_000, limit: 10 }), async (req, res) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Credenciais inválidas." });
  const user = db.prepare("SELECT id, email, password_hash FROM users WHERE email = ?").get(parsed.data.email.toLowerCase());
  if (!user || !(await bcrypt.compare(parsed.data.password, user.password_hash))) return res.status(401).json({ error: "Email ou palavra-passe incorretos." });
  res.json({ token: issueToken(user), user: { id: user.id, email: user.email } });
});

app.get("/api/servers", auth, (req, res) => {
  const servers = db.prepare("SELECT id, name, software, version, created_at AS createdAt FROM servers WHERE user_id = ? ORDER BY id DESC").all(req.user.id);
  res.json({ servers });
});

app.post("/api/servers", auth, async (req, res) => {
  const parsed = serverSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Verifica o nome, software, versão e memória escolhidos." });
  const maxRam = Number(process.env.MAX_RAM_MB || 4096);
  const memoryMb = Math.min(parsed.data.memoryMb || Number(process.env.DEFAULT_RAM_MB || 2048), maxRam);
  const diskMb = Number(process.env.DEFAULT_DISK_MB || 5120);
  const cpuPercent = Number(process.env.DEFAULT_CPU_PERCENT || 100);
  if (!process.env.PTERODACTYL_URL || !process.env.PTERODACTYL_APPLICATION_KEY) {
    return res.status(503).json({ error: "O alojamento ainda não está ligado ao Pterodactyl. O administrador tem de configurar o backend." });
  }
  try {
    const server = await provisionMinecraftServer({ ...parsed.data, memoryMb, diskMb, cpuPercent });
    db.prepare("INSERT INTO servers (user_id, panel_server_id, identifier, name, software, version) VALUES (?, ?, ?, ?, ?, ?)")
      .run(req.user.id, server.id, server.identifier, parsed.data.name, parsed.data.software, parsed.data.version);
    res.status(201).json({ server: { id: server.id, identifier: server.identifier, name: parsed.data.name, software: parsed.data.software, version: parsed.data.version } });
  } catch (error) {
    console.error("Provisioning failed:", error.message);
    res.status(502).json({ error: error.message || "O Pterodactyl não conseguiu criar o servidor." });
  }
});

app.use((error, _req, res, _next) => {
  console.error(error.message);
  res.status(400).json({ error: "Pedido inválido." });
});

app.listen(port, () => console.log(`Servidor GG API listening on port ${port}`));
