# TTT-AI-NAMES — naming design for AI opponents and player personas

Design-only deliverable for WORK row op 372. Verified against
`origin/main@e08bd1c` (2026-11-17). Nothing here is implemented; section 5
lists exactly which files change if the owner picks this scheme.

## 0. Evidence first: what the spec got wrong, and what is actually true

The spec describes "combos of 5 stems x 5 stems ... ~350 combos". No such
system exists in this repo — checked `git log -S` across all history and both
current naming modules:

- **AI opponents** live in `src/game/npc-names.ts` (landed yesterday,
  `ec11cdd`, TTT-NPC-NAMES1): a hand-authored roster of **376 English-only**
  names in three tiers — EASY 111 / NORMAL 114 / HARD 151 — drawn one per
  match by `createNpcNameSession`. Not combinatorial; the opposite problem:
  a joke vending machine. Every name is a one-off gag ("Purrito",
  "Xylophone Kid", "Goofball") with no character behind it, and the module
  comment states the roster is deliberately "English only ... puns do not
  translate" (`npc-names.ts:25-26`), so a Spanish player meets 376 English
  gags. That is the "awful in Spanish" half of the owner verdict, and it is
  real.
- **Player personas** (guest display names) live in `src/lib/identity.ts`:
  `generateGuestDisplayName` pairs 30 adjectives x 30 nouns = **900 combos
  per locale** (`identity.ts:58-98, 107-116`). This is the adjective+noun
  trap the spec describes — just bigger than "5 x 5". The ES pool is a
  gender-agreement workaround: every adjective is gender-invariable and
  every noun masculine (`identity.ts:67-70, 90-91`), so "Veloz Océano" and
  "Austero Juglar" are what the workaround buys. Senseless and calqued, as
  charged.

The owner verdict stands; the mechanism description was stale. Both surfaces
get the same cure below.

## 1. The scheme: "The Cast"

**One name per character. No combinatorial generation.**

- An opponent is a *character*, not a pairing. Each roster entry names one
  personality with a role (what it is), a quirk (how it plays), and a threat
  (why it wins or loses). The name is a proper noun — short, native,
  self-contained — never an adjective+noun description.
- **Per-locale casts.** EN and ES each get a full, independently authored
  cast per difficulty tier. Names are not translations of each other; a pun
  that only works in English gets a different native equivalent in Spanish,
  or the character simply has a Spanish name. This is the only honest way to
  satisfy "no calques" — you cannot translate "X Marks Spot" into Spanish
  without producing nonsense, so the ES cast is written natively around the
  same archetypes.
- **Cast size: 10 per tier per locale** (60 AI names total). Big enough that
  consecutive matches rarely repeat, small enough that each name is a
  character a player can actually learn. Repetition is the feature: meeting
  "Jaque" for the third time should feel like meeting a rival again, not
  re-pulling a slot machine.
- **Player personas become authored pools**: 100 hand-picked names per
  locale, drawn like today but never generated from parts. Each is a
  plausible handle a person would actually pick.
- **The machinery does not change.** `createNpcNameSession`'s draw pile,
  `isNpcName`, the `as const` + `Record<difficulty, …>` shape, the
  sanitize/banned-fragment test pins — all stay. What changes is authorship:
  curated characters instead of generated combos and joke fragments.

### Why this escapes the adjective+noun trap

The trap is semantic, not lexical. A generated "Adjective Noun" delegates
its meaning to the pairing, so most pairings are noise — "Veloz Océano"
describes a vibe, not a who. Three consequences the cast fixes:

1. **No referent, no memory.** A combo cannot be recognized twice because it
   was never a person. A named character accrues identity through repetition:
   the player learns its habits and the bot becomes a rival.
2. **Grammar debt.** Romance languages force gender agreement, so any
   productive pairing grammar generates ungrammatical or calqued output at
   scale — the ES pool's all-masculine-noun workaround is the tell. A proper
   noun declines for nothing; "Jaque" is "Jaque" in every sentence slot.
