# back-end/conexao_db.py

import sqlite3
import os
from pathlib import Path

# Define o caminho do banco de dados
# Vai subir um nível (sai da pasta back-end) e procura biblioteca.db
DB_PATH = Path(__file__).parent.parent / 'biblioteca.db'

def conectar():
    """
    Função que cria e retorna uma conexão com o banco de dados.
    Use sempre esta função para conectar ao banco.
    
    Exemplo de uso:
        conn = conectar()
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM usuarios")
        resultados = cursor.fetchall()
        conn.close()
    """
    try:
        # Verifica se o arquivo do banco existe
        if not DB_PATH.exists():
            print(f"⚠️ Banco de dados não encontrado em: {DB_PATH}")
            print("📌 Criando novo banco de dados...")
            
        # Conecta ao banco (cria se não existir)
        conn = sqlite3.connect(str(DB_PATH))
        
        # Isso permite acessar as colunas pelo nome (ex: usuario['nome'])
        conn.row_factory = sqlite3.Row
        
        print(f"✅ Conectado ao banco: {DB_PATH}")
        return conn
        
    except sqlite3.Error as erro:
        print(f"❌ Erro ao conectar ao banco: {erro}")
        return None

def testar_conexao():
    """Função para testar se a conexão está funcionando"""
    conn = conectar()
    if conn:
        print("✅ Conexão estabelecida com sucesso!")
        conn.close()
        return True
    else:
        print("❌ Falha na conexão")
        return False

# Se executar este arquivo diretamente, faz o teste
if __name__ == "__main__":
    testar_conexao()