# Prime Sieve Arcs

An animation of the **Sieve of Eratosthenes**, the oldest way of finding prime numbers. Every prime hops along its own multiples in glowing arcs. A number that no arc lands on is prime.

![The finished sweep](../../resources/images/projects/primeSieveArcs.webp)

## How it works

The sieve is a very old idea: write the numbers in a row, cross off every multiple of 2, then every multiple of 3, and keep going. What survives is the primes.

This page draws that idea instead of writing it:

1. A front sweeps left to right along the number line.
2. When the front reaches a number that no arc has landed on, that number is prime. It gets a chip and a violet halo, and it starts hopping.
3. A prime `p` hops `p` -> `2p` -> `3p` -> `4p` and on. Each hop is a half circle whose diameter is `p`, and the hops alternate above and below the line.
4. Every landing marks a composite number. The primes are the gaps that never get hit.

Small primes make tight loops near the line. Large primes throw wide arcs across the screen. Together they build the fan shape that grows as the front advances.

## Features

- **The sieve as light** — hops are painted once and left on screen, so the picture builds up like a long-exposure photograph.
- **Live count** — the number the front has reached, how many primes it has found, and the newest one.
- **Deep link to one frame** — `?at=87` freezes the picture at number 87, ready to share.
- **Loops on its own** — it holds on the finished picture, fades out and starts again.
- **Respects reduced motion** — with the operating system set to reduce motion, the page shows the finished picture instead of animating.

## Controls

| Action | Keyboard | Pointer |
|---|---|---|
| Play or pause | `Space` | Click the canvas, or the Pause button |
| Restart | `R` | Restart button |

## URL Parameters

| Parameter | Default | What it does |
|---|---|---|
| `limit` | fits the window | Highest number in the sweep (12 to 1200). It also sets the zoom, because the whole sweep must fit the width. By default it follows the window width, giving every number about 22 pixels, which is the scale of the reference frame: about 115 on a wide desktop, about 24 on a phone. |
| `speed` | `4` | Numbers per second (0.2 to 60). |
| `at` | none | Freeze the animation at this number, paused. |
| `loop` | on | `loop=0` stops on the finished picture instead of starting again. |

Example: [`?limit=200&speed=6`](https://triunitystudios.com/web-projects/prime-sieve-arcs/?limit=200&speed=6)

## Where the look comes from

The art style copies a video frame that Guillem found and liked. That frame is kept in this folder, at
[`reference/inspiration-frame.webp`](reference/inspiration-frame.webp), so the source of the look stays with the code. Nothing on the site links to it.

The frame carries no author or title, so the original maker is unknown. Everything here was rebuilt from scratch: the rule behind the arcs and the colours were measured out of that single frame, pixel by pixel. `AGENTS.md` records the measurements.

## How to Run

Open `index.html` in a browser, or serve the repository root with any HTTP server:

```bash
python -m http.server 8000
```

Then open `http://localhost:8000/web-projects/prime-sieve-arcs/`.

## Tests

```bash
bun test
```

## Tech Stack

Vanilla HTML, CSS, and JavaScript. No frameworks or dependencies.

## Live Version

[triunitystudios.com/web-projects/prime-sieve-arcs/](https://triunitystudios.com/web-projects/prime-sieve-arcs/)
