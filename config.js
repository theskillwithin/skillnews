const config = {
  channels: ["#nextjs", "#reactjs", "#gp"],
  server: "irc.libera.chat",
  botName: "skillnews",
  realName: "skillnews",
  password: "",
  feeds: [
    { url: "https://nextjs.org/feed.xml", refresh: 600000 },
    { url: "https://remix.run/blog/rss.xml", refresh: 600000 },
    { url: "https://react.dev/rss.xml", refresh: 600000 },
  ],
  hexip: false, // enable hexip? Probably false unless you know what you're doing.
};

module.exports = config;
