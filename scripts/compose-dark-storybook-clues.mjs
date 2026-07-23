import { mkdir, readFile, access, writeFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const course = JSON.parse(await readFile(join(ROOT, "src/data/ket-course.json"), "utf8"));
const emoji = JSON.parse(await readFile(join(ROOT, "node_modules/openmoji/data/openmoji.json"), "utf8"));
const iconDir = join(ROOT, "node_modules/openmoji/color/svg");
const BASE_PAINTINGS = [
  "again", "already", "alone", "along", "also", "always", "amazed", "amazing", "an", "answer",
  "any", "anything", "anyway", "area", "arm", "at-all", "attractive", "autumn", "away", "awful",
].map((slug) => join(ROOT, "public/images/a", `${slug}.webp`));

const args = new Set(process.argv.slice(2));
const force = args.has("--force");
const dryRun = args.has("--dry-run");
const only = process.argv.find((arg) => arg.startsWith("--only="))
  ?.slice("--only=".length)
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);

const STOP = new Set([
  "a", "an", "and", "are", "at", "be", "been", "being", "by", "do", "does", "for", "from", "has", "have",
  "in", "is", "it", "its", "of", "on", "or", "that", "the", "their", "them", "this", "to", "use", "used", "very",
  "was", "were", "what", "when", "where", "which", "who", "with", "you", "your", "thing", "things", "one", "someone",
  "something", "person", "people", "show", "showing", "clear", "simple", "storybook", "scene", "rounded", "looks", "acting",
  "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten",
]);

// Abstract KET words need a concrete visual bridge. These queries choose the
// prop or action while the layouts below show the relationship itself.
const VISUAL_QUERY = {
  "a/an": "one apple",
  "a few": "three apples",
  "a little": "small cup water",
  "a lot": "many boxes",
  "about": "question face",
  "above": "balloon house",
  "across": "walking bridge",
  "actually": "magnifying glass",
  "after": "clock footsteps",
  "again": "repeat arrows",
  "against": "two people pushing",
  "ago": "clock past",
  "all": "group people",
  "all right/alright": "bandage smiling face",
  "all the time": "clock circle",
  "almost": "finish flag",
  "alone": "one person",
  "along": "walking path",
  "already": "check mark clock",
  "also": "plus sign gift",
  "although": "rain umbrella smile",
  "always": "clock circle",
  "among": "one red apple green apples",
  "and": "two friends together",
  "another": "second apple",
  "any": "choice boxes",
  "anymore": "empty box",
  "anyone": "crowd question",
  "anything": "box question",
  "anywhere": "map pins",
  "around": "circle arrows house",
  "as": "same size scales",
  "as well": "plus sign",
  "as well (as)": "plus sign friends",
  "at": "map pin house",
  "at all": "empty hands",
  "away": "walking far house",
  "back": "person from behind",
  "bad": "broken toy",
  "badly": "sad broken toy",
  "because": "rain umbrella house",
  "before": "hands lunch clock",
  "behind": "person behind tree",
  "below": "ball under table",
  "beside": "two friends side by side",
  "best": "gold medal",
  "better": "two stars one brighter",
  "between": "small person between two trees",
  "both": "two hands",
  "but": "sun rain umbrella",
  "by": "person beside house",
  "certainly": "check mark",
  "could": "raising hand red question mark",
  "daily": "calendar sunrise",
  "down": "down arrow stairs",
  "each": "gift for every child",
  "either": "two doors choice",
  "else": "second choice door",
  "enough": "full cup",
  "even": "small child lifting weight",
  "ever": "clock question",
  "every": "check marks group",
  "everybody": "crowd people",
  "everyone": "crowd people",
  "everything": "full box objects",
  "everywhere": "map many pins",
  "exactly": "bullseye target",
  "except": "one outside group",
  "far": "tiny house horizon",
  "few": "three apples",
  "first": "gold medal number one",
  "for": "gift giving",
  "from": "arrow leaving house",
  "further": "long road horizon",
  "get": "incoming envelope wrapped gift",
  "here": "map pin feet",
  "however": "cloud with rain soccer ball",
  "how": "question face gears",
  "if": "motorway red question mark",
  "in": "toy inside box",
  "including": "objects inside circle",
  "inside": "person inside house",
  "instead": "swap arrows two objects",
  "instead of": "swap arrows two objects",
  "just": "small clock",
  "last": "person at end line",
  "least": "smallest pile",
  "left": "left arrow hand",
  "less": "small pile large pile",
  "like": "heart person",
  "lots/a lot": "many boxes",
  "many": "many apples",
  "may": "open door question",
  "might": "cloud rain question",
  "more": "bigger pile plus",
  "most": "largest pile",
  "much": "full basket",
  "must": "stop sign seat belt",
  "near": "person close house",
  "next to": "two chairs side by side",
  "no": "cross mark hand",
  "nobody": "empty room",
  "nothing": "empty box",
  "now": "clock now",
  "off": "lamp switched off",
  "often": "calendar many marks",
  "OK/okay": "thumbs up",
  "on": "book on table",
  "only": "one apple spotlight",
  "opposite": "two people facing",
  "or": "two paths choice",
  "other": "second different object",
  "out": "person leaving door",
  "out of": "person leaving box",
  "over": "bird flying over house",
  "past": "person walking past house",
  "perhaps": "question cloud",
  "plus": "plus sign apples",
  "possibly": "question cloud",
  "quite": "cup almost full",
  "rather": "choosing one of two",
  "really": "magnifying glass check",
  "right": "right arrow hand",
  "round": "circle ball",
  "same": "two matching socks",
  "seem": "shadow question",
  "several": "four apples",
  "shall": "two friends question",
  "should": "helpful sign",
  "since": "calendar arrow",
  "so": "rain house arrow",
  "some": "several apples",
  "somebody": "person silhouette",
  "someone": "person silhouette",
  "something": "mystery box",
  "sometimes": "calendar few marks",
  "somewhere": "map question pin",
  "still": "person waiting clock",
  "such": "pointing example",
  "than": "two objects scales",
  "that": "pointing far object",
  "then": "two pictures arrow",
  "there": "pointing far place",
  "these": "pointing near objects",
  "this": "pointing near object",
  "those": "pointing far objects",
  "through": "person walking through tunnel",
  "till": "waiting clock",
  "to": "arrow toward house",
  "together": "friends holding hands",
  "too": "plus sign friend",
  "under": "cat under table",
  "until": "waiting clock",
  "up": "up arrow stairs",
  "us": "two friends waving",
  "usually": "calendar many marks",
  "very": "large exclamation mark",
  "well": "thumbs up smile",
  "what": "question box",
  "when": "question clock",
  "where": "question map pin",
  "which": "choice objects question",
  "while": "reading while cooking",
  "who": "question person",
  "whole": "complete puzzle",
  "whose": "bag question person",
  "why": "question light bulb",
  "will ('ll)": "calendar future arrow",
  "with": "two friends together",
  "without": "one person empty hands",
  "would": "cup tea please",
  "different": "sun moon",
  "writer": "writing hand books",
  "yet": "waiting clock",
};

