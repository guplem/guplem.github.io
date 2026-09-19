"""Draw a generated map as a PNG, with the same tiles the page uses.

The page draws a cell from its type's visual tag through the manifest in
`tileset.js` (ADR 0003). This module does the same in Python with Pillow, so a
map logged to Galtea can carry a picture next to its ASCII view. Every cell of
a type is drawn with the tag's first tile variant, like the page's "Vary
sprites" switch turned off, because the picture is for reading, not for mood.

Pure: `render_map` takes the grid, a type -> visual tag map, the sheet image and
the manifest, and returns an image. `load_manifest` reads the manifest out of
`tileset.js` through Bun, so the two never drift.
"""

from __future__ import annotations

import json
import subprocess
from pathlib import Path

from PIL import Image, ImageDraw

HERE = Path(__file__).resolve().parent
PROJECT = HERE.parent
TILESET_PATH = PROJECT / "tileset.png"

BACKGROUND = (11, 11, 13, 255)
EMPTY_DARK = (19, 19, 22, 255)
EMPTY_LIGHT = (23, 23, 27, 255)
FALLBACK_MARK = (255, 140, 0, 255)
HAND_MARK = (80, 200, 255, 255)


def load_manifest(bun: str) -> dict:
    """`VISUAL_TAGS` and the sheet geometry, straight from tileset.js."""
    script = (
        "import { VISUAL_TAGS, TILE_SIZE, TILE_PITCH, TILE_OFFSET } from '../tileset.js';"
        "console.log(JSON.stringify({ tags: VISUAL_TAGS, tileSize: TILE_SIZE, pitch: TILE_PITCH, offset: TILE_OFFSET }));"
    )
    completed = subprocess.run([bun, "-e", script], capture_output=True, text=True, encoding="utf8", cwd=HERE)
    if completed.returncode != 0:
        raise RuntimeError(f"Could not read tileset.js:\n{completed.stderr}")
    return json.loads(completed.stdout)


def load_preset_tags(bun: str) -> dict[str, dict[str, str]]:
    """For every preset, its type id -> visual tag. Used to draw a saved run whose vocabulary was a preset."""
    script = (
        "import { PRESET_VOCABULARIES } from '../presetVocabularies.js';"
        "const out = {}; for (const [id, v] of Object.entries(PRESET_VOCABULARIES)) out[id] = Object.fromEntries(v.elements.map((e) => [e.id, e.visualTag]));"
        "console.log(JSON.stringify(out));"
    )
    completed = subprocess.run([bun, "-e", script], capture_output=True, text=True, encoding="utf8", cwd=HERE)
    if completed.returncode != 0:
        raise RuntimeError(f"Could not read presetVocabularies.js:\n{completed.stderr}")
    return json.loads(completed.stdout)


def tags_by_type(vocabulary: dict) -> dict[str, str]:
    """Type id -> visual tag, from a full vocabulary object."""
    return {element["id"]: element["visualTag"] for element in vocabulary.get("elements", [])}


def tile_box(manifest: dict, tag: str) -> tuple[int, int, int, int]:
    """The pixel box of a tag's first variant on the sheet; the `unknown` tile for a tag the manifest lacks."""
    variants = manifest["tags"].get(tag) or manifest["tags"]["unknown"]
    column, row = variants[0]
    x = manifest["offset"] + column * manifest["pitch"]
    y = manifest["offset"] + row * manifest["pitch"]
    return (x, y, x + manifest["tileSize"], y + manifest["tileSize"])


def render_map(grid: dict, type_tags: dict[str, str], sheet: Image.Image, manifest: dict, scale: int = 8) -> Image.Image:
    """The grid as an image: one tile per cell, `scale` screen pixels per sheet pixel."""
    width, height = grid["width"], grid["height"]
    size = manifest["tileSize"] * scale
    image = Image.new("RGBA", (width * size, height * size), BACKGROUND)
    draw = ImageDraw.Draw(image)
    mark = max(2, size // 5)
    for index, cell in enumerate(grid["cells"]):
        x = (index % width) * size
        y = (index // width) * size
        if cell is None:
            colour = EMPTY_DARK if (index % width + index // width) % 2 == 0 else EMPTY_LIGHT
            draw.rectangle((x, y, x + size - 1, y + size - 1), fill=colour)
            continue
        tile = sheet.crop(tile_box(manifest, type_tags.get(cell["typeId"], "unknown"))).resize((size, size), Image.NEAREST)
        image.alpha_composite(tile, (x, y))
        if cell.get("source") == "fallback":
            draw.rectangle((x, y, x + mark - 1, y + mark - 1), fill=FALLBACK_MARK)
        elif cell.get("source") == "hand":
            draw.rectangle((x + size - mark, y, x + size - 1, y + mark - 1), fill=HAND_MARK)
    return image


def load_sheet() -> Image.Image:
    return Image.open(TILESET_PATH).convert("RGBA")
