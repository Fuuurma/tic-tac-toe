import { AI_Difficulty, type AI_Difficulty as AI_DifficultyType } from "./constants";
import { getLocale } from "@/i18n/language";
import type { Locale } from "@/lib/preferences";

/**
 * The persona roster for the vs-computer opponent.
 *
 * The opponent used to be a bare label — "AI" in the lobby, "CPU" in tests —
 * everywhere a name should have been. A name is a small piece of the
 * product's voice: the lobby card greets you with who is about to sit down,
 * the turn line reads "Jaque thinking", the win banner names the winner.
 * The roster backs that with one source of truth: per-locale casts of short
 * handles, drawn without repeats for the length of a browser session.
 *
 * The approach (not the names) is borrowed from gambit-deck's guest identity:
 * themed pools, a secure-ish random draw through one function, and tests
 * that pin length, uniqueness and hygiene against the repo's single
 * display-name gate.
 *
 * The Cast (docs/ttt-ai-names-design-20261117.md §2): an opponent is a
 * character, not a gag — ten authored names per difficulty tier per locale.
 * The English and Spanish casts are written natively around the same
 * archetypes, never translated: a proper noun declines for nothing, so
 * "Jaque" is "Jaque" in every sentence slot.
 *
 * Rules for a name here:
 *   - 2 to 14 characters (the lobby validates opponent names 2-20; we stay
 *     inside that with room for a difficulty badge beside the card name).
 *   - Survives `sanitizeDisplayName` unchanged (it will be shown and stored
 *     through that gate).
 *   - No fragment from BANNED_NAME_FRAGMENTS — English and Spanish — the
 *     roster is family-friendly by design.
 *   - Draws follow the UI locale (`getLocale()`); `pick` also takes an
 *     explicit locale for callers and tests that need one.
 */

export const NPC_NAME_MAX_LENGTH = 14;

/**
 * Substrings no roster name may contain, matched case-insensitively. The
 * roster is hand-authored and this is its guardrail: the tests hold every
 * name against this list, so a future edit that drifts dirty cannot land
 * quietly. Fragments are chosen to be distinctive roots — a fragment like
 * "die" would ban "soldier", so collision-prone short words are left out and
 * the hygiene lives in the authoring instead.
 */
export const BANNED_NAME_FRAGMENTS = [
  "fuck",
  "shit",
  "piss",
  "crap",
  "bitch",
  "bastard",
  "slut",
  "whore",
  "dick",
  "cock",
  "cunt",
  "twat",
  "prick",
  "wanker",
  "sex",
  "porn",
  "nude",
  "nigg",
  "fag",
  "retard",
  "spic",
  "chink",
  "nazi",
  "hitler",
  "kkk",
  "rape",
  "meth",
  "cocaine",
  "heroin",
  "weed",
  "vodka",
  "whiskey",
  "bomb",
  "nuke",
  "suicide",
  // Spanish profanity and slurs — the ES cast answers to the same gate.
  // Verified against the authored names: "Zorro" does not contain "zorra".
  "puto",
  "zorra",
  "joder",
  "hostia",
  "coño",
  "verga",
  "mierda",
  "gilipollas",
  "cabrón",
  "maricón",
  "subnormal",
  "retrasado",
] as const;

/**
 * The Cast — the authored per-locale roster (design doc §2). One name per
 * character, ten per difficulty tier per locale; the Spanish names are
 * written natively around the same archetypes, not translated from the
 * English ones.
 */

/** Easy (EN): the house guests — harmless, young, snack-powered. */
const EN_EASY_NAMES = [
  "Pip",
  "Momo",
  "Biscuit",
  "Tilda",
  "Gus",
  "Pogo",
  "Waffles",
  "Juno",
  "Bramble",
  "Noodle",
] as const;

/** Normal (EN): the club regulars — reads the board, has a personality. */
const EN_NORMAL_NAMES = [
  "Ada",
  "Bex",
  "Cleo",
  "Dex",
  "Marlo",
  "Hank",
  "Iris",
  "Joss",
  "Kit",
  "Silas",
] as const;

