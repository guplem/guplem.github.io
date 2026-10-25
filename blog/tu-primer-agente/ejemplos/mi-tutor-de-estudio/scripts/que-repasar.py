#!/usr/bin/env python3
# Qué repasar: lee datos/progreso.md y dice qué temas
# hace más de 7 días que no repasas, del más antiguo al más reciente.
# Uso: python3 scripts/que-repasar.py
# Opcional: python3 scripts/que-repasar.py 2026-10-25   (para probar con otra fecha)
# Solo usa la biblioteca estándar de Python 3.

import sys
from datetime import date, datetime
from pathlib import Path

DIAS_LIMITE = 7
ARCHIVO = Path(__file__).resolve().parent.parent / "datos" / "progreso.md"


def leer_fecha(texto):
    return datetime.strptime(texto.strip(), "%Y-%m-%d").date()


def main():
    try:
        hoy = leer_fecha(sys.argv[1]) if len(sys.argv) > 1 else date.today()
    except ValueError:
        print("La fecha no es válida. Escríbela así: AAAA-MM-DD (por ejemplo 2026-10-25).")
        return 1

    if not ARCHIVO.exists():
        print("No encuentro el archivo datos/progreso.md. Pídele al agente que lo cree.")
        return 1

    try:
        lineas = ARCHIVO.read_text(encoding="utf-8").splitlines()
    except (OSError, UnicodeDecodeError):
        print("No puedo leer datos/progreso.md. Revisa que sea un archivo de texto.")
        return 1

    pendientes = []   # (días, asignatura, tema, estado)
    sin_repasar = []  # temas sin fecha
    errores = []      # líneas que no se entienden

    for numero, linea in enumerate(lineas, start=1):
        if not linea.strip().startswith("|"):
            continue
        celdas = [c.strip() for c in linea.strip().strip("|").split("|")]
        if celdas[0] in ("Asignatura", "") or set(celdas[0]) <= set("-: "):
            continue  # cabecera o línea de guiones
        if len(celdas) < 4:
            errores.append(numero)
            continue
        asignatura, tema, estado, texto_fecha = celdas[:4]
        if texto_fecha in ("-", ""):
            sin_repasar.append((asignatura, tema, estado))
            continue
        try:
            dias = (hoy - leer_fecha(texto_fecha)).days
        except ValueError:
            errores.append(numero)
            continue
        if dias > DIAS_LIMITE:
            pendientes.append((dias, asignatura, tema, estado))

    if errores:
        lista = ", ".join(str(n) for n in errores)
        palabra = "la línea" if len(errores) == 1 else "las líneas"
        print(f"Aviso: no entiendo {palabra} {lista} de datos/progreso.md. Revisa la fecha (AAAA-MM-DD).")
        print()

    if not pendientes and not sin_repasar:
        if errores:
            return 1
        print(f"Todo al día. No hay temas sin repasar desde hace más de {DIAS_LIMITE} días.")
        return 0

    if pendientes:
        pendientes.sort(key=lambda t: -t[0])  # el más antiguo primero
        print(f"Temas sin repasar hace más de {DIAS_LIMITE} días (del más antiguo al más reciente):")
        for dias, asignatura, tema, estado in pendientes:
            print(f"- {asignatura}, {tema}: hace {dias} días ({estado})")

    if sin_repasar:
        if pendientes:
            print()
        print("Temas que aún no has repasado nunca:")
        for asignatura, tema, estado in sin_repasar:
            print(f"- {asignatura}, {tema} ({estado})")
    return 0


if __name__ == "__main__":
    sys.exit(main())
