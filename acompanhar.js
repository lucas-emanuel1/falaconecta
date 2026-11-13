const form = document.getElementById('form');
const campoProtocolo = document.getElementById('protocolo');
const campoCodigo = document.getElementById('codigo');
const erro = document.getElementById('erro');
const botao = document.getElementById('botao');
const resultado = document.getElementById('resultado');

/* ---------- Consulta ---------- */
// TODO: trocar pelo servidor (fetch/Supabase). O servidor deve comparar o código
// com o hash guardado e devolver SOMENTE status e andamento (nunca dados pessoais).
async function consultar(protocolo, codigo) {
  // --- DADOS DE TESTE (apagar quando ligar o servidor) ---
  if (protocolo === 'SB-2026-00842' && codigo === '7K9P-42XM') {
    return {
      protocolo,
      status: 'Em análise',
      categoria: 'Iluminação pública',
      bairro: 'Centro',
      criadaEm: '2026-11-10T09:30:00-03:00',
      historico: [
        { status: 'Recebida', texto: 'Manifestação recebida e aguardando análise.', data: '2026-11-10T09:30:00-03:00' },
        { status: 'Em análise', texto: 'A equipe da Ouvidoria está avaliando o caso.', data: '2026-11-11T14:10:00-03:00' },
      ],
    };
  }
  return null;
}

/* ---------- Normalização e validação ---------- */
const normalizarProtocolo = (v) => v.trim().toUpperCase();
function normalizarCodigo(v) {
  const limpo = v.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  return limpo.length === 8 ? limpo.slice(0, 4) + '-' + limpo.slice(4) : limpo;
}
const protocoloValido = (p) => /^SB-\d{4}-\d{5}$/.test(p);
const codigoValido = (c) => /^[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(c);

const mostrarErro = (msg) => { erro.textContent = msg; erro.hidden = false; };
const fmt = (iso) => new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });

/* ---------- Envio ---------- */
form.addEventListener('submit', async (e) => {
  e.preventDefault();
  erro.hidden = true;
  resultado.hidden = true;
  [campoProtocolo, campoCodigo].forEach((c) => c.classList.remove('invalido'));

  const protocolo = normalizarProtocolo(campoProtocolo.value);
  const codigo = normalizarCodigo(campoCodigo.value);

  if (!protocolo || !codigo) {
    mostrarErro('Preencha o número do protocolo e o código de acesso.');
    (protocolo ? campoCodigo : campoProtocolo).classList.add('invalido');
    (protocolo ? campoCodigo : campoProtocolo).focus();
    return;
  }
  if (!protocoloValido(protocolo)) {
    mostrarErro('Use o formato do protocolo, por exemplo: SB-2026-00842.');
    campoProtocolo.classList.add('invalido');
    campoProtocolo.focus();
    return;
  }
  if (!codigoValido(codigo)) {
    mostrarErro('O código de acesso tem 8 caracteres, por exemplo: 7K9P-42XM.');
    campoCodigo.classList.add('invalido');
    campoCodigo.focus();
    return;
  }

  botao.disabled = true;
  botao.textContent = 'Consultando...';
  try {
    const m = await consultar(protocolo, codigo);
    if (!m) {
      // Mesma mensagem para protocolo errado ou código errado (não revela qual falhou)
      mostrarErro('Protocolo ou código de acesso incorretos.');
      return;
    }
    mostrarResultado(m);
  } catch (err) {
    console.error(err);
    mostrarErro('Não foi possível consultar agora. Tente novamente em instantes.');
  } finally {
    botao.disabled = false;
    botao.textContent = 'Acompanhar';
  }
});

function mostrarResultado(m) {
  document.getElementById('r-protocolo').textContent = m.protocolo;
  document.getElementById('r-status').textContent = m.status;
  document.getElementById('r-meta').textContent = `${m.categoria} · ${m.bairro} · enviada em ${fmt(m.criadaEm)}`;

  const lista = document.getElementById('r-historico');
  lista.innerHTML = '';
  [...m.historico].reverse().forEach((h) => { // mais recente primeiro
    const li = document.createElement('li');
    const forte = document.createElement('strong');
    forte.textContent = h.status;
    const t = document.createElement('time');
    t.textContent = fmt(h.data);
    li.append(forte, document.createTextNode(' — ' + h.texto), t);
    lista.appendChild(li);
  });

  resultado.hidden = false;
  resultado.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// Tira o aviso assim que o usuário volta a digitar
[campoProtocolo, campoCodigo].forEach((c) =>
  c.addEventListener('input', () => { c.classList.remove('invalido'); erro.hidden = true; })
);
