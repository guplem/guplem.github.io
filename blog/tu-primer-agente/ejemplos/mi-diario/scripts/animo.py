# animo.py: cuenta cuántos días hubo de cada estado de ánimo en cada mes.
#
# Lee los archivos de datos/entradas/ (uno por día, con la fecha como nombre).
# Cada entrada debe empezar así:
#   línea 1:  # 2026-10-20
#   línea 2:  Ánimo: tranquilo
# Si una entrada no cumple el formato, el script la salta y avisa.
#
# Uso, desde la carpeta del agente:  python3 scripts/animo.py
# Solo usa la biblioteca estándar de Python 3: no hay que instalar nada.

import re
import sys
from collections import Counter, defaultdict
from pathlib import Path

CARPETA = Path(__file__).resolve().parent.parent / "datos" / "entradas"
FECHA = re.compile(r"^#\s*(\d{4})-(\d{2})-(\d{2})\s*$")
ANIMO = re.compile(r"^[ÁáAa]nimo\s*:\s*(\S+)\s*$")


def leer_entrada(ruta):
    """Devuelve (mes, ánimo) o lanza ValueError con el motivo en español."""
    lineas = ruta.read_text(encoding="utf-8").splitlines()
    if len(lineas) < 2:
        raise ValueError("tiene menos de dos líneas")
    f = FECHA.match(lineas[0])
    if not f:
        raise ValueError("la primera línea no es '# AAAA-MM-DD'")
    anio, mes, dia = f.groups()
    if ruta.stem != f"{anio}-{mes}-{dia}":
        raise ValueError("la fecha de la primera línea no coincide con el nombre del archivo")
    if not 1 <= int(mes) <= 12 or not 1 <= int(dia) <= 31:
        raise ValueError("la fecha no es válida")
    a = ANIMO.match(lineas[1])
    if not a:
        raise ValueError("la segunda línea no es 'Ánimo: palabra'")
    return f"{anio}-{mes}", a.group(1).lower()


def main():
    if not CARPETA.is_dir():
        print(f"AVISO: no existe la carpeta {CARPETA}")
        return 1
    meses = defaultdict(Counter)
    for ruta in sorted(CARPETA.glob("*.md")):
        try:
            mes, animo = leer_entrada(ruta)
        except (ValueError, UnicodeDecodeError, OSError) as error:
            print(f"AVISO: salto {ruta.name}: {error}")
            continue
        meses[mes][animo] += 1
    if not meses:
        print("No hay entradas válidas.")
        return 0
    for mes in sorted(meses):
        total = sum(meses[mes].values())
        print(f"{mes} ({total} {'día' if total == 1 else 'días'})")
        for animo, n in sorted(meses[mes].items(), key=lambda x: (-x[1], x[0])):
            print(f"  {animo}: {n}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
