# Taboo · Juego Determinista

Juego de adivinanzas tipo Taboo para jugar en persona con varios móviles, **sin servidor**. Cada dispositivo reconstruye el estado completo del juego (turno, jugador activo, carta) a partir de unas pocas entradas compartidas verbalmente.

## ¿Cómo funciona?

No hay backend, ni sincronización en tiempo real, ni código de partida. La coherencia entre dispositivos se garantiza porque todos calculan lo mismo:

- Todos introducen el **mismo seed** (cualquier texto, p.ej. `cumple-marta-2026`).
- Todos introducen los **mismos tamaños de equipo**.
- Cada uno introduce su propio **equipo** (A o B) y **número de jugador** (1..N).
- Todos avanzan **manualmente** el turno al unísono cuando termina cada ronda.

A partir de eso, cada cliente deriva:

- A qué equipo le toca adivinar (los turnos impares son del equipo A).
- Quién es el jugador activo del equipo adivinador (mediante un PRNG sembrado).
- Qué carta concreta toca jugar (mediante un Fisher-Yates sembrado sobre la baraja entera).

## Roles y visibilidad

En cada turno tu pantalla muestra una vista distinta según tu rol:

| Rol | Lo que ve | Lo que hace |
|---|---|---|
| **Jugador activo** (equipo adivinador) | Palabra objetivo + palabras prohibidas | Describe sin usar las prohibidas |
| **Compañero del activo** (equipo adivinador) | **Nada** (cara tapada) | NO mira la pantalla, escucha y grita la palabra |
| **Equipo juez** (el otro equipo) | Palabra objetivo + palabras prohibidas | Vigila las prohibidas, valida el acierto |

## Cómo jugar

1. Abre el juego en cada móvil del grupo.
2. Decidid un seed común y los tamaños de equipo. El "anfitrión" puede usar **Copiar enlace de partida** para mandar un enlace que pre-rellene los campos compartidos en todos los dispositivos.
3. Cada jugador escoge su equipo y número.
4. Pulsad **Empezar a jugar**. Todos veréis el mismo turno y la misma carta (con la visibilidad que corresponda).
5. Al acabar cada turno, todos pulsan **Siguiente** a la vez.

Si alguien llega tarde, basta con que ponga el número de turno actual: la baraja es totalmente reconstruible.

## Dataset de cartas

`cards.json` contiene 559+ cartas en español, generadas por agentes IA y deduplicadas. El formato es:

```json
{
  "version": "1.0.0",
  "language": "es",
  "cards": [
    { "word": "Titanic", "forbidden": ["barco", "hundir", "DiCaprio", "iceberg", "Rose"] }
  ]
}
```

Para ampliar el dataset, edita `cards.json` y sube la `version`. **Todos los dispositivos deben usar la misma versión del dataset** para ver las mismas cartas en los mismos turnos.

**Contenido para adultos.** Hay cartas con temática picante, política, religiosa y polémica deliberadamente; está pensado para grupos de adultos que quieran romper el hielo con momentos comprometidos.

## Cómo ejecutar

Sin build. Sirve la carpeta con cualquier servidor HTTP:

```bash
# Desde la raíz del repo
python -m http.server 8000
```

Y abre `http://localhost:8000/web-projects/taboo-game/`.

## Tests

La lógica determinista está cubierta por tests con `bun test`.

```bash
# Desde esta carpeta
bun test
```

## Parámetros de URL

- `s` — seed (string)
- `a` — tamaño del equipo A
- `b` — tamaño del equipo B
- `t` — turno
- `v` — versión del dataset (avisa si no coincide con la cargada)

Ejemplo: `?s=fiesta-julio&a=4&b=3&t=1&v=1.0.0`

Los datos personales (equipo, número de jugador) quedan en `localStorage` de cada dispositivo, no en la URL.

## Tech

Vanilla HTML / CSS / JS. Sin frameworks, sin build, sin servidor. PRNG `mulberry32` con hash FNV-1a.

## Versión en vivo

[triunitystudios.com/web-projects/taboo-game](https://triunitystudios.com/web-projects/taboo-game/)
