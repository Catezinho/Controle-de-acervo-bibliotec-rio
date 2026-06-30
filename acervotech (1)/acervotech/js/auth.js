/**
 * auth.js — Módulo de Autenticação
 *
 * Responsável por:
 *  - Enviar o formulário de login para a API e salvar a sessão.
 *  - Enviar o formulário de cadastro para a API.
 *  - Verificar se o usuário está autenticado em qualquer página interna.
 *  - Exibir o nome do usuário logado no menu de navegação.
 *  - Realizar o logout limpando a sessão e redirecionando para o login.
 *
 * CORREÇÃO PRINCIPAL: O projeto original redirecionava o usuário
 * imediatamente após o login sem salvar nenhum dado de sessão, e as
 * funções `verificarAutenticacao()` e `exibirUsuarioNoMenu()` —
 * chamadas em todas as páginas internas — nunca foram definidas,
 * causando erro de JavaScript em toda navegação pós-login.
 */

const API_URL_AUTH = 'http://127.0.0.1:8000/api/auth';

// ===========================================================================
//  SESSÃO
// ===========================================================================

/**
 * Salva os dados do usuário logado no sessionStorage.
 * O sessionStorage é limpo automaticamente ao fechar o navegador.
 *
 * @param {Object} usuario - Objeto com id, nome e email do administrador.
 */
function salvarSessao(usuario) {
    sessionStorage.setItem('usuario', JSON.stringify(usuario));
}

/**
 * Recupera os dados do usuário da sessão atual.
 *
 * @returns {Object|null} Dados do usuário ou null se não houver sessão ativa.
 */
function obterSessao() {
    const dados = sessionStorage.getItem('usuario');
    return dados ? JSON.parse(dados) : null;
}

/**
 * Verifica se o usuário está autenticado.
 * Deve ser chamada no início de cada página interna do sistema.
 *
 * CORREÇÃO: Esta função estava sendo chamada em todas as páginas internas
 * (dashboard, livros, usuários, empréstimos, devoluções etc.) mas nunca
 * havia sido definida, gerando erro fatal de JavaScript.
 *
 * Se não houver sessão ativa, redireciona para a tela de login.
 *
 * @returns {Object} Dados do usuário logado.
 */
function verificarAutenticacao() {
    const usuario = obterSessao();
    if (!usuario) {
        // Redireciona para a raiz do projeto, que contém o index.html
        window.location.href = '../index.html';
        return null;
    }
    return usuario;
}

/**
 * Exibe o nome do usuário logado no elemento #nomeUsuario do menu de navegação.
 *
 * CORREÇÃO: Esta função também estava sendo chamada em todas as páginas
 * internas sem nunca ter sido definida.
 */
function exibirUsuarioNoMenu() {
    const usuario = obterSessao();
    const elementoNome = document.getElementById('nomeUsuario');
    if (elementoNome && usuario) {
        elementoNome.textContent = usuario.nome;
    }
}

/**
 * Encerra a sessão do usuário, limpa o sessionStorage e redireciona
 * para a tela de login.
 *
 * Esta função já existia em livros.js com um caminho de redirecionamento
 * correto. Foi centralizada aqui para evitar duplicação e garantir
 * consistência em todas as páginas.
 */
function logout() {
    sessionStorage.clear();
    window.location.href = '../index.html';
}


// ===========================================================================
//  FORMULÁRIO DE LOGIN (index.html)
// ===========================================================================

const formLogin = document.getElementById('formLogin');
if (formLogin) {
    formLogin.addEventListener('submit', function (e) {
        e.preventDefault();

        const email = document.getElementById('email').value.trim();
        const senha = document.getElementById('senha').value;
        const msg   = document.getElementById('mensagemErro');

        // Desabilita o botão para evitar múltiplos envios
        const botao = formLogin.querySelector('button[type="submit"]');
        botao.disabled = true;
        botao.textContent = 'Entrando...';

        fetch(`${API_URL_AUTH}/login`, {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ email, senha })
        })
        .then(async response => {
            const data = await response.json();
            if (!response.ok) throw new Error(data.detail || 'Erro ao fazer login.');
            return data;
        })
        .then(data => {
            msg.textContent  = 'Login efetuado com sucesso! Redirecionando...';
            msg.style.color  = '#2e7d32';

            // CORREÇÃO: Salva os dados do usuário na sessão antes de redirecionar.
            // Sem isso, todas as chamadas a verificarAutenticacao() nas páginas
            // internas falham e o usuário é imediatamente devolvido ao login.
            salvarSessao(data.usuario);

            // Aguarda 1 segundo para o usuário ler a mensagem, depois redireciona
            setTimeout(() => {
                window.location.href = 'pages/dashboard.html';
            }, 1000);
        })
        .catch(error => {
            msg.textContent = error.message;
            msg.style.color = '#d32f2f';
            botao.disabled     = false;
            botao.textContent  = 'Entrar';
        });
    });
}


// ===========================================================================
//  FORMULÁRIO DE CADASTRO (register.html)
// ===========================================================================

const formCadastro = document.getElementById('formCadastro');
if (formCadastro) {
    formCadastro.addEventListener('submit', function (e) {
        e.preventDefault();

        const nome      = document.getElementById('nomeCompleto').value.trim();
        const email     = document.getElementById('emailCadastro').value.trim();
        const senha     = document.getElementById('senhaCadastro').value;
        const confirmar = document.getElementById('confirmarSenha').value;
        const msg       = document.getElementById('mensagemCadastro');

        // Validação de senha no front-end antes de enviar
        if (senha !== confirmar) {
            msg.textContent = 'As senhas não coincidem.';
            msg.style.color = '#d32f2f';
            return;
        }

        const botao = formCadastro.querySelector('button[type="submit"]');
        botao.disabled    = true;
        botao.textContent = 'Cadastrando...';

        fetch(`${API_URL_AUTH}/register`, {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ nome, email, senha })
        })
        .then(async response => {
            const data = await response.json();
            if (!response.ok) throw new Error(data.detail || 'Erro ao cadastrar.');
            return data;
        })
        .then(() => {
            msg.textContent = 'Cadastro realizado! Redirecionando para o login...';
            msg.style.color = '#2e7d32';
            setTimeout(() => window.location.href = 'index.html', 1500);
        })
        .catch(error => {
            msg.textContent  = error.message;
            msg.style.color  = '#d32f2f';
            botao.disabled    = false;
            botao.textContent = 'Cadastrar';
        });
    });
}
