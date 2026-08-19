# Upgrading a running skillnews deployment

This release upgrades Primate from 0.3 to 0.9 and requires **Node.js 24**.
Read the database note before restarting the bot.

## 0. Authentication moved to SASL

The bot now identifies with **SASL** during connection registration instead of
messaging NickServ after connecting, and connects over **TLS on port 6697**
(it previously used plaintext 6667, which meant the account password crossed
the wire in the clear).

Nothing new to configure — the same `IDENTIFY` secret is reused as the SASL
password. It is now required at startup: the bot exits immediately with
`IDENTIFY is not set` rather than silently running unidentified.

Why: the old flow sent `IDENTIFY` and then joined channels on a fixed
10-second timer. A timer is a guess, not a confirmation — whenever services
lagged, the joins went out before identification completed and `+r` channels
rejected them silently, leaving the bot in fewer channels with nothing in the
logs. SASL completes before registration finishes, so joining while
unidentified is no longer possible.

If authentication fails the bot now disconnects and logs
`SASL authentication failed (<reason>)` rather than carrying on unidentified.
Check that first if it starts looping on reconnect after this upgrade.

## 1. Node.js 24

The bot now needs Node 24 or newer. `@primate/sqlite` uses the built-in
`node:sqlite`, which is stable in 24 (it was experimental in 22 and printed a
warning on every start).

With nvm:

```bash
nvm install 24
nvm use 24
node --version   # expect v24.x
```

Or from NodeSource on Debian/Ubuntu:

```bash
curl -fsSL https://deb.nodesource.com/setup_24.x | sudo -E bash -
sudo apt-get install -y nodejs
```

If the bot runs under systemd with an absolute path to the old Node binary,
update `ExecStart` to the new one (`which node`) and `systemctl daemon-reload`.

## 2. Pull and reinstall

The dependency tree changed substantially and the old `node_modules` will not
work. Delete it rather than installing on top:

```bash
cd /path/to/skillnews
git pull
rm -rf node_modules
npm ci
npm run build
```

Use `npm ci`, not `yarn`. There is no `yarn.lock` in this repo, so yarn would
re-resolve every dependency range from scratch and could pull a different tree
than the one that was tested.

## 3. Check the database before restarting

**Read this even if everything above went fine.**

`Item.create()` issues `CREATE TABLE IF NOT EXISTS`. It does not migrate an
existing table and it does not warn if the table on disk has a different shape
— you would only find out minutes later, when the first feed poll throws
`no such column` inside an async handler and takes the process down.

The current schema is unchanged by this upgrade, so an existing `db.data`
should just work. Confirm it:

```bash
node -e "const {DatabaseSync} = require('node:sqlite');
const db = new DatabaseSync('./db.data');
console.log(db.prepare(\"select sql from sqlite_master where name='item'\").get()?.sql);"
```

Expect all four columns — `id`, `link`, `feed`, `channel`:

```
CREATE TABLE `item` (`id` INTEGER PRIMARY KEY, `link` TEXT, `feed` TEXT, `channel` TEXT)
```

`id INTEGER PRIMARY KEY` and `id INTEGER PRIMARY KEY AUTOINCREMENT` are both
fine — new databases get `AUTOINCREMENT`, older ones do not, and the store
works either way.

If `channel` is missing, the database predates the per-channel tracking change
and the bot will crash on the first feed poll. Either add the column:

```bash
node -e "const {DatabaseSync} = require('node:sqlite');
const db = new DatabaseSync('./db.data');
db.exec('alter table item add column channel TEXT');"
```

...or just delete it and let the bot rebuild:

```bash
rm db.data
```

Deleting is safe and quiet. On an empty database the bot treats every feed as
unseeded: it records the current items without announcing them, and only starts
posting once genuinely new items appear. It will not spam the channels with a
backlog.

## 4. Restart and watch

```bash
sudo systemctl restart skillnews    # or: pm2 restart skillnews
journalctl -u skillnews -f          # or: pm2 logs skillnews
```

The bot identifies with NickServ, waits 10 seconds, joins its channels, then
starts polling feeds 5 seconds later. Nothing is posted on the first poll of a
feed it has never seen.

## Rolling back

```bash
git checkout <previous-commit>
rm -rf node_modules
npm ci
npm run build
```

Note that the previous release **cannot be installed any more**: it depends on
`@rcompat/stdio@0.12.2`, which has been unpublished from npm, so `npm ci` on the
old lockfile fails. A rollback only works if the old `node_modules` still exists
on the box — so consider moving it aside rather than deleting it:

```bash
mv node_modules node_modules.bak
```
