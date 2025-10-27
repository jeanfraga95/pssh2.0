#!/usr/bin/python
# -*- coding: utf-8 -*-

import os
import sys
import time

if len(sys.argv) != 2:
    print("Uso: python sinc.py <nome_do_arquivo>")
    sys.exit(1)

nome_arquivo = sys.argv[1]

with open(nome_arquivo, 'r') as arquivo:
    linhas = arquivo.readlines()
    linhas = [linha for linha in linhas if linha.strip()]

for linha in linhas:
    colunas = linha.split()
    if len(colunas) >= 5:
        os.system("./painelssjf v2rayadd " + colunas[4] + " " + colunas[0] + " " + colunas[1] + " " + colunas[2] + " " + colunas[3])
    else:
        os.system("./painelssjf createssh " + colunas[0] + " " + colunas[1] + " " + colunas[2] + " " + colunas[3])

arquivo.close()

os.system("rm " + nome_arquivo)

os.system("sudo systemctl restart v2ray")
