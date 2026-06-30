/**
 * usuarios.js — Módulo de Gerenciamento de Usuários da Biblioteca
 */

// AJUSTE A PORTA AQUI (8080 para Java ou 8000 para Python)
const API_URL_USUARIOS = 'http://localhost:8000/api/usuarios';

// Executa automaticamente ao carregar a página
document.addEventListener('DOMContentLoaded', () => {
    verificarAutenticacao();
    exibirUsuarioNoMenu();
    carregarTabelaUsuarios();
    configurarFormUsuario();
});

// ===========================================================================
//  1. LISTAR USUÁRIOS
// ===========================================================================

function carregarTabelaUsuarios() {
    const tbody = document.getElementById('tabelaUsuarios');
    if (!tbody) return;

    tbody.innerHTML = `
        <tr>
            <td colspan="6" style="text-align:center; padding:20px; color:#666;">
                Carregando usuários...
            </td>
        </tr>`;

    fetch(API_URL_USUARIOS)
        .then(res => {
            if (!res.ok) throw new Error('Falha ao comunicar com o servidor.');
            return res.json();
        })
        .then(usuarios => {
            tbody.innerHTML = '';

            if (usuarios.length === 0) {
                tbody.innerHTML = `
                    <tr>
                        <td colspan="6" style="text-align:center; padding:20px; color:#666;">
                            Nenhum usuário cadastrado.
                        </td>
                    </tr>`;
                return;
            }

            usuarios.forEach(u => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>${u.id}</td>
                    <td>${u.nome}</td>
                    <td>${u.email}</td>
                    <td>${u.tipo}</td>
                    <td>${u.ativo ? '✅ Sim' : '❌ Não'}</td>
                    <td class="acoes">
                        <button class="btn-editar" onclick="editarUsuario(${u.id})">Editar</button>
                        <button class="btn-excluir" onclick="excluirUsuario(${u.id}, '${u.nome.replace(/'/g, "\\'")}')">Excluir</button>
                    </td>
                `;
                tbody.appendChild(tr);
            });
        })
        .catch(err => {
            tbody.innerHTML = `
                <tr>
                    <td colspan="6" style="text-align:center; padding:20px; color:#c62828;">
                        Erro ao carregar usuários: ${err.message}
                    </td>
                </tr>`;
        });
}

// ===========================================================================
//  2. FORMULÁRIO — CRIAR E EDITAR USUÁRIO
// ===========================================================================

function configurarFormUsuario() {
    const formUsuario = document.getElementById('formUsuario');
    if (!formUsuario) return;

    formUsuario.addEventListener('submit', function (e) {
        e.preventDefault();

        const id    = document.getElementById('usuarioId').value;
        const nome  = document.getElementById('nome').value.trim();
        const email = document.getElementById('email').value.trim();
        const tipo  = document.getElementById('tipo').value;
        const ativo = document.getElementById('ativo').checked;

        const payload = { nome, email, tipo, ativo };
        const metodo  = id ? 'PUT' : 'POST';
        const url     = id ? `${API_URL_USUARIOS}/${id}` : API_URL_USUARIOS;

        const botao = formUsuario.querySelector('button[type="submit"]');
        botao.disabled    = true;
        botao.textContent = 'Salvando...';

        fetch(url, {
            method:  metodo,
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify(payload)
        })
        .then(async res => {
            const data = await res.json();
            if (!res.ok) throw new Error(data.detail || 'Erro ao salvar usuário.');
            return data;
        })
        .then(() => {
            fecharFormUsuario();
            carregarTabelaUsuarios();
        })
        .catch(err => alert('Erro: ' + err.message))
        .finally(() => {
            botao.disabled    = false;
            botao.textContent = 'Salvar';
        });
    });
}

function editarUsuario(id) {
    fetch(`${API_URL_USUARIOS}/${id}`)
        .then(res => {
            if (!res.ok) throw new Error('Usuário não encontrado.');
            return res.json();
        })
        .then(usuario => {
            document.getElementById('usuarioId').value  = usuario.id;
            document.getElementById('nome').value       = usuario.nome;
            document.getElementById('email').value      = usuario.email;
            document.getElementById('tipo').value       = usuario.tipo;
            document.getElementById('ativo').checked    = usuario.ativo;
            document.getElementById('formUsuarioTitulo').textContent = 'Editar Usuário';
            document.getElementById('formUsuarioContainer').style.display = 'block';
        })
        .catch(err => alert('Erro ao carregar usuário: ' + err.message));
}

function excluirUsuario(id, nome) {
    if (!confirm(`Deseja realmente excluir o usuário "${nome}"?`)) return;

    fetch(`${API_URL_USUARIOS}/${id}`, { method: 'DELETE' })
        .then(async res => {
            const data = await res.json();
            if (!res.ok) throw new Error(data.detail || 'Erro ao excluir.');
            return data;
        })
        .then(() => carregarTabelaUsuarios())
        .catch(err => alert('Erro: ' + err.message));
}

// ===========================================================================
//  3. CONTROLE DE VISIBILIDADE DO FORMULÁRIO
// ===========================================================================

function abrirFormUsuario() {
    document.getElementById('formUsuarioContainer').style.display = 'block';
    document.getElementById('formUsuarioTitulo').textContent      = 'Cadastrar Usuário';
    document.getElementById('formUsuario').reset();
    document.getElementById('usuarioId').value = '';
    document.getElementById('ativo').checked   = true;
}

function fecharFormUsuario() {
    document.getElementById('formUsuarioContainer').style.display = 'none';
}