3. **Translation ceiling.** Puns and compounds do not survive literal
   transfer. Per-locale authorship means every name was chosen *in* its
   language, checked for meaning and agreement *in* that language.

## 2. AI opponent cast

Ten characters per tier per locale. Role/quirk/threat/rationale are design
annotations, not shipped strings. All names verified ≤14 chars
(`NPC_NAME_MAX_LENGTH`), survive `sanitizeDisplayName` unchanged, and clear
`BANNED_NAME_FRAGMENTS` (script-checked 2026-11-17).

### Easy — the house guests: harmless, young, snack-powered

| Name | Role | Quirk | Threat | Feel |
|---|---|---|---|---|
| Pip | the littlest | still learning which mark is yours | beginner's luck | You are the gentle giant; winning should feel kind |
| Momo | the napper | misses its turn daydreaming | a yawn costs a square | Soft, beatable, endearing |
| Biscuit | the rookie | plays in sugar rushes | crashes by move six | Snack-fueled chaos you can laugh at |
| Tilda | the daydreamer | sees better moves in her head than on the board | a daydream can win you the game | Charming and harmless |
| Gus | the golden retriever | pure enthusiasm, no plan | wants a rematch more than a win | Lovable, zero threat |
| Pogo | the bouncer | hops anywhere, plans nothing | chaos is a strategy too | Unpredictable but weak |
| Waffles | the breakfast bot | slow, sweet, syrupy | warm but beatable | Cozy and gentle |
| Juno | the optimist | every move is "the best one" | confidence is not accuracy | Upbeat try-hard |
| Bramble | the hedgehog | defends its favorite squares | prickly when cornered | Feisty underdog |
| Noodle | the noodle arm | limber, harmless | a flailing limb blocks you | Silly and floppy |

### Normal — the club regulars: reads the board, has a personality

| Name | Role | Quirk | Threat | Feel |
|---|---|---|---|---|
| Ada | the veteran | treats every board like a title match | pattern memory is scary | A real rival, not a toy |
| Bex | the shadow | blocks before you commit | your threats arrive pre-covered | You have to earn every square |
| Cleo | the trickster | loves a fork | two ways to win at once | Cute until the fork lands |
| Dex | the improviser | no plan, all instinct | instinct reads boards well | Witty, loose, dangerous |
| Marlo | the card sharp | counts your squares like cards | the house always knows | Smug, clever, human |
| Hank | the corner man | owns the corners like furniture | fundamentals done right | Solid, reliable, hard to rattle |
| Iris | the observer | says little, blocks everything | silence means your move failed | Quiet pressure |
| Joss | the risk-taker | goes for the win over the draw | brave losses, brave wins | Exhilarating either way |
| Kit | the quick study | adapts by move three | mid-game pivots catch you flat | Improves as you play |
| Silas | the safe player | takes the draw and calls it art | you have to beat perfection | The real test at this level |

### Hard — the inevitability engine: depth-8, reads everything

| Name | Role | Quirk | Threat | Feel |
|---|---|---|---|---|
| Sable | the operative | reads the board like a dossier | nothing surprises it | Cold, precise, unbeatable-feeling |
| Cipher | the encryptor | your plan arrives already decoded | encryption cuts both ways | Your ideas bounce off |
| Vesper | the evening star | appears when the game is decided | late-game precision | Elegant inevitability |
| Mason | the mason | builds lines block by block | a wall is a win delayed | Patient construction |
| Onyx | the stone | immovable center | pressure without panic | Weight you cannot move |
| Vector | the mathematician | computes all nine squares at once | arithmetic ends arguments | Pure calculation |
| Null | the null set | finds the move nobody saw | the empty square wins | The unexpected answer |
| Axiom | the proof | every game is a theorem already proved | the proof was forced | Inevitability itself |
| Warden | the keeper | guards the center like a gate | the gate does not open | Impregnable |
| Rook | the tower | straight lines only, always | orthogonal certainty | Relentless geometry |

### Easy (ES) — los invitados de casa

