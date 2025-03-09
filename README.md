# SkillNews IRC Bot

A specialized IRC bot that monitors RSS feeds from tech websites and announces updates to relevant IRC channels. Currently tracking blogs from Next.js, React, Remix, TypeScript, and Primate.js communities.

## Features

- Monitors multiple RSS feeds with configurable refresh intervals
- Posts updates to IRC channels based on configuration
- Supports mapping specific feeds to specific channels
- Can handle multiple authors in feed items
- Optional IP address hexadecimal encoding for IRC identification

## Installation

```bash
# Clone the repository
git clone <repository-url>
cd skillnews

# Install dependencies
npm install
# or
yarn
```

## Configuration

Configuration is managed in `src/config.ts`:

```typescript
export default {
  channels: {
    "#nextjs": ["nextjs", "react", "remix"],
    "#reactjs": ["react", "remix", "nextjs"],
    "#typescript": ["typescript"],
    // ...
  },
  server: "irc.libera.chat",
  user: {
    nick: "YOUR_NICKNAME", // Change this to your own IRC nickname, don't use "skillnews"
    name: "YOUR_NAME", // Change this to your own IRC username
    password: "",
  },
  feeds: {
    nextjs: { url: "https://nextjs.org/feed.xml", refresh: 600000 },
    react: { url: "https://react.dev/rss.xml", refresh: 600000 },
    // ...
  },
  hexip: false,
};
```

### Configuration Options

- `channels`: Map of IRC channels to feed subscriptions. Use `"*"` to subscribe to all feeds.
- `server`: IRC server address
- `user`: Bot credentials (⚠️ **Important:** Please use your own nickname and not "skillnews")
- `feeds`: RSS feed sources with refresh intervals in milliseconds
- `hexip`: Enable IP address hexadecimal encoding for IRC identification

## Usage

```bash
# Build and start the bot
npm run start
# or
yarn start
```

## Development

```bash
# Build the TypeScript code
npm run build
# or
yarn build

# Lint the code
npm run lint
# or
yarn lint
```

## License

MIT
