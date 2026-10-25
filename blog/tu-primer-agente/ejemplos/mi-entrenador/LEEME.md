# mi-entrenador

Esta carpeta es un agente de IA de ejemplo: un entrenador personal que apunta tus entrenos y comidas y te dice cómo vas hacia tu objetivo.
Es el ejemplo "Salud" de la guía. Sus datos son de ejemplo: borra los míos y pon los tuyos.

## Cómo abrirla
- Claude: abre la app, entra en Code y elige esta carpeta.
- ChatGPT: abre la app, elige Codex en el selector de modo y pulsa "Add new project".
- Antigravity: pulsa el icono de nuevo proyecto, "Add Folder", elige esta carpeta y pulsa "Create".
- Goose: elige esta carpeta en el selector de la barra de abajo. Antes, en "Settings", "Chat", "Default Mode", elige "Manual" para que te pregunte antes de cambiar archivos.

Luego escribe: "Hazme el resumen de esta semana."

## Qué hay dentro
- AGENTS.md: las instrucciones. CLAUDE.md solo apunta a ellas.
- datos/: tu objetivo, tu rutina y el registro de entrenos y comidas.
- .agents/skills/ y .claude/skills/: la skill del resumen semanal (la misma, para todas las apps).
- scripts/resumen.py: suma los últimos 7 días (necesita Python 3).
- exportaciones/: los resúmenes que te entrega el agente.

Esto no es consejo médico. Si tienes dudas o dolor, consulta a un profesional.

La guía completa: https://triunitystudios.com/blog/tu-primer-agente/