| Name | Role | Quirk | Threat | Feel |
|---|---|---|---|---|
| Nico | el pequeño | aprende las reglas sobre la marcha | la suerte del principiante | Eres el hermano mayor |
| Lolo | el dormilón | se pierde pensando en su turno | una cabezada cuesta una casilla | Suave, vencible, entrañable |
| Galleta | la del desayuno | juega a base de chucherías | el subidón de azúcar dura poco | Tierno y algo tonto |
| Nube | la soñadora | ve mejores jugadas en la cabeza que en el tablero | soñar también gana | Encantadora e inocente |
| Toby | el perro faldero | entusiasmo puro, sin plan | prefiere otra partida a ganar | Enamorada de jugar, no de ganar |
| Chispa | la saltarina | salta a cualquier casilla | el caos también es estrategia | Impredecible pero blanda |
| Chocolate | el de la merienda | dulce y pausado | la pausa también es jugada | Cálido y fácil de ganar |
| Sol | el optimista | cada jugada es "la mejor" | la confianza no es puntería | Alegre y con ganas |
| Erizo | el erizo | defiende sus casillas favoritas | pinchoso cuando lo acorralas | Rudo por fuera, blando por dentro |
| Pulpo | el pulpo | ocho brazos para nueve casillas | un tentáculo siempre estorba | Divertido y bloqueador |

### Normal (ES) — los del club

| Name | Role | Quirk | Threat | Feel |
|---|---|---|---|---|
| Dama | la ajedrecista | nunca repite una jugada | el jaque llega antes que tú | Una rival de verdad |
| Torre | la torre | líneas rectas, siempre | ortogonal y certera | Sólida, difícil de mover |
| Zorro | el zorro | taima cada jugada | la astucia también es defensa | Astuta, no burra |
| Lince | el lince | vista de linaje | nada se le escapa | Atenta, silenciosa |
| Bruno | el veterano | cada tablero es un título | la memoria de patrones asusta | Experimentado y frío |
| Vera | la sombra | bloquea antes de que actúes | tus amenazas llegan cubiertas | Presión silenciosa |
| Iker | el improvisador | sin plan, todo instinto | el instinto lee bien | Suelto pero peligroso |
| Pícaro | el pícaro | encanta las trampas | dos amenazas a la vez | Tierno hasta el truco |
| Sofía | la valiente | va por la victoria, no por el empate | derrotas valientes, victorias valientes | Emocionante siempre |
| Nora | la serena | prefiere el empate perfecto | tienes que ganarle a la perfección | El verdadero reto |

### Hard (ES) — la máquina de lo inevitable

| Name | Role | Quirk | Threat | Feel |
|---|---|---|---|---|
| Jaque | el jaque | nunca descansa la guardia | el mate está cerca | La presión misma |
| Niebla | la niebla | aparece cuando ya está decidido | precisión de cierre | Cierre elegante e inevitable |
| Centinela | la centinela | vigila cada casilla | nada pasa inadvertido | Guardia total |
| Vértice | el vértice | cada línea converge | la geometría es implacable | Precisión matemática |
| Eje | el eje | el centro del mundo | quien lo tiene casi gana | Control absoluto |
| Vacío | el vacío | encuentra la casilla invisible | la casilla vacía gana | La respuesta inesperada |
| Teorema | el teorema | cada partida es una prueba | la prueba ya estaba hecha | Inevitabilidad |
| Cenit | el cenit | la cima de la precisión | desde arriba todo se ve | Supremacía serena |
| Oráculo | el oráculo | ve lo que viene | la profecía se cumple | Saber antes de jugar |
| Rey | el rey | el centro lo es todo | la coronación es un jaque | La autoridad final |

## 3. Player persona pools

The guest name is the *human's* handle — it should read as a person, not a
bot, so the identity triple (role/quirk/threat) does not apply; each name
carries a vibe instead. 100 authored names per locale, disjoint from the AI
cast in both locales (a player named "Jaque" facing bot "Jaque" is a bug the
pool must make impossible — pinned by test at implementation time). All
names verified 2-20 chars, `sanitizeDisplayName`-clean, banned-fragment
clean, unique across both pools and the whole AI cast.

