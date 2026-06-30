"""
=============================================================================
  ACERVO TECH DIGITAL — Back-end com MySQL
  Tecnologia: FastAPI + MySQL (pymysql)
  Credenciais: root / 12345678
=============================================================================
"""

import hashlib
import pymysql
from datetime import date, datetime, timedelta
from fastapi import FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel, field_validator
from typing import Optional
import os

# ---------------------------------------------------------------------------
# CONFIGURAÇÕES DO BANCO DE DADOS (ALTERADO PARA SUAS CREDENCIAIS)
# ---------------------------------------------------------------------------
DB_CONFIG = {
    "host": "localhost",
    "port": 3307,
    "user": "root",
    "password": "12345678",
    "database": "acervotech",
    "charset": "utf8mb4",
    "cursorclass": pymysql.cursors.DictCursor
}

# ---------------------------------------------------------------------------
# Instância principal do FastAPI e CORS
# ---------------------------------------------------------------------------
app = FastAPI(
    title="Acervo Tech Digital",
    description="API de gerenciamento de biblioteca digital com MySQL",
    version="2.1.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ===========================================================================
#  UTILITÁRIOS
# ===========================================================================

def hash_senha(senha: str) -> str:
    """Gera hash SHA-256 da senha."""
    return hashlib.sha256(senha.encode()).hexdigest()


def obter_conexao():
    """
    Cria e retorna uma conexão com o banco MySQL.
    """
    conn = pymysql.connect(**DB_CONFIG)
    return conn


# ===========================================================================
#  INICIALIZAÇÃO DO BANCO DE DADOS (cria tabelas se não existirem)
# ===========================================================================

def inicializar_banco():
    """Cria todas as tabelas necessárias, se não existirem."""
    conn = obter_conexao()
    cursor = conn.cursor()

    # Tabela de administradores
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS admins (
            id     INT PRIMARY KEY AUTO_INCREMENT,
            nome   VARCHAR(100) NOT NULL,
            email  VARCHAR(100) UNIQUE NOT NULL,
            senha  VARCHAR(64) NOT NULL
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    """)

    # Tabela de livros (com campos de lixeira)
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS livros (
            id              INT PRIMARY KEY AUTO_INCREMENT,
            titulo          VARCHAR(200) NOT NULL,
            autor           VARCHAR(100) NOT NULL,
            isbn            VARCHAR(20),
            genero          VARCHAR(50),
            exemplares      INT DEFAULT 1,
            disponiveis     INT DEFAULT 1,
            ativo           BOOLEAN DEFAULT TRUE,
            data_inativacao DATE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    """)

    # Tabela de usuários da biblioteca
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS usuarios_biblio (
            id    INT PRIMARY KEY AUTO_INCREMENT,
            nome  VARCHAR(100) NOT NULL,
            email VARCHAR(100) UNIQUE NOT NULL,
            tipo  VARCHAR(20) NOT NULL DEFAULT 'Aluno',
            ativo BOOLEAN DEFAULT TRUE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    """)

    # Tabela de empréstimos
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS emprestimos (
            id                      INT PRIMARY KEY AUTO_INCREMENT,
            id_livro                INT NOT NULL,
            id_usuario              INT NOT NULL,
            data_emprestimo         DATE NOT NULL,
            data_devolucao_prevista DATE NOT NULL,
            data_devolucao_real     DATE,
            status                  VARCHAR(20) NOT NULL DEFAULT 'ativo',
            FOREIGN KEY (id_livro)   REFERENCES livros(id) ON DELETE RESTRICT,
            FOREIGN KEY (id_usuario) REFERENCES usuarios_biblio(id) ON DELETE RESTRICT
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    """)

    conn.commit()
    conn.close()
    print("✅ Tabelas verificadas/criadas com sucesso no MySQL!")


# Executa a inicialização ao subir a aplicação
inicializar_banco()


# ===========================================================================
#  MODELOS DE DADOS (Pydantic)
# ===========================================================================

class ModeloCadastroAdmin(BaseModel):
    nome:  str
    email: str
    senha: str

class ModeloLogin(BaseModel):
    email: str
    senha: str

class ModeloLivro(BaseModel):
    titulo:     str
    autor:      str
    isbn:       Optional[str] = None
    genero:     Optional[str] = None
    exemplares: int = 1

    @field_validator("exemplares")
    @classmethod
    def exemplares_positivos(cls, v: int) -> int:
        if v < 1:
            raise ValueError("A quantidade de exemplares deve ser pelo menos 1.")
        return v

class ModeloUsuarioBiblio(BaseModel):
    nome:  str
    email: str
    tipo:  str = "Aluno"
    ativo: bool = True

class ModeloEmprestimo(BaseModel):
    id_livro:               int
    id_usuario:             int
    data_devolucao_prevista: str

    @field_validator("data_devolucao_prevista")
    @classmethod
    def validar_data_futura(cls, v: str) -> str:
        try:
            data = datetime.strptime(v, "%Y-%m-%d").date()
        except ValueError:
            raise ValueError("Data deve estar no formato YYYY-MM-DD.")
        if data < date.today():
            raise ValueError("A data de devolução prevista não pode ser anterior a hoje.")
        return v


# ===========================================================================
#  ROTAS — AUTENTICAÇÃO
# ===========================================================================

@app.post("/api/auth/register", status_code=status.HTTP_201_CREATED,
          summary="Cadastrar administrador")
def cadastrar_admin(dados: ModeloCadastroAdmin):
    conn = obter_conexao()
    cursor = conn.cursor()
    try:
        cursor.execute(
            "INSERT INTO admins (nome, email, senha) VALUES (%s, %s, %s)",
            (dados.nome, dados.email, hash_senha(dados.senha))
        )
        conn.commit()
        return {"message": "Administrador cadastrado com sucesso!"}
    except pymysql.IntegrityError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Este e-mail já está cadastrado."
        )
    finally:
        conn.close()


