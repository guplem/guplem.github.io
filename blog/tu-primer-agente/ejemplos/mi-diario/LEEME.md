# mi-diario: un agente de IA en una carpeta

Esta carpeta es un agente de diario. Guarda cada día y te ayuda a ver qué se repite.
Es el ejemplo "Diario" de la guía: https://triunitystudios.com/blog/tu-primer-agente/

## Cómo abrirla con tu app
- Claude: abre la app, entra en Code y elige esta carpeta.
- ChatGPT: abre la app, elige el modo Codex, pulsa "Add new project" y elige esta carpeta.
- Antigravity: pulsa el icono de nuevo proyecto, "Add Folder", elige esta carpeta y pulsa "Create".
- Goose: abre la app y elige esta carpeta en el selector de la barra de abajo. Antes, en "Settings", "Chat", "Default Mode", elige "Manual" para que te pregunte antes de cambiar archivos.

Luego escribe: "¿Quién eres y qué sabes hacer?"

## Qué trae
- AGENTS.md: las instrucciones. CLAUDE.md solo apunta a ellas.
- datos/: la memoria (entradas del día y temas).
- .agents/skills/ y .claude/skills/: la receta cerrar-el-dia.
- scripts/animo.py: cuenta los días de cada ánimo por mes (necesita Python 3).
- exportaciones/: un resumen de ejemplo.

## Importante
- Las entradas y los temas son datos de ejemplo. Bórralos y pon los tuyos.
- Un diario es muy personal. La app manda partes de tus archivos a la empresa del modelo para responder. No escribas nada que no quieras compartir.
