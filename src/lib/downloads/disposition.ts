// The Content-Disposition value that makes a browser save a file (D33).
const FALLBACK_NAME = "download";
const REPLACEMENT = "_";
const HEX = 16;
// The last control character, and the delete character: both are removed from a name.
const LAST_CONTROL = 0x1f;
const DELETE = 0x7f;
const PLAIN_CHARACTERS =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789._-";
// encodeURIComponent leaves these alone, but RFC 8187 wants them percent-encoded.
const ALSO_ENCODED = "'()*";

const isControlOrQuote = (character: string) =>
  character.charCodeAt(0) <= LAST_CONTROL ||
  character.charCodeAt(0) === DELETE ||
  character === '"';

const percent = (character: string) =>
  `%${character.charCodeAt(0).toString(HEX).toUpperCase()}`;

const mapCharacters = (text: string, change: (character: string) => string) =>
  Array.from(text, change).join("");

// Directory pieces ("..", "etc") are not part of a file name; only dots is not a name at all.
const isRealPiece = (piece: string) => piece.replaceAll(".", "") !== "";

// Drops directory pieces and anything that could end the quoted name early.
function cleanName(name: string): string {
  const joined = name
    .split("/")
    .flatMap((piece) => piece.split("\\"))
    .filter(isRealPiece)
    .join(REPLACEMENT);
  const clean = mapCharacters(joined, (character) =>
    isControlOrQuote(character) ? REPLACEMENT : character,
  );
  return clean === "" ? FALLBACK_NAME : clean;
}

// `attachment; filename="plain"; filename*=UTF-8''percent-encoded`. The plain name is for old
// browsers and is ASCII only; the second carries the exact name.
export function attachmentDisposition(filename: string): string {
  const clean = cleanName(filename);
  const plain = mapCharacters(clean, (character) =>
    PLAIN_CHARACTERS.includes(character) ? character : REPLACEMENT,
  );
  const exact = mapCharacters(encodeURIComponent(clean), (character) =>
    ALSO_ENCODED.includes(character) ? percent(character) : character,
  );
  return `attachment; filename="${plain}"; filename*=UTF-8''${exact}`;
}