@app.post("/api/auth/login", summary="Login de administrador")
def login_admin(dados: ModeloLogin):
    conn = obter_conexao()
    cursor = conn.cursor()
    cursor.execute(
        "SELECT id, nome, email FROM admins WHERE email = %s AND senha = %s",
        (dados.email, hash_senha(dados.senha))
    )
    admin = cursor.fetchone()
    conn.close()

    if admin:
        return {
            "message": "Login efetuado com sucesso!",
            "usuario": {
                "id":    admin["id"],
                "nome":  admin["nome"],
                "email": admin["email"]
            }
        }
    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="E-mail ou senha incorretos."
    )


# ===========================================================================
#  ROTAS — LIVROS
# ===========================================================================

@app.post("/api/livros", status_code=status.HTTP_201_CREATED,
          summary="Cadastrar livro")
def cadastrar_livro(livro: ModeloLivro):
    conn = obter_conexao()
    cursor = conn.cursor()
    try:
        cursor.execute(
            """INSERT INTO livros (titulo, autor, isbn, genero, exemplares, disponiveis)
               VALUES (%s, %s, %s, %s, %s, %s)""",
            (livro.titulo, livro.autor, livro.isbn,
             livro.genero, livro.exemplares, livro.exemplares)
        )
        conn.commit()
        novo_id = cursor.lastrowid
        return {"message": "Livro cadastrado com sucesso!", "id": novo_id}
    except Exception as erro:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erro ao salvar livro: {str(erro)}"
        )
    finally:
        conn.close()


@app.get("/api/livros", summary="Listar livros ativos")
def listar_livros():
    conn = obter_conexao()
    cursor = conn.cursor()
    cursor.execute(
        "SELECT id, titulo, autor, isbn, genero, exemplares, disponiveis "
        "FROM livros WHERE ativo = 1 ORDER BY titulo"
    )
    linhas = cursor.fetchall()
    conn.close()
    return linhas


