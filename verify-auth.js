#!/usr/bin/env node

// Preflight check for SASL credentials. Connects exactly as the bot does,
// authenticates, reports the result and quits. It never joins a channel and
// never sends a message, so it is safe to run against production credentials
// before deploying.
//
//   IDENTIFY=... npm run verify-auth

import IRC from "irc-framework";

const SERVER = "irc.libera.chat";
const ACCOUNT = "skillnews";
// Connect under a different nick than the bot's. SASL authenticates against
// the account, not the nick, so this checks the real credentials without
// colliding with a running bot - a collision would otherwise stall
// registration and look like an auth failure.
const NICK = `${ACCOUNT}-check`;
const TIMEOUT_MS = 30000;

// Allow pointing at a test ircd; defaults to Libera.
const HOST = process.env.IRC_HOST || SERVER;
const PORT = Number(process.env.IRC_PORT || 6697);
const TLS = process.env.IRC_TLS !== "false";

if (!process.env.IDENTIFY) {
  console.error("FAIL: IDENTIFY is not set in the environment");
  process.exit(1);
}

const client = new IRC.Client();
let settled = false;

const done = (ok, message) => {
  if (settled) return;
  settled = true;
  console.log(message);
  client.quit();
  setTimeout(() => process.exit(ok ? 0 : 1), 250);
};

client.on("registered", () => {
  // Reaching "registered" with SASL configured means the server accepted us.
  done(
    true,
    `PASS: authenticated to the "${ACCOUNT}" account and registered.\n` +
      "      The bot will identify before joining. No channels were joined.",
  );
});

client.on("sasl failed", (event) => {
  done(
    false,
    `FAIL: SASL rejected (${event.reason}).\n` +
      "      The IDENTIFY secret does not match the account, or the nick is\n" +
      `      not grouped to an account named "${ACCOUNT}". Fix before\n` +
      "      deploying: the bot now refuses to run unidentified rather\n" +
      "      than joining.",
  );
});

// Should not happen with the -check suffix, but a stalled registration would
// otherwise be reported as an auth failure.
client.on("nick in use", () => {
  done(false, `FAIL: ${NICK} is already in use; rerun with a free nick.`);
});

client.on("close", () => {
  done(false, "FAIL: connection closed before authentication completed.");
});

setTimeout(
  () => done(false, "FAIL: timed out waiting for the server."),
  TIMEOUT_MS,
);

console.log(
  `Checking SASL for account "${ACCOUNT}" on ${HOST}:${PORT} as ${NICK}...`,
);

client.connect({
  host: HOST,
  port: PORT,
  tls: TLS,
  rejectUnauthorized: TLS,
  nick: NICK,
  username: NICK,
  gecos: NICK,
  account: { account: ACCOUNT, password: process.env.IDENTIFY },
  sasl_disconnect_on_fail: true,
  auto_reconnect: false,
});