/** Hard (EN): the inevitability engine — depth-8, reads everything. */
const EN_HARD_NAMES = [
  "Sable",
  "Cipher",
  "Vesper",
  "Mason",
  "Onyx",
  "Vector",
  "Null",
  "Axiom",
  "Warden",
  "Rook",
] as const;

/** Easy (ES): los invitados de casa — suaves, jóvenes, a base de chucherías. */
const ES_EASY_NAMES = [
  "Nico",
  "Lolo",
  "Galleta",
  "Nube",
  "Toby",
  "Chispa",
  "Chocolate",
  "Sol",
  "Erizo",
  "Pulpo",
] as const;

/** Normal (ES): los del club — leen el tablero y tienen personalidad. */
const ES_NORMAL_NAMES = [
  "Dama",
  "Torre",
  "Zorro",
  "Lince",
  "Bruno",
  "Vera",
  "Iker",
  "Pícaro",
  "Sofía",
  "Nora",
] as const;

/** Hard (ES): la máquina de lo inevitable. */
const ES_HARD_NAMES = [
  "Jaque",
  "Niebla",
  "Centinela",
  "Vértice",
  "Eje",
  "Vacío",
  "Teorema",
  "Cenit",
  "Oráculo",
  "Rey",
] as const;

/**
 * The pools by locale then difficulty. `Record` so a new locale or a new
 * difficulty fails to compile until this table grows with it.
 */
export const NPC_NAME_TIERS: Record<
  Locale,
  Record<AI_DifficultyType, readonly string[]>
> = {
  en: {
    [AI_Difficulty.EASY]: EN_EASY_NAMES,
    [AI_Difficulty.NORMAL]: EN_NORMAL_NAMES,
    [AI_Difficulty.HARD]: EN_HARD_NAMES,
  },
  es: {
    [AI_Difficulty.EASY]: ES_EASY_NAMES,
    [AI_Difficulty.NORMAL]: ES_NORMAL_NAMES,
    [AI_Difficulty.HARD]: ES_HARD_NAMES,
  },
};

/** Each locale's whole cast — the pool a dry tier widens into. */
const ROSTER_BY_LOCALE: Record<Locale, readonly string[]> = {
  en: [...EN_EASY_NAMES, ...EN_NORMAL_NAMES, ...EN_HARD_NAMES],
  es: [...ES_EASY_NAMES, ...ES_NORMAL_NAMES, ...ES_HARD_NAMES],
};

/** The whole cast, both locales flat — consumers that only need the list (e2e pins). */
export const NPC_NAMES: readonly string[] = [
  ...ROSTER_BY_LOCALE.en,
  ...ROSTER_BY_LOCALE.es,
];

const NPC_NAME_SET: ReadonlySet<string> = new Set<string>(NPC_NAMES);

/**
 * The retired gag roster — 376 English-only names drawn before the Cast
 * shipped. Never picked again, but kept recognizable: a persona saved in
 * `preferences.opponentName` still reads as session-assigned, so a rematch
 * draws a fresh Cast name instead of freezing the old gag. Design doc §5
 * sanctions keeping it for one release; drop it once stored personas have
 * cycled out.
 */
