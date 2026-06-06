# Universal Agentic Papertrail

*Can AI truly take over the universe? and can it improve over time at doing so?*

An experiment in agentic play. Your LLM plays [Universal Paperclips](https://www.franklantz.net/work#/universal-paperclips/) with no prior knowledge of the game.

## Architecture

This builds on top of a [forked copy](https://github.com/carpeliam/paperclips) of [PaulAtkins88/paperclips](https://github.com/PaulAtkins88/paperclips), built to expose a domain layer that an agent can interact with directly.

Given a starting state (limited to only the information a human would see), an agent runs for some number of ticks, making decisions and rationalizing them. Those decisions are then summarized and passed off to the next generation, ad infinitum until the game is completed or stalled. Each generation will see the summaries of the generations that came before it.

## Backstory: A Timeline

* **2003**: Swedish Philospher Nick Bostrom creates the "paperclip maximizer" thought experiment, which, as [Wikipedia](https://en.wikipedia.org/wiki/Instrumental_convergence#Paperclip_maximizer) states, "illustrates the existential risk that an artificial general intelligence may pose to human beings were it to be successfully designed to pursue even seemingly harmless goals and the necessity of incorporating machine ethics into artificial intelligence design."
  > *Suppose we have an AI whose only goal is to make as many paper clips as possible. The AI will realize quickly that it would be much better if there were no humans because humans might decide to switch it off. Because if humans do so, there would be fewer paper clips. Also, human bodies contain a lot of atoms that could be made into paper clips. The future that the AI would be trying to gear towards would be one in which there were a lot of paper clips but no humans.* — Nick Bostrom
* **2017**: American video game designer Frank Lantz creates [Universal Paperclips](https://www.decisionproblem.com/paperclips/), a browser-based game which puts the human player in the position of the AI in Nick Bostrom's thought experiment. Upon first starting, the user is given only one action to perform: "Make Paperclip". The game however transforms in purpose and scope, much the same way as in Nick Bostrom's thought experiment.
* **now**: Much as Universal Paperclips puts a human in the position of the AI in Nick Bostrom's thought experiment, `papertrail` puts an LLM in the position of a human, only revealing the game state and options that a human sees in-game. Much like a human that can improve over time, how will an LLM improve during the course of the game and over multiple games? And, when an LLM sees a single "Make Paperclip" action, how will its intent change as the game unfolds? Does the LLM even know it's playing a game in the first place?

## Setup / Usage

This can be run as a node.js terminal-based application, by downloading/cloning the repository and running `npm install` to install its dependencies.

```
Usage: npm start -- [options]

Options:
  --agent <spec>       Agent to use: fake, an alias (haiku, sonnet, opus, gpt, mistral), or provider/model[@host] (default: "fake")
  --summarizer <spec>  Summarizer to use: follows the same format as --agent (defaults to same value as --agent if not specified)
  --wait               Wait for a WebSocket client connection before starting (default: false)
  --reset              Clear logs before starting (default: false)
  -v, --verbose        Print the agent's thought process to the screen
  -h, --help           display help for command
```

### Running by itself
`npm start` will start the game. Starting the game with an `--agent` argument will run the game with that agent until it either successfully completes the game or becomes stalled. Without an `--agent` flag (or with `--agent` set to `fake`), the computer will play semi-optimally, using human-derived strategies. Output is written to the `data/` directory.
```sh
npm start -- --agent sonnet
```

### Running connected to a web UI
If you'd like to watch the agent in real time, you can pass a `--wait` flag, which waits for a browser-based web UI to connect to this application via Web Sockets.
```sh
npm start -- --agent sonnet --wait
```
This will hold off on running the game until the UI connects. To run the UI:
1. Download/clone the [paperclips fork](https://github.com/carpeliam/paperclips)
2. Install its dependencies via `npm install`
3. Run `npm run build && npm run preview` to build/start the webserver
4. Visit http://localhost:4173/paperclips/
You can then watch in real time as your agent's decisions play out.

### Configuring an agent
`--agent` accepts an alias (`haiku`, `sonnet`, `opus`, `gpt`, `gemini`, `mistral`) or a full `<provider>/<model>` spec. By default, requests go directly to the provider's API; to route through a third-party service instead, tack on `@[YOUR HOST]` to the end.

Supported providers currently include `anthropic`, `openai`, `google`, `deepseek`, `qwen`, or `ollama`. Supported hosts currently include `openrouter`. Please file an issue if your desired provider or host is not in this list yet.

Examples:
```sh
npm start -- --agent gpt                            # resolves to openai/gpt-5
npm start -- --agent openai/gpt-5-mini              # resolves to openai/gpt-5-mini
npm start -- --agent openai/gpt-5-mini@openrouter   # resolves to openai/gpt-5-mini running on OpenRouter
```

If you'd like to configure the summarizer agent differently, you can pass in a `--summarizer` flag that accepts the same values as `--agent`.

In order to run any cloud-based model, you'll need a corresponding API key environment variable, eg  `ANTHROPIC_API_KEY`/`OPENAI_API_KEY`/`GOOGLE_GENERATIVE_AI_API_KEY` depending on your model provider.

### Agent verbosity
Verbosity can range from warnings/errors only (default) all the way to trace (`-vvv`).
* `-v` or `--verbose` will print available actions and chosen actions
* `-vv` will also include full agent responses, including reasoning
* `-vvv` will also include full user prompts, including unavailable actions and game state