@app.get("/api/livros/lixeira", summary="Listar livros na lixeira")
def listar_livros_lixeira():
    conn = obter_conexao()
    cursor = conn.cursor()
    cursor.execute(
        "SELECT id, titulo, autor, isbn, genero, exemplares, disponiveis, data_inativacao "
        "FROM livros WHERE ativo = 0 ORDER BY data_inativacao DESC"
    )
    linhas = cursor.fetchall()
    conn.close()
    return linhas


@app.get("/api/livros/{livro_id}", summary="Buscar livro por ID")
def buscar_livro(livro_id: int):
    conn = obter_conexao()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM livros WHERE id = %s", (livro_id,))
    livro = cursor.fetchone()
    conn.close()
    if not livro:
        raise HTTPException(status_code=404, detail="Livro não encontrado.")
    return livro


@app.put("/api/livros/{livro_id}", summary="Atualizar livro")
def atualizar_livro(livro_id: int, livro: ModeloLivro):
    conn = obter_conexao()
    cursor = conn.cursor()
    cursor.execute("SELECT exemplares, disponiveis FROM livros WHERE id = %s", (livro_id,))
    livro_atual = cursor.fetchone()
    if not livro_atual:
        conn.close()
        raise HTTPException(status_code=404, detail="Livro não encontrado.")

    variacao = livro.exemplares - livro_atual["exemplares"]
    novos_disponiveis = livro_atual["disponiveis"] + variacao
    if novos_disponiveis < 0:
        conn.close()
        raise HTTPException(
            status_code=400,
            detail="Não é possível reduzir os exemplares abaixo da quantidade emprestada."
        )

    try:
        cursor.execute(
            """UPDATE livros
               SET titulo = %s, autor = %s, isbn = %s, genero = %s, exemplares = %s, disponiveis = %s
               WHERE id = %s""",
            (livro.titulo, livro.autor, livro.isbn, livro.genero,
             livro.exemplares, novos_disponiveis, livro_id)
        )
        conn.commit()
        return {"message": "Livro atualizado com sucesso!"}
    except Exception as erro:
        raise HTTPException(status_code=500, detail=f"Erro ao atualizar: {str(erro)}")
    finally:
        conn.close()


@app.delete("/api/livros/{livro_id}", summary="Mover para lixeira")
def mover_para_lixeira(livro_id: int):
    conn = obter_conexao()
    cursor = conn.cursor()
    cursor.execute("SELECT ativo FROM livros WHERE id = %s", (livro_id,))
    livro = cursor.fetchone()
    if not livro:
        conn.close()
        raise HTTPException(status_code=404, detail="Livro não encontrado.")
    if not livro["ativo"]:
        conn.close()
        raise HTTPException(status_code=400, detail="Livro já está na lixeira.")

    cursor.execute("SELECT id FROM emprestimos WHERE id_livro = %s AND status = 'ativo'", (livro_id,))
    if cursor.fetchone():
        conn.close()
        raise HTTPException(
            status_code=400,
            detail="Existem empréstimos ativos para este livro."
        )

    data_atual = date.today().isoformat()
    cursor.execute(
        "UPDATE livros SET ativo = 0, data_inativacao = %s WHERE id = %s",
        (data_atual, livro_id)
    )
    conn.commit()
    conn.close()
    return {"message": "Livro movido para a lixeira."}


@app.put("/api/livros/{livro_id}/restaurar", summary="Restaurar livro")
def restaurar_livro(livro_id: int):
    conn = obter_conexao()
    cursor = conn.cursor()
    cursor.execute("SELECT ativo FROM livros WHERE id = %s", (livro_id,))
    livro = cursor.fetchone()
    if not livro:
        conn.close()
        raise HTTPException(status_code=404, detail="Livro não encontrado.")
    if livro["ativo"]:
        conn.close()
        raise HTTPException(status_code=400, detail="Livro já está ativo.")

    cursor.execute(
        "UPDATE livros SET ativo = 1, data_inativacao = NULL WHERE id = %s",
        (livro_id,)
    )
    conn.commit()
    conn.close()
    return {"message": "Livro restaurado com sucesso!"}


