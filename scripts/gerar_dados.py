#!/usr/bin/env python3
"""Gera dados/dados.js a partir da planilha exportada em CSV.

Uso:
    python3 scripts/gerar_dados.py                      # lê dados/Planilha_PAIP.csv
    python3 scripts/gerar_dados.py caminho/arquivo.csv  # lê outro CSV

A planilha original não é alterada: o script só lê o CSV e grava dados/dados.js,
que o painel carrega. Todo o tratamento fica aqui, documentado em cada etapa.
"""

import csv
import json
import re
import sys
import unicodedata
from collections import Counter, defaultdict
from datetime import datetime
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
ENTRADA = Path(sys.argv[1]) if len(sys.argv) > 1 else RAIZ / "dados" / "Planilha_PAIP.csv"
SAIDA = RAIZ / "dados" / "dados.js"

SEM_TURMA = "NENHUMA TURMA ENCONTRADA"

# Nomes curtos dos cursos, usados nos gráficos.
CURSO_CURTO = {
    "Engenharia Mecânica": "Mecânica",
    "Engenharia de Energias e Meio Ambiente": "Energias e Meio Ambiente",
    "Engenharia Produção Mecânica": "Produção Mecânica",
    "Engenharia Renováveis": "Energias Renováveis",
    "Engenharia Ambiental e Sanitária": "Ambiental e Sanitária",
    "Engenharia Elétrica": "Elétrica",
    "Engenharia de Telecomunicações": "Telecomunicações",
    "Engenharia de Computação": "Computação",
    "Mestrado": "Mestrado",
}

# Nomes de docentes que chegam incompletos na planilha.
CORRECAO_DOCENTE = {
    "ROBERTO DE ARAUJO BEZERR": "ROBERTO DE ARAUJO BEZERRA",
}

# Palavras de disciplinas que chegam sem acento.
CORRECAO_PALAVRA = {
    "SOLIDOS": "SÓLIDOS", "PNEUMATICOS": "PNEUMÁTICOS", "TERMICOS": "TÉRMICOS",
    "TERMICO": "TÉRMICO", "FABRICACAO": "FABRICAÇÃO", "VIBRACOES": "VIBRAÇÕES",
    "MONITORACAO": "MONITORAÇÃO", "TRANSFERENCIA": "TRANSFERÊNCIA", "GAS": "GÁS",
    "DIAGNOSTICO": "DIAGNÓSTICO", "AS": "ÀS",
}

MINUSCULAS = {"de", "da", "do", "das", "dos", "e", "em", "para", "por", "com",
              "a", "o", "à", "às", "ao", "aos", "na", "no"}
SIGLAS = {"I", "II", "III", "IV", "V", "EEMA"}


def capitalizar(texto, corrigir_acentos=False):
    palavras = []
    for i, p in enumerate(texto.split()):
        up = p.upper()
        if corrigir_acentos:
            up = CORRECAO_PALAVRA.get(up, up)
        low = up.lower()
        if up in SIGLAS:
            palavras.append(up)
        elif i > 0 and low in MINUSCULAS:
            palavras.append(low)
        else:
            palavras.append(low[:1].upper() + low[1:])
    return " ".join(palavras)


def limpar_disciplina(bruta):
    t = " ".join(bruta.replace("\n", " ").split())
    # "TÓPICOS ESPECIAIS EM ENGENHARIA TÓPICOS ESPECIAIS EM ENGENHARIA MECÂNICA IV"
    t = re.sub(r"^(TÓPICOS ESPECIAIS EM ENGENHARIA) \1", r"\1", t, flags=re.I)
    # A planilha mistura "AS EEMA" com o artigo; só esse caso vira crase.
    t = re.sub(r"\bAS EEMA\b", "ÀS EEMA", t, flags=re.I)
    return capitalizar(t, corrigir_acentos=True) if t else ""


def separar_docentes(celula, ch_turma):
    """'X (32h) e Y (32h)' -> [(X, 32), (Y, 32)]; 'X (64h)' -> [(X, 64)]."""
    partes = re.split(r"\s+e\s+(?=[A-ZÀ-Ú][A-Za-zÀ-ú ]+\(\d+h\))", celula.strip())
    saida = []
    for parte in partes:
        m = re.match(r"^(.*?)\s*(?:\((\d+)h\))?\s*$", parte)
        nome = " ".join(m.group(1).split()).upper()
        nome = CORRECAO_DOCENTE.get(nome, nome)
        ch = int(m.group(2)) if m.group(2) else ch_turma
        saida.append((nome, ch))
    return saida


def chave(txt):
    return unicodedata.normalize("NFKD", txt).encode("ascii", "ignore").decode().upper()