function addVisualQueries(words, query) {
  words.split("|").forEach((word) => { VISUAL_QUERY[word] = query; });
}

addVisualQueries("Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday|January|February|March|April|May|June|July|August|September|October|November|December", "spiral calendar");
addVisualQueries("day|daily|week|weekday|weekend|weekly|month|monthly|year|century|date|today|tomorrow|yesterday|recently", "spiral calendar|alarm clock");
addVisualQueries("afternoon|evening|midday|midnight|morning|night|noon|tonight", "alarm clock|sunrise");
addVisualQueries("early|immediately|later|latest|moment|now|soon|time", "alarm clock");
addVisualQueries("cent|pence|penny|price|cost|discount|pay|rent|cheap|expensive|rich|poor|earn|spend|sale|for sale", "coin|money bag");
addVisualQueries("centimetre/centimeter (cm)|kilometre (km)|metre|mile|length|wide|tall|short|size", "straight ruler|triangular ruler");
addVisualQueries("gram(me)|kilogramme (kg)", "balance scale|flexed biceps");
addVisualQueries("litre", "pouring liquid|cup with straw");
addVisualQueries("he|him|his|himself|Mr|man|boy|dad|father|grand(d)ad|grandfather|grandpa|husband|son|uncle", "man|boy");
addVisualQueries("she|her|hers|herself|Ms|Miss|Mrs|woman|girl|mum|mom|mother|grandma|grandmother|granny|wife|daughter", "woman|girl");
addVisualQueries("they|them|their|theirs|themselves|people|everybody|everyone|somebody|someone|nobody|person|crowd", "busts in silhouette|bust in silhouette");
addVisualQueries("we|us|our|ours|ourselves", "people holding hands|palms up together");
addVisualQueries("you|your|yours|yourself", "bust in silhouette|backhand index pointing left");
addVisualQueries("a few|few|several|some", "green apple|apple");
addVisualQueries("all|many|much|most|lots / a lot", "busts in silhouette|basket");
addVisualQueries("each|every", "wrapped gift|busts in silhouette");
addVisualQueries("least|less|little|only", "small blue diamond|apple");
addVisualQueries("another|other|pair|both", "green apple|apple");
addVisualQueries("band|concert|music|musical|musician|song|tune (music)", "musical notes|microphone");
addVisualQueries("bedroom", "bed|house");
addVisualQueries("begin|beginning|start", "1st place medal|right arrow");
addVisualQueries("beginner|learn|lesson|study|studies|training (transitive and intransitive)", "school|books");
addVisualQueries("business|business person|businessman|businesswoman|company|job|occupation|work", "office building|briefcase");
addVisualQueries("ceiling|roof|upstairs", "house|backhand index pointing up");
addVisualQueries("celebrate|congratulations!|festival|event|party", "party popper|balloon");
addVisualQueries("celebrity|famous|popular", "glowing star|camera with flash");
addVisualQueries("centre/center|corner|middle", "bullseye|round pushpin");
addVisualQueries("certainly|correct|exactly|perfect|real|sure|true|yes", "check mark button|thumbs up");
addVisualQueries("channel|programme|program", "television|film frames");
addVisualQueries("character|actor|comic", "performing arts|film frames");
addVisualQueries("check|cheque", "check mark button|money bag");
addVisualQueries("chef|cook|cooker", "cook|cooking");
addVisualQueries("chemist|drugstore|pharmacy|medicine", "pill|medical symbol");
addVisualQueries("choose|decide|either|or|prefer / would prefer|which", "red question mark|left right black arrow");
addVisualQueries("class|classmate|classroom|college|schoolchild|pupil|subject|vocabulary|examination/exam|quiz|homework|grade", "school|books");
addVisualQueries("clean|clear|tidy|tidy up", "sparkles|bubbles");
addVisualQueries("click|computer|digital|IT|online|PC (personal computer)|platform|software|technology|website", "laptop|computer mouse");
addVisualQueries("coast|harbour|ocean|river|sea", "water wave|sailboat");
addVisualQueries("colleague|friend|friendly|member|neighbour|partner|team", "people holding hands|handshake");
addVisualQueries("collect|include|including|set|variety|various", "card file box|assembly group");
addVisualQueries("colour", "artist palette|rainbow");
addVisualQueries("come|go|arrive|leave|travel|visit", "man walking|right arrow");
addVisualQueries("comedy|funny|laugh", "face with tears of joy|performing arts");
addVisualQueries("competition|match|race|score|win|winner", "trophy|sports medal");
addVisualQueries("complete|continue|final|finally|finish", "check mark button|finish flag");
addVisualQueries("conversation|chat|chatroom|discuss|explain|say|speak|talk|tell", "people dialogue|speech balloon");
addVisualQueries("country|countryside|geography|international|nationality", "world map|house with garden");
addVisualQueries("course|path|road|street", "motorway|man walking");
addVisualQueries("crowded", "bus|busts in silhouette");
addVisualQueries("dear|email|invitation|invite|letter|postcard", "love letter|envelope");
addVisualQueries("degree|temperature", "thermometer|straight ruler");
addVisualQueries("delay|delayed|wait", "alarm clock|hourglass not done");
addVisualQueries("describe|example|fact|information|instructions|paragraph|sentence|text|topic|word", "memo|open book");
addVisualQueries("design|draw|drawing|paint|painter|painting", "artist palette|crayon");
addVisualQueries("difference|different|same|similar", "sun|crescent moon");
addVisualQueries("difficult|hard|impossible|problem|trouble|wrong|worse|worst", "cross mark|puzzle piece");
addVisualQueries("diploma|document|licence|passport", "scroll|identification card");
addVisualQueries("dirty", "mud|soap");
addVisualQueries("discover|explore|find|find out|look for", "magnifying glass tilted left|world map");
addVisualQueries("do|make|put|take|use", "hammer and wrench|flexed biceps");
addVisualQueries("drawer|cupboard|cabinet|closet|wardrobe", "file cabinet|door");
addVisualQueries("during|since|while", "alarm clock|right arrow");
addVisualQueries("easy|easily|simple", "thumbs up|smiling face with smiling eyes");
addVisualQueries("else|instead|instead of|other", "left right black arrow|right arrow");
addVisualQueries("enter|entrance|exit|out|outside", "door|man walking");
addVisualQueries("environment|nature|natural|wildlife", "deciduous tree|deer");
addVisualQueries("equipment|instrument|tool", "hammer and wrench|toolbox");
addVisualQueries("eraser", "pencil|memo");
addVisualQueries("especially|important|special|very", "glowing star|exclamation mark");
addVisualQueries("exhibition|gallery|museum", "framed picture|artist palette");
addVisualQueries("experience|experiment|physics|science", "microscope|test tube");
addVisualQueries("fair|good|great|nice|pleasant|wonderful|excellent|fantastic", "thumbs up|glowing star");
addVisualQueries("favourite|like|love|lovely", "red heart|smiling face with heart-eyes");
addVisualQueries("feel|feelings", "thinking face|red heart");
addVisualQueries("fill|full|enough", "cup with straw|basket");
addVisualQueries("fit|get fit|healthy|health|helpful|useful", "flexed biceps|red heart");
addVisualQueries("follow", "footprints|right arrow");
addVisualQueries("foreign|international", "world map|airplane");
addVisualQueries("form|list", "clipboard|memo");
addVisualQueries("free|available", "open hands|open door");
addVisualQueries("fresh", "sparkles|green apple");
addVisualQueries("further|far|away", "motorway|derelict house");
addVisualQueries("give|offer|lend|receive", "palm up hand|wrapped gift");
addVisualQueries("good morning|good afternoon|good evening|good night|hello|hi|hey|goodbye|welcome", "waving hand|sunrise");
addVisualQueries("hate|unhappy|sorry|shame|pity", "crying face|broken heart");
addVisualQueries("have|belong|own", "clutch bag|person raising hand");
addVisualQueries("help|helpful|look after", "help others|red heart");
addVisualQueries("here|there|where|somewhere|anywhere|everywhere", "round pushpin|world map");
addVisualQueries("history|past|ago", "hourglass done|old key");
addVisualQueries("homework|lesson|study|studies", "books|school");
addVisualQueries("huge|big|large|wide", "derelict house|small airplane");
addVisualQueries("idea|opinion|plan|reason|suggest|think|understand", "light bulb|thought balloon");
addVisualQueries("immediately|quick|quickly|suddenly", "dashing away|alarm clock");
addVisualQueries("ingredient|meal|main course|supper|dinner|lunch|snack", "fork and knife with plate|pot of food");
addVisualQueries("inside|in", "bento box|ballot box with ballot");
addVisualQueries("interested|interesting", "magnifying glass tilted left|glowing star");
addVisualQueries("it|its|itself|thing|something|anything|everything|nothing", "package|red question mark");
addVisualQueries("jewellery|earring|necklace|bracelet", "gem stone|ring");
addVisualQueries("journalist|writer|write|writing|write down", "writing hand|books");
addVisualQueries("journey|trip|tour|tourist", "luggage|airplane");
addVisualQueries("language|spelling|spell", "speech balloon|books");
addVisualQueries("leather|wooden|metal|plastic|wool", "toolbox|thread");
addVisualQueries("lend|give|offer", "palm up hand|wrapped gift");
addVisualQueries("let|allow|can|could|may|might|shall|should|will ('ll)|would", "open door|red question mark");
addVisualQueries("live|life", "red heart|house");
addVisualQueries("local|near|next to|close to", "round pushpin|house");
addVisualQueries("make-up|perfume|fashion|good-looking|smart (stylish)", "lipstick|sparkles");
addVisualQueries("matter|mind|memory|remember|forget|know", "brain|thought balloon");
addVisualQueries("mean", "speech balloon|red question mark");
addVisualQueries("meet|meeting|join|take part", "handshake|busts in silhouette");
addVisualQueries("nervous|worried|worry|afraid|frightened|scared|scary", "worried face|fearful face");
addVisualQueries("news|newspaper|magazine|article|review", "newspaper|books");
addVisualQueries("noise|noisy|loud|shout", "speaker high volume|speaking head");
addVisualQueries("normal|usual|usually|often|always|never|sometimes", "spiral calendar|check mark button");
addVisualQueries("number|total", "keycap: 1234|abacus");
addVisualQueries("of course|OK/okay|all right/alright", "thumbs up|check mark button");
addVisualQueries("opinion|idea", "thought balloon|speech balloon");
addVisualQueries("pardon|please|thank|thanks|thank you", "folded hands|waving hand");
addVisualQueries("pass|fail|test", "check mark button|cross mark");
addVisualQueries("performance (ENTERTAINMENT)|perform (ENTERTAIN)|play|theatre", "performing arts|film frames");
addVisualQueries("photographer|photography|photo(graph)", "camera with flash|camera");
addVisualQueries("practice|practise|repeat", "repeat button|books");
addVisualQueries("prepare|ready", "check mark button|backpack");
addVisualQueries("probably|perhaps|possibly|maybe|suppose", "red question mark|cloud");
addVisualQueries("question|what|why|who|whose", "red question mark|person raising hand");
addVisualQueries("receptionist|secretary|manager|staff|worker", "office worker|office building");
addVisualQueries("refrigerator|fridge", "refrigerator|canned food");
addVisualQueries("repair|fix", "hammer and wrench|construction worker");
addVisualQueries("rest|relax (become happy)|relaxing", "person in bed|person getting massage");
addVisualQueries("safe|danger|dangerous", "shield|warning");
addVisualQueries("schoolchild|student|teenager|kid(s)", "child|school");
addVisualQueries("sell|shop|shopper|shop assistant|market|supermarket", "shopping bags|shopping cart");
addVisualQueries("seem|suppose", "thinking face|thought balloon");
addVisualQueries("serve|waiter|waitress", "fork and knife with plate|person standing");
addVisualQueries("single|alone", "bust in silhouette|derelict house");
addVisualQueries("site|place|area", "round pushpin|world map");
addVisualQueries("slim|thin|fat", "person standing|left right black arrow");
addVisualQueries("slow|slowly|quick|quickly|fast", "man running|turtle");
addVisualQueries("smart (clever)|clever", "brain|light bulb");
addVisualQueries("spare|extra", "plus sign|package");
addVisualQueries("staff|worker|work|working hours", "office building|alarm clock");
addVisualQueries("stairs|upstairs", "stairway|backhand index pointing up");
addVisualQueries("stay|wait|still", "alarm clock|person standing");
addVisualQueries("steal", "thief|warning");
addVisualQueries("story|title|book|textbook", "open book|film frames");
addVisualQueries("success|successful|winner|prize", "trophy|glowing star");
addVisualQueries("take|bring|carry", "palm up hand|package");
addVisualQueries("terrible|awful|horrible|bad", "broken heart|cross mark");
addVisualQueries("thin|thick|wide|narrow", "left right black arrow|straight ruler");
addVisualQueries("tights|trousers|shorts|skirt|dress|clothes|wear", "woman’s clothes|jeans");
addVisualQueries("towel|sheet|blanket", "roll of paper|bed");
addVisualQueries("trainer|training (transitive and intransitive)|coach|teacher|teach", "teacher|school");
addVisualQueries("transport|travel|journey|trip", "locomotion|airplane");
addVisualQueries("try|try on", "man gesturing OK|woman’s clothes");
addVisualQueries("unfortunately|unhappy|upset", "crying face|broken heart");
addVisualQueries("unusual|strange|different", "sun|crescent moon");
addVisualQueries("visitor|visit", "man walking|house");
addVisualQueries("wake|wake up", "alarm clock|person in bed");
addVisualQueries("wallet|pocket|bag|purse", "wallet|handbag");
addVisualQueries("want|wish|hope", "thought balloon|glowing star");
addVisualQueries("west|east|north|south", "compass|sun");
addVisualQueries("wildlife|animal|pet", "deer|dog");
addVisualQueries("yog(h)urt", "bowl with spoon|glass of milk");
addVisualQueries("young|old|aged|adult|teenager", "baby|older person");
addVisualQueries("before", "alarm clock|fork and knife with plate");
addVisualQueries("busy", "office building|alarm clock");
addVisualQueries("complete|continue|final|finally|finish", "check mark button|chequered flag");
addVisualQueries("get", "incoming envelope|wrapped gift");
addVisualQueries("however", "cloud with rain|soccer ball");
addVisualQueries("if", "motorway|red question mark");
addVisualQueries("just", "alarm clock|mantelpiece clock");
addVisualQueries("steal", "ninja|warning");
addVisualQueries("through", "man walking|door");
addVisualQueries("I|me|my|mine|myself", "person raising hand|bust in silhouette");
addVisualQueries("clearly", "eyes|sparkles");
addVisualQueries("future", "crystal ball|spiral calendar");
addVisualQueries("kind", "red heart|card file box");
addVisualQueries("pack", "luggage|backpack");
addVisualQueries("table", "fork and knife with plate|chair");
addVisualQueries("zoo", "deer|lion");

