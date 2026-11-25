// Body weight bounds (D24), kept apart from the zod schemas in weight.ts so the
// form can read them without bringing zod into the browser. The CHECKs in
// 20261124190000_add_body_weight use the same numbers, as does the progress
// photo form (src/app/progress/photos/actions.ts, its own copy).
export const MIN_WEIGHT_KG = 20;
export const MAX_WEIGHT_KG = 400;
export const MAX_NOTE_LENGTH = 300;
export const EARLIEST_DAY = "2000-01-01";
