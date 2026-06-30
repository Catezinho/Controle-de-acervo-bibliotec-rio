

const API_URL_EMP      = 'http://127.0.0.1:8000/api/emprestimos';
const API_URL_LIV_EMP  = 'http://127.0.0.1:8000/api/livros';
const API_URL_USU_EMP  = 'http://127.0.0.1:8000/api/usuarios';

// Executa ao carregar a página
document.addEventListener('DOMContentLoaded', () => {
    verificarAutenticacao();
    exibirUsuarioNoMenu();
    carregarTabelaEmprestimos();
    configurarFormEmprestimo();
});


// ===========================================================================
//  1. LISTAR EMPRÉSTIMOS
// ===========================================================================

/**
 * Busca a lista de empréstimos na API e popula a tabela HTML.
 */
function carregarTabelaEmprestimos() {
    const tbody = document.getElementById('tabelaEmprestimos');
    if (!tbody) return;

    tbody.innerHTML = `
        <tr>
            <td colspan="7" style="text-align:center; padding:20px; color:#666;">
                Carregando empréstimos...
            </td>
        </tr>`;

    fetch(API_URL_EMP)
        .then(res => {
            if (!res.ok) throw new Error('Falha ao comunicar com o servidor.');
            return res.json();
        })
        .then(emprestimos => {
            tbody.innerHTML = '';

            if (emprestimos.length === 0) {
                tbody.innerHTML = `
                    <tr>
                        <td colspan="7" style="text-align:center; padding:20px; color:#666;">
                            Nenhum empréstimo registrado.
                        </td>
                    </tr>`;
                return;
            }

            const hoje = new Date();
            hoje.setHours(0, 0, 0, 0);   // Zera hora para comparar apenas datas

            emprestimos.forEach(emp => {
                const previsao  = new Date(emp.data_devolucao_prevista + 'T00:00:00');
                const atrasado  = emp.status === 'ativo' && hoje > previsao;
                const classeStatus = emp.status === 'finalizado'
                    ? 'finalizado'
                    : (atrasado ? 'atrasado' : 'ativo');
                const textoStatus = emp.status === 'finalizado'
                    ? 'Devolvido'
                    : (atrasado ? 'Atrasado' : 'Em dia');

                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>${emp.id}</td>
                    <td>${emp.titulo_livro}</td>
                    <td>${emp.nome_usuario}</td>
                    <td>${emp.data_emprestimo}</td>
                    <td>${emp.data_devolucao_prevista}</td>
                    <td><span class="status ${classeStatus}">${textoStatus}</span></td>
                    <td>
                        ${emp.status === 'ativo'
                            ? `<button
                                onclick="prepararDevolucao(${emp.id})"
                                style="background:#f9a825; color:white; border:none;
                                       padding:5px 10px; border-radius:4px; cursor:pointer;">
                                   Devolver
                               </button>`
                            : `<span style="color:#666;">—</span>`
                        }
                    </td>
                `;
                tbody.appendChild(tr);
            });
        })
        .catch(err => {
            tbody.innerHTML = `
                <tr>
                    <td colspan="7" style="text-align:center; padding:20px; color:#c62828;">
                        Erro ao carregar empréstimos: ${err.message}
                    </td>
                </tr>`;
        });
}


// ===========================================================================
//  2. SELECTS DO FORMULÁRIO
// ===========================================================================

function carregarSelects() {
    const selLivro   = document.getElementById('idLivro');
    const selUsuario = document.getElementById('idUsuario');

    selLivro.innerHTML   = '<option value="">Carregando...</option>';
    selUsuario.innerHTML = '<option value="">Carregando...</option>';

    // Busca livros e usuários em paralelo
    Promise.all([
        fetch(API_URL_LIV_EMP).then(r => r.json()),
        fetch(API_URL_USU_EMP).then(r => r.json())
    ])
    .then(([livros, usuarios]) => {
        selLivro.innerHTML = '<option value="">Selecione o livro</option>';
        livros
            .filter(l => l.disponiveis > 0)  // Exibe apenas livros disponíveis
            .forEach(l => {
                const opt = document.createElement('option');
                opt.value       = l.id;
                opt.textContent = `${l.titulo} — ${l.autor} (${l.disponiveis} disp.)`;
                selLivro.appendChild(opt);
            });

        selUsuario.innerHTML = '<option value="">Selecione o usuário</option>';
        usuarios
            .filter(u => u.ativo)   // Exibe apenas usuários ativos
            .forEach(u => {
                const opt = document.createElement('option');
                opt.value       = u.id;
                opt.textContent = `${u.nome} (${u.tipo})`;
                selUsuario.appendChild(opt);
            });
    })
    .catch(err => {
        selLivro.innerHTML   = `<option value="">Erro: ${err.message}</option>`;
        selUsuario.innerHTML = `<option value="">Erro: ${err.message}</option>`;
    });
}


// ===========================================================================
//  3. REGISTRAR EMPRÉSTIMO
// ===========================================================================

function configurarFormEmprestimo() {
    const formEmprestimo = document.getElementById('formEmprestimo');
    if (!formEmprestimo) return;

    formEmprestimo.addEventListener('submit', function (e) {
        e.preventDefault();

        const idLivro    = parseInt(document.getElementById('idLivro').value);
        const idUsuario  = parseInt(document.getElementById('idUsuario').value);
        const dataDev    = document.getElementById('dataDevolucao').value;

        if (!idLivro || !idUsuario || !dataDev) {
            alert('Preencha todos os campos antes de registrar o empréstimo.');
            return;
        }

        const botao = formEmprestimo.querySelector('button[type="submit"]');
        botao.disabled    = true;
        botao.textContent = 'Registrando...';

        fetch(API_URL_EMP, {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({
                id_livro:                idLivro,
                id_usuario:              idUsuario,
                data_devolucao_prevista: dataDev
            })
        })
        .then(async res => {
            const data = await res.json();
            if (!res.ok) throw new Error(data.detail || 'Erro ao registrar empréstimo.');
            return data;
        })
        .then(() => {
            fecharFormEmprestimo();
            carregarTabelaEmprestimos();
        })
        .catch(err => alert('Erro: ' + err.message))
        .finally(() => {
            botao.disabled    = false;
            botao.textContent = 'Registrar';
        });
    });
}


// ===========================================================================
//  4. DEVOLUÇÃO (com cálculo de multa)
// ===========================================================================

/**
 * Registra a devolução de um empréstimo na API.
 * Exibe uma mensagem com a multa calculada pelo back-end.
 *
 * @param {number} id - ID do empréstimo a ser devolvido.
 */
function prepararDevolucao(id) {
    if (!confirm('Confirmar devolução deste empréstimo?')) return;

    fetch(`${API_URL_EMP}/${id}/devolver`, { method: 'POST' })
        .then(async res => {
            const data = await res.json();
            if (!res.ok) throw new Error(data.detail || 'Erro ao registrar devolução.');
            return data;
        })
        .then(data => {
            let mensagem = '✅ Devolução registrada com sucesso!';
            if (data.dias_atraso > 0) {
                mensagem += `\n\n⚠️ Atraso de ${data.dias_atraso} dia(s).\nMulta: R$ ${data.multa.toFixed(2)}`;
            } else {
                mensagem += '\n\nSem multa — entregue no prazo.';
            }
            alert(mensagem);
            carregarTabelaEmprestimos();
        })
        .catch(err => alert('Erro: ' + err.message));
}


// ===========================================================================
//  5. CONTROLE DE VISIBILIDADE DO FORMULÁRIO
// ===========================================================================


function abrirFormEmprestimo() {
    const container = document.getElementById('formEmprestimoContainer');
    if (!container) return;
    document.getElementById('formEmprestimo').reset();
    container.style.display = 'block';
    carregarSelects();   // Sempre recarrega para refletir disponibilidade atual
}

function fecharFormEmprestimo() {
    const container = document.getElementById('formEmprestimoContainer');
    if (container) container.style.display = 'none';
}
