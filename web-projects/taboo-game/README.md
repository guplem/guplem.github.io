# Taboo · Juego Determinista

Juego de adivinanzas tipo Taboo para jugar en persona con varios móviles, **sin servidor**. Cada dispositivo reconstruye el estado completo del juego (turno, jugador activo, palabra actual, carta) a partir de unas pocas entradas compartidas verbalmente.

## ¿Cómo funciona?

No hay backend, ni sincronización en tiempo real, ni código de partida. La coherencia entre dispositivos se garantiza porque todos calculan lo mismo:

- Todos introducen el **mismo seed** (cualquier texto, p.ej. `cumple-marta-2026`).
- Todos introducen los **mismos tamaños de equipo** y la **misma duración de timer**.
- Cada uno introduce su propio **equipo** (A o B) y **número de jugador** (1..N).
- Cada turno tiene dos contadores: el **turno** (qué jugador describe) y el **número de palabra** dentro del turno. Ambos se avanzan manualmente.

A partir de eso, cada cliente deriva:

- A qué equipo le toca adivinar (los turnos impares son del equipo A).
- Quién es el jugador activo del equipo adivinador (rotación determinista: cada miembro describe una vez antes de repetirse).
- Qué carta toca para (turno, número de palabra) — sobre un único barajado determinista del mazo entero, cada turno reserva 50 huecos consecutivos. **Una palabra que ya salió en un turno anterior no puede volver a salir** durante toda la partida (hasta agotar el mazo).

## Roles y visibilidad

En cada turno tu pantalla muestra una vista distinta según tu rol:

| Rol | Lo que ve | Lo que hace |
|---|---|---|
| **Jugador activo** (equipo adivinador) | "Es tu turno" + botón Empezar → carta + cronómetro | Pulsa Empezar y describe palabras sin usar las prohibidas |
| **Compañero del activo** (equipo adivinador) | **Nada** (cara tapada con 🙈) | NO mira la pantalla, escucha y grita la palabra |
| **Equipo juez** (el otro equipo) | Carta entera (palabra + prohibidas) + contador local de aciertos | Vigila las prohibidas, valida los aciertos |

Jueces y compañeros del activo disponen de un **contador local de aciertos** (botón ✓ Acierto) que se reinicia automáticamente al cambiar de turno. Es puramente local: no se sincroniza ni se guarda — sólo ayuda a llevar la cuenta sin esfuerzo mental durante el turno.

## Cómo jugar

1. Abre el juego en cada móvil del grupo.
2. Decidid un seed, tamaños de equipo y duración del timer (p.ej. 30 s). El "anfitrión" puede usar **Copiar enlace de partida** para mandar un enlace que pre-rellene esos campos en todos los dispositivos.
3. Cada jugador escoge su equipo y número.
4. Pulsad **Empezar a jugar**.
5. En cada turno, el jugador activo ve "Es tu turno". Cuando todos están listos, pulsa **Empezar** y arranca su cronómetro. Mientras dura, ve una palabra y la describe; al acertar (o pasar) pulsa **Siguiente palabra**. Repite hasta que se acabe el tiempo.
6. **Los jueces** también pulsan **Siguiente palabra** cada vez que el activo cambia de carta para mantener su contador sincronizado y poder ver la siguiente.
7. **Los compañeros del activo** también pueden pulsar **Siguiente palabra** aunque no vean nada — el contador es local en cada dispositivo.
8. Cuando se acaba el tiempo, el botón de siguiente palabra del jugador activo se congela y aparece **¡TIEMPO!** Solo queda **Siguiente turno**, que todos pulsan a la vez.

Si alguien llega tarde, basta con que ponga el número de turno y palabra actuales: el estado es totalmente reconstruible.

## Dataset de cartas

`cards.json` contiene 1024 cartas en español, generadas por agentes IA, deduplicadas y filtradas para eliminar palabras con dos significados muy populares (p.ej. "Banco", "Medusa", "Gato"). El formato es:

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
- `w` — número de palabra dentro del turno (opcional, por defecto 1)
- `d` — duración del timer en segundos
- `v` — versión del dataset (avisa si no coincide con la cargada)

Ejemplo: `?s=fiesta-julio&a=4&b=3&t=1&d=30&v=1.0.0`

Los datos personales (equipo, número de jugador) quedan en `localStorage` de cada dispositivo, no en la URL.

## Tech

Vanilla HTML / CSS / JS. Sin frameworks, sin build, sin servidor. PRNG `mulberry32` con hash FNV-1a.

## Versión en vivo

[triunitystudios.com/web-projects/taboo-game](https://triunitystudios.com/web-projects/taboo-game/)