def main():
    with open(ENTRADA, encoding="utf-8") as f:
        linhas = list(csv.reader(f))
    cabecalho, corpo = linhas[0], linhas[1:]

    ocorrencias = Counter()
    nome_por_codigo = defaultdict(Counter)
    natureza_por_codigo, ppc_por_codigo = {}, {}

    # 1ª passada: o que cada código diz sobre nome, natureza e PPC.
    for r in corpo:
        r = r + [""] * (10 - len(r))
        if r[3].strip() == SEM_TURMA:
            continue
        cod = r[4].strip()
        if r[3].strip():
            nome_por_codigo[cod][limpar_disciplina(r[3])] += 1
        if r[8].strip():
            natureza_por_codigo.setdefault(cod, r[8].strip())
        if r[9].strip():
            ppc_por_codigo.setdefault(cod, r[9].strip())

    alocacoes = {}   # chave da alocação -> registro
    cursos_vistos, periodos = set(), set()

    for num, r in enumerate(corpo, start=2):
        r = r + [""] * (10 - len(r))
        curso, ano, sem, disc, cod, prof, turma, ch, nat, ppc = [c.strip() for c in r]
        if disc == SEM_TURMA:
            ocorrencias["sem_turma"] += 1
            continue

        ano, sem = int(ano), int(sem)
        periodo = f"{ano}.{sem}"
        periodos.add(periodo)
        cursos_vistos.add(curso)

        if not disc:
            ocorrencias["disciplina_pelo_codigo"] += 1
            nome = nome_por_codigo[cod].most_common(1)[0][0]
        else:
            nome = limpar_disciplina(disc)

        turma = re.sub(r"^0+(?=\d)", "", turma) if turma else ""
        ch_turma = int(re.search(r"\d+", ch).group())

        if curso == "Engenharia Mecânica" and not nat:
            nat = natureza_por_codigo.get(cod, "")
            ppc = ppc or ppc_por_codigo.get(cod, "")
            ocorrencias["natureza_pelo_codigo"] += 1

        docentes = separar_docentes(prof, ch_turma)
        if len(docentes) > 1:
            ocorrencias["turma_com_dois_docentes"] += 1
            if sum(c for _, c in docentes) != ch_turma:
                ocorrencias["soma_difere_ch"] += 1
        if any(CORRECAO_DOCENTE.get(" ".join(re.sub(r"\(\d+h\)", "", p).split()).upper())
               for p in re.split(r"\s+e\s+", prof)):
            ocorrencias["nome_corrigido"] += 1

        # Uma mesma turma aparece na lista de cada curso que ela atende.
        # A chave abaixo junta essas repetições numa única alocação de docente.
        turma_id = f"{periodo}|{cod}|{turma or 'S' + str(ch_turma)}"
        for nome_doc, ch_doc in docentes:
            k = (turma_id, chave(nome_doc), ch_doc)
            reg = alocacoes.get(k)
            if reg is None:
                reg = alocacoes[k] = {
                    "periodo": periodo, "ano": ano, "semestre": sem,
                    "codigo": cod, "disciplina": nome,
                    "turma": turma or "—", "turma_id": turma_id,
                    "docente": capitalizar(nome_doc),
                    "ch": ch_doc, "ch_turma": ch_turma,
                    "nivel": "Pós-graduação" if curso == "Mestrado" else "Graduação",
                    "natureza": "", "ppc": "", "cursos": [], "linhas": [],
                }
            else:
                ocorrencias["repeticao_entre_cursos"] += 1
            curto = CURSO_CURTO.get(curso, curso)
            if curto not in reg["cursos"]:
                reg["cursos"].append(curto)
            reg["linhas"].append(num)
            if curso == "Engenharia Mecânica":
                reg["natureza"] = nat or reg["natureza"]
                reg["ppc"] = ppc or reg["ppc"]

    lista = sorted(alocacoes.values(),
                   key=lambda a: (a["periodo"], a["disciplina"], a["turma"], a["docente"]))

    # Avisos que o tratamento não resolve sozinho (ficam visíveis no painel).
    avisos = []
    for cod, nomes in sorted(nome_por_codigo.items()):
        if len(nomes) > 1:
            avisos.append(f"O código {cod} aparece com nomes diferentes: "
                          + " / ".join(sorted(nomes)) + ".")
    if ocorrencias["soma_difere_ch"]:
        avisos.append("Em Energias e Meio Ambiente, 2023.1, Termodinâmica Aplicada, as cargas "
                      "dos dois docentes somam 96h numa turma de 64h.")
    for a in lista:
        if a["turma"] == "11":
            avisos.append(f"{a['disciplina']} ({a['periodo']}) consta como turma 11, "
                          "provavelmente turma 1.")

    saida = {
        "gerado_em": datetime.now().strftime("%d/%m/%Y"),
        "fonte": ENTRADA.name,
        "linhas_origem": len(corpo),
        "periodos": sorted(periodos),
        "cursos": [CURSO_CURTO.get(c, c) for c in CURSO_CURTO if c in cursos_vistos],
        "ocorrencias": dict(ocorrencias),
        "avisos": avisos,
        "alocacoes": lista,
    }
    SAIDA.write_text("window.DADOS = " + json.dumps(saida, ensure_ascii=False, indent=1) + ";\n",
                     encoding="utf-8")

    turmas = {a["turma_id"] for a in lista}
    print(f"{len(corpo)} linhas lidas, {ocorrencias['sem_turma']} sem turma.")
    print(f"{len(lista)} alocações de docente em {len(turmas)} turmas, "
          f"{len({a['docente'] for a in lista})} docentes, "
          f"{len({a['codigo'] for a in lista})} códigos de disciplina.")
    print(f"Gravado em {SAIDA.relative_to(RAIZ)}")


if __name__ == "__main__":
    main()