const LEGACY_EASY_NAMES = [
  "Big Oh",
  "Lil X",
  "Xoxo",
  "Xoxo Foxo",
  "Ohsie",
  "Exie",
  "Xylo",
  "Xylophone Kid",
  "Little O",
  "Oh Deer",
  "Ohh La La",
  "Oopsy",
  "Oopsy Daisy",
  "Boxy",
  "Squiggles",
  "Doodles",
  "Noodles",
  "Noodle Noob",
  "Wobblekins",
  "Wobbles",
  "Wobbly Winnie",
  "Bumbles",
  "Bumble Bear",
  "Bumbling Bo",
  "Bloop",
  "Boops",
  "Bubbles",
  "Bubblegum Bo",
  "Giggles",
  "Gigglesworth",
  "Giggles McGee",
  "Snorkel Sam",
  "Snoozy Sue",
  "Snooze Cruise",
  "Yawns",
  "Goofball",
  "Goofy Gus",
  "Silly Billy",
  "Loopy Larry",
  "Waffles",
  "Toasty",
  "Pancake Pat",
  "Maple Syrup Mo",
  "Gummy Greg",
  "Pickle Pete",
  "Pretzel Pam",
  "Bagel Beth",
  "Muffin Max",
  "Toast Tony",
  "Nugget Ned",
  "Nugget Nell",
  "Cookie Crumb",
  "Cupcake Carl",
  "Jellybean Jo",
  "Gumdrop Grace",
  "Sprinkles",
  "Sherbet Sid",
  "Marshmallow",
  "Pudding Paul",
  "Dumpling Dot",
  "Jelly Jim",
  "Fudgie",
  "Butterscotch",
  "Buttercup",
  "Caramel Curt",
  "Root Beer Rex",
  "Lemon Drop",
  "Peppermint",
  "Quackers",
  "Honkers",
  "Duck Duck Doug",
  "Baa Baa Beth",
  "Sheepish Sal",
  "Chonky Cat",
  "Chonky Cheeks",
  "Floof",
  "Floofers",
  "Sir Floofs",
  "Purrito",
  "Cat Loaf",
  "Loafing Lou",
  "Waffle Pup",
  "Pupper",
  "Pupperoni",
  "Doggo Dan",
  "Kitten Mitten",
  "Koala Tea",
  "Cozy Koala",
  "Otter Space",
  "Otterly",
  "Axolotl Al",
  "Pangolin Pat",
  "Slowpoke Seth",
  "Sloth Sprinter",
  "Dopey Dingo",
  "Snuggle Bunny",
  "Snuggle Pug",
  "Purr Box",
  "Whiskers",
  "Whiskerless",
  "Pawsitive",
  "Pause Paws",
  "Sofa Sloth",
  "Snooze Hound",
  "Prunes",
  "Beep Boop",
  "Hopscotch",
  "Hide N Seek",
  "Red Rover",
  "Simon Says",
  "Musical Chairs",
] as const;

/**
 * Normal: the pun tier. Witty grid-and-wordplay handles for the bot that
 * plays like a person who read one strategy article and liked it.
 */
const LEGACY_NORMAL_NAMES = [
  "Oh Brother",
  "Ohs Well",
  "O Snap",
  "Master of O",
  "X Marks Spot",
  "Xactly Right",
  "Xanadu",
  "Xavier",
  "Maximus",
  "Ex Nihilo",
  "Axis",
  "Axel",
  "Xray Vision",
  "Excalibur",
  "Xenon",
  "Xylophonic",
  "Xeno",
  "Ohm Sweet Ohm",
  "Oh Well Ollie",
  "Criss Cross",
  "Crossfire",
  "Double Cross",
  "Triple Cross",
  "Crosswalk Carl",
  "Crossword",
  "Mark My Words",
  "Marksmen",
  "Gridlock Gary",
  "Diagonal Dana",
  "Vertical Vic",
  "Horizontal Hal",
  "Parallel Pete",
  "Perpendicular",
  "Square Root",
  "Square Deal",
  "Square One Sid",
  "Corner Cam",
  "Cornerstone",
  "Column Kirby",
  "Rowbot Riley",
  "Linebacker",
  "Line Lord",
  "Off The Grid",
  "Grid Kid",
  "Box Thinker",
  "Kitty Corner",
  "Cats Game",
  "Three In A Row",
  "Tic Tac Tim",
  "Tac Toe Tina",
  "Tactician",
  "Noughty Nell",
  "Middle Row Mo",
  "Top Left Ted",
  "Player Two",
  "Player Three",
  "Sidekick",
  "Wildcard Walt",
  "High Roller",
  "Card Shark",
  "Poker Face Pat",
  "Bingo Bruno",
  "High Five",
  "Slot Machine",
  "Pinball Pete",
  "Cheeky Chimp",
  "Sassy Lassie",
  "Smug Mug",
  "Smirky",
  "Sarcastic Sam",
  "Chatty Cathy",
  "Quiet Quinn",
  "Drama Llama",
  "Messy Bessie",
  "Moody Judy",
  "Bold Moves",
  "Risk It Rick",
  "Chill Bill",
  "Mellow Fellow",
  "Sly Fox",
  "Tricky Vicky",
  "Jumpy Jerome",
  "Sneaky Steve",
  "Peekaboo",
  "Gotcha",
  "Plot Twist",
  "Plot Thickens",
  "Wing It",
  "Wingman Wes",
  "Copycat Cathy",
  "Pigeon Pair",
  "Stubborn Mule",
  "Steady Eddy",
  "Sore Loser Sam",
  "Sore Winner",
  "Second Best",
  "Lucky Clover",
  "Rabbit's Foot",
  "Horseshoe",
  "Wishbone",
  "Shooting Star",
  "Comet Carol",
  "Storm Chaser",
  "Bubble Wrap",
  "Riddle Me Rex",
  "No Idea Izzy",
  "Whatever Wendy",
  "Almost Alice",
  "So Close Sid",
  "Runner Up",
  "Underdog Ed",
  "Comeback Kid",
  "Dark Horse",
  "Understudy",
] as const;