const ANNOTATION_ALIASES = {
  aeroplane: "airplane", aircraft: "airplane", album: "photo album", ambulance: "ambulance", apartment: "house",
  barbecue: "grill", bath: "bathtub", biscuit: "cookie", blouse: "shirt", boot: "boot", chemist: "pharmacy",
  cinema: "cinema", cooker: "cooking", cupboard: "cabinet", doctor: "doctor", drawing: "artist palette",
  film: "film frames", football: "soccer ball", fridge: "refrigerator", glasses: "glasses", holiday: "luggage",
  jumper: "sweater", lift: "elevator", lorry: "truck", mobile: "mobile phone", motorway: "motorway", nought: "zero",
  petrol: "fuel pump", photo: "camera", post: "mailbox", railway: "train", rubbish: "wastebasket", shop: "shopping bags",
  sofa: "couch", sweets: "candy", timetable: "calendar", torch: "flashlight", trousers: "jeans", underground: "metro",
  university: "school", wardrobe: "cabinet", wash: "soap", website: "computer", yoghurt: "yogurt",
};

const GROUP_PENALTY = new Set(["flags", "component"]);
const iconEntries = emoji
  .filter((item) => item.skintone === "" && item.hexcode && !GROUP_PENALTY.has(item.group))
  .map((item) => ({
    ...item,
    haystack: `${item.annotation} ${item.tags || ""} ${item.openmoji_tags || ""}`.toLowerCase(),
    tokens: new Set(tokenize(`${item.annotation} ${item.tags || ""} ${item.openmoji_tags || ""}`)),
  }));

