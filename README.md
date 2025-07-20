# codex

This is an [AI](https://docs.automa.app/bots/types#ai) & [manual](https://docs.automa.app/bots/types#manual) [agent](https://docs.automa.app/bots#bot-vs-agent) for [**Automa**](https://automa.app) that uses [OpenAI's Codex](https://github.com/openai/codex) tool to work on tasks.

#### Features

- Runs tasks via job schedule with retry and backoff support.
- Generates pull request titles and bodies using GPT-4.1-mini.

## Getting Started

[![Install on Automa](https://automa.app/install.svg)](https://console.automa.app/$/bots/new/openai/codex)

### Self-Hosting

This agent can be self-hosted. You can either follow our more detailed [guide](https://docs.automa.app/self-hosting/agents/codex) or follow these steps to get it running.

#### Prerequisites

- Have [`docker`](https://docker.com/) installed.

#### Needed services

- Have [`redis`](https://github.com/redis/redis) or any redis compatible memory store running.

#### Automa bot

[Create a bot](https://docs.automa.app/bot-development/create-bot) of [manual](https://docs.automa.app/bots/types#manual) type on [Automa](https://automa.app) (Cloud or Self-hosted) and point its webhook to your planned server (e.g., `http://your-server-ip:8000/hooks/automa`). Copy the **webhook secret** after it is created.

#### Starting the server

```sh
docker run -it --rm -p 8000:8000 \
  -e REDIS_URL=your_url_here \
  -e AUTOMA_WEBHOOK_SECRET=your_secret_here \
  -e OPENAI_API_KEY=your_key_here \
  ghcr.io/automa/codex
```

## How It Works

It runs [`codex`](https://github.com/openai/codex) in full approval mode.

## Contributing

Contributions and feedback are welcome! Feel free to open an issue or submit a pull request. See [CONTRIBUTING.md](CONTRIBUTING.md) for more details. Here is a list of [Contributors](https://github.com/automa/codex/contributors).

## LICENSE

MIT

## Bug Reports

Report [here](https://github.com/automa/codex/issues).
