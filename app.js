/**
 * Configuração: cole aqui a URL do Web App publicado (Code.gs / doGet-doPost).
 * Ex: https://script.google.com/macros/s/AKfycb.../exec
 */
const API_URL = "https://script.google.com/macros/s/AKfycbxKit_hVTerKv7LQePlvVBwQmat3YKvFnUNi9X78nGBxBRdJGnmhJjx0nX9NUqHdlk6/exec";

/**
 * Mesma chave configurada na propriedade de script API_KEY do backend.
 * Não impede alguém com acesso ao código-fonte deste arquivo de ler a chave,
 * mas evita que a URL sozinha (compartilhada por engano, por exemplo) seja
 * suficiente para acessar os dados.
 */
const API_KEY = "COLE_AQUI_A_MESMA_CHAVE_DA_PROPRIEDADE_API_KEY";

const form = document.getElementById("form-aniversariante");
const listaEl = document.getElementById("lista");
const loadingEl = document.getElementById("loading");
const vazioEl = document.getElementById("vazio");
const contadorEl = document.getElementById("contador");
const toastEl = document.getElementById("toast");
const btnCancelar = document.getElementById("btn-cancelar");
const btnSalvar = document.getElementById("btn-salvar");
const formTitle = document.getElementById("form-title");

const MESES = ["JAN","FEV","MAR","ABR","MAI","JUN","JUL","AGO","SET","OUT","NOV","DEZ"];

let editandoId = null;

async function carregarLista() {
  loadingEl.classList.remove("hidden");
  listaEl.innerHTML = "";
  vazioEl.classList.add("hidden");

  try {
    const res = await fetch(`${API_URL}?action=list&key=${encodeURIComponent(API_KEY)}`);
    const json = await res.json();
    if (!json.ok) throw new Error(json.error);

    const dados = ordenarPorProximoAniversario(json.data);
    renderLista(dados);
  } catch (err) {
    mostrarToast("Erro ao carregar: " + err.message, true);
  } finally {
    loadingEl.classList.add("hidden");
  }
}

function ordenarPorProximoAniversario(dados) {
  const hoje = new Date();
  const hojeMD = hoje.getMonth() * 100 + hoje.getDate();

  return [...dados].sort((a, b) => {
    const [da, ma] = a.dataNascimento.split("/").map(Number);
    const [db, mb] = b.dataNascimento.split("/").map(Number);
    let keyA = (ma - 1) * 100 + da;
    let keyB = (mb - 1) * 100 + db;
    if (keyA < hojeMD) keyA += 1300;
    if (keyB < hojeMD) keyB += 1300;
    return keyA - keyB;
  });
}

function renderLista(dados) {
  contadorEl.textContent = dados.length;

  if (dados.length === 0) {
    vazioEl.classList.remove("hidden");
    return;
  }

  dados.forEach((pessoa) => {
    const [dia, mes] = pessoa.dataNascimento.split("/");
    const li = document.createElement("li");
    li.className = "item";
    li.innerHTML = `
      <div class="item-data">
        <div class="dia">${dia}</div>
        <div class="mes">${MESES[parseInt(mes, 10) - 1]}</div>
      </div>
      <div class="item-info">
        <div class="nome">${escapeHtml(pessoa.nome)}</div>
        <div class="tel">${escapeHtml(pessoa.telefone)}</div>
      </div>
      <div class="item-actions">
        <button class="icon-btn" data-action="edit" data-id="${pessoa.id}">✏️</button>
        <button class="icon-btn" data-action="delete" data-id="${pessoa.id}">🗑️</button>
      </div>
    `;
    listaEl.appendChild(li);
  });
}

listaEl.addEventListener("click", async (e) => {
  const btn = e.target.closest("button[data-action]");
  if (!btn) return;

  const id = btn.dataset.id;
  const acao = btn.dataset.action;

  if (acao === "delete") {
    if (!confirm("Remover este aniversariante?")) return;
    try {
      await chamarApi({ action: "delete", id });
      mostrarToast("Removido com sucesso");
      carregarLista();
    } catch (err) {
      mostrarToast("Erro ao remover: " + err.message, true);
    }
  }

  if (acao === "edit") {
    try {
      const res = await fetch(`${API_URL}?action=list&key=${encodeURIComponent(API_KEY)}`);
      const json = await res.json();
      const pessoa = json.data.find((p) => p.id === id);
      if (!pessoa) return;
      preencherFormParaEdicao(pessoa);
    } catch (err) {
      mostrarToast("Erro ao carregar dados: " + err.message, true);
    }
  }
});

function preencherFormParaEdicao(pessoa) {
  editandoId = pessoa.id;
  document.getElementById("f-id").value = pessoa.id;
  document.getElementById("f-nome").value = pessoa.nome;
  document.getElementById("f-data").value = pessoa.dataNascimento;
  document.getElementById("f-telefone").value = pessoa.telefone;
  document.getElementById("f-mensagem").value = pessoa.mensagemCustom || "";

  formTitle.textContent = "Editar aniversariante";
  btnSalvar.textContent = "Salvar alterações";
  btnCancelar.classList.remove("hidden");
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function resetForm() {
  editandoId = null;
  form.reset();
  formTitle.textContent = "Novo aniversariante";
  btnSalvar.textContent = "Adicionar";
  btnCancelar.classList.add("hidden");
}

btnCancelar.addEventListener("click", resetForm);

form.addEventListener("submit", async (e) => {
  e.preventDefault();

  const payload = {
    nome: document.getElementById("f-nome").value.trim(),
    dataNascimento: document.getElementById("f-data").value.trim(),
    telefone: document.getElementById("f-telefone").value.trim(),
    mensagemCustom: document.getElementById("f-mensagem").value.trim()
  };

  if (!validarData(payload.dataNascimento)) {
    mostrarToast("Data inválida. Use o formato DD/MM/AAAA.", true);
    return;
  }

  try {
    if (editandoId) {
      await chamarApi({ action: "update", id: editandoId, ...payload });
      mostrarToast("Alterações salvas");
    } else {
      await chamarApi({ action: "create", ...payload });
      mostrarToast("Aniversariante adicionado");
    }
    resetForm();
    carregarLista();
  } catch (err) {
    mostrarToast("Erro ao salvar: " + err.message, true);
  }
});

function validarData(str) {
  return /^\d{2}\/\d{2}\/\d{4}$/.test(str);
}

async function chamarApi(body) {
  const res = await fetch(API_URL, {
    method: "POST",
    body: JSON.stringify({ ...body, key: API_KEY })
  });
  const json = await res.json();
  if (!json.ok) throw new Error(json.error || "Erro desconhecido");
  return json.data;
}

function mostrarToast(msg, isError = false) {
  toastEl.textContent = msg;
  toastEl.className = "toast" + (isError ? " error" : "");
  toastEl.classList.remove("hidden");
  setTimeout(() => toastEl.classList.add("hidden"), 3000);
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

carregarLista();
