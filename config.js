const config = {
  channel: "#nextjs",
  server: "irc.libera.chat",
  botName: "skillnews",
  realName: "skillnews",
  password: process.env.IDENTIFY,
  feeds: [{ url: "https://nextjs.org/feed.xml", refresh: 600000 }],
  hexip: false, // enable hexip? Probably false unless you know what you're doing.
};

module.exports = config;
