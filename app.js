const memory = document.getElementById("memory");
const ramValue = document.getElementById("ramValue");
const form = document.getElementById("serverForm");
const result = document.getElementById("result");
const apiBase = (window.SERVIDOR_GG_API_URL || "").replace(/\/$/, "");
const authDialog = document.getElementById("authDialog");
const authForm = document.getElementById("authForm");
const authMessage = document.getElementById("authMessage");
let authMode = "login";
let catalog = null;
let token = sessionStorage.getItem("servidorGGToken") || "";

function showResult(message, isError = false) {
  result.classList.add("show");
  result.style.borderColor = isError ? "#a64b4b" : "#3b593e";
  result.style.color = isError ? "#ffb8b8" : "#b9efc5";
  result.textContent = message;
}
async function apiRequest(path, options = {}) {
  if (!apiBase) throw new Error("A API ainda não está ligada. O administrador tem de configurar config.js com o URL HTTPS do backend.");
  const response = await fetch(apiBase + path, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: "Bearer " + token } : {}),
      ...(options.headers || {})
    }
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "O pedido falhou.");
  return data;
}

memory.addEventListener("input", () => { ramValue.textContent = memory.value + " GB"; });

function setAuthMode(mode) {
  authMode = mode;
  document.getElementById("authTitle").textContent = mode === "register" ? "Criar conta" : "Entrar";
  document.getElementById("authDescription").textContent = mode === "register"
    ? "Cria uma conta para começares a gerir os teus servidores."
    : "Inicia sessão para gerir os teus servidores.";
  document.getElementById("authSubmit").textContent = mode === "register" ? "Criar conta" : "Entrar";
  document.getElementById("registerBtn").textContent = mode === "register" ? "Já tenho conta" : "Criar conta";
  document.getElementById("authPassword").autocomplete = mode === "register" ? "new-password" : "current-password";
  authMessage.textContent = "";
}
document.getElementById("loginBtn").addEventListener("click", () => {
  setAuthMode("login");
  authDialog.showModal();
});
document.getElementById("closeAuth").addEventListener("click", () => authDialog.close());
document.getElementById("registerBtn").addEventListener("click", () => setAuthMode(authMode === "login" ? "register" : "login"));

authForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  authMessage.textContent = "A processar...";
  const email = document.getElementById("authEmail").value.trim();
  const password = document.getElementById("authPassword").value;
  try {
    const data = await apiRequest("/api/auth/" + authMode, { method: "POST", body: JSON.stringify({ email, password }) });
    token = data.token;
    sessionStorage.setItem("servidorGGToken", token);
    authMessage.textContent = "Sessão iniciada com sucesso.";
    document.getElementById("loginBtn").textContent = "Conta ativa";
    setTimeout(() => authDialog.close(), 700);\n    refreshServers();
  } catch (error) {
    authMessage.textContent = error.message;
  }
});

async function loadCatalog() {
  if (!apiBase) return;
  try {
    catalog = await apiRequest("/api/catalog");
    const softwareSelect = document.getElementById("serverType");
    const versionSelect = document.getElementById("version");
    if (catalog.software?.length) {
      softwareSelect.replaceChildren(...catalog.software.map((item) => new Option(item.label, item.id)));
    } else {
      softwareSelect.replaceChildren(new Option("Nenhum software configurado", ""));
    }
    if (catalog.versions?.length) {
      versionSelect.replaceChildren(...catalog.versions.map((item) => new Option(item.id, item.id)));
    }
  } catch (error) {
    console.warn("Não foi possível carregar o catálogo:", error.message);
  }
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const name = document.getElementById("serverName").value.trim();
  const software = document.getElementById("serverType").value;
  const version = document.getElementById("version").value;
  const memoryMb = Number(memory.value) * 1024;
  if (!token) {
    showResult("Para criar um servidor real, inicia sessão ou cria uma conta primeiro.", true);
    setAuthMode("register");
    authDialog.showModal();
    return;
  }
  const submit = form.querySelector('button[type="submit"]');
  submit.disabled = true;
  submit.textContent = "A criar servidor...";
  try {
    const data = await apiRequest("/api/servers", {
      method: "POST",
      body: JSON.stringify({ name, software, version, memoryMb })
    });
    showResult("Pedido enviado e servidor criado no Pterodactyl. ID: " + data.server.id + ". O arranque automático está desativado; a gestão do servidor será adicionada numa próxima etapa.");
    form.reset();
    ramValue.textContent = memory.value + " GB";
  } catch (error) {
    showResult(error.message, true);
  } finally {
    submit.disabled = false;
    submit.innerHTML = 'Preparar configuração <span>→</span>';
  }
});

document.getElementById("copyIp").addEventListener("click", async () => {
  const button = document.getElementById("copyIp");
  try {
    await navigator.clipboard.writeText("play.servidor.gg");
    button.textContent = "✓";
    setTimeout(() => button.textContent = "▣", 1500);
  } catch { button.textContent = "—"; }
});

if (token) document.getElementById("loginBtn").textContent = "Conta ativa";
loadCatalog();

async function refreshServers() {
  const list = document.getElementById("serverList");
  const status = document.getElementById("accountStatus");
  if (!token) {
    status.textContent = "Sessão não iniciada";
    list.innerHTML = '<div class="empty-servers">Inicia sessão para veres os teus servidores.</div>';
    return;
  }
  status.textContent = "A carregar...";
  try {
    const data = await apiRequest("/api/servers");
    status.textContent = data.servers.length + (data.servers.length === 1 ? " servidor na tua conta" : " servidores na tua conta");
    list.replaceChildren();
    if (!data.servers.length) {
      list.innerHTML = '<div class="empty-servers">Ainda não tens servidores. Usa o configurador acima para preparar o primeiro.</div>';
      return;
    }
    for (const server of data.servers) {
      const card = document.createElement("article");
      card.className = "managed-server";
      const title = document.createElement("h3");
      title.textContent = server.name;
      const details = document.createElement("p");
      details.textContent = server.software + " · Minecraft " + server.version;
      const id = document.createElement("span");
      id.textContent = "ID do painel: " + server.id;
      card.append(title, details, id);
      list.append(card);
    }
  } catch (error) {
    status.textContent = "Não foi possível carregar";
    list.replaceChildren();
    const message = document.createElement("div");
    message.className = "empty-servers";
    message.textContent = error.message;
    list.append(message);
  }
}
document.getElementById("refreshServers").addEventListener("click", refreshServers);
