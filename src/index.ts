import IRC from "irc-framework";
import ip from "ip";
import RSSFeedEmitter from "rss-feed-emitter";
import c from "irc-colors";
import config from "./config.js";
import { setTimeout as sleep } from "node:timers/promises";

const bot = new IRC.Client();

// Simple rate limiter: drop messages that exceed the limit
let messageCount = 0;
let intervalStart = Date.now();

function rateLimitedSay(channel: string, message: string) {
  if (!config.rateLimit.enabled) {
    bot.say(channel, message);
    return;
  }

  const now = Date.now();

  // Reset counter if interval has passed
  if (now - intervalStart >= config.rateLimit.intervalMs) {
    messageCount = 0;
    intervalStart = now;
  }

  // Drop message if we've exceeded the limit
  if (messageCount >= config.rateLimit.maxMessages) {
    return;
  }

  // Send message and increment counter
  bot.say(channel, message);
  messageCount++;
}

function ip2Hex(address: string) {
  return address
    .split(".")
    .map((octet: string) => {
      let hex = parseInt(octet, 10).toString(16);

      if (hex.length === 1) {
        hex = `0${hex}`;
      }

      return hex;
    })
    .join("");
}

type Item = {
  "rss:author"?: {
    name: {
      "#": string;
    };
  };
};

function getAuthors(item: Item) {
  if (!item["rss:author"]) return "";

  if (Array.isArray(item["rss:author"])) {
    const authors = item["rss:author"].map((author) => author.name["#"]);
    if (authors.length === 0) return "";
    if (authors.length === 1) return authors[0];

    const lastAuthor = authors.pop();
    return `${authors.join(", ")} and ${lastAuthor}`;
  }

  return `${item["rss:author"].name["#"]}`;
}

bot.connect({
  host: config.server,
  nick: config.user.nick,
  gecos: config.user.name,
  username: (config.hexip /*upcast*/ as boolean)
    ? ip2Hex(ip.address())
    : config.user.nick,
  password: config.user.password,
  auto_reconnect: true,
  auto_reconnect_wait: 4000,
  auto_reconnect_max_retries: 3,
  ping_interval: 30,
  ping_timeout: 120,
});

type Feed = keyof typeof config.feeds;

const match_channels = (feed: Feed) =>
  Object.entries(config.channels)
    .filter(([, feeds]) => feeds === "*" || (feeds as Feed[]).includes(feed))
    .map(([name]) => name);

const init_feeder = () => {
  const feeder = new RSSFeedEmitter({ skipFirstLoad: true });
  Object.entries(config.feeds).forEach(([eventName, { url, refresh }]) => {
    feeder.on(eventName, (item) => {
      match_channels(eventName as Feed).forEach((channel) => {
        rateLimitedSay(
          channel,
          `${c.blue(item.title)} - ${item.link} by ${getAuthors(item)}`
        );
      });
    });
    feeder.add({ url, refresh, eventName });
  });

  // Silent error handler to prevent crashes
  feeder.on("error", () => {});
};

bot.on("registered", async () => {
  bot.say("NickServ", `IDENTIFY ${config.user.nick} ${process.env.IDENTIFY}`);

  // wait for 10 seconds before joining channels
  await sleep(10000);

  Object.keys(config.channels).forEach((channel) => {
    bot.join(channel);
  });

  setTimeout(() => {
    init_feeder();
  }, 5000);
});
