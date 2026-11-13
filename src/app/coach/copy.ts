// Fixed wording on the coach screen (#63), kept out of actions.ts because a "use server" file may only export async functions.
export const TIER_MESSAGE =
  "The coach is part of the free trial and Pro. Start a trial or upgrade on your account page to chat.";
export const NO_PROFILE_MESSAGE =
  "Take the quiz first, so the coach knows your goal, equipment and injuries.";
export const EMPTY_MESSAGE = "Type a message for the coach first.";
export const TOO_LONG_MESSAGE = "That message is too long to send.";
export const SAVE_FAILED_MESSAGE =
  "Your message and the coach's reply could not be saved. Send it again to keep them in your conversation.";
export const LOAD_FAILED_MESSAGE =
  "Your conversation could not be loaded, so nothing was sent. Send it again in a moment.";
export const RATE_MINUTE_MESSAGE =
  "That's a lot of messages in a minute. Wait a moment, then send your next one.";
export const RATE_DAY_MESSAGE =
  "You've reached today's limit of coach messages. The coach is back tomorrow; your plan and logging still work.";
// The message box stops here; it matches MAX_MESSAGE_CHARS in src/lib/coach/chat.ts
// (a test checks), copied so the client bundle does not pull in the turn logic.
export const MESSAGE_MAX_LENGTH = 1000;
