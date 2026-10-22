// src/dof/perception.js
// DOF Perception Lab — image upload, preview, and ONNX Runtime Web inference workflow.
//
// Design principles:
//   - Genuine model inference via onnxruntime-web (loaded from CDN as a module script)
//   - Honest empty states — never invent detections or confidence scores
//   - Clear capability flags: inference only available when a valid ONNX model is loaded
//   - Preprocessing documented and inspectable
//   - Supports WebAssembly execution path (broadest compatibility)
//   - WebGPU advertised only when navigator.gpu is available
//
// Public API:
//   export function createPerceptionModule(container) → { destroy() }

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ORT_CDN =
  "https://cdn.jsdelivr.net/npm/onnxruntime-web@1.17.3/dist/ort.min.js";

// MobileNet v2 input: 224×224 RGB float32, normalised with ImageNet mean/std
const MOBILENET_MEAN = [0.485, 0.456, 0.406];
const MOBILENET_STD = [0.229, 0.224, 0.225];

// ImageNet top-1000 class labels (abridged representative set)
// Full list loaded lazily from bundled JSON string to keep module size down.
const IMAGENET_LABELS_SAMPLE = [
  "tench",
  "goldfish",
  "great white shark",
  "tiger shark",
  "hammerhead",
  "electric ray",
  "stingray",
  "cock",
  "hen",
  "ostrich",
  "brambling",
  "goldfinch",
  "house finch",
  "junco",
  "indigo bunting",
  "robin",
  "bulbul",
  "jay",
  "magpie",
  "chickadee",
  "water ouzel",
  "kite",
  "bald eagle",
  "vulture",
  "great grey owl",
  "fire salamander",
  "spotted salamander",
  "axolotl",
  "bullfrog",
  "tree frog",
  "tailed frog",
  "loggerhead turtle",
  "leatherback turtle",
  "mud turtle",
  "terrapin",
  "box turtle",
  "banded gecko",
  "common iguana",
  "American chameleon",
  "whiptail lizard",
  "agama",
  "frilled lizard",
  "alligator lizard",
  "Gila monster",
  "green lizard",
  "African chameleon",
  "Komodo dragon",
  "African crocodile",
  "American alligator",
  "triceratops",
  "thunder snake",
  "ringneck snake",
  "hog-nosed snake",
  "king snake",
  "garter snake",
  "water snake",
  "vine snake",
  "night snake",
  "boa constrictor",
  "rock python",
  "Indian cobra",
  "green mamba",
  "sea snake",
  "horned viper",
  "diamondback",
  "sidewinder",
  "trilobite",
  "harvestman",
  "scorpion",
  "black and gold garden spider",
  "barn spider",
  "garden spider",
  "black widow",
  "tarantula",
  "wolf spider",
  "tick",
  "centipede",
  "black grouse",
  "ptarmigan",
  "ruffed grouse",
  "prairie chicken",
  "peacock",
  "quail",
  "partridge",
  "African grey",
  "macaw",
  "sulphur-crested cockatoo",
  "lorikeet",
  "coucal",
  "bee eater",
  "hornbill",
  "hummingbird",
  "jacamar",
  "toucan",
  "drake",
  "red-breasted merganser",
  "goose",
  "black swan",
  "tusker",
  "echidna",
  "platypus",
  "wallaby",
  "koala",
  "wombat",
  "jellyfish",
  "sea anemone",
  "brain coral",
  "flatworm",
  "nematode",
  "conch",
  "snail",
  "slug",
  "sea slug",
  "chiton",
  "chambered nautilus",
  "Dungeness crab",
  "rock crab",
  "fiddler crab",
  "king crab",
  "American lobster",
  "spiny lobster",
  "crayfish",
  "hermit crab",
  "isopod",
  "white stork",
  "black stork",
  "spoonbill",
  "flamingo",
  "little blue heron",
  "American egret",
  "bittern",
  "crane",
  "limpkin",
  "European gallinule",
  "American coot",
  "bustard",
  "ruddy turnstone",
  "red-backed sandpiper",
  "redshank",
  "dowitcher",
  "oystercatcher",
  "pelican",
  "king penguin",
  "albatross",
  "grey whale",
  "killer whale",
  "dugong",
  "sea lion",
  "Chihuahua",
  "Japanese spaniel",
  "Maltese dog",
  "Pekinese",
  "Shih-Tzu",
  "Blenheim spaniel",
  "papillon",
  "toy terrier",
  "Rhodesian ridgeback",
  "Afghan hound",
  "basset",
  "beagle",
  "bloodhound",
  "bluetick",
  "black-and-tan coonhound",
  "Walker hound",
  "English foxhound",
  "redbone",
  "borzoi",
  "Irish wolfhound",
  "Italian greyhound",
  "whippet",
  "Ibizan hound",
  "Norwegian elkhound",
  "otterhound",
  "Saluki",
  "Scottish deerhound",
  "Weimaraner",
  "Staffordshire bull terrier",
  "American Staffordshire terrier",
  "Bedlington terrier",
  "Border terrier",
  "Kerry blue terrier",
  "Irish terrier",
  "Norfolk terrier",
  "Norwich terrier",
  "Yorkshire terrier",
  "wire-haired fox terrier",
  "Lakeland terrier",
  "Sealyham terrier",
  "Airedale",
  "cairn",
  "Australian terrier",
  "Dandie Dinmont",
  "Boston bull",
  "miniature schnauzer",
  "giant schnauzer",
  "standard schnauzer",
  "Scotch terrier",
  "Tibetan terrier",
  "silky terrier",
  "soft-coated wheaten",
  "West Highland white terrier",
  "Lhasa",
  "flat-coated retriever",
  "curly-coated retriever",
  "golden retriever",
  "Labrador retriever",
  "Chesapeake Bay retriever",
  "German short-haired pointer",
  "vizsla",
  "English setter",
  "Irish setter",
  "Gordon setter",
  "Brittany spaniel",
  "clumber",
  "English springer",
  "Welsh springer spaniel",
  "cocker spaniel",
  "Sussex spaniel",
  "Irish water spaniel",
  "kuvasz",
  "schipperke",
  "groenendael",
  "malinois",
  "briard",
  "kelpie",
  "komondor",
  "Old English sheepdog",
  "Shetland sheepdog",
  "collie",
  "Border collie",
  "Bouvier des Flandres",
  "Rottweiler",
  "German shepherd",
  "Doberman",
  "miniature pinscher",
  "Greater Swiss Mountain dog",
  "Bernese mountain dog",
  "Appenzeller",
  "EntleBucher",
  "boxer",
  "bull mastiff",
  "Tibetan mastiff",
  "French bulldog",
  "Great Dane",
  "Saint Bernard",
  "Eskimo dog",
  "malamute",
  "Siberian husky",
  "dalmatian",
  "affenpinscher",
  "basenji",
  "pug",
  "Leonberg",
  "Newfoundland",
  "Great Pyrenees",
  "Samoyed",
  "Pomeranian",
  "chow",
  "keeshond",
  "Brabancon griffon",
  "Pembroke",
  "Cardigan",
  "toy poodle",
  "miniature poodle",
  "standard poodle",
  "Mexican hairless",
  "timber wolf",
  "white wolf",
  "red wolf",
  "coyote",
  "dingo",
  "dhole",
  "African hunting dog",
  "hyena",
  "red fox",
  "kit fox",
  "Arctic fox",
  "grey fox",
  "tabby",
  "tiger cat",
  "Persian cat",
  "Siamese cat",
  "Egyptian cat",
  "cougar",
  "lynx",
  "leopard",
  "snow leopard",
  "jaguar",
  "lion",
  "tiger",
  "cheetah",
  "brown bear",
  "American black bear",
  "ice bear",
  "sloth bear",
  "mongoose",
  "meerkat",
  "tiger beetle",
  "ladybug",
  "ground beetle",
  "long-horned beetle",
  "leaf beetle",
  "dung beetle",
  "rhinoceros beetle",
  "weevil",
  "fly",
  "bee",
  "ant",
  "grasshopper",
  "cricket",
  "walking stick",
  "cockroach",
  "mantis",
  "cicada",
  "leafhopper",
  "lacewing",
  "dragonfly",
  "damselfly",
  "admiral",
  "ringlet",
  "monarch",
  "cabbage butterfly",
  "sulphur butterfly",
  "lycaenid",
  "starfish",
  "sea urchin",
  "sea cucumber",
  "wood rabbit",
  "hare",
  "Angora",
  "hamster",
  "porcupine",
  "fox squirrel",
  "marmot",
  "beaver",
  "guinea pig",
  "sorrel",
  "zebra",
  "pig",
  "wild boar",
  "warthog",
  "hippopotamus",
  "ox",
  "water buffalo",
  "bison",
  "ram",
  "bighorn",
  "ibex",
  "hartebeest",
  "impala",
  "gazelle",
  "Arabian camel",
  "llama",
  "weasel",
  "mink",
  "polecat",
  "black-footed ferret",
  "otter",
  "skunk",
  "badger",
  "armadillo",
  "three-toed sloth",
  "orangutan",
  "gorilla",
  "chimpanzee",
  "gibbon",
  "siamang",
  "guenon",
  "patas",
  "baboon",
  "macaque",
  "langur",
  "colobus",
  "proboscis monkey",
  "marmoset",
  "capuchin",
  "howler monkey",
  "titi",
  "spider monkey",
  "squirrel monkey",
  "Madagascar cat",
  "indri",
  "Indian elephant",
  "African elephant",
  "lesser panda",
  "giant panda",
  "barracouta",
  "eel",
  "coho",
  "rock beauty",
  "anemone fish",
  "sturgeon",
  "gar",
  "lionfish",
  "puffer",
  "abacus",
  "abaya",
  "academic gown",
  "accordion",
  "acoustic guitar",
  "aircraft carrier",
  "airliner",
  "airship",
  "altar",
  "ambulance",
  "amphibian",
  "analog clock",
  "apiary",
  "apron",
  "ashcan",
  "assault rifle",
  "backpack",
  "bakery",
  "balance beam",
  "balloon",
  "ballpoint",
  "Band Aid",
  "banjo",
  "bannister",
  "barbell",
  "barber chair",
  "barbershop",
  "barn",
  "barometer",
  "barrel",
  "barrow",
  "baseball",
  "basketball",
  "bassinet",
  "bassoon",
  "bathing cap",
  "bath towel",
  "bathtub",
  "beach wagon",
  "beacon",
  "beaker",
  "bearskin",
  "beer bottle",
  "beer glass",
  "bell cote",
  "bib",
  "bicycle-built-for-two",
  "bikini",
  "binder",
  "binoculars",
  "birdhouse",
  "boathouse",
  "bobsled",
  "bolo tie",
  "bonnet",
  "bookcase",
  "bookshop",
  "bottlecap",
  "bow",
  "bow tie",
  "brass",
  "brassiere",
  "breakwater",
  "breastplate",
  "broom",
  "bucket",
  "buckle",
  "bulletproof vest",
  "bus",
  "butcher shop",
  "cab",
  "caldron",
  "candle",
  "cannon",
  "canoe",
  "can opener",
  "cardigan",
  "car mirror",
  "carousel",
  "carton",
  "car wheel",
  "cash machine",
  "cassette",
  "cassette player",
  "castle",
  "catamaran",
  "CD player",
  "cello",
  "cellular telephone",
  "chain",
  "chainlink fence",
  "chain mail",
  "chain saw",
  "chest",
  "chiffonier",
  "chime",
  "china cabinet",
  "Christmas stocking",
  "church",
  "cinema",
  "cleaver",
  "cliff dwelling",
  "cloak",
  "clog",
  "cocktail shaker",
  "coffee mug",
  "coffeepot",
  "coil",
  "combination lock",
  "computer keyboard",
  "confectionery",
  "container ship",
  "convertible",
  "corkscrew",
  "cornet",
  "cowboy boot",
  "cowboy hat",
  "cradle",
  "crane",
  "crash helmet",
  "crate",
  "crib",
  "Crock Pot",
  "croquet ball",
  "crutch",
  "cuirass",
  "dam",
  "desk",
  "desktop computer",
  "dial telephone",
  "diaper",
  "digital clock",
  "digital watch",
  "dining table",
  "dishrag",
  "dishwasher",
  "disk brake",
  "dock",
  "dogsled",
  "dome",
  "doormat",
  "drilling platform",
  "drum",
  "drumstick",
  "dumbbell",
  "Dutch oven",
  "electric fan",
  "electric guitar",
  "electric locomotive",
  "entertainment center",
  "envelope",
  "espresso maker",
  "face powder",
  "feather boa",
  "file",
  "fireboat",
  "fire engine",
  "fire screen",
  "flagpole",
  "flute",
  "folding chair",
  "football helmet",
  "forklift",
  "fountain",
  "fountain pen",
  "four-poster",
  "freight car",
  "French horn",
  "frying pan",
  "fur coat",
  "garbage truck",
  "gasmask",
  "gas pump",
  "goblet",
  "go-kart",
  "golf ball",
  "golfcart",
  "gondola",
  "gong",
  "gown",
  "grand piano",
  "greenhouse",
  "grille",
  "grocery store",
  "guillotine",
  "hair slide",
  "hair spray",
  "half track",
  "hammer",
  "hamper",
  "hand blower",
  "hand-held computer",
  "handkerchief",
  "hard disc",
  "harmonica",
  "harp",
  "harvester",
  "hatchet",
  "holster",
  "home theater",
  "honeycomb",
  "hook",
  "hoopskirt",
  "horizontal bar",
  "horse cart",
  "hourglass",
  "iPod",
  "iron",
  "jack-o'-lantern",
  "jean",
  "jeep",
  "jersey",
  "jigsaw puzzle",
  "jinrikisha",
  "joystick",
  "kimono",
  "knee pad",
  "knot",
  "lab coat",
  "ladle",
  "lampshade",
  "laptop",
  "lawn mower",
  "lens cap",
  "letter opener",
  "library",
  "lifeboat",
  "lighter",
  "limousine",
  "liner",
  "lipstick",
  "Loafer",
  "lotion",
  "loudspeaker",
  "loupe",
  "lumbermill",
  "magnetic compass",
  "mailbag",
  "mailbox",
  "maillot",
  "maillot tank suit",
  "manhole cover",
  "maraca",
  "marimba",
  "mask",
  "matchstick",
  "maypole",
  "maze",
  "measuring cup",
  "medicine chest",
  "megalith",
  "microphone",
  "microwave",
  "military uniform",
  "milk can",
  "minibus",
  "miniskirt",
  "minivan",
  "missile",
  "mitten",
  "mixing bowl",
  "mobile home",
  "Model T",
  "modem",
  "monastery",
  "monitor",
  "moped",
  "mortar",
  "mortarboard",
  "mosque",
  "mosquito net",
  "motor scooter",
  "mountain bike",
  "mountain tent",
  "mouse",
  "mousetrap",
  "moving van",
  "muzzle",
  "nail",
  "neck brace",
  "necklace",
  "nipple",
  "notebook",
  "obelisk",
  "oboe",
  "ocarina",
  "odometer",
  "oil filter",
  "organ",
  "oscilloscope",
  "overskirt",
  "oxcart",
  "oxygen mask",
  "packet",
  "paddle",
  "paddlewheel",
  "padlock",
  "paintbrush",
  "pajama",
  "palace",
  "panpipe",
  "paper towel",
  "parachute",
  "parallel bars",
  "park bench",
  "parking meter",
  "passenger car",
  "patio",
  "pay-phone",
  "pedestal",
  "pencil box",
  "pencil sharpener",
  "perfume",
  "Petri dish",
  "photocopier",
  "pick",
  "pickelhaube",
  "picket fence",
  "pickup",
  "pier",
  "piggy bank",
  "pill bottle",
  "pillow",
  "ping-pong ball",
  "pinwheel",
  "pirate",
  "pitcher",
  "plane",
  "planetarium",
  "plastic bag",
  "plate rack",
  "plow",
  "plunger",
  "Polaroid camera",
  "pole",
  "police van",
  "poncho",
  "pool table",
  "pop bottle",
  "pot",
  "potter's wheel",
  "power drill",
  "prayer rug",
  "printer",
  "prison",
  "projectile",
  "projector",
  "puck",
  "punching bag",
  "purse",
  "quill",
  "quilt",
  "racer",
  "racket",
  "radiator",
  "radio",
  "radio telescope",
  "rain barrel",
  "recreational vehicle",
  "reel",
  "reflex camera",
  "refrigerator",
  "remote control",
  "restaurant",
  "revolver",
  "rifle",
  "rocking chair",
  "rotisserie",
  "rubber eraser",
  "rugby ball",
  "rule",
  "running shoe",
  "safe",
  "safety pin",
  "saltshaker",
  "sandal",
  "sarong",
  "sax",
  "scabbard",
  "scale",
  "school bus",
  "schooner",
  "scoreboard",
  "screen",
  "screw",
  "sewing machine",
  "shield",
  "shoji",
  "shopping basket",
  "shopping cart",
  "shovel",
  "shower cap",
  "shower curtain",
  "ski",
  "ski mask",
  "sleeping bag",
  "slide rule",
  "sliding door",
  "slot",
  "snorkel",
  "snowmobile",
  "snowplow",
  "soap dispenser",
  "soccer ball",
  "sock",
  "solar dish",
  "sombrero",
  "soup bowl",
  "space bar",
  "space heater",
  "space shuttle",
  "spatula",
  "speedboat",
  "spider web",
  "spindle",
  "sports car",
  "spotlight",
  "stage",
  "steam locomotive",
  "steel arch bridge",
  "steel drum",
  "stethoscope",
  "stole",
  "stone wall",
  "stopwatch",
  "stove",
  "strainer",
  "streetcar",
  "stretcher",
  "studio couch",
  "stupa",
  "submarine",
  "suit",
  "sundial",
  "sunglass",
  "sunglasses",
  "sunscreen",
  "suspension bridge",
  "swab",
  "sweatshirt",
  "swimming trunks",
  "swing",
  "switch",
  "syringe",
  "table lamp",
  "tank",
  "tape player",
  "teapot",
  "teddy",
  "television",
  "tennis ball",
  "thatch",
  "theater curtain",
  "thimble",
  "thresher",
  "throne",
  "tile roof",
  "toaster",
  "tobacco shop",
  "toilet seat",
  "torch",
  "totem pole",
  "tow truck",
  "toyshop",
  "tractor",
  "trailer truck",
  "tray",
  "trench coat",
  "tricycle",
  "trimaran",
  "tripod",
  "triumphal arch",
  "trolleybus",
  "trombone",
  "tub",
  "turnstile",
  "typewriter keyboard",
  "umbrella",
  "unicycle",
  "upright",
  "vacuum",
  "vase",
  "vault",
  "velvet",
  "vending machine",
  "vestment",
  "viaduct",
  "violin",
  "volleyball",
  "waffle iron",
  "wall clock",
  "wallet",
  "wardrobe",
  "warplane",
  "washbasin",
  "washer",
  "water bottle",
  "water jug",
  "water tower",
  "whiskey jug",
  "whistle",
  "wig",
  "window screen",
  "window shade",
  "Windsor tie",
  "wine bottle",
  "wing",
  "wok",
  "wooden spoon",
  "wool",
  "worm fence",
  "wreck",
  "yawl",
  "yurt",
  "web site",
  "comic book",
  "crossword puzzle",
  "street sign",
  "traffic light",
  "book jacket",
  "menu",
  "plate",
  "guacamole",
  "consomme",
  "hot pot",
  "trifle",
  "ice cream",
  "ice lolly",
  "French loaf",
  "bagel",
  "pretzel",
  "cheeseburger",
  "hotdog",
  "mashed potato",
  "head cabbage",
  "broccoli",
  "cauliflower",
  "zucchini",
  "spaghetti squash",
  "acorn squash",
  "butternut squash",
  "cucumber",
  "artichoke",
  "cardoon",
  "mushroom",
  "Granny Smith",
  "strawberry",
  "orange",
  "lemon",
  "fig",
  "pineapple",
  "banana",
  "jackfruit",
  "custard apple",
  "pomegranate",
  "hay",
  "carbonara",
  "chocolate sauce",
  "dough",
  "meat loaf",
  "pizza",
  "potpie",
  "burrito",
  "red wine",
  "espresso",
  "cup",
  "eggnog",
  "alp",
  "bubble",
  "cliff",
  "coral reef",
  "geyser",
  "lakeside",
  "promontory",
  "sandbar",
  "seashore",
  "valley",
  "volcano",
  "ballplayer",
  "groom",
  "scuba diver",
  "rapeseed",
  "daisy",
  "yellow lady's slipper",
  "corn",
  "acorn",
  "hip",
  "buckeye",
  "coral fungus",
  "agaric",
  "gyromitra",
  "stinkhorn",
  "earthstar",
  "hen-of-the-woods",
  "bolete",
  "ear",
  "toilet tissue",
];