function tokenize(value) {
  return String(value)
    .toLowerCase()
    .replace(/\([^)]*\)/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter((token) => token && !STOP.has(token));
}

function stem(token) {
  if (token.length > 5 && token.endsWith("ing")) return token.slice(0, -3);
  if (token.length > 4 && token.endsWith("ed")) return token.slice(0, -2);
  if (token.length > 4 && token.endsWith("es")) return token.slice(0, -2);
  if (token.length > 3 && token.endsWith("s")) return token.slice(0, -1);
  return token;
}

function queryFor(entry) {
  const direct = VISUAL_QUERY[entry.headword];
  if (direct) return direct;
  const clean = entry.headword.toLowerCase().replace(/\([^)]*\)/g, "").split("/")[0].trim();
  const alias = ANNOTATION_ALIASES[clean] || clean;
  return `${alias} ${entry.definition} ${entry.example}`;
}

function scoreIcon(icon, query, entry) {
  const queryTokens = tokenize(query);
  const headTokens = tokenize(ANNOTATION_ALIASES[entry.headword.toLowerCase()] || entry.headword);
  let score = 0;
  const annotation = icon.annotation.toLowerCase();
  const cleanHead = headTokens.join(" ");
  if (cleanHead && annotation === cleanHead) score += 180;
  if (cleanHead && new RegExp(`(^|\\s)${cleanHead.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\$&")}(\\s|$)`).test(annotation)) score += 95;
  for (const [index, token] of queryTokens.entries()) {
    const root = stem(token);
    const priority = Math.max(0, 8 - index);
    const isHeadwordToken = headTokens.includes(token);
    if (icon.tokens.has(token)) score += (isHeadwordToken ? 2 : 7) + priority;
    else if ([...icon.tokens].some((candidate) => stem(candidate) === root)) score += (isHeadwordToken ? 1 : 5) + priority;
    if (annotation.split(/\s+/).some((candidate) => stem(candidate) === root)) score += 22 + priority;
  }
  for (const token of headTokens) {
    const root = stem(token);
    if (annotation.split(/\s+/).some((candidate) => stem(candidate) === root)) score += 42;
    else if (icon.tokens.has(token) || [...icon.tokens].some((candidate) => stem(candidate) === root)) score += 4;
  }
  if (/flag|keycap|button|symbol|sign/.test(annotation) && !/flag|button|sign|symbol|key/.test(query)) score -= 35;
  if (/face/.test(annotation) && !/face|feeling|smile|sad|happy|angry|ill|sick|tired|scared|afraid|surprise/.test(query)) score -= 16;
  return score;
}

