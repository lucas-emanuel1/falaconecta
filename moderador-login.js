const form = document.getElementById('form-login');
const erro = document.getElementById('erro');
const botao = document.getElementById('botao');

const mostrarErro = (msg) => { erro.textContent = msg; erro.hidden = false; };

// Se já estiver logado, vai direto para o painel certo
_db.auth.getSession().then(async ({ data }) => {
  if (!data.session) return;
  const { data: perfil } = await _db
    .from('perfis').select('papel').eq('user_id', data.session.user.id).maybeSingle();
  if (perfil && perfil.papel === 'moderador') window.location.replace('moderador.html');
  else if (perfil && perfil.papel === 'orgao') window.location.replace('orgao.html');
});

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  erro.hidden = true;

  const email = document.getElementById('email').value.trim();
  const senha = document.getElementById('senha').value;
  if (!email || !senha) { mostrarErro('Preencha o email e a senha.'); return; }

  botao.disabled = true;
  botao.textContent = 'Entrando...';
  try {
    const { data, error } = await _db.auth.signInWithPassword({ email, password: senha });
    if (error) { mostrarErro('Email ou senha incorretos.'); return; }

    // Só entra no painel quem tem o papel de moderador na tabela "perfis"
    const { data: perfil } = await _db
      .from('perfis').select('papel').eq('user_id', data.user.id).maybeSingle();

    if (perfil && perfil.papel === 'moderador') {
      window.location.replace('moderador.html');
    } else if (perfil && perfil.papel === 'orgao') {
      window.location.replace('orgao.html');
    } else {
      await _db.auth.signOut();
      mostrarErro('Esta conta não tem acesso ao painel de moderação.');
    }
  } catch (err) {
    console.error(err);
    mostrarErro('Não foi possível entrar agora. Tente novamente.');
  } finally {
    botao.disabled = false;
    botao.textContent = 'Entrar';
  }
});
