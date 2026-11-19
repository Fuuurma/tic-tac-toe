import { getLocale } from "@/i18n/language";
import type { Locale } from "@/lib/preferences";
import { AI_Difficulty, type AI_Difficulty as AI_DifficultyType } from "./constants";

/**
 * The Cast — the persona roster for the vs-computer opponent.
 *
 * The opponent used to be a bare label — "AI" in the lobby, "CPU" in tests —
 * everywhere a name should have been. A name is a small piece of the
 * product's voice: the lobby card greets you with who is about to sit down,
 * the turn line reads "Jaque pensando", the win banner names the winner.
 *
 * The roster is the authored Cast from docs/ttt-ai-names-design-20261117.md
 * §2: ten characters per difficulty tier per locale. EN and ES each field
 * their own cast, written natively rather than translated — a proper noun is
 * the one handle that survives a language switch, and a pun that only works
 * in English gets a different native equivalent in Spanish instead of a
 * calque. Repetition is the feature: meeting "Jaque" for the third time
 * should feel like meeting a rival again, not re-pulling a slot machine.
 *
 * The machinery is the one the gag roster proved: themed `as const` pools
 * behind `NPC_NAME_TIERS`, a secure-ish random draw through one function,
 * and tests that pin length, uniqueness and hygiene against the repo's
 * single display-name gate. What changed is authorship — curated
 * characters instead of generated combos.
 *
 * Rules for a name here:
 *   - 2 to 14 characters (the lobby validates opponent names 2-20; we stay
 *     inside that with room for a difficulty badge beside the card name).
 *   - Survives `sanitizeDisplayName` unchanged (it will be shown and stored
 *     through that gate).
 *   - No fragment from BANNED_NAME_FRAGMENTS, in either language — the
 *     roster is family-friendly by design.
 */

export const NPC_NAME_MAX_LENGTH = 14;

/**
 * Substrings no roster name may contain, matched case-insensitively. The
 * roster is hand-authored and this is its guardrail: the tests hold every
 * name against this list, so a future edit that drifts dirty cannot land
 * quietly. Fragments are chosen to be distinctive roots — a fragment like
 * "die" would ban "soldier", so collision-prone short words are left out and
 * the hygiene lives in the authoring instead.
 *
 * The English set came first; the Spanish set (design doc §4) guards the ES
 * cast the same way. "Zorro" stays clean because "zorra" needs the final a —
 * substring checks are safe here, but the fragment list must grow before a
 * dirty ES name can land quietly.
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
 * Easy — the house guests: harmless, young, snack-powered. Beating this
 * bot should feel like taking candy from someone who was holding it for
 * you. The ES cast is the same archetypes with native names, not
 * translations: Nico is not "Pip", he is the littlest in his own way.
 */
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

/**
 * Normal — the club regulars: reads the board, has a personality. Witty
 * handles for the bot that plays like a person who read one strategy
 * article and liked it.
 */
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

/**
 * Hard — the inevitability engine: depth-8, reads everything. Cold, sharp,
 * a little concerning — the tier that reads a board like a chess engine
 * reads a position and sounds like it has already won.
 */
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
 * The casts by locale then difficulty. `Record` at both levels so a new
 * locale or difficulty fails to compile until this table grows with it.
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

/** One locale's whole cast, flat — the widening pool when a tier runs dry. */
const LOCALE_ROSTERS: Record<Locale, readonly string[]> = {
  en: [...EN_EASY_NAMES, ...EN_NORMAL_NAMES, ...EN_HARD_NAMES],
  es: [...ES_EASY_NAMES, ...ES_NORMAL_NAMES, ...ES_HARD_NAMES],
};

const ALL_NAMES: readonly string[] = [...LOCALE_ROSTERS.en, ...LOCALE_ROSTERS.es];

/** The whole roster, flat — consumers that only need the list (e2e pins). */
export const NPC_NAMES = ALL_NAMES;

/**
 * The gag roster the Cast replaced (landed 2026-11-16, swapped 2026-11-19).
 * Never drawn — the piles above only deal Cast names — but still recognized
 * by `isNpcName`, the design doc §5 migration edge resolved toward
 * recognition: a persona saved in `preferences.opponentName` before the
 * swap keeps reading as session-drawn, so the next reset deals a Cast name
 * instead of freezing the old gag as if the player had typed it. Retire
 * this list once saved preferences can no longer hold it.
 */
