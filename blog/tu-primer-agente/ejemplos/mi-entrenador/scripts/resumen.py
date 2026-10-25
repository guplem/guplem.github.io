# resumen.py -- resumen de los últimos 7 días de entreno.
#
# Qué hace: lee datos/registro.csv y suma, para los últimos 7 días,
# los minutos de entreno (filas con unidad "min") y los kilómetros
# (filas con unidad "km"). Las comidas (unidad "kcal") no se suman aquí.
#
# Los 7 días se cuentan hacia atrás desde la fecha más reciente del
# registro, ese día incluido. Así funciona igual aunque pase el tiempo.
#
# Cómo se apunta una carrera: dos filas con la misma fecha y tipo "carrera",
# una con los km y otra con los minutos.
#
# Uso (desde la carpeta del agente):  python3 scripts/resumen.py
# Solo usa la biblioteca estándar de Python 3: no hay que instalar nada.

import csv
import sys
from datetime import date, timedelta
from pathlib import Path

RUTA = Path(__file__).resolve().parent.parent / "datos" / "registro.csv"
COLUMNAS = ["fecha", "tipo", "detalle", "cantidad", "unidad"]
DIAS = 7


def salir(mensaje):
    print(mensaje)
    sys.exit(1)


def leer_filas():
    """Devuelve (filas válidas, avisos). Cada fila es (fecha, tipo, cantidad, unidad)."""
    if not RUTA.exists():
        salir("No encuentro datos/registro.csv. Pídele al agente que lo cree.")
    try:
        with open(RUTA, newline="", encoding="utf-8-sig") as f:
            lector = csv.reader(f)
            cabecera = next(lector, None)
            if cabecera is None:
                salir("datos/registro.csv está vacío. Apunta primero algún entreno.")
            cabecera = [c.strip().lower() for c in cabecera]
            if cabecera != COLUMNAS:
                salir("La primera línea de datos/registro.csv debe ser: "
                      + ",".join(COLUMNAS))
            filas, avisos = [], []
            for n, campos in enumerate(lector, start=2):
                if not any(c.strip() for c in campos):
                    continue  # línea en blanco
                if len(campos) != len(COLUMNAS):
                    avisos.append(f"Línea {n}: tiene {len(campos)} columnas y debe tener 5. La salto.")
                    continue
                f_txt, tipo, _detalle, cant_txt, unidad = [c.strip() for c in campos]
                try:
                    fecha = date.fromisoformat(f_txt)
                except ValueError:
                    avisos.append(f"Línea {n}: la fecha '{f_txt}' no es válida (usa AAAA-MM-DD). La salto.")
                    continue
                try:
                    cantidad = float(cant_txt.replace(",", "."))
                except ValueError:
                    avisos.append(f"Línea {n}: la cantidad '{cant_txt}' no es un número. La salto.")
                    continue
                filas.append((fecha, tipo.lower(), cantidad, unidad.lower()))
            return filas, avisos
    except (OSError, UnicodeDecodeError, csv.Error) as error:
        salir(f"No puedo leer datos/registro.csv ({error}).")


def formato(numero):
    """Escribe 18.5 como 18,5 y 205.0 como 205."""
    return f"{numero:g}".replace(".", ",")


def main():
    filas, avisos = leer_filas()
    if not filas:
        for aviso in avisos:
            print(aviso)
        salir("No hay filas válidas en datos/registro.csv. Apunta primero algún entreno.")

    ultima = max(f[0] for f in filas)
    primera = ultima - timedelta(days=DIAS - 1)
    semana = [f for f in filas if primera <= f[0] <= ultima]

    minutos = sum(c for _, _, c, u in semana if u == "min")
    km = sum(c for _, _, c, u in semana if u == "km")
    dias_entreno = {d for d, _, _, u in semana if u in ("min", "km")}
    comidas = sum(1 for _, t, _, _ in semana if t == "comida")

    print(f"Resumen de los últimos {DIAS} días")
    print(f"Del {primera} al {ultima} (la fecha más reciente del registro es {ultima}).")
    print(f"- Minutos de entreno: {formato(minutos)}")
    print(f"- Kilómetros: {formato(km)}")
    print(f"- Días con entreno: {len(dias_entreno)}")
    print(f"- Comidas apuntadas: {comidas}")
    for aviso in avisos:
        print("Aviso: " + aviso)


if __name__ == "__main__":
    main()