@app.delete("/api/livros/limpeza-definitiva", summary="Limpar lixeira")
def limpeza_definitiva():
    conn = obter_conexao()
    cursor = conn.cursor()
    cinco_anos_atras = (date.today() - timedelta(days=1825)).isoformat()
    cursor.execute(
        "DELETE FROM livros WHERE ativo = 0 AND data_inativacao <= %s",
        (cinco_anos_atras,)
    )
    conn.commit()
    conn.close()
    return {"message": "Limpeza concluída!"}


# ===========================================================================
#  ROTAS — USUÁRIOS
# ===========================================================================

@app.post("/api/usuarios", status_code=status.HTTP_201_CREATED,
          summary="Cadastrar usuário")
def cadastrar_usuario_biblio(usuario: ModeloUsuarioBiblio):
    conn = obter_conexao()
    cursor = conn.cursor()
    try:
        cursor.execute(
            "INSERT INTO usuarios_biblio (nome, email, tipo, ativo) VALUES (%s, %s, %s, %s)",
            (usuario.nome, usuario.email, usuario.tipo, int(usuario.ativo))
        )
        conn.commit()
        return {"message": "Usuário cadastrado com sucesso!", "id": cursor.lastrowid}
    except pymysql.IntegrityError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Este e-mail já está cadastrado."
        )
    finally:
        conn.close()


@app.get("/api/usuarios", summary="Listar usuários")
def listar_usuarios():
    conn = obter_conexao()
    cursor = conn.cursor()
    cursor.execute("SELECT id, nome, email, tipo, ativo FROM usuarios_biblio ORDER BY nome")
    linhas = cursor.fetchall()
    conn.close()
    # Converter ativo para booleano
    for u in linhas:
        u["ativo"] = bool(u["ativo"])
    return linhas


@app.put("/api/usuarios/{usuario_id}", summary="Atualizar usuário")
def atualizar_usuario_biblio(usuario_id: int, usuario: ModeloUsuarioBiblio):
    conn = obter_conexao()
    cursor = conn.cursor()
    cursor.execute("SELECT id FROM usuarios_biblio WHERE id = %s", (usuario_id,))
    if not cursor.fetchone():
        conn.close()
        raise HTTPException(status_code=404, detail="Usuário não encontrado.")
    cursor.execute(
        "UPDATE usuarios_biblio SET nome=%s, email=%s, tipo=%s, ativo=%s WHERE id=%s",
        (usuario.nome, usuario.email, usuario.tipo, int(usuario.ativo), usuario_id)
    )
    conn.commit()
    conn.close()
    return {"message": "Usuário atualizado com sucesso!"}


@app.delete("/api/usuarios/{usuario_id}", summary="Excluir usuário")
def excluir_usuario_biblio(usuario_id: int):
    conn = obter_conexao()
    cursor = conn.cursor()
    cursor.execute("SELECT id FROM usuarios_biblio WHERE id = %s", (usuario_id,))
    if not cursor.fetchone():
        conn.close()
        raise HTTPException(status_code=404, detail="Usuário não encontrado.")
    cursor.execute(
        "SELECT id FROM emprestimos WHERE id_usuario = %s AND status = 'ativo'",
        (usuario_id,)
    )
    if cursor.fetchone():
        conn.close()
        raise HTTPException(
            status_code=400,
            detail="Usuário possui empréstimos ativos."
        )
    cursor.execute("DELETE FROM usuarios_biblio WHERE id = %s", (usuario_id,))
    conn.commit()
    conn.close()
    return {"message": "Usuário excluído com sucesso!"}


# ===========================================================================
#  ROTAS — EMPRÉSTIMOS E DEVOLUÇÕES
# ===========================================================================

@app.post("/api/emprestimos", status_code=status.HTTP_201_CREATED,
          summary="Registrar empréstimo")
