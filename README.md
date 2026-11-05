# Sword and Thunder

Ficha de personaje de **Pathfinder 1e** con cálculos automáticos y un **menú jugable** para el celular, estilo videojuego. Pensada para la mesa: los dados son físicos; la app muestra bonos, daño y recursos.

**Usarla:** https://capitanahab.github.io/Sword_and_Thunder/

*English: a Pathfinder 1e character sheet and mobile, game-style play menu. UI in Spanish.*

## Qué tiene

- **`#/play`, menú jugable:** HUD (PG, CA, salvaciones, Reserva arcana), atacar, lanzar conjuros, Combate con conjuros, buffs y condiciones, combate por rondas, descanso y preparación de conjuros. Cada acción tiene su sonido y su animación. La sesión (PG actuales, espacios gastados, efectos) queda guardada en el navegador.
- **`#/sheet`, ficha:** basada en la ficha oficial, en 2 páginas y de solo lectura, con el desglose de cada número.
- **ES / EN:** español rioplatense por defecto.
- **PWA:** se instala en la pantalla de inicio y funciona sin conexión.

## Instalarla en el celular

1. Abrí el enlace de arriba en Chrome (Android) o Safari (iPhone).
2. Android: menú ⋮ → *Agregar a la pantalla de inicio* / *Instalar app*. iPhone: Compartir → *Agregar a inicio*.
3. Abrila una vez con conexión; después anda sin Wi-Fi. Cuando hay una versión nueva, se actualiza sola al abrirla.

## Correrla en tu compu

Requisitos: Node 24.

```bash
npm install
npm run dev -- --host   # dev server, accesible desde el celular en la misma red
npm run build           # build de producción en dist/
```

## El personaje

El personaje es un JSON: `src/characters/magus.json` (Furio, magus humano de nivel 1, de ejemplo). Lo valida un schema de Zod (`src/core/schema.ts`); si algo no valida, la ficha muestra el error.

```jsonc
{
  "name": "Furio",
  "race": "human",
  "abilities": { "str": 16, "dex": 13, "con": 15, "int": 16, "wis": 12, "cha": 12 },
  "levels": [{ "class": "magus", "hp": 8, "fcb": "hp" }],
  "feats": [{ "id": "combat-casting" }],
  "skills": { "spellcraft": 1 },
  "equipment": { "armor": { … }, "weapons": [ … ], "items": [ … ] },
  "spellbook": { "0": [ … ], "1": ["Shocking Grasp", "Shield"] },
  "defaultPrepared": { "0": [ … ], "1": ["Shocking Grasp", "Shield"] }
}
```

Clases, razas, dotes y conjuros son **datos** en `src/data/`. Para sumar uno, se agrega ahí (y su nombre en castellano en `src/data/names.ts`).

## Cómo está hecha

- Vite + React + TypeScript estricto + Zod. Sin librerías de estado ni de animación.
- Todos los cálculos viven en `src/core/` (TypeScript puro): `computeSheet(character, rules, session)`. Las pantallas solo muestran.
- Audio sintetizado con Web Audio (sin archivos) y animaciones CSS, configurados en `src/config/effects-config.json`.
- Los elementos clave tienen `data-testid` para pruebas automatizadas.

## Licencia y atribución

El código está bajo licencia [MIT](LICENSE).

Sword and Thunder usa marcas y/o derechos de autor de Paizo Inc., bajo la [Community Use Policy](https://paizo.com/communityuse) de Paizo. Uso gratuito y no comercial. No está publicado, avalado ni aprobado específicamente por Paizo. Las reglas de Pathfinder Roleplaying Game se usan bajo la Open Game License. Las descripciones de conjuros, dotes y aptitudes son breves y propias, no el texto del libro.

*Sword and Thunder uses trademarks and/or copyrights owned by Paizo Inc., used under Paizo's Community Use Policy. We are expressly prohibited from charging you to use or access this content. Sword and Thunder is not published, endorsed, or specifically approved by Paizo. For more information about Paizo's Community Use Policy, please visit paizo.com/communityuse. For more information about Paizo Inc. and Paizo products, please visit paizo.com.*