function chooseIcons(entry) {
  const query = queryFor(entry);
  const direct = VISUAL_QUERY[entry.headword];
  if (direct?.includes("|")) {
    const concepts = direct.split("|").map((value) => value.trim()).filter(Boolean);
    const chooseConcept = (concept, exclude = null) => iconEntries
      .filter((icon) => icon.hexcode !== exclude)
      .map((icon) => {
        const annotation = icon.annotation.toLowerCase();
        const conceptTokens = tokenize(concept);
        let score = annotation === concept.toLowerCase() ? 240 : 0;
        if (new RegExp(`(^|\\s)${concept.toLowerCase().replace(/[.*+?^${}()|[\\]\\\\]/g, "\\$&")}(\\s|$)`).test(annotation)) score += 130;
        for (const token of conceptTokens) {
          if (annotation.split(/\s+/).some((part) => stem(part) === stem(token))) score += 34;
          else if (icon.tokens.has(token)) score += 7;
        }
        return { icon, score };
      })
      .sort((a, b) => b.score - a.score || a.icon.annotation.localeCompare(b.icon.annotation))[0];
    const first = chooseConcept(concepts[0]);
    const second = chooseConcept(concepts[1], first.icon.hexcode);
    return { query, first: first.icon, second: second.icon, score: first.score };
  }
  const ranked = iconEntries
    .map((icon) => ({ icon, score: scoreIcon(icon, query, entry) }))
    .sort((a, b) => b.score - a.score || a.icon.annotation.localeCompare(b.icon.annotation));
  const first = ranked[0].icon;
  const second = ranked.find(({ icon, score }) => score > 18 && icon.hexcode !== first.hexcode && icon.annotation !== first.annotation)?.icon;
  return { query, first, second, score: ranked[0].score };
}

