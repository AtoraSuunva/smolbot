# Smol Bot (& RobotOtter)

## [Add RobotOtter to Server](https://discordapp.com/oauth2/authorize?client_id=189078347207278593&scope=bot%20applications.commands&permissions=0)

## [Support Server](https://discord.gg/8K3uCfb) - [Privacy Policy](./privacy.md) - [Terms of Service](./tos.md)

Various (mostly) moderation- or utility-focused commands I've needed, in a Discord bot.

Technically "Yet Another Mod Bot Nobody Asked For," but all the utils here were made because of my own requirements. You are free to invite and use the "public" version [RobotOtter](https://discordapp.com/oauth2/authorize?client_id=189078347207278593&scope=bot&permissions=0). You cannot invite Smol Bot.

> [!WARNING]  
> This is currently still a WIP. Most things are pretty stable, but nothing's guaranteed.

## RobotOtter?

**tl;dr: This repo *IS* RobotOtter's source code!**

RobotOtter used to be an ancient mod-like bot with misc commands that I maintained. I've partially given up on maintaining it, instead investing my work into Smol Bot, which then ended up superseding RobotOtter in literally every feature. In the end I decided might as well just run RobotOtter off Smol Bot's codebase (which supported all the exact same mod features) and only have to maintain 3 bots instead of 4. Smol Bot is also significantly more advanced in a bunch of ways.

## Setup

While open-source, Smol Bot isn't really designed to be ran anywhere. If you're familiar with Node.js or Docker, you can get it running yourself, but documentation isn't a big priority. Everything below is *mainly* written for my own reference (I have forgotten important steps before, never again).

### .env requirements

```sh
NODE_ENV=development # or production
TOKEN=<discord bot token>
APPLICATION_ID=<discord application id>
USE_PINO_PRETTY=true # or false for default pino logs
DATABASE_URL="file:./db/dev.db" # or anywhere else you want an sqlite db to be
ACTIVITIES_FILE="./resources/activities-smol.txt" # path to a text file with the activities you want the bot to show
SENTRY_DSN=<access token> # A sentry DSN for error reporting, optional
```

## Running

You can either run the bot via the pre-built Docker image, Docker, or installing the dependencies yourself.

### Pre-built Docker image

A pre-built image is available from [GitHub](https://github.com/AtoraSuunva/SmolBot/pkgs/container/smolbot), currently building off the latest development commit.

Create a `.env` file and a `docker-smolbot.yml` file (or whatever name you want):

```yml
services:
  bot:
    image: 'ghcr.io/atorasuunva/smolbot:development'
    restart: always
    init: true
    env_file:
      - .env
    volumes:
      - smolbot-db:/home/node/app/prisma/db

volumes:
  smolbot-db:
```

Then run it via `docker compose -f docker-smolbot.yml`. This avoids needing to clone the repo and wait for builds. A `docker run` will work as well, but require copy-pasting the command to keep the config.

> [!NOTE]  
> Currently, the activities files `activities-smol.txt` etc are baked into the image. You can't change the activities without needing to rebuild the image. Someday I'll change it, but it's pretty low priority.

### Docker

If you prefer/need to re-build the image (ie. you've changed the code), you can use the provided `docker-compose.yml` and `docker compose up -d --build` to handle it all for you.

### Installing dependencies yourself

You'll need Node.js (At **least** >=22.0.0), pnpm, patience, and prayers.

Assuming you have Node.js and pnpm installed and working:

```sh
# Install dependencies (*should* generate prisma client)
pnpm install

# Either
pnpm build
pnpm start:prod
# Or, doing both steps in 1 command
pnpm start:dev
```
