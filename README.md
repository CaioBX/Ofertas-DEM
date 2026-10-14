# Painel de Oferta Docente · DEM/UFC

Painel do Departamento de Engenharia Mecânica (DEM) da UFC com as turmas ofertadas, a carga horária e os docentes de cada semestre, de 2021.1 a 2025.2, para todos os cursos atendidos (graduações e mestrado).

É um site estático: HTML, CSS e JavaScript, sem servidor e sem dependências. Funciona no GitHub Pages e também abrindo o `index.html` direto no navegador.

## O que tem no painel

- Indicadores: turmas ofertadas, carga horária docente, docentes, disciplinas distintas e cursos atendidos.
- Evolução por semestre, em turmas ou em carga horária, separando graduação e mestrado.
- Carga horária por docente e turmas por curso atendido (clique numa barra para filtrar).
- Disciplinas mais ofertadas.
- Mapa de carga horária docente × semestre.
- Transição do PPC antigo para o novo em Engenharia Mecânica, com a divisão entre obrigatórias e optativas.
- Tabela com todas as turmas, com busca, ordenação e download em CSV.
- Notas sobre como os números são contados e pontos a conferir na planilha.
- Filtros por período, semestre (1º ou 2º), curso atendido, docente, disciplina, nível, PPC (novo ou antigo) e natureza (obrigatória ou optativa). PPC e natureza existem só para as turmas de Engenharia Mecânica.
- Tema claro e escuro.

## Estrutura

```
index.html              página do painel
assets/estilo.css       visual
assets/painel.js        gráficos, filtros e tabela
dados/Planilha_PAIP.csv planilha original exportada em CSV (não é alterada)
dados/dados.js          dados tratados que o painel lê (gerado pelo script)
scripts/gerar_dados.py  tratamento da planilha
```

## Publicar no GitHub Pages

1. Crie um repositório no GitHub e envie todos os arquivos desta pasta.
2. No repositório, abra **Settings → Pages**.
3. Em **Build and deployment**, escolha **Deploy from a branch**, a branch `main` e a pasta `/ (root)`. Salve.
4. Em um ou dois minutos o painel fica disponível em `https://SEU-USUARIO.github.io/NOME-DO-REPOSITORIO/`.

## Atualizar a cada semestre

1. No Google Sheets, abra a planilha e use **Arquivo → Fazer download → Valores separados por vírgula (.csv)**.
2. Salve o arquivo como `dados/Planilha_PAIP.csv`, substituindo o anterior. Mantenha as mesmas colunas: `CURSO, Ano, Semestre, Disciplina, Código, Professor, TURMA, CH, Natureza, PPC`.
3. Gere os dados do painel (precisa de Python 3, sem bibliotecas extras):

   ```
   python3 scripts/gerar_dados.py
   ```

4. Envie as mudanças para o GitHub (`git add . && git commit -m "Dados 2026.1" && git push`). O Pages republica sozinho.

Os semestres, cursos e docentes novos entram automaticamente nos filtros e gráficos.

## Como os dados são tratados

O script `scripts/gerar_dados.py` só lê o CSV. Ele:

- ignora as linhas "NENHUMA TURMA ENCONTRADA";
- separa turmas com dois docentes ("X (32h) e Y (32h)") em uma linha por docente, com a carga indicada para cada um;
- junta a mesma turma quando ela aparece na lista de mais de um curso, guardando a lista de cursos atendidos;
- padroniza nomes de docentes e disciplinas (maiúsculas, acentos e quebras de linha) e corrige um nome truncado;
- preenche disciplina, natureza e PPC vazios a partir de outra linha com o mesmo código, quando existe;
- lista no painel os pontos que precisam de conferência manual na planilha.

Para corrigir um nome ou acento novo, edite os dicionários `CORRECAO_DOCENTE` e `CORRECAO_PALAVRA` no início do script.

## Personalizar

No início de `assets/painel.js`, o bloco `CONFIG` define o texto acima do título (por exemplo, o nome do departamento), o rodapé e o semestre marcado como início do PPC novo.
