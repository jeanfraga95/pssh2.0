#!/usr/bin/python
# -*- coding: utf-8 -*-

import os
import sys
import time

if len(sys.argv) != 2:
    sys.exit(1)

nome_arquivo = sys.argv[1]

with open(nome_arquivo, 'r') as arquivo:
    linhas = arquivo.readlines()
    linhas = [linha for linha in linhas if linha.strip()]

for linha in linhas:
    colunas = linha.split()
    if len(colunas) >= 2:
        os.system("./painelssjf v2raydel " + colunas[1] + " " + colunas[0])
    else:
        linha = linha.replace(' ', '')
        os.system("./painelssjf removessh " + linha)

arquivo.close()

os.system("rm " + nome_arquivo)

os.system("sudo systemctl restart v2ray")
