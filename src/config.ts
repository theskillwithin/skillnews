type Feeds = {
  [k in string]: {
    url: string,
    refresh: number;
  }
}

const feeds = {
  nextjs: { url: "https://nextjs.org/feed.xml", refresh: 600000 },
  remix: { url: "https://remix.run/blog/rss.xml", refresh: 600000 },
  react: { url: "https://react.dev/rss.xml", refresh: 600000 },
  typescript: { url: "https://devblogs.microsoft.com/typescript/feed/", refresh: 600000 },
  primate: { url: "https://primatejs.com/blog.rss", refresh: 600000 },
} satisfies Feeds;

type Channels = {
  [k in `#${string}`]: (keyof typeof feeds)[] | "*"
};

export default {
  channels: {
    //"#nextjs": ["nextjs"],
    //"#reactjs": ["react", "remix"],
    //"#typescript": ["typescript"],
    "#gp": "*",
    "#primate": ["primate"],
  },
  server: "irc.libera.chat",
  user: {
    nick: "skillnews",
    name: "skillnews",
    password: "",
  },
  feeds,
  hexip: false, // enable hexip? Probably false unless you know what you're doing.
} satisfies {
  channels: Channels,
  server: string,
  user: {
    nick: string,
    name: string,
    password: string,
  }
  feeds: Feeds,
  hexip: boolean,
};
