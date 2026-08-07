// Generate hero images via OpenAI gpt-image-1 (Ramon-authorized, build-time
// tooling only — never runtime). Usage: node scripts/gen-heroes.mjs chest prow …
import { writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const KEY = process.env.OPENAI_API_KEY;
if (!KEY) { console.error('no OPENAI_API_KEY'); process.exit(1); }

const BIBLE = 'Museum-grade prop photography, single warm hearth key light from upper left, deep black shadow falloff, carved dark oak with near-black recesses, worn gold leaf surviving on proud ridges, traces of old blood-red, fjord-blue and pine-green pigment deep in the carving grooves, Viking Age craftsmanship in Oseberg and Urnes style, photorealistic, dark background, no text, no letters, no watermark, no people.';

const ASSETS = {
  chest: ['1024x1536', 'A massive closed Viking sea-chest facing the camera straight on, curved oak lid, three broad riveted iron straps, fifteen small round bronze lock medallions arranged in three arcs across the front, carved interlace borders, standing on stone flags in a dark mead-hall, ember glow pooling on the floor.'],
  prow: ['1024x1536', 'A carved wooden dragon figurehead from a Viking longship, side profile facing right, swept-back horns, rows of chip-carved scales down the recurved neck, snarling parted jaw with carved teeth, tight spiral snout.'],
  panel: ['1536x1024', 'An empty rectangular carved oak panel, wide ornate border of deep-cut Urnes-style ribbon interlace with beast-head terminals, chip-carved corner rosettes, the center field plain smooth dark oak with subtle grain, photographed perfectly flat-on like a picture frame.'],
  chart: ['1536x1024', "A captain's chart table seen top-down: an aged vellum map of a Norse fjord coast with inked coastlines and tiny rock hatchings, brass dividers, a scored whalebone compass rose disc, a coil of tarred cord, all on dark oak."],
  stones: ['1536x1024', 'Nine weathered rune-stones standing in a shallow arc on trampled dusk moorland, each carved with runic bands, lichen and age, one taller law-rock at center, two distant torches, cold twilight with warm torchlight rims.'],
  silver: ['1536x1024', 'A Viking silver-court seen top-down: twelve hack-silver fragments - cut coins, chopped ingots, bent arm-ring pieces - laid on dark wool cloth, a small hanging balance scale with bronze pans at rest above them, hammered textures, cold sheen.'],
  tafl: ['1536x1024', 'A carved hnefatafl game board, 7x7 grid of inlaid squares worn smooth at the center, turned bone and dark tar-stained wooden pieces standing on it, a carved king piece, photographed at a shallow angle.'],
  ring: ['1024x1024', 'A twisted gold Viking oath arm-ring, macro photograph, two thick gold rods twisted together with hammer facets, fourteen small sockets worked into the twist, one iron rivet, resting on a round oak plinth.'],
  rose: ['1024x1024', 'A scored whalebone compass disc, macro, 32-point wind rose construction scribed into aged bone, major points bold, cardinal marks carved as runes, salt rime at the edge.'],
  bench: ['1536x1024', "A woodcarver's bench top-down: a partly carved oak knotwork panel held by iron clamps, mallet and three chisels resting beside it, pale wood shavings, chalk stub, whetstone."],
};

const wanted = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(ASSETS);
mkdirSync(join(ROOT, 'assets/gen'), { recursive: true });

for (const id of wanted) {
  const a = ASSETS[id];
  if (!a) { console.error(`unknown asset ${id}`); continue; }
  const [size, prompt] = a;
  process.stdout.write(`gen ${id} (${size})… `);
  const res = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${KEY}` },
    body: JSON.stringify({ model: 'gpt-image-1', prompt: `${prompt} ${BIBLE}`, size, quality: 'high', n: 1 }),
  });
  if (!res.ok) { console.error(`HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`); continue; }
  const data = await res.json();
  const b64 = data.data && data.data[0] && data.data[0].b64_json;
  if (!b64) { console.error('no image payload'); continue; }
  const out = join(ROOT, 'assets/gen', `${id}.png`);
  writeFileSync(out, Buffer.from(b64, 'base64'));
  console.log(`saved assets/gen/${id}.png (${Math.round(b64.length * 0.75 / 1024)}KB)`);
}