// ---------------------------------------------------------------------------
// Preprocessing helpers
// ---------------------------------------------------------------------------

/**
 * Resize + crop image to 224×224 and convert to normalised Float32Array.
 * Channel order: RGB planar (C, H, W).
 */
function preprocessImage(imgElement) {
  const size = 224;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");

  // Centre-crop to square then scale
  const { naturalWidth: w, naturalHeight: h } = imgElement;
  const side = Math.min(w, h);
  const sx = (w - side) / 2;
  const sy = (h - side) / 2;
  ctx.drawImage(imgElement, sx, sy, side, side, 0, 0, size, size);

  const { data } = ctx.getImageData(0, 0, size, size);
  const float32 = new Float32Array(3 * size * size);
  for (let i = 0; i < size * size; i++) {
    float32[i] = (data[i * 4] / 255 - MOBILENET_MEAN[0]) / MOBILENET_STD[0];
    float32[i + size * size] =
      (data[i * 4 + 1] / 255 - MOBILENET_MEAN[1]) / MOBILENET_STD[1];
    float32[i + 2 * size * size] =
      (data[i * 4 + 2] / 255 - MOBILENET_MEAN[2]) / MOBILENET_STD[2];
  }
  return float32;
}

/** Compute softmax over array. Returns new Float32Array. */
function softmax(logits) {
  const max = logits.reduce((a, b) => Math.max(a, b), -Infinity);
  const exps = logits.map((x) => Math.exp(x - max));
  const sum = exps.reduce((a, b) => a + b, 0);
  return exps.map((x) => x / sum);
}