/**
 * Hard: cold, sharp, a little concerning. The tier that reads a board like a
 * chess engine reads a position and sounds like it has already won.
 */
const LEGACY_HARD_NAMES = [
  "Minimax",
  "Alpha Beta",
  "Algorithm Al",
  "Deep Thought",
  "Null Pointer",
  "Seg Fault",
  "Off By One",
  "Infinite Loop",
  "Stack Smasher",
  "Bit Flipper",
  "Hard Drive",
  "Hard Reset",
  "Kernel Panic",
  "Sysadmin",
  "Daemon",
  "Sudo",
  "Root Access",
  "Middleware",
  "Quicksort",
  "Recursion",
  "Bitwise",
  "Binary",
  "Modal",
  "Regex",
  "Roninja",
  "Frostbyte",
  "Zero Sum",
  "Zero Hour",
  "Absolute Zero",
  "Entropy",
  "Heat Death",
  "The Void",
  "Abyss",
  "Nadir",
  "Zenith",
  "Apex",
  "Apex Predator",
  "Vertex",
  "Vector",
  "Matrix",
  "Singularity",
  "Paradox",
  "Oxymoron",
  "Enigma",
  "Cipher",
  "Ciphertext",
  "Sphinx",
  "Riddler Rex",
  "Puzzler",
  "Adversary",
  "Ringer",
  "Lag Wizard",
  "Frame Perfect",
  "Pixel Perfect",
  "Final Boss",
  "GameOverlord",
  "Overlord",
  "One More Turn",
  "Save Scummer",
  "Save Point",
  "Checkpoint",
  "Respawn",
  "Speedrunner",
  "No Scope",
  "Photo Finish",
  "O Negative",
  "Xenomaster",
  "Blocker Bill",
  "Blockparty",
  "Triple Threat",
  "Fork Tactician",
  "Forklift",
  "Pincer Pete",
  "Endgame",
  "Endgame Edgar",
  "Zugzwang",
  "Gambit",
  "Checkmate Moe",
  "Stalemate Stan",
  "Opening Book",
  "Theorycraft",
  "Metagame",
  "Grandmaster",
  "Prodigy",
  "Maestro",
  "Virtuoso",
  "Savant",
  "Oracle",
  "Cassandra",
  "Nostradamus",
  "Palm Reader",
  "Soothsayer",
  "Forecaster",
  "Optimum",
  "Optimal Otto",
  "Precision",
  "Scalpel",
  "Occam",
  "Occams Edge",
  "Vex",
  "Vortex",
  "Nemesis",
  "Frenemy",
  "Automaton",
  "Robot Ralph",
  "Servo",
  "Piston",
  "Gears",
  "Hardcase",
  "Deadbolt",
  "Locksmith",
  "Gatekeeper",
  "Keystone",
  "Ultimatum",
  "Cyclone",
  "Avalanche",
  "Landslide",
  "Domino Effect",
  "Chain Reaction",
  "Freight Train",
  "Steamroller",
  "Bulldozer",
  "Wrecking Ball",
  "Sidewinder",
  "King Cobra",
  "Viper",
  "Adder",
  "Mongoose",
  "Honey Badger",
  "Piranha",
  "Barracuda",
  "Mako",
  "Sharkbait",
  "Land Shark",
  "Orca",
  "Kraken",
  "Leviathan",
  "Behemoth",
  "Juggernaut",
  "Berserker",
  "Valkyrie",
  "Vanguard",
  "Sentinel",
  "Rattlesnake",
  "Boomslang",
  "Hawk Eye",
  "Peregrine",
  "Osprey",
  "Lone Wolf",
  "Alpha Wolf",
  "Zero Chill",
] as const;