### English (100)

Real-name register — feels like someone you'd queue with:
Rowan, Wren, Ash, Eli, Mae, Jules, Remy, Noor, Zane, Blythe, Coral, Flint,
Gale, Harbor, Indigo, Lane, Marlow, Nell, Oak, Quin, Reed, Sage, Tamsin,
Uma, Vale, Winter, Yael, Zephyr, Arlo, Bea, Clem, Dove, Ezra, Fern, Gray,
Hope, Ivo, Jem, Kestrel, Lark, Milo, Nova, Opal, Piper, Quill, Robin, Skye,
Tess, Ulric, Willa, Xander, Yara, Zadie, Alfie, Birdie, Coco, Dot, Echo,
Faye, Gabe, Hana, Ike, June, Kofi, Lena, Mabel, Nils, Olive, Perry, Quinn,
Rosa, Sam, Theo, Una, Vicky, Will, Xan, Yuki, Zara, Axel, Blair, Clara,
Daphne, Edwin, Freya, Greta, Hazel, Ivy, Jasper, Kira, Lars, Margot, Nadia,
Otto, Petra, Rufus, Stella, Juniper, Sorrel, Wilder.

Rationale (shared): each is a plausible handle — a first name, a nature
word used as a name, or a short compound — that survives being read aloud
in a lobby and typed back into the name field.

### Spanish (100)

Real-name register (46) — nombres y apodos que suenan a gente de verdad:
Lucía, Pablo, Carmen, Diego, Ana, Jorge, Elena, Mario, Laura, Andrés,
Marta, Sergio, Julia, David, Paula, Álvaro, Sara, Hugo, Carla, Adrián,
Daniel, Alba, Marcos, Unai, Aitor, Mikel, Jon, Eneko, Xabi, Asier, Gorka,
Imanol, Aritz, Ibai, Ekain, Julen, Markel, Unax, Xabier, Yeray, Ainara,
Naiara, Olatz, Zuriñe, Ainhoa, Iván.

Naturaleza y tiempo (15): Brisa, Ventisca, Aguacero, Chubasco, Nublado,
Llovizna, Escarcha, Brasa, Ceniza, Roble, Olivo, Sauce, Álamo, Cerezo,
Membrillo — cada uno es una palabra española real con género correcto.

Animales (11): Ardilla, Nutria, Garduña, Tejón, Jabalí, Conejo, Liebre,
Hurón, Comadreja, Musaraña, Gineta.

Comida (10): Churro, Turrón, Gazpacho, Paella, Tortilla, Jamón, Queso,
Uva, Higo, Nuez.

Mitología y juego (10): Duende, Genio, Hada, Trasgo, Gnomo, Sirena,
Nómada, Juglar, Corsario, Gigante.

Frutos secos y fruta (8): Almendra, Castaña, Albaricoque, Cereza,
Mandarina, Dátil, Avellana, Bellota.

Rationale (shared): each is a word a Spanish speaker would actually choose
— a name, a place-word, an animal, a snack — correct in gender and meaning
with no calque of the English list. Nothing here declines, agrees, or
needs a translation note.

## 4. Rules the implementation must keep

- Names stay `as const` arrays behind `NPC_NAME_TIERS`-shaped tables; the
  session draw pile, `isNpcName`, and the no-immediate-repeat guarantee are
  unchanged mechanics.
- The roster gains a locale dimension (e.g. pools keyed by locale then
  difficulty). `getLocale()` already exists; `pick` either takes the locale
  or reads it — decide at implementation, pin with a test.
- `BANNED_NAME_FRAGMENTS` is English-only today. Add Spanish profanity and
  slur fragments before the ES cast lands (puto, zorra, joder, hostia,
  coño, verga, mierda, gilipollas, cabrón, maricón, subnormal,
  retrasado…). Verified: "Zorro" does not contain "zorra" — substring check
  is safe, but the fragment list must grow first so a future edit cannot
  land a dirty ES name quietly.
