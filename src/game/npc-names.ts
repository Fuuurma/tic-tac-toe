import { AI_Difficulty, type AI_Difficulty as AI_DifficultyType } from "./constants";

/**
 * The persona roster for the vs-computer opponent.
 *
 * The opponent used to be a bare label — "AI" in the lobby, "CPU" in tests —
 * everywhere a name should have been. A name is a small piece of the
 * product's voice: the lobby card greets you with who is about to sit down,
 * the turn line reads "Wobbles thinking", the win banner names the winner.
 * The roster backs that with one source of truth: three difficulty pools of
 * short, family-friendly handle-style names, drawn without repeats for the
 * length of a browser session.
 *
 * The approach (not the names) is borrowed from gambit-deck's guest identity:
 * themed `as const` pools, a rare flavored tier, a secure-ish random draw
 * through one function, and tests that pin length, uniqueness and hygiene
 * against the repo's single display-name gate.
 *
 * Rules for a name here:
 *   - 2 to 14 characters (the lobby validates opponent names 2-20; we stay
 *     inside that with room for a difficulty badge beside the card name).
 *   - Survives `sanitizeDisplayName` unchanged (it will be shown and stored
 *     through that gate).
 *   - No fragment from BANNED_NAME_FRAGMENTS, family-friendly by design.
 *   - English only: unlike guest names (localized), a persona is a proper
 *     noun — puns do not translate.
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
] as const;

/**
 * Easy: gentle, a little dim, mostly snacks and sleepy animals. Beating this
 * bot should feel like taking candy from someone who was holding it for you.
 */
const EASY_NAMES = [
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
const NORMAL_NAMES = [
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
const HARD_NAMES = [
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

/**
 * The pools by difficulty. `Record` so a new difficulty fails to compile
 * until this table grows with it.
 */
export const NPC_NAME_TIERS: Record<AI_DifficultyType, readonly string[]> = {
  [AI_Difficulty.EASY]: EASY_NAMES,
  [AI_Difficulty.NORMAL]: NORMAL_NAMES,
  [AI_Difficulty.HARD]: HARD_NAMES,
};

const ALL_NAMES: readonly string[] = [...EASY_NAMES, ...NORMAL_NAMES, ...HARD_NAMES];

/** The whole roster, flat — consumers that only need the list (e2e pins). */
export const NPC_NAMES = ALL_NAMES;

const NPC_NAME_SET: ReadonlySet<string> = new Set<string>(ALL_NAMES);

export interface NpcNameSession {
  /** Draws one unused name from the difficulty's pool, without repeats. */
  pick: (difficulty: AI_DifficultyType) => string;
}

/**
 * One browser session's draw pile. Picks avoid every name already drawn and
 * never repeat the name just shown; when the requested tier runs dry the
 * draw widens to the whole roster, and when that runs out too the pile
 * resets (reserving only the predecessor) so the session never dead-ends.
 * An injected rng keeps tests deterministic; the app uses Math.random.
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

  const pick = (difficulty: AI_DifficultyType): string => {
    const tier = NPC_NAME_TIERS[difficulty];
    const tierFresh = fresh(tier);
    const pool = tierFresh.length > 0 ? tierFresh : fresh(ALL_NAMES);
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

/** True when `name` is a roster persona — the "this name drew itself" check. */
export function isNpcName(name: string): boolean {
  return NPC_NAME_SET.has(name);
}