const LEGACY_NPC_NAME_SET: ReadonlySet<string> = new Set<string>([
  ...LEGACY_EASY_NAMES,
  ...LEGACY_NORMAL_NAMES,
  ...LEGACY_HARD_NAMES,
]);

export interface NpcNameSession {
  /**
   * Draws one unused name from the difficulty's pool, without repeats.
   * Locale defaults to the UI language; pass it explicitly to pin a cast.
   */
  pick(difficulty: AI_DifficultyType): string;
  pick(locale: Locale | undefined, difficulty: AI_DifficultyType): string;
}

/**
 * One browser session's draw pile. Picks avoid every name already drawn and
 * never repeat the name just shown; when the requested tier runs dry the
 * draw widens to the locale's whole cast, and when that runs out too the
 * pile resets (reserving only the predecessor) so the session never
 * dead-ends. An injected rng keeps tests deterministic; the app uses
 * Math.random.
 */
export function createNpcNameSession(rng: () => number = Math.random): NpcNameSession {
  const used = new Set<string>();
  let last: string | null = null;

  const drawFrom = (pool: readonly string[]): string => {
    const index = Math.min(Math.floor(rng() * pool.length), pool.length - 1);
    return pool[index]!;
  };

  const fresh = (pool: readonly string[]): string[] =>
    pool.filter((name) => !used.has(name) && name !== last);

  const isLocaleArg = (value: unknown): value is Locale => value === "en" || value === "es";

  const pick = (
    first: AI_DifficultyType | Locale | undefined,
    second?: AI_DifficultyType | Locale,
  ): string => {
    // Both call shapes land here: pick(difficulty) and pick(locale, difficulty).
    // The value sets are disjoint, so each argument is classified by what it is.
    const args = [first, second];
    const locale = args.find(isLocaleArg) ?? getLocale();
    const difficulty =
      args.find(
        (arg): arg is AI_DifficultyType =>
          arg === AI_Difficulty.EASY ||
          arg === AI_Difficulty.NORMAL ||
          arg === AI_Difficulty.HARD,
      ) ?? AI_Difficulty.NORMAL;

    const tier = NPC_NAME_TIERS[locale][difficulty];
    const roster = ROSTER_BY_LOCALE[locale];
    const tierFresh = fresh(tier);
    const pool = tierFresh.length > 0 ? tierFresh : fresh(roster);
    let name: string;
    if (pool.length > 0) {
      name = drawFrom(pool);
    } else {
      // A session longer than the roster: forget the pile rather than
      // dead-end, reserve only the name just shown, and draw again.
      used.clear();
      used.add(last ?? "");
      const again = tier.filter((name) => name !== last);
      name = drawFrom(again.length > 0 ? again : tier);
    }
    used.add(name);
    last = name;
    return name;
  };

  return { pick };
}

/** The application-wide draw pile: no repeat within a browser session. */
export const npcNameSession = createNpcNameSession();

/**
 * True when `name` is a roster persona — the "this name drew itself" check.
 * The retired gag roster stays recognized for one release so a saved
 * persona still redraws on rematch instead of freezing (design doc §5).
 */
export function isNpcName(name: string): boolean {
  return NPC_NAME_SET.has(name) || LEGACY_NPC_NAME_SET.has(name);
}
