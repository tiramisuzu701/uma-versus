---
version: "0.1.2"
level: pair
processes:
  design: assist
  implementation: pair
  testing: pair
  documentation: pair
  deployment: assist
components:
  src/: assist
  tools/: assist
  supabase/: pair
  wiki/: pair
  assets/art/: none
  assets/sprites/: none
  assets/music/: none
---

## Notes

- Uma Versus is a free, non-commercial fan project. Minimal portions of the code were written by an AI coding assistant (Claude, by Anthropic) following my directions.
- Design: The move sets and the balance changes are my own, with feedback from other players. The AI assisted with the technical design (engine, rollback netcode, accounts) to align with what I envisioned.
- Implementation: the game engine, online play, accounts, menus, training tools, replays, Arcade and the tutorial were implemented, but not entirely written, by the AI.
- Testing: the AI writes and runs the automated tests (combos, combo trials, inputs, online sync, menus). I and other players playtest every update.
- Documentation: the README, patch notes, AI declaration, and wiki are written by me. The wiki's frame data is measured from the game, and its text was drafted by the AI and rewritten by me.
- Deployment: the AI assisted with the packaging scripts and database setup. I publish the site on GitHub Pages and run the database changes myself.
- Art and music: the art and music aren't mine (see Credits in the [README](README.md)); no AI was used for any of it. (->TO MY KNOWLEDGE<-)

*This declaration follows the AI-DECLARATION.md format, version 0.1.2: https://ai-declaration.md/en/0.1.2/*
