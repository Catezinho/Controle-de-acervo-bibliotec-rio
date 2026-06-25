

// Adicione isso na LINHA 1 do arquivo (ajuste a porta se o seu backend não for 8080)
const API_URL_LIVROS = 'http://localhost:8000/api/livros'; 

// ===========================================================================
//  1. LISTAR LIVROS
// ===========================================================================
function carregarLivros() {
    // ... resto do seu código igual ...
    const tabelaBody = document.getElementById('tabelaLivrosBody');
    if (!tabelaBody) return;

    // Exibe mensagem de carregamento enquanto aguarda a API
    tabelaBody.innerHTML = `
        <tr>
            <td colspan="8" style="text-align:center; padding:20px; color:#666;">
                Carregando acervo...
            </td>
        </tr>`;

    fetch(API_URL_LIVROS)
        .then(response => {
            if (!response.ok) throw new Error('Falha ao comunicar com o servidor.');
            return response.json();
        })
        .then(livros => {
            tabelaBody.innerHTML = '';

            if (livros.length === 0) {
                tabelaBody.innerHTML = `
                    <tr>
                        <td colspan="8" style="text-align:center; padding:20px; color:#666;">
                            Nenhum livro cadastrado no acervo.
                        </td>
                    </tr>`;
                return;
            }

            livros.forEach(livro => {
                const statusDisp = livro.disponiveis > 0
                    ? `<span style="color:#2e7d32;">✅ Disponível</span>`
                    : `<span style="color:#c62828;">❌ Esgotado</span>`;

                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>${livro.id}</td>
                    <td><strong>${livro.titulo}</strong></td>
                    <td>${livro.autor}</td>
                    <td>${livro.isbn || '—'}</td>
                    <td>${livro.genero || 'Geral'}</td>
                    <td>${livro.exemplares}</td>
                    <td>${statusDisp}</td>
                    <td>
                        <button
                            onclick="editarLivro(${livro.id})"
                            style="background:#1e3a8a; color:white; border:none;
                                   padding:5px 10px; border-radius:4px;
                                   margin-right:5px; cursor:pointer;"
                            title="Editar livro">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button
                            onclick="excluirLivro(${livro.id}, '${livro.titulo.replace(/'/g, "\\'")}')"
                            style="background:#d32f2f; color:white; border:none;
                                   padding:5px 10px; border-radius:4px; cursor:pointer;"
                            title="Excluir livro">
                            <i class="fas fa-trash"></i>
                        </button>
                    </td>
                `;
                tabelaBody.appendChild(tr);
            });
        })
        .catch(error => {
            tabelaBody.innerHTML = `
                <tr>
                    <td colspan="8" style="text-align:center; padding:20px; color:#c62828;">
                        Erro ao carregar livros: ${error.message}
                    </td>
                </tr>`;
        });

    }

// ===========================================================================
//  2. FORMULÁRIO — CRIAR E EDITAR LIVRO
// ===========================================================================


function configurarFormulario() {
    const formLivro = document.getElementById('formLivro');
    if (!formLivro) return;

    formLivro.addEventListener('submit', function (e) {
        e.preventDefault();

        const id        = document.getElementById('livroId').value;
        const titulo    = document.getElementById('titulo').value.trim();
        const autor     = document.getElementById('autor').value.trim();
        const isbn      = document.getElementById('isbn').value.trim();
        // CORREÇÃO: O front-end usava id 'categoria', mas o JS mapeava para 'genero'
        // no payload. Padronizado para usar o id 'genero' no HTML.
        const genero    = document.getElementById('genero').value.trim();
        const exemplares = parseInt(document.getElementById('exemplares').value) || 1;

        const dadosLivro = { titulo, autor, isbn, genero, exemplares };

        // Define método e URL com base em criação ou edição
        const metodo = id ? 'PUT' : 'POST';
        const url    = id ? `${API_URL_LIVROS}/${id}` : API_URL_LIVROS;

        const botao = formLivro.querySelector('button[type="submit"]');
        botao.disabled    = true;
        botao.textContent = 'Salvando...';

        fetch(url, {
            method:  metodo,
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify(dadosLivro)
        })
        .then(async response => {
            const data = await response.json();
            if (!response.ok) throw new Error(data.detail || 'Erro ao salvar o livro.');
            return data;
        })
        .then(() => {
            fecharFormLivro();
            carregarLivros();   // Recarrega a tabela com os dados atualizados
        })
        .catch(error => {
            alert('Erro: ' + error.message);
        })
        .finally(() => {
            botao.disabled    = false;
            botao.textContent = 'Salvar';
        });
    });
}

/**
 * Preenche o formulário com os dados do livro selecionado para edição.
 * Busca os dados diretamente da API para garantir que são os mais recentes.
 *
 * CORREÇÃO: Funcionalidade ausente no projeto original.
 *
 * @param {number} id - ID do livro a ser editado.
 */
function editarLivro(id) {
    fetch(`${API_URL_LIVROS}/${id}`)
        .then(response => {
            if (!response.ok) throw new Error('Livro não encontrado.');
            return response.json();
        })
        .then(livro => {
            // Preenche o campo oculto com o ID para que o submit saiba que é edição
            document.getElementById('livroId').value      = livro.id;
            document.getElementById('titulo').value       = livro.titulo;
            document.getElementById('autor').value        = livro.autor;
            document.getElementById('isbn').value         = livro.isbn || '';
            document.getElementById('genero').value       = livro.genero || '';
            document.getElementById('exemplares').value   = livro.exemplares;

            // Atualiza o título do formulário e o exibe
            document.getElementById('formLivroTitulo').textContent = 'Editar Livro';
            document.getElementById('formLivroContainer').style.display = 'block';

            // Rola a página até o formulário
            document.getElementById('formLivroContainer').scrollIntoView({ behavior: 'smooth' });
        })
        .catch(error => alert('Erro ao carregar livro: ' + error.message));
}

/**
 * Solicita confirmação e exclui um livro pelo seu ID.
 *
 * CORREÇÃO: Funcionalidade ausente no projeto original.
 *
 * @param {number} id     - ID do livro a ser excluído.
 * @param {string} titulo - Título do livro (exibido na confirmação).
 */
function excluirLivro(id, titulo) {
    if (!confirm(`Deseja realmente excluir o livro "${titulo}"?\nEsta ação não pode ser desfeita.`)) {
        return;
    }

    fetch(`${API_URL_LIVROS}/${id}`, { method: 'DELETE' })
        .then(async response => {
            const data = await response.json();
            if (!response.ok) throw new Error(data.detail || 'Erro ao excluir.');
            return data;
        })
        .then(() => {
            carregarLivros();   // Atualiza a tabela após exclusão
        })
        .catch(error => alert('Erro: ' + error.message));
}


// ... restante do seu código anterior ...

// ===========================================================================
//  3. CONTROLE DE VISIBILIDADE DO FORMULÁRIO
// ===========================================================================

/**
 * Abre o formulário de cadastro de livro em modo de criação (sem ID).
 */
function abrirFormLivro() {
    const container = document.getElementById('formLivroContainer');
    if (!container) return;

    const formLivro = document.getElementById('formLivro');
    if (formLivro) formLivro.reset();
    document.getElementById('livroId').value = '';
    document.getElementById('formLivroTitulo').textContent = 'Cadastrar Livro';

    container.style.display = 'block';
    container.scrollIntoView({ behavior: 'smooth' });
}

/**
 * Fecha e reseta o formulário de livro.
 */
function fecharFormLivro() {
    const container = document.getElementById('formLivroContainer');
    if (container) container.style.display = 'none';

    const formLivro = document.getElementById('formLivro');
    if (formLivro) formLivro.reset();
}

// COLE O CÓDIGO EXATAMENTE AQUI, NO FINAL DE TUDO:
document.addEventListener('DOMContentLoaded', () => {
    carregarLivros();
    configurarFormulario();
});