const LEGACY_NPC_NAMES = [
  "Big Oh", "Lil X", "Xoxo", "Xoxo Foxo", "Ohsie", "Exie",
  "Xylo", "Xylophone Kid", "Little O", "Oh Deer", "Ohh La La", "Oopsy",
  "Oopsy Daisy", "Boxy", "Squiggles", "Doodles", "Noodles", "Noodle Noob",
  "Wobblekins", "Wobbles", "Wobbly Winnie", "Bumbles", "Bumble Bear", "Bumbling Bo",
  "Bloop", "Boops", "Bubbles", "Bubblegum Bo", "Giggles", "Gigglesworth",
  "Giggles McGee", "Snorkel Sam", "Snoozy Sue", "Snooze Cruise", "Yawns", "Goofball",
  "Goofy Gus", "Silly Billy", "Loopy Larry", "Waffles", "Toasty", "Pancake Pat",
  "Maple Syrup Mo", "Gummy Greg", "Pickle Pete", "Pretzel Pam", "Bagel Beth", "Muffin Max",
  "Toast Tony", "Nugget Ned", "Nugget Nell", "Cookie Crumb", "Cupcake Carl", "Jellybean Jo",
  "Gumdrop Grace", "Sprinkles", "Sherbet Sid", "Marshmallow", "Pudding Paul", "Dumpling Dot",
  "Jelly Jim", "Fudgie", "Butterscotch", "Buttercup", "Caramel Curt", "Root Beer Rex",
  "Lemon Drop", "Peppermint", "Quackers", "Honkers", "Duck Duck Doug", "Baa Baa Beth",
  "Sheepish Sal", "Chonky Cat", "Chonky Cheeks", "Floof", "Floofers", "Sir Floofs",
  "Purrito", "Cat Loaf", "Loafing Lou", "Waffle Pup", "Pupper", "Pupperoni",
  "Doggo Dan", "Kitten Mitten", "Koala Tea", "Cozy Koala", "Otter Space", "Otterly",
  "Axolotl Al", "Pangolin Pat", "Slowpoke Seth", "Sloth Sprinter", "Dopey Dingo", "Snuggle Bunny",
  "Snuggle Pug", "Purr Box", "Whiskers", "Whiskerless", "Pawsitive", "Pause Paws",
  "Sofa Sloth", "Snooze Hound", "Prunes", "Beep Boop", "Hopscotch", "Hide N Seek",
  "Red Rover", "Simon Says", "Musical Chairs", "Oh Brother", "Ohs Well", "O Snap",
  "Master of O", "X Marks Spot", "Xactly Right", "Xanadu", "Xavier", "Maximus",
  "Ex Nihilo", "Axis", "Axel", "Xray Vision", "Excalibur", "Xenon",
  "Xylophonic", "Xeno", "Ohm Sweet Ohm", "Oh Well Ollie", "Criss Cross", "Crossfire",
  "Double Cross", "Triple Cross", "Crosswalk Carl", "Crossword", "Mark My Words", "Marksmen",
  "Gridlock Gary", "Diagonal Dana", "Vertical Vic", "Horizontal Hal", "Parallel Pete", "Perpendicular",
  "Square Root", "Square Deal", "Square One Sid", "Corner Cam", "Cornerstone", "Column Kirby",
  "Rowbot Riley", "Linebacker", "Line Lord", "Off The Grid", "Grid Kid", "Box Thinker",
  "Kitty Corner", "Cats Game", "Three In A Row", "Tic Tac Tim", "Tac Toe Tina", "Tactician",
  "Noughty Nell", "Middle Row Mo", "Top Left Ted", "Player Two", "Player Three", "Sidekick",
  "Wildcard Walt", "High Roller", "Card Shark", "Poker Face Pat", "Bingo Bruno", "High Five",
  "Slot Machine", "Pinball Pete", "Cheeky Chimp", "Sassy Lassie", "Smug Mug", "Smirky",
  "Sarcastic Sam", "Chatty Cathy", "Quiet Quinn", "Drama Llama", "Messy Bessie", "Moody Judy",
  "Bold Moves", "Risk It Rick", "Chill Bill", "Mellow Fellow", "Sly Fox", "Tricky Vicky",
  "Jumpy Jerome", "Sneaky Steve", "Peekaboo", "Gotcha", "Plot Twist", "Plot Thickens",
  "Wing It", "Wingman Wes", "Copycat Cathy", "Pigeon Pair", "Stubborn Mule", "Steady Eddy",
  "Sore Loser Sam", "Sore Winner", "Second Best", "Lucky Clover", "Rabbit's Foot", "Horseshoe",
  "Wishbone", "Shooting Star", "Comet Carol", "Storm Chaser", "Bubble Wrap", "Riddle Me Rex",
  "No Idea Izzy", "Whatever Wendy", "Almost Alice", "So Close Sid", "Runner Up", "Underdog Ed",
  "Comeback Kid", "Dark Horse", "Understudy", "Minimax", "Alpha Beta", "Algorithm Al",
  "Deep Thought", "Null Pointer", "Seg Fault", "Off By One", "Infinite Loop", "Stack Smasher",
  "Bit Flipper", "Hard Drive", "Hard Reset", "Kernel Panic", "Sysadmin", "Daemon",
  "Sudo", "Root Access", "Middleware", "Quicksort", "Recursion", "Bitwise",
  "Binary", "Modal", "Regex", "Roninja", "Frostbyte", "Zero Sum",
  "Zero Hour", "Absolute Zero", "Entropy", "Heat Death", "The Void", "Abyss",
  "Nadir", "Zenith", "Apex", "Apex Predator", "Vertex", "Vector",
  "Matrix", "Singularity", "Paradox", "Oxymoron", "Enigma", "Cipher",
  "Ciphertext", "Sphinx", "Riddler Rex", "Puzzler", "Adversary", "Ringer",
  "Lag Wizard", "Frame Perfect", "Pixel Perfect", "Final Boss", "GameOverlord", "Overlord",
  "One More Turn", "Save Scummer", "Save Point", "Checkpoint", "Respawn", "Speedrunner",
  "No Scope", "Photo Finish", "O Negative", "Xenomaster", "Blocker Bill", "Blockparty",
  "Triple Threat", "Fork Tactician", "Forklift", "Pincer Pete", "Endgame", "Endgame Edgar",
  "Zugzwang", "Gambit", "Checkmate Moe", "Stalemate Stan", "Opening Book", "Theorycraft",
  "Metagame", "Grandmaster", "Prodigy", "Maestro", "Virtuoso", "Savant",
  "Oracle", "Cassandra", "Nostradamus", "Palm Reader", "Soothsayer", "Forecaster",
  "Optimum", "Optimal Otto", "Precision", "Scalpel", "Occam", "Occams Edge",
  "Vex", "Vortex", "Nemesis", "Frenemy", "Automaton", "Robot Ralph",
  "Servo", "Piston", "Gears", "Hardcase", "Deadbolt", "Locksmith",
  "Gatekeeper", "Keystone", "Ultimatum", "Cyclone", "Avalanche", "Landslide",
  "Domino Effect", "Chain Reaction", "Freight Train", "Steamroller", "Bulldozer", "Wrecking Ball",
  "Sidewinder", "King Cobra", "Viper", "Adder", "Mongoose", "Honey Badger",
  "Piranha", "Barracuda", "Mako", "Sharkbait", "Land Shark", "Orca",
  "Kraken", "Leviathan", "Behemoth", "Juggernaut", "Berserker", "Valkyrie",
  "Vanguard", "Sentinel", "Rattlesnake", "Boomslang", "Hawk Eye", "Peregrine",
  "Osprey", "Lone Wolf", "Alpha Wolf", "Zero Chill",
] as const;

