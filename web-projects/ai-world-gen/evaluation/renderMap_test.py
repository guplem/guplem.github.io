"""Tests for the map renderer. Run with `python -m unittest renderMap_test` in this folder."""

import unittest

from PIL import Image

from renderMap import render_map, tags_by_type, tile_box

MANIFEST = {"tags": {"grass": [[1, 0], [2, 0]], "wall": [[0, 1]], "unknown": [[3, 3]]}, "tileSize": 2, "pitch": 3, "offset": 1}


def sheet_with(colours: dict[tuple[int, int], tuple[int, int, int, int]]) -> Image.Image:
    """A tiny sheet where the tile at (column, row) is one flat colour."""
    image = Image.new("RGBA", (1 + 4 * 3, 1 + 4 * 3), (0, 0, 0, 255))
    for (column, row), colour in colours.items():
        x, y = 1 + column * 3, 1 + row * 3
        for dx in range(2):
            for dy in range(2):
                image.putpixel((x + dx, y + dy), colour)
    return image


SHEET = sheet_with({(1, 0): (0, 200, 0, 255), (0, 1): (200, 200, 200, 255), (3, 3): (255, 0, 255, 255)})


class TileBox(unittest.TestCase):
    def test_first_variant_at_offset_plus_index_times_pitch(self):
        self.assertEqual(tile_box(MANIFEST, "grass"), (4, 1, 6, 3))
        self.assertEqual(tile_box(MANIFEST, "wall"), (1, 4, 3, 6))

    def test_unknown_tag_falls_back(self):
        self.assertEqual(tile_box(MANIFEST, "lava"), tile_box(MANIFEST, "unknown"))


class RenderMap(unittest.TestCase):
    def test_draws_each_cell_with_its_tag_at_the_given_scale(self):
        grid = {"width": 2, "height": 1, "cells": [{"typeId": "g", "source": "model"}, {"typeId": "w", "source": "model"}]}
        image = render_map(grid, {"g": "grass", "w": "wall"}, SHEET, MANIFEST, scale=4)
        self.assertEqual(image.size, (16, 8))
        self.assertEqual(image.getpixel((3, 3)), (0, 200, 0, 255))
        self.assertEqual(image.getpixel((12, 3)), (200, 200, 200, 255))

    def test_undecided_cell_is_a_dark_square_and_unknown_type_is_the_fallback_tile(self):
        grid = {"width": 2, "height": 1, "cells": [None, {"typeId": "nope", "source": "model"}]}
        image = render_map(grid, {}, SHEET, MANIFEST, scale=2)
        self.assertEqual(image.getpixel((1, 1))[:3], (19, 19, 22))
        self.assertEqual(image.getpixel((5, 1)), (255, 0, 255, 255))

    def test_fallback_and_hand_cells_carry_a_corner_mark(self):
        grid = {"width": 2, "height": 1, "cells": [{"typeId": "g", "source": "fallback"}, {"typeId": "g", "source": "hand"}]}
        image = render_map(grid, {"g": "grass"}, SHEET, MANIFEST, scale=5)
        self.assertEqual(image.getpixel((0, 0)), (255, 140, 0, 255))
        self.assertEqual(image.getpixel((19, 0)), (80, 200, 255, 255))
        self.assertEqual(image.getpixel((5, 5)), (0, 200, 0, 255))

    def test_tags_by_type_reads_a_vocabulary(self):
        self.assertEqual(tags_by_type({"elements": [{"id": "a", "visualTag": "grass"}]}), {"a": "grass"})


if __name__ == "__main__":
    unittest.main()
