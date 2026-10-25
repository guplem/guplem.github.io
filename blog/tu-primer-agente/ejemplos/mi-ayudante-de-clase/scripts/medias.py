# medias.py
# Lee datos/notas.csv y calcula la media de cada grupo y de cada actividad.
# Uso: python3 scripts/medias.py
#      python3 scripts/medias.py otra/ruta/notas.csv   (si el archivo está en otro sitio)
# Solo usa Python 3 estándar: no hay que instalar nada.
# El CSV debe tener estas columnas: alumno,grupo,actividad,fecha,nota

import csv
import sys
from pathlib import Path

COLUMNAS = ["alumno", "grupo", "actividad", "fecha", "nota"]


def salir(mensaje):
    print("Error: " + mensaje)
    sys.exit(1)


def leer_notas(ruta):
    """Devuelve una lista de (grupo, actividad, nota). Avisa de las filas con problemas."""
    try:
        with open(ruta, newline="", encoding="utf-8-sig") as archivo:
            lector = csv.DictReader(archivo)
            if lector.fieldnames is None:
                salir("el archivo " + str(ruta) + " está vacío.")
            faltan = [c for c in COLUMNAS if c not in lector.fieldnames]
            if faltan:
                salir("a " + str(ruta) + " le faltan estas columnas: " + ", ".join(faltan)
                      + ". La primera fila debe ser: " + ",".join(COLUMNAS))
            filas = []
            for linea, fila in enumerate(lector, start=2):
                if None in fila:
                    print("Aviso: línea " + str(linea) + " ignorada, tiene más columnas de las "
                          "que toca (¿un decimal con coma sin comillas?).")
                    continue
                grupo = (fila.get("grupo") or "").strip()
                actividad = (fila.get("actividad") or "").strip()
                texto = (fila.get("nota") or "").strip().replace(",", ".")
                if not grupo and not actividad and not texto:
                    continue  # fila vacía
                try:
                    nota = float(texto)
                except ValueError:
                    print("Aviso: línea " + str(linea) + " ignorada, la nota '"
                          + texto + "' no es un número.")
                    continue
                if not grupo or not actividad:
                    print("Aviso: línea " + str(linea) + " ignorada, falta el grupo o la actividad.")
                    continue
                filas.append((grupo, actividad, nota))
            return filas
    except FileNotFoundError:
        salir("no encuentro " + str(ruta) + ". Ejecuta el script desde la carpeta del agente "
              "o indica la ruta del archivo.")
    except (OSError, UnicodeDecodeError, csv.Error) as problema:
        salir("no he podido leer " + str(ruta) + " (" + str(problema) + ").")


def medias_por(filas, posicion):
    """Agrupa las notas por la columna indicada (0 = grupo, 1 = actividad)."""
    acumulado = {}
    for fila in filas:
        suma, cuenta = acumulado.get(fila[posicion], (0.0, 0))
        acumulado[fila[posicion]] = (suma + fila[2], cuenta + 1)
    return {clave: (suma / cuenta, cuenta) for clave, (suma, cuenta) in acumulado.items()}


def mostrar(titulo, medias):
    print(titulo)
    for clave in sorted(medias):
        media, cuenta = medias[clave]
        print("  " + clave + ": " + format(media, ".2f") + "  (" + str(cuenta) + " notas)")
    print()


def main():
    if len(sys.argv) > 1:
        ruta = Path(sys.argv[1])
    else:
        ruta = Path(__file__).resolve().parent.parent / "datos" / "notas.csv"
    filas = leer_notas(ruta)
    if not filas:
        salir("no hay ninguna nota válida en " + str(ruta) + ".")
    mostrar("Media por grupo", medias_por(filas, 0))
    mostrar("Media por actividad", medias_por(filas, 1))
    print("Total: " + str(len(filas)) + " notas leídas.")


main()