def registrar_emprestimo(dados: ModeloEmprestimo):
    conn = obter_conexao()
    cursor = conn.cursor()

    cursor.execute("SELECT disponiveis FROM livros WHERE id = %s AND ativo = 1", (dados.id_livro,))
    livro = cursor.fetchone()
    if not livro:
        conn.close()
        raise HTTPException(status_code=404, detail="Livro não encontrado ou inativo.")
    if livro["disponiveis"] <= 0:
        conn.close()
        raise HTTPException(status_code=400, detail="Nenhum exemplar disponível.")

    cursor.execute("SELECT ativo FROM usuarios_biblio WHERE id = %s", (dados.id_usuario,))
    usuario = cursor.fetchone()
    if not usuario or not usuario["ativo"]:
        conn.close()
        raise HTTPException(status_code=400, detail="Usuário inativo ou não encontrado.")

    hoje = date.today().isoformat()
    cursor.execute(
        """INSERT INTO emprestimos
               (id_livro, id_usuario, data_emprestimo, data_devolucao_prevista, status)
           VALUES (%s, %s, %s, %s, 'ativo')""",
        (dados.id_livro, dados.id_usuario, hoje, dados.data_devolucao_prevista)
    )
    cursor.execute(
        "UPDATE livros SET disponiveis = disponiveis - 1 WHERE id = %s",
        (dados.id_livro,)
    )
    conn.commit()
    novo_id = cursor.lastrowid
    conn.close()
    return {"message": "Empréstimo registrado com sucesso!", "id": novo_id}


@app.get("/api/emprestimos", summary="Listar empréstimos")
def listar_emprestimos(status_filtro: Optional[str] = None):
    conn = obter_conexao()
    cursor = conn.cursor()
    sql = """
        SELECT e.id,
               e.id_livro,
               l.titulo          AS titulo_livro,
               e.id_usuario,
               u.nome            AS nome_usuario,
               e.data_emprestimo,
               e.data_devolucao_prevista,
               e.data_devolucao_real,
               e.status
          FROM emprestimos e
          JOIN livros            l ON l.id = e.id_livro
          JOIN usuarios_biblio   u ON u.id = e.id_usuario
    """
    if status_filtro:
        cursor.execute(sql + " WHERE e.status = %s ORDER BY e.id DESC", (status_filtro,))
    else:
        cursor.execute(sql + " ORDER BY e.id DESC")
    linhas = cursor.fetchall()
    conn.close()
    return linhas


@app.post("/api/emprestimos/{emprestimo_id}/devolver",
          summary="Registrar devolução")
def registrar_devolucao(emprestimo_id: int):
    conn = obter_conexao()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM emprestimos WHERE id = %s", (emprestimo_id,))
    emprestimo = cursor.fetchone()
    if not emprestimo:
        conn.close()
        raise HTTPException(status_code=404, detail="Empréstimo não encontrado.")
    if emprestimo["status"] == "finalizado":
        conn.close()
        raise HTTPException(status_code=400, detail="Empréstimo já finalizado.")

    hoje = date.today()
    previsao = datetime.strptime(emprestimo["data_devolucao_prevista"], "%Y-%m-%d").date()
    dias_atraso = max(0, (hoje - previsao).days)
    multa = round(dias_atraso * 2.00, 2)

    cursor.execute(
        "UPDATE emprestimos SET status = 'finalizado', data_devolucao_real = %s WHERE id = %s",
        (hoje.isoformat(), emprestimo_id)
    )
    cursor.execute(
        "UPDATE livros SET disponiveis = LEAST(disponiveis + 1, exemplares) WHERE id = %s",
        (emprestimo["id_livro"],)
    )
    conn.commit()
    conn.close()

    return {
        "message": "Devolução registrada com sucesso!",
        "dias_atraso": dias_atraso,
        "multa": multa
    }


# ===========================================================================
#  ROTA — DASHBOARD
# ===========================================================================

