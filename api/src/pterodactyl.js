const baseUrl = (process.env.PTERODACTYL_URL || "").replace(/\/$/, "");

function requirePanelConfig() {
  const required = ["PTERODACTYL_URL", "PTERODACTYL_APPLICATION_KEY", "PTERODACTYL_OWNER_ID", "PTERODACTYL_ALLOCATION_ID"];
  const missing = required.filter((key) => !process.env[key]);
  if (missing.length) throw new Error("Configuração Pterodactyl em falta: " + missing.join(", "));
}

export async function panelRequest(path, options = {}) {
  requirePanelConfig();
  const response = await fetch(baseUrl + path, {
    ...options,
    headers: {
      Accept: "Application/vnd.pterodactyl.v1+json",
      Authorization: `Bearer ${process.env.PTERODACTYL_APPLICATION_KEY}`,
      "Content-Type": "application/json",
      ...(options.headers || {})
    }
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const detail = body?.errors?.map((item) => item.detail).filter(Boolean).join("; ");
    throw new Error(detail || `Pterodactyl respondeu com HTTP ${response.status}`);
  }
  return body;
}

export async function provisionMinecraftServer({ name, memoryMb, diskMb, cpuPercent, software, version }) {
  requirePanelConfig();
  let eggMap;
  try { eggMap = JSON.parse(process.env.EGG_MAP_JSON || "{}"); }
  catch { throw new Error("EGG_MAP_JSON não contém JSON válido."); }

  const egg = eggMap[software];
  if (!egg || !egg.nestId || !egg.eggId || !egg.dockerImage || !egg.startup) {
    throw new Error(`O software "${software}" ainda não está configurado no backend. Instala/configura o Egg correspondente e adiciona-o a EGG_MAP_JSON.`);
  }

  const env = { ...(egg.environment || {}) };
  if (egg.versionVariable) env[egg.versionVariable] = version;

  const created = await panelRequest("/api/application/servers", {
    method: "POST",
    body: JSON.stringify({
      name,
      user: Number(process.env.PTERODACTYL_OWNER_ID),
      nest: Number(egg.nestId),
      egg: Number(egg.eggId),
      docker_image: egg.dockerImage,
      startup: egg.startup,
      environment: env,
      limits: { memory: memoryMb, swap: 0, disk: diskMb, io: 500, cpu: cpuPercent },
      feature_limits: { databases: 0, backups: 1, allocations: 1 },
      allocation: { default: Number(process.env.PTERODACTYL_ALLOCATION_ID) },
      deploy: { locations: [], dedicated_ip: false, port_range: [] },
      start_on_completion: false
    })
  });

  return created.attributes;
}
