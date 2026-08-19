import store from "@primate/core/store";
import sqlite from "@primate/sqlite";
import c from "irc-colors";
import IRC from "irc-framework";
import type { EventEmitter } from "node:events";
import { networkInterfaces } from "node:os";
import { setTimeout as sleep } from "node:timers/promises";
import p from "pema";
import RSSFeedEmitter from "rss-feed-emitter";
import config from "./config.js";

const db = sqlite({ database: "./db.data" });

const Item = store({
  table: "item",
  db,
  schema: {
    id: store.key.primary(p.u32),
    link: p.string,
    feed: p.string,
    channel: p.string,
  },
});

await Item.create();

const bot = new IRC.Client();

// First non-internal IPv4 address of this host, or a loopback fallback.
function localAddress() {
  const addresses = Object.values(networkInterfaces()).flat();

  for (const address of addresses) {
    if (
      address !== undefined &&
      address.family === "IPv4" &&
      !address.internal
    ) {
      return address.address;
    }
  }

  return "127.0.0.1";
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

type Author = {
  name: {
    "#": string;
  };
};

type FeedItem = {
  "rss:author"?: Author;
};

function getAuthors(item: FeedItem) {
  // Feed contents are not actually typed: `rss:author` may be absent, a single
  // author, or an array of them. Normalise to an array before formatting rather
  // than trusting the declared type.
  const author = item["rss:author"] as Author | Author[] | null | undefined;

  if (author === undefined || author === null) {
    return "";
  }

  const authors = (Array.isArray(author) ? author : [author]).map(
    (each) => each.name["#"],
  );

  if (authors.length === 0) {
    return "";
  }

  if (authors.length === 1) {
    return `by ${authors[0]}`;
  }

  const lastAuthor = authors.pop();
  return `by ${authors.join(", ")} and ${lastAuthor}`;
}

bot.connect({
  host: config.server,
  nick: config.user.nick,
  gecos: config.user.name,
  username: (config.hexip /*upcast*/ as boolean)
    ? ip2Hex(localAddress())
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
  // rss-feed-emitter extends EventEmitter at runtime, but its generated
  // typings only declare `emit`, so widen the type to expose `on`.
  const feeder = new RSSFeedEmitter() as RSSFeedEmitter & EventEmitter;
  Object.entries(config.feeds).forEach(([feed, { url, refresh }]) => {
    feeder.on(feed, async (item) => {
      const preseeded = (await Item.count({ where: { feed } })) > 0;
      const channels = match_channels(feed as Feed);

      for (const channel of channels) {
        const found =
          (await Item.count({ where: { link: item.link, channel } })) > 0;
        if (!found) {
          await Item.insert({ link: item.link, feed, channel });
          if (preseeded) {
            bot.say(
              channel,
              `${c.blue(item.title)} - ${item.link} ${getAuthors(item)}`,
            );
          }
        }
      }
    });
    feeder.add({ url, refresh, eventName: feed });
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
