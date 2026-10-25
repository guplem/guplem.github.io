# mi-ayudante-de-clase

Esta carpeta es un agente de IA ya montado: un ayudante para un docente de Matemáticas de 4.º de primaria con dos grupos, 4.º A y 4.º B.
Es el ejemplo "Docente" de la guía https://triunitystudios.com/blog/tu-primer-agente/ (míralo ahí si quieres ver cómo se construye).

Los datos son de ejemplo (grupos, notas y calendario de octubre de 2026). Los alumnos son solo números de lista. Bórralos y pon los tuyos.
Las notas de datos/notas.csv también son inventadas. Ese archivo es una tabla limpia, sin aviso arriba, por eso lo digo aquí.

Cómo abrirla (mueve la carpeta donde quieras y elige esa carpeta en tu app):
- Claude: abre la app, entra en Code y elige la carpeta.
- ChatGPT: abre la app, elige Codex en el selector de modo, pulsa "Add new project" y elige la carpeta.
- Antigravity: pulsa el icono de nuevo proyecto, "Add Folder", elige la carpeta y pulsa "Create".
- Goose: elige la carpeta en el selector de la barra de abajo. Antes, en "Settings", "Chat", "Default Mode", elige "Manual" para que te pregunte antes de cambiar archivos.

Prueba con: "Prepárame una ficha de fracciones para 4.º B." En exportaciones/ hay una ya hecha.
Para las medias, pide: "Dame las medias de las notas". Usará scripts/medias.py (necesita Python 3).