- Player pool and AI cast are disjoint across BOTH locales — the same name
  as you and as the bot is a collision the UI cannot explain.
- Stored names are untouched: `tic-tac-toe:displayName` and
  `preferences.opponentName` hold strings that still pass
  `sanitizeDisplayName`; no data migration.

## 5. Migration note — exact paths, no edits made

If the owner picks this scheme, these are the files that change:

**AI roster**
- `src/game/npc-names.ts` — pool contents become per-locale character
  casts; `NPC_NAME_TIERS` gains a locale key; module doc rewritten (the
  "English only" rationale is reversed).
- `src/game/npc-names.test.ts` — size pins change (was ≥300 total, ≥100 per
  tier); keep uniqueness/length/banned/sanitizer pins; add per-locale
  disjointness and player-pool-disjointness tests.
- `src/hooks/useLocalGame.ts` — `npcNameSession.pick` call sites (2) may
  need the locale argument.
- `src/components/lobby/lobbyForm.tsx` — 3 `npcNameSession.pick` call sites
  (initial state, mode re-entry, online-fallback).
- `src/components/game/queuePlay.tsx` — 1 `npcNameSession.pick` call site
  (warm-up opponent).
- `e2e/smoke.spec.ts` — imports `NPC_NAMES`/`isNpcName`; works unchanged if
  `NPC_NAMES` stays the union export.
- `src/components/lobby/lobbyForm.computerNames.test.tsx` — `isNpcName`
  assertions; works unchanged.

**Player personas**
- `src/lib/identity.ts` — `GUEST_NAME_ADJECTIVES`, `GUEST_NAME_ADJECTIVES_ES`,
  `GUEST_NAME_NOUNS`, `GUEST_NAME_NOUNS_ES` and the pairing logic in
  `generateGuestDisplayName` become two authored pools.
- `src/lib/identity.test.ts` — the `/^[A-Z][a-z]+ [A-Z][a-z]+$/` shape test
  and the 900-combo variety test are rewritten for single-word authored
  pools.

**No changes needed**
- `src/i18n/en.ts`, `src/i18n/es.ts` — names are not localized strings;
  `"{name}'s turn"`, `"Turno de {name}"`, `"{name} pensando"`,
  `"¡{name} gana!"` interpolate any name. `lobby.defaultAI`/`settings.ai`/
  `game.aiThinking` ("AI"/"IA") stay — they are the fallback label, not a
  persona.
- `src/lib/preferences.ts`, `src/lib/storage.ts` — storage shapes unchanged.
- `scripts/deploy-check.mjs` bundle budget — ~260 short strings is a few KB.

**One edge to decide at implementation**: users' saved
`preferences.opponentName` may hold an old-roster persona (the settings
sheet persists whatever name was drawn). After the swap `isNpcName` returns
false for it, so the old name freezes as if player-typed. Either accept it
(it is still a valid display name) or keep the old roster inside
`isNpcName`'s recognized set for one release.

## 6. What the owner is picking

- Scheme: authored per-locale character casts (this doc) vs. patched
  combinatorial generation vs. bare tier labels.
- Cast sizes: 10/tier proposed; 8 or 12 are defensible — the mechanic does
  not care, only the memorability does.
- Player pool size: 100/locale proposed; the only hard floor is "big enough
  that two players in one match rarely share a handle".
- Whether ES gets its own cast (recommended — it is the only way to honor
  "no calques") or shares the EN cast with translated names (rejected:
  that is the calque factory the verdict complains about).

Verified 2026-11-17 against `origin/main@e08bd1c`: roster contents and
counts (`npc-names.ts:81-472`), guest generator pools
(`identity.ts:58-116`), call sites (`useLocalGame.ts:54,82`;
`lobbyForm.tsx:140,532,555`; `queuePlay.tsx:255`), test pins
(`npc-names.test.ts:15-23`, `identity.test.ts:208-221`), and the
display-name gate (`identity.ts:162-175`). Name-set hygiene verified by
script: lengths, banned fragments, sanitizer survival, cross-set
uniqueness — all clean.