const NPC_NAME_SET: ReadonlySet<string> = new Set<string>([...ALL_NAMES, ...LEGACY_NPC_NAMES]);

const isLocaleArg = (value: AI_DifficultyType | Locale | undefined): value is Locale =>
  value === "en" || value === "es";

export interface NpcNameSession {
  /**
   * Draws one unused name from the difficulty's pool, without repeats. The
   * cast follows the UI locale — `getLocale()` when `locale` is omitted —
   * and the locale argument may lead or follow the difficulty.
   */
  pick: {
    (difficulty: AI_DifficultyType, locale?: Locale): string;
    (locale: Locale, difficulty: AI_DifficultyType): string;
  };
}

/**
 * One browser session's draw pile. Picks avoid every name already drawn and
 * never repeat the name just shown; when the requested tier runs dry the
 * draw widens to the rest of the locale's cast, and when that runs out too
 * the pile resets (reserving only the predecessor) so the session never
 * dead-ends. A pick never leaves its locale: a Spanish UI is not dealt an
 * English persona. An injected rng keeps tests deterministic; the app uses
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

  const pick = ((
    first: AI_DifficultyType | Locale,
    second?: AI_DifficultyType | Locale,
  ): string => {
    const locale = isLocaleArg(first) ? first : isLocaleArg(second) ? second : getLocale();
    const difficulty = (isLocaleArg(first) ? second : first) as AI_DifficultyType;
    const tier = NPC_NAME_TIERS[locale][difficulty];
    const tierFresh = fresh(tier);
    const pool = tierFresh.length > 0 ? tierFresh : fresh(LOCALE_ROSTERS[locale]);
    let name: string;
    if (pool.length > 0) {
      name = drawFrom(pool);
    } else {
      // A session longer than the cast: forget the pile rather than
      // dead-end, reserve only the name just shown, and draw again.
      used.clear();
      used.add(last ?? "");
      const again = tier.filter((name) => name !== last);
      name = drawFrom(again.length > 0 ? again : tier);
    }
    used.add(name);
    last = name;
    return name;
  }) as NpcNameSession["pick"];

  return { pick };
}

/** The application-wide draw pile: no repeat within a browser session. */
export const npcNameSession = createNpcNameSession();

/**
 * True when `name` is a roster persona — Cast or retired gag roster — the
 * "this name drew itself" check.
 */
export function isNpcName(name: string): boolean {
  return NPC_NAME_SET.has(name);
}