@app.get("/api/dashboard", summary="Estatísticas")
def obter_estatisticas():
    conn = obter_conexao()
    cursor = conn.cursor()
    cursor.execute("SELECT COUNT(*) AS total FROM livros WHERE ativo = 1")
    total_livros = cursor.fetchone()["total"]
    cursor.execute("SELECT COUNT(*) AS total FROM usuarios_biblio WHERE ativo = 1")
    total_usuarios = cursor.fetchone()["total"]
    cursor.execute("SELECT COUNT(*) AS total FROM emprestimos WHERE status = 'ativo'")
    total_emprestimos = cursor.fetchone()["total"]
    cursor.execute("SELECT COUNT(*) AS total FROM livros WHERE ativo = 1 AND disponiveis = 0")
    total_indisponiveis = cursor.fetchone()["total"]
    conn.close()
    return {
        "total_livros": total_livros,
        "total_usuarios": total_usuarios,
        "total_emprestimos": total_emprestimos,
        "total_indisponiveis": total_indisponiveis
    }


# ===========================================================================
#  QR CODE
# ===========================================================================

import qrcode
from io import BytesIO
from fastapi.responses import StreamingResponse

@app.get("/api/qrcode/livro/{livro_id}", summary="QR Code do livro")
def gerar_qrcode_livro(livro_id: int):
    conn = obter_conexao()
    cursor = conn.cursor()
    cursor.execute("SELECT id, titulo, autor, isbn FROM livros WHERE id = %s", (livro_id,))
    livro = cursor.fetchone()
    conn.close()
    if not livro:
        raise HTTPException(status_code=404, detail="Livro não encontrado.")
    dados_qr = f"Livro: {livro['titulo']} | Autor: {livro['autor']} | ISBN: {livro['isbn'] or 'N/A'}"
    qr = qrcode.QRCode(version=1, error_correction=qrcode.constants.ERROR_CORRECT_L, box_size=10, border=4)
    qr.add_data(dados_qr)
    qr.make(fit=True)
    img = qr.make_image(fill_color="black", back_color="white")
    buffer = BytesIO()
    img.save(buffer, format="PNG")
    buffer.seek(0)
    return StreamingResponse(buffer, media_type="image/png", headers={
        "Content-Disposition": f"inline; filename=qr_livro_{livro_id}.png"
    })

@app.get("/api/qrcode/usuario/{usuario_id}", summary="QR Code do usuário")
def gerar_qrcode_usuario(usuario_id: int):
    conn = obter_conexao()
    cursor = conn.cursor()
    cursor.execute("SELECT id, nome, email, tipo FROM usuarios_biblio WHERE id = %s", (usuario_id,))
    usuario = cursor.fetchone()
    conn.close()
    if not usuario:
        raise HTTPException(status_code=404, detail="Usuário não encontrado.")
    dados_qr = f"Usuário: {usuario['nome']} | E-mail: {usuario['email']} | Tipo: {usuario['tipo']}"
    qr = qrcode.QRCode(version=1, error_correction=qrcode.constants.ERROR_CORRECT_L, box_size=10, border=4)
    qr.add_data(dados_qr)
    qr.make(fit=True)
    img = qr.make_image(fill_color="black", back_color="white")
    buffer = BytesIO()
    img.save(buffer, format="PNG")
    buffer.seek(0)
    return StreamingResponse(buffer, media_type="image/png", headers={
        "Content-Disposition": f"inline; filename=qr_usuario_{usuario_id}.png"
    })


# ===========================================================================
#  SERVIDOR DE ARQUIVOS ESTÁTICOS (front-end)
# ===========================================================================

app.mount("/css", StaticFiles(directory="css"), name="css")
app.mount("/js", StaticFiles(directory="js"), name="js")
app.mount("/pages", StaticFiles(directory="pages"), name="pages")

@app.get("/")
def servir_index():
    return FileResponse("index.html")


# ===========================================================================
#  EXECUÇÃO
# ===========================================================================

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)