function hashText(value) {
  let hash = 2166136261;
  for (const char of value) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

const iconCache = new Map();
async function iconMarkup(icon) {
  if (!iconCache.has(icon.hexcode)) {
    let svg = await readFile(join(iconDir, `${icon.hexcode}.svg`), "utf8");
    svg = svg.replace(/^<svg[^>]*>/, "").replace(/<\/svg>\s*$/, "");
    svg = svg.replace(/#[0-9a-f]{6}/gi, (colour) => {
      const red = Number.parseInt(colour.slice(1, 3), 16);
      const green = Number.parseInt(colour.slice(3, 5), 16);
      const blue = Number.parseInt(colour.slice(5, 7), 16);
      const light = (red + green + blue) / 3;
      if (light < 42) return "#292a23";
      if (light > 226) return "#ddd3ae";
      if (red > green * 1.18 && red > blue * 1.18) return light > 150 ? "#bd775e" : "#8f4f43";
      if (blue > red * 1.16) return light > 150 ? "#83918a" : "#4c625d";
      if (green > red * 1.14) return light > 150 ? "#949775" : "#53604c";
      if (red > blue * 1.16 && green > blue * 1.16) return light > 150 ? "#c4a66b" : "#8f764e";
      return light > 150 ? "#b8ad8c" : "#666655";
    });
    svg = svg.replace(/#fff\b/gi, "#ddd3ae").replace(/#000\b/gi, "#292a23");
    iconCache.set(icon.hexcode, svg);
  }
  return iconCache.get(icon.hexcode);
}

function placedIcon(markup, x, y, size, rotate = 0) {
  const centerX = x + size / 2;
  const centerY = y + size / 2;
  return `<g filter="url(#paintedProp)" transform="rotate(${rotate} ${centerX} ${centerY}) translate(${x} ${y}) scale(${size / 72})">${markup}</g>`;
}

function blobCharacter(x, y, scale = 1, looking = 1) {
  const eyeX = looking > 0 ? 8 : -8;
  return `<g transform="translate(${x} ${y}) scale(${scale})" filter="url(#paintedProp)">
    <path d="M0 91C-8 42 5 1 43 0c39-1 56 45 48 91-5 31-24 48-47 48S5 122 0 91Z" fill="#8d876c" stroke="#292a23" stroke-width="5"/>
    <ellipse cx="${35 + eyeX}" cy="48" rx="7" ry="8" fill="#e2d9b6"/><circle cx="${37 + eyeX}" cy="49" r="3" fill="#23251f"/>
    <ellipse cx="${57 + eyeX}" cy="49" rx="7" ry="8" fill="#e2d9b6"/><circle cx="${59 + eyeX}" cy="50" r="3" fill="#23251f"/>
    <path d="M42 72q8 5 16 0" fill="none" stroke="#3a382e" stroke-width="3" stroke-linecap="round"/>
    <path d="M11 130q-12 11-20 0M80 130q12 11 20 0" fill="none" stroke="#292a23" stroke-width="7" stroke-linecap="round"/>
  </g>`;
}

function paperSpeckles(seed) {
  let value = seed || 1;
  const random = () => {
    value = Math.imul(value ^ (value >>> 15), 2246822519);
    value = Math.imul(value ^ (value >>> 13), 3266489917);
    return ((value ^= value >>> 16) >>> 0) / 4294967296;
  };
  return Array.from({ length: 84 }, () => {
    const x = Math.round(random() * 640);
    const y = Math.round(random() * 400);
    const radius = (0.8 + random() * 2.6).toFixed(1);
    const opacity = (0.025 + random() * 0.075).toFixed(3);
    return `<circle cx="${x}" cy="${y}" r="${radius}" fill="#171c18" opacity="${opacity}"/>`;
  }).join("");
}

function relationshipLayout(entry, primary, secondary, variant) {
  const word = entry.headword.toLowerCase();
  const two = secondary || primary;
  const relational = /^(above|across|after|against|along|among|around|before|behind|below|beside|between|down|from|in front of|inside|near|next to|off|on|opposite|out|out of|over|past|through|to|together|under|up|with|without)$/.test(word);
  if (!relational) {
    if (variant % 4 === 0 && secondary) return `${placedIcon(primary, 182, 78, 235, -3)}${placedIcon(secondary, 420, 190, 115, 4)}${blobCharacter(66, 210, .72, 1)}`;
    if (variant % 4 === 1) return `${placedIcon(primary, 224, 64, 244, 2)}${blobCharacter(86, 210, .72, 1)}`;
    if (variant % 4 === 2 && secondary) return `${placedIcon(primary, 112, 100, 190, -4)}${placedIcon(secondary, 360, 92, 196, 4)}${blobCharacter(280, 232, .6, 1)}`;
    return `${placedIcon(primary, 210, 74, 240, -2)}${blobCharacter(476, 220, .66, -1)}`;
  }
  if (/above|over/.test(word)) return `${placedIcon(primary, 250, 34, 150)}${placedIcon(two, 225, 228, 180)}<path d="M323 190v-42" class="motion"/>`;
  if (/below|under/.test(word)) return `${placedIcon(two, 220, 48, 205)}${placedIcon(primary, 260, 246, 130)}<path d="M323 202v45" class="motion"/>`;
  if (/behind/.test(word)) return `${placedIcon(two, 246, 74, 230)}${blobCharacter(176, 208, .72, 1)}`;
  if (/in front of/.test(word)) return `${placedIcon(two, 246, 82, 216)}${blobCharacter(212, 190, .92, 1)}`;
  if (/between/.test(word)) return `${placedIcon(primary, 252, 150, 140)}${placedIcon(two, 70, 104, 190)}${placedIcon(two, 415, 104, 190, 4)}`;
  if (/beside|next to|near|with|together/.test(word)) return `${placedIcon(primary, 116, 112, 195, -3)}${placedIcon(two, 350, 110, 195, 3)}`;
  if (/without/.test(word)) return `${placedIcon(primary, 228, 95, 205)}<circle cx="330" cy="199" r="125" fill="none" stroke="#a25b49" stroke-width="15"/><path d="M243 111l174 174" stroke="#a25b49" stroke-width="15" stroke-linecap="round"/>`;
  if (/inside|^in$/.test(word)) return `<path d="M176 110h288v208H176z" fill="#4b4a3d" stroke="#24251f" stroke-width="8"/>${placedIcon(primary, 238, 132, 170)}`;
  if (/out|off/.test(word)) return `${placedIcon(primary, 112, 128, 175)}<path d="M324 108h192v210H324z" fill="#46453a" stroke="#24251f" stroke-width="8"/><path d="M293 218h94" class="motion"/><path d="m370 199 22 19-22 19" class="motion"/>`;
  if (/through|across|along|past|to|from/.test(word)) return `${placedIcon(two, 421, 92, 155)}${blobCharacter(80, 204, .72, 1)}<path d="M183 278C285 194 367 275 464 188" class="motion"/><path d="m445 174 27 8-17 23" class="motion"/>`;
  if (/opposite|against/.test(word)) return `${blobCharacter(112, 202, .78, 1)}${blobCharacter(438, 202, .78, -1)}<path d="M267 272h106" class="motion"/>`;
  if (/up|down/.test(word)) {
    const down = word === "down";
    return `${placedIcon(primary, 240, down ? 190 : 54, 165)}<path d="M323 ${down ? 92 : 307}V${down ? 195 : 168}" class="motion"/><path d="m${down ? "304 176 19 24 19-24" : "304 188 19-24 19 24"}" class="motion"/>`;
  }
  return `${placedIcon(primary, 205, 84, 230)}${blobCharacter(72, 222, .65, 1)}`;
}

function backgroundMarkup(variant) {
  const type = variant % 5;
  if (type === 0) return `<path d="M0 0h640v400H0z" fill="url(#wall)"/><path d="M0 292h640v108H0z" fill="#4a4639"/><path d="M67 36h124v173H67z" fill="#d5c898" opacity=".72"/><path d="M129 36v173M67 121h124" stroke="#575547" stroke-width="7"/><path d="M497 115q0-80 70-80t70 80v202H497z" fill="#262b26"/><path d="M0 318h640M85 292l-13 108M212 292l-4 108M360 292l8 108M520 292l18 108" stroke="#302f28" opacity=".62" stroke-width="3"/>`;
  if (type === 1) return `<rect width="640" height="400" fill="url(#forest)"/><path d="M0 308Q138 257 283 309t357-26v117H0z" fill="#403f34"/><g fill="#252b27" opacity=".92"><path d="M42 0h53l-12 321H25z"/><path d="M188 0h44l11 308h-73z"/><path d="M502 0h52l31 324h-91z"/></g><path d="M0 294Q179 248 331 291t309-20" fill="none" stroke="#a79c73" stroke-width="4" opacity=".35"/>`;
  if (type === 2) return `<rect width="640" height="400" fill="url(#wall)"/><path d="M0 280h640v120H0z" fill="#39382f"/><path d="M0 280h640" stroke="#23251f" stroke-width="9"/><path d="M48 33h158v175H48z" fill="#d7ca99" opacity=".66"/><path d="M127 33v175M48 119h158" stroke="#565447" stroke-width="7"/><ellipse cx="487" cy="300" rx="176" ry="46" fill="#272923" opacity=".32"/>`;
  if (type === 3) return `<rect width="640" height="400" fill="url(#sky)"/><path d="M0 267Q154 174 314 271t326-18v147H0z" fill="#5e5c47"/><path d="M0 316Q167 248 336 313t304-31" fill="none" stroke="#b4a679" stroke-width="5" opacity=".35"/><circle cx="531" cy="77" r="37" fill="#d4c58e" opacity=".64"/>`;
  return `<rect width="640" height="400" fill="url(#sea)"/><path d="M0 279q98-29 191 1t186 0 263-2v122H0z" fill="#3d4840"/><path d="M0 297q105-28 206 2t204 1 230-8" fill="none" stroke="#c0b889" stroke-width="5" opacity=".38"/><path d="M0 329q100-22 205 1t205-2 230-8" fill="none" stroke="#c0b889" stroke-width="3" opacity=".23"/>`;
}

async function renderEntry(entry, selection) {
  const primaryMarkup = await iconMarkup(selection.first);
  const secondaryMarkup = selection.second ? await iconMarkup(selection.second) : null;
  const variant = hashText(entry.slug);
  const artwork = relationshipLayout(entry, primaryMarkup, secondaryMarkup, variant);
  const overlaySvg = `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="400" viewBox="0 0 640 400">
    <defs>
      <radialGradient id="lamp" cx="50%" cy="45%"><stop offset="0" stop-color="#e2d5a9" stop-opacity=".34"/><stop offset=".7" stop-color="#d3c69a" stop-opacity=".07"/><stop offset="1" stop-color="#20251f" stop-opacity="0"/></radialGradient>
      <radialGradient id="edge"><stop offset=".54" stop-color="#111611" stop-opacity="0"/><stop offset="1" stop-color="#111611" stop-opacity=".48"/></radialGradient>
      <filter id="paintedProp" x="-35%" y="-35%" width="170%" height="185%">
        <feTurbulence type="fractalNoise" baseFrequency=".018" numOctaves="2" seed="${variant % 61}" result="warp"/>
        <feDisplacementMap in="SourceGraphic" in2="warp" scale="1.15" xChannelSelector="R" yChannelSelector="G" result="rough"/>
        <feDropShadow in="rough" dx="0" dy="7" stdDeviation="5" flood-color="#111511" flood-opacity=".54"/>
      </filter>
      <filter id="agedPaper" x="-10%" y="-10%" width="120%" height="120%">
        <feTurbulence type="fractalNoise" baseFrequency=".42" numOctaves="4" seed="${variant % 97}" result="grain"/>
        <feColorMatrix in="grain" type="saturate" values="0" result="mono"/>
        <feComponentTransfer in="mono" result="soft"><feFuncA type="table" tableValues="0 .13"/></feComponentTransfer>
      </filter>
    </defs>
    <rect width="640" height="400" fill="#263028" opacity=".16"/>
    <rect width="640" height="400" fill="url(#lamp)"/>
    <ellipse cx="320" cy="334" rx="237" ry="37" fill="#171b17" opacity=".24"/>
    <g opacity=".91">${artwork}</g>
    <rect width="640" height="400" filter="url(#agedPaper)" opacity=".52"/>
    <rect width="640" height="400" fill="#77745d" opacity=".06"/>
    <g>${paperSpeckles(variant)}</g>
    <g fill="none" stroke="#d1c79e" stroke-width="5" stroke-linecap="round" opacity=".18"><path d="M29 82q37-29 76-9"/><path d="M541 345q33-19 67-3"/></g>
    <rect width="640" height="400" fill="url(#edge)"/>
    <rect x="8" y="8" width="624" height="384" rx="27" fill="none" stroke="#242720" stroke-width="7" opacity=".86"/>
    <style>.motion{fill:none;stroke:#c09b70;stroke-width:10;stroke-linecap:round;stroke-linejoin:round;stroke-dasharray:3 18}</style>
  </svg>`;
  const output = join(ROOT, "public", entry.image.replace(/^\//, ""));
  await mkdir(dirname(output), { recursive: true });
  const base = BASE_PAINTINGS[variant % BASE_PAINTINGS.length];
  const background = await sharp(base)
    .resize(640, 400, { fit: "fill" })
    .blur(4.2)
    .modulate({ brightness: 0.82, saturation: 0.62 })
    .toBuffer();
  await sharp(background)
    .composite([{ input: Buffer.from(overlaySvg), blend: "over" }])
    .webp({ quality: 84, effort: 5 })
    .toFile(output);
}

const work = [];
const mapping = [];
for (const entry of course.entries) {
  if (only && !only.includes(entry.slug) && !only.includes(entry.headword)) continue;
  const output = join(ROOT, "public", entry.image.replace(/^\//, ""));
  if (!force) {
    try { await access(output); continue; } catch { /* missing clue */ }
  }
  const selection = chooseIcons(entry);
  mapping.push({
    headword: entry.headword,
    image: entry.image,
    query: selection.query,
    primary: selection.first.annotation,
    secondary: selection.second?.annotation || "",
    score: selection.score,
  });
  work.push({ entry, selection });
}

await mkdir(join(ROOT, "tmp"), { recursive: true });
await writeFile(join(ROOT, "tmp/dark-storybook-icon-map.json"), JSON.stringify(mapping, null, 2));

if (dryRun) {
  console.log(`Mapped ${mapping.length} missing clues. No images rendered.`);
  process.exit(0);
}

let cursor = 0;
const workers = Array.from({ length: Math.min(10, work.length) }, async () => {
  while (true) {
    const index = cursor++;
    if (index >= work.length) return;
    const { entry, selection } = work[index];
    await renderEntry(entry, selection);
    if ((index + 1) % 50 === 0 || index === work.length - 1) console.log(`Created ${index + 1}/${work.length} dark storybook clues`);
  }
});

await Promise.all(workers);
console.log(`Finished ${work.length} missing dark storybook clue images.`);
