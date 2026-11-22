const memory = document.getElementById("memory");
const ramValue = document.getElementById("ramValue");
const form = document.getElementById("serverForm");
const result = document.getElementById("result");

memory.addEventListener("input", () => {
  ramValue.textContent = memory.value + " GB";
});

form.addEventListener("submit", (event) => {
  event.preventDefault();
  const name = document.getElementById("serverName").value.trim();
  const edition = document.getElementById("edition").value;
  const version = document.getElementById("version").value;
  const type = document.getElementById("serverType").value;
  const ram = memory.value;
  result.classList.add("show");
  result.innerHTML = "<strong>Configuração preparada!</strong><br>" +
    "Nome: " + escapeHtml(name) + "<br>" +
    "Edição: " + edition + " · Versão: " + version + "<br>" +
    "Software: " + type + " · RAM: " + ram + " GB<br><br>" +
    "Isto é apenas uma pré-visualização. Ainda não foi criado nem iniciado um servidor real.";
  result.scrollIntoView({ behavior: "smooth", block: "nearest" });
});

function escapeHtml(value) {
  return value.replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
  }[char]));
}

document.getElementById("copyIp").addEventListener("click", async () => {
  const button = document.getElementById("copyIp");
  try {
    await navigator.clipboard.writeText("play.servidor.gg");
    button.textContent = "✓";
    setTimeout(() => button.textContent = "▣", 1500);
  } catch {
    button.textContent = "—";
  }
});

document.getElementById("loginBtn").addEventListener("click", () => {
  alert("O sistema de contas será ligado numa próxima etapa.");
});