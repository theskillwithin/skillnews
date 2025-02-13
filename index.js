const IRC = require("irc-framework");
const ip = require("ip");

const bot = new IRC.Client();
const RssFeedEmitter = require("rss-feed-emitter");
const c = require("irc-colors");
const config = require("./config.js");

const feeder = new RssFeedEmitter();

function ip2Hex(address) {
  return address
    .split(".")
    .map((octet) => {
      let hex = parseInt(octet, 10).toString(16);

      if (hex.length === 1) {
        hex = `0${hex}`;
      }

      return hex;
    })
    .join("");
}

function getAuthors(item) {
  if (!item["rss:author"]) return "";

  if (Array.isArray(item["rss:author"])) {
    const authors = item["rss:author"].map((author) => author.name["#"]);
    const lastAuthor = authors.pop();
    return `${authors.join(", ")} and ${lastAuthor}`;
  }

  return `${item["rss:author"].name["#"]}`;
}

function initReader() {
  config.feeds.forEach((e) => {
    feeder.add({
      url: e.url,
      refresh: e.refresh,
    });
  });
}

bot.connect({
  host: config.server,
  nick: config.botName,
  gecos: config.realName,
  username: config.hexip ? ip2Hex(ip.address()) : config.botName,
  password: config.password,
  auto_reconnect: true,
  auto_reconnect_wait: 4000,
  auto_reconnect_max_retries: 3,
  ping_interval: 30,
  ping_timeout: 120,
});

bot.on("join", (event) => {
  if (event.nick === config.botName) {
    console.log("Joined channel:", event.channel);
  }
});

feeder.on("new-item", (item) => {
  config.channels.forEach((channel) => {
    bot.say(
      channel,
      `${c.blue(item.title)} - ${item.link} by ${getAuthors(item)}`
    );
  });
});

bot.on("registered", () => {
  console.log("Connected!");
  bot.say("NickServ", `IDENTIFY skillnews ${process.env.IDENTIFY}`);

  setTimeout(() => {
    config.channels.forEach((channel) => {
      bot.join(channel);
    });
  }, 10000);

  initReader();
});
