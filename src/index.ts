import Store from "@primate/core/database/Store";
import sqlite from "@primate/sqlite";
import ip from "ip";
import c from "irc-colors";
import IRC from "irc-framework";
import { setTimeout as sleep } from "node:timers/promises";
import p from "pema";
import RSSFeedEmitter from "rss-feed-emitter";
import config from "./config.js";

const Item = new Store(
  {
    id: p.primary,
    link: p.string,
    feed: p.string,
    channel: p.string,
  },
  { database: sqlite({ database: "./db.data" }), name: "item" },
);
Item.schema.create();

const bot = new IRC.Client();

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
    const lastAuthor = authors.pop();
    return `by ${authors.join(", ")} and ${lastAuthor}`;
  }

  return `by ${item["rss:author"].name["#"]}`;
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
  const feeder = new RSSFeedEmitter();
  Object.entries(config.feeds).forEach(([feed, { url, refresh }]) => {
    feeder.on(feed, async (item) => {
      const preseeded = (await Item.count({ feed })) > 0;
      const channels = match_channels(feed as Feed);

      for (const channel of channels) {
        const found = (await Item.count({ link: item.link, channel })) > 0;
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
  feeder.on("error", () => { });
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
