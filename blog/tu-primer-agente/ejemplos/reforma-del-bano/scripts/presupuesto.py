#!/usr/bin/env python3
# presupuesto.py
#
# Qué hace: lee datos/presupuesto.csv y dice tres cosas:
#   1. el total previsto,
#   2. el total gastado,
#   3. las partidas que se pasan de lo previsto.
#
# Cómo se usa: desde la carpeta del agente, escribe
#   python3 scripts/presupuesto.py
#
# El archivo debe tener estas columnas: partida,previsto,gastado
# Las cantidades son euros, en números simples (por ejemplo 350 o 12.5).
# Solo usa Python 3, sin instalar nada más.

import csv
import sys
from pathlib import Path

# La ruta se calcula desde este script, así funciona desde cualquier sitio.
RUTA = Path(__file__).resolve().parent.parent / "datos" / "presupuesto.csv"
COLUMNAS = ["partida", "previsto", "gastado"]


def error(mensaje):
    print("Error: " + mensaje)
    sys.exit(1)


def a_numero(texto, linea, columna):
    """Convierte un texto en un número. Si no puede, explica dónde está el fallo."""
    limpio = (texto or "").strip()
    try:
        valor = float(limpio)
    except ValueError:
        error(f"en la línea {linea}, la columna '{columna}' tiene '{limpio}' "
              "y no es un número. Escribe solo el número, por ejemplo 350.")
    if valor < 0:
        error(f"en la línea {linea}, la columna '{columna}' es negativa ({limpio}). "
              "Usa un número de cero o más.")
    return valor


def leer_partidas():
    if not RUTA.exists():
        error(f"no encuentro el archivo {RUTA}. "
              "Comprueba que existe datos/presupuesto.csv.")
    try:
        with open(RUTA, newline="", encoding="utf-8-sig") as archivo:
            lector = csv.DictReader(archivo)
            if lector.fieldnames is None:
                error("datos/presupuesto.csv está vacío.")
            cabecera = [c.strip() for c in lector.fieldnames]
            if cabecera != COLUMNAS:
                error("las columnas de datos/presupuesto.csv deben ser "
                      + ",".join(COLUMNAS) + " y son " + ",".join(cabecera) + ".")
            partidas = []
            for numero, fila in enumerate(lector, start=2):
                if None in fila or None in fila.values():
                    error(f"la línea {numero} no tiene exactamente 3 columnas.")
                if not any((valor or "").strip() for valor in fila.values()):
                    continue  # línea en blanco
                nombre = (fila["partida"] or "").strip()
                if not nombre:
                    error(f"la línea {numero} no tiene nombre de partida.")
                partidas.append((
                    nombre,
                    a_numero(fila["previsto"], numero, "previsto"),
                    a_numero(fila["gastado"], numero, "gastado"),
                ))
    except (OSError, UnicodeDecodeError) as problema:
        error(f"no puedo leer datos/presupuesto.csv ({problema}).")
    if not partidas:
        error("datos/presupuesto.csv no tiene ninguna partida.")
    return partidas


def euros(cantidad):
    """Escribe una cantidad como 5.450 € (o 12,50 € si tiene céntimos)."""
    if abs(cantidad - round(cantidad)) < 0.005:
        texto = f"{round(cantidad):,}".replace(",", ".")
    else:
        texto = f"{cantidad:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")
    return texto + " €"


def main():
    partidas = leer_partidas()
    total_previsto = sum(p[1] for p in partidas)
    total_gastado = sum(p[2] for p in partidas)
    pasadas = [p for p in partidas if p[2] > p[1]]

    print(f"Partidas: {len(partidas)}")
    print(f"Total previsto: {euros(total_previsto)}")
    print(f"Total gastado: {euros(total_gastado)}")
    print(f"Queda por gastar: {euros(total_previsto - total_gastado)}")
    print()
    if pasadas:
        print("Partidas que se pasan de lo previsto:")
        for nombre, previsto, gastado in pasadas:
            print(f"- {nombre}: previsto {euros(previsto)}, "
                  f"gastado {euros(gastado)} (+{euros(gastado - previsto)})")
    else:
        print("Ninguna partida se pasa de lo previsto.")


if __name__ == "__main__":
    main()
