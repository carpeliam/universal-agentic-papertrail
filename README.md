# Universal Agentic Papertrail

*Can AI truly take over the universe? and can it improve over time at doing so?*

An experiment in agentic play. Claude plays [Universal Paperclips](https://www.decisionproblem.com/paperclips/) with no prior knowledge of the game.

## Architecture

This builds on top of a [forked copy](https://github.com/carpeliam/paperclips) of [PaulAtkins88/paperclips](https://github.com/PaulAtkins88/paperclips), built to expose a domain layer that an agent can interact with directly.

Given a starting state (limited to only the information a human would see), an agent runs for ~60s, making decisions and rationalizing them. Those decisions are then summarized and passed off to the next generation, ad infinitum until the game is completed or stalled.

## The Experiment

The interesting question isn't whether the agent can play the game. It's whether notes passed between generations can carry enough context that each generation builds on the last, rather than rediscovering the same things.

## Setup

TBD.