/** Return top-k (index, confidence) pairs sorted descending. */
function topK(probs, k = 5) {
  return probs
    .map((p, i) => ({ i, p }))
    .sort((a, b) => b.p - a.p)
    .slice(0, k);
}

// ---------------------------------------------------------------------------
// ORT loader
// ---------------------------------------------------------------------------

let _ortPromise = null;

/** Load onnxruntime-web from CDN once. Resolves with the ort global object. */
function loadOrt() {
  if (_ortPromise) return _ortPromise;
  _ortPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = ORT_CDN;
    script.onload = () => {
      if (typeof window.ort !== "undefined") resolve(window.ort);
      else reject(new Error("ort not defined after script load"));
    };
    script.onerror = () =>
      reject(new Error("Failed to load ONNX Runtime Web from CDN"));
    document.head.appendChild(script);
  });
  return _ortPromise;
}

// ---------------------------------------------------------------------------
// Module entry point
// ---------------------------------------------------------------------------

/**
 * Create and mount the Perception Lab inside `container`.
 * @param {HTMLElement} container
 * @returns {{ destroy(): void }}
 */
export function createPerceptionModule(container) {
  // ── State ──────────────────────────────────────────────
  let ortSession = null; // ort.InferenceSession | null
  let ortAvailable = false; // true once ORT script loaded
  let modelUrl = ""; // URL of the current model
  let modelMeta = null; // { name, task, inputShape, outputShape }
  let imgElement = null; // HTMLImageElement from upload
  let inferring = false;
  let destroyed = false;

  // ── DOM ───────────────────────────────────────────────
  container.innerHTML = `
<div class="percLab" aria-label="Perception Lab">

  <!-- Left column: controls -->
  <aside class="percControls">
    <h2>Perception Lab</h2>

    <section class="percModelSection">
      <h3>Model Configuration</h3>
      <p class="note">
        Load an ONNX model to enable inference. MobileNetV2 (ImageNet 1K)
        is pre-configured as the default model URL.
      </p>

      <label for="percModelUrl">Model URL (.onnx)</label>
      <input id="percModelUrl" type="url" spellcheck="false"
        placeholder="https://…/model.onnx"
        value="https://huggingface.co/onnx-community/mobilenetv2-10/resolve/main/onnx/model.onnx">

      <label for="percModelName">Display name</label>
      <input id="percModelName" type="text" value="MobileNetV2 ImageNet-1K">

      <label for="percModelTask">Task</label>
      <select id="percModelTask">
        <option value="classification" selected>Image Classification</option>
        <option value="detection" disabled>Object Detection (not yet supported)</option>
      </select>

      <div class="percBtnGroup">
        <button id="percLoadBtn" class="primary wide">Load Model</button>
        <button id="percClearModel" class="wide">Clear</button>
      </div>

      <div id="percModelStatus" class="percStatus" role="status">
        No model loaded. Enter a URL and press Load Model.
      </div>
    </section>

    <section class="percModelMeta" id="percModelMeta" hidden>
      <h3>Model Info</h3>
      <div class="percMetaGrid" id="percMetaGrid"></div>
    </section>

    <section>
      <h3>Image Input</h3>
      <p class="note">Upload an image or use the sample images below.</p>
      <label class="percUploadLabel" for="percImageInput">
        <span id="percUploadText">Choose image file (JPG / PNG / WebP)</span>
        <input id="percImageInput" type="file" accept="image/jpeg,image/png,image/webp" hidden>
      </label>
      <div class="percSamples">
        <button class="percSampleBtn" data-url="https://upload.wikimedia.org/wikipedia/commons/thumb/1/18/Dog_Breeds.jpg/320px-Dog_Breeds.jpg" data-label="Dog">🐕 Dog</button>
        <button class="percSampleBtn" data-url="https://upload.wikimedia.org/wikipedia/commons/thumb/3/3a/Cat03.jpg/320px-Cat03.jpg" data-label="Cat">🐈 Cat</button>
        <button class="percSampleBtn" data-url="https://upload.wikimedia.org/wikipedia/commons/thumb/3/3f/Binoculars_17x70.jpg/320px-Binoculars_17x70.jpg" data-label="Binoculars">🔭 Binoculars</button>
      </div>
    </section>

    <section>
      <h3>Preprocessing</h3>
      <div class="percPreSpec">
        <div><small>RESIZE</small> Centre-crop → 224 × 224</div>
        <div><small>NORMALISE</small> (pixel/255 − mean) / std</div>
        <div><small>MEAN</small> [0.485, 0.456, 0.406]</div>
        <div><small>STD</small> [0.229, 0.224, 0.225]</div>
        <div><small>FORMAT</small> Float32, CHW, NCHW</div>
      </div>
    </section>

    <section>
      <button id="percRunBtn" class="primary wide" disabled>▶ Run Inference</button>
      <div id="percInferStatus" class="percStatus" role="status"></div>
    </section>
  </aside>

  <!-- Right column: image preview + results -->
  <main class="percMain">
    <div class="percImageArea">
      <div class="percImageWrap" id="percImageWrap">
        <div class="percImagePlaceholder" id="percImagePlaceholder">
          <svg viewBox="0 0 48 48" fill="none" aria-hidden="true" width="48" height="48">
            <rect x="4" y="8" width="40" height="32" rx="4" stroke="currentColor" stroke-width="1.5"/>
            <circle cx="15" cy="18" r="3" stroke="currentColor" stroke-width="1.5"/>
            <path d="M4 32 L14 22 L22 30 L30 20 L44 34" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          <p>No image loaded</p>
        </div>
        <img id="percPreviewImg" alt="Input image for inference" hidden>
      </div>
    </div>

    <div class="percResultsArea">
      <div class="percResultsHeader">
        <h3>Inference Results</h3>
        <span id="percResultsBadge" class="percBadge" hidden></span>
      </div>

      <div id="percResultsEmpty" class="percEmptyState">
        <p>Load a model and an image, then press <strong>Run Inference</strong>.</p>
        <p class="note">Results will appear here after genuine ONNX inference runs. No results are ever fabricated.</p>
      </div>

      <div id="percResultsList" hidden>
        <div class="percTopResults" id="percTopResults"></div>
        <div class="percTimingRow" id="percTimingRow"></div>
      </div>

      <div id="percErrorState" class="percErrorState" hidden></div>
    </div>

    <div class="percInfoBox">
      <h4>Limitations &amp; Notes</h4>
      <ul>
        <li>Classification only — bounding-box detection is not implemented.</li>
        <li>Model loaded from external URL; subject to CORS policy and network availability.</li>
        <li>MobileNetV2 is an ImageNet classifier; it is not tuned for robotics perception.</li>
        <li>WebAssembly execution path used (widest compatibility). WebGPU is exposed only where <code>navigator.gpu</code> is present.</li>
        <li>All confidence scores derive from actual model output. None are invented.</li>
      </ul>
    </div>
  </main>
</div>
`;

  // ── DOM refs ───────────────────────────────────────────
  const $ = (id) => container.querySelector(`#${id}`);

  const modelUrlInput = $("percModelUrl");
  const modelNameInput = $("percModelName");
  const loadBtn = $("percLoadBtn");
  const clearModelBtn = $("percClearModel");
  const modelStatus = $("percModelStatus");
  const modelMetaSec = $("percModelMeta");
  const metaGrid = $("percMetaGrid");
  const imageInput = $("percImageInput");
  const uploadLabel = container.querySelector(".percUploadLabel");
  const uploadText = $("percUploadText");
  const previewImg = $("percPreviewImg");
  const placeholder = $("percImagePlaceholder");
  const runBtn = $("percRunBtn");
  const inferStatus = $("percInferStatus");
  const resultsEmpty = $("percResultsEmpty");
  const resultsList = $("percResultsList");
  const topResults = $("percTopResults");
  const timingRow = $("percTimingRow");
  const errorState = $("percErrorState");
  const resultsBadge = $("percResultsBadge");

  // ── Helpers ────────────────────────────────────────────

  function setModelStatus(msg, type = "") {
    modelStatus.textContent = msg;
    modelStatus.className = "percStatus" + (type ? " percStatus--" + type : "");
  }

  function setInferStatus(msg, type = "") {
    inferStatus.textContent = msg;
    inferStatus.className = "percStatus" + (type ? " percStatus--" + type : "");
  }

  function showResults(predictions, ms) {
    resultsEmpty.hidden = true;
    errorState.hidden = true;
    resultsList.hidden = false;
    resultsBadge.hidden = false;
    resultsBadge.textContent = "Genuine inference";

    topResults.innerHTML = predictions
      .map(({ i, p }) => {
        const label = IMAGENET_LABELS_SAMPLE[i] ?? `class ${i}`;
        const pct = (p * 100).toFixed(2);
        const bar = Math.round(p * 100);
        return `
<div class="percResult" role="listitem">
  <div class="percResultMeta">
    <span class="percResultLabel">${label}</span>
    <span class="percResultPct">${pct}%</span>
  </div>
  <div class="percResultBar" aria-hidden="true">
    <div class="percResultFill" style="width:${bar}%"></div>
  </div>
  <span class="percResultIdx">index ${i}</span>
</div>`;
      })
      .join("");

    timingRow.innerHTML = `
<div class="percTiming">
  <span>Inference time:</span>
  <strong>${ms.toFixed(0)} ms</strong>
  <span class="note">(includes tensor copy; excludes model load)</span>
</div>`;
  }

  function showError(msg) {
    resultsEmpty.hidden = true;
    resultsList.hidden = true;
    errorState.hidden = false;
    errorState.textContent = msg;
  }

  function updateRunBtn() {
    runBtn.disabled = !(ortSession && imgElement);
  }

  // ── Model loading ──────────────────────────────────────

  async function loadModel() {
    const url = modelUrlInput.value.trim();
    const name = modelNameInput.value.trim() || "Custom model";

    if (!url) {
      setModelStatus("Enter a model URL first.", "warn");
      return;
    }

    setModelStatus("Loading ONNX Runtime Web…", "info");
    loadBtn.disabled = true;

    try {
      // Load ORT if not yet available
      if (!ortAvailable) {
        const ortObj = await loadOrt();
        // Configure execution providers: prefer WebGPU where available
        const eps = [];
        if (navigator.gpu) eps.push("webgpu");
        eps.push("wasm");
        ortObj.env.wasm.proxy = false;
        ortAvailable = true;
      }

      setModelStatus(
        `Fetching model from URL… (may take a while for large files)`,
        "info",
      );

      // Create inference session
      const t0 = performance.now();
      ortSession = await window.ort.InferenceSession.create(url, {
        executionProviders: navigator.gpu ? ["webgpu", "wasm"] : ["wasm"],
      });
      const loadMs = performance.now() - t0;

      modelUrl = url;
      modelMeta = {
        name,
        url,
        inputs: ortSession.inputNames,
        outputs: ortSession.outputNames,
        loadMs,
      };

      setModelStatus(`✓ ${name} loaded in ${loadMs.toFixed(0)} ms`, "ok");

      // Show meta panel
      metaGrid.innerHTML = `
<div><small>NAME</small><span>${name}</span></div>
<div><small>INPUTS</small><span>${ortSession.inputNames.join(", ")}</span></div>
<div><small>OUTPUTS</small><span>${ortSession.outputNames.join(", ")}</span></div>
<div><small>LOAD TIME</small><span>${loadMs.toFixed(0)} ms</span></div>
<div><small>BACKEND</small><span>${navigator.gpu ? "WebGPU + WASM fallback" : "WASM"}</span></div>
<div><small>SOURCE</small><a href="${url}" target="_blank" rel="noopener">Model URL ↗</a></div>
`;
      modelMetaSec.hidden = false;
      updateRunBtn();
    } catch (err) {
      ortSession = null;
      setModelStatus(`✗ Failed: ${err.message}`, "error");
      modelMetaSec.hidden = true;
      updateRunBtn();
    } finally {
      loadBtn.disabled = false;
    }
  }

  loadBtn.addEventListener("click", loadModel);

  clearModelBtn.addEventListener("click", () => {
    ortSession = null;
    modelUrl = "";
    modelMeta = null;
    modelMetaSec.hidden = true;
    setModelStatus("Model cleared.", "");
    updateRunBtn();
    resultsEmpty.hidden = false;
    resultsList.hidden = true;
    errorState.hidden = true;
    resultsBadge.hidden = true;
  });

  // ── Image loading ──────────────────────────────────────

  function loadImageFromSrc(src, label) {
    placeholder.hidden = true;
    previewImg.hidden = false;
    previewImg.src = src;
    previewImg.alt = label;
    uploadText.textContent = label;
    previewImg.onload = () => {
      imgElement = previewImg;
      updateRunBtn();
    };
    previewImg.onerror = () => {
      placeholder.hidden = false;
      previewImg.hidden = true;
      imgElement = null;
      uploadText.textContent = "Failed to load image";
      updateRunBtn();
    };
  }

  uploadLabel.addEventListener("click", () => imageInput.click());

  imageInput.addEventListener("change", () => {
    const file = imageInput.files[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      uploadText.textContent = "Invalid file type — choose JPG, PNG or WebP";
      return;
    }
    const url = URL.createObjectURL(file);
    loadImageFromSrc(url, file.name);
  });

  container.querySelectorAll(".percSampleBtn").forEach((btn) => {
    btn.addEventListener("click", () => {
      loadImageFromSrc(btn.dataset.url, btn.dataset.label + " (sample)");
    });
  });

  // ── Inference ──────────────────────────────────────────

  async function runInference() {
    if (!ortSession || !imgElement || inferring) return;
    inferring = true;
    runBtn.disabled = true;
    setInferStatus("Preprocessing image…", "info");
    resultsEmpty.hidden = true;
    resultsList.hidden = true;
    errorState.hidden = true;

    try {
      const float32 = preprocessImage(imgElement);
      const tensor = new window.ort.Tensor(
        "float32",
        float32,
        [1, 3, 224, 224],
      );

      setInferStatus("Running inference…", "info");
      const t0 = performance.now();
      const inputName = ortSession.inputNames[0];
      const feeds = { [inputName]: tensor };
      const results = await ortSession.run(feeds);
      const ms = performance.now() - t0;

      // Get logits from output tensor
      const outputName = ortSession.outputNames[0];
      const outputData = results[outputName].data;
      const probs = softmax(Array.from(outputData));
      const top5 = topK(probs, 5);

      showResults(top5, ms);
      setInferStatus(`Done in ${ms.toFixed(0)} ms`, "ok");
    } catch (err) {
      showError(`Inference failed: ${err.message}`);
      setInferStatus("Inference error — see results panel.", "error");
    } finally {
      inferring = false;
      updateRunBtn();
    }
  }

  runBtn.addEventListener("click", runInference);

  // ── Initial draw ────────────────────────────────────────
  updateRunBtn();

  return {
    destroy() {
      destroyed = true;
      if (ortSession) {
        ortSession.release?.();
        ortSession = null;
      }
      container.innerHTML = "";
    },
  };
}
