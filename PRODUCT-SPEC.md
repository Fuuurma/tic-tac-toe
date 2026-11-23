# Tic Tac Toe Disappear

## Players and product value

The game is for people who want a quick strategy round on their own, on a shared device, or with a friend on another device. Players can start as guests. The three-mark limit gives familiar tic-tac-toe a new decision on every fourth move, and the turn clock keeps the pace brisk. The value worth paying for would be a polished version of that experience with a reliable way to get into a round. [README](README.md) · [Game rules](ARCHITECTURE.md#game-rules)

## Player journeys

- **Learn the rule.** A first-time player can practice on the real board and see the oldest mark disappear. They can skip the lesson or replay it later from the lobby.
- **Play on this device.** A player can choose a computer difficulty or hand the same device to another person. The installed app supports local play offline.
- **Play online.** A guest can start Quick Match, create and share a room, or join directly from an invite. While searching or hosting, they can play the computer without losing their place. A brief disconnect leaves time to reconnect. When a connection fails, the player can see what happened and take the next available action.
- **Finish a round.** The board and interface show whose turn it is, which mark will disappear, and how the round ended. Players can see their saved record and start another round.

## Design and release bar

Keep the board dominant. Use concise language for status and recovery, and ensure translated copy fits on a small screen. Support keyboard interaction and reduced motion. [Design contract](DESIGN.md)

The preview becomes a release candidate once private rooms, Quick Match, and disconnect recovery are verified across two networks. [Release checklist](README.md#before-launch) · [Deployment guide](docs/DEPLOYMENT.md)

## Simplify first

Reuse the existing play modes, settings, and recovery actions. Keep secondary controls out of the board's way and keep guest play free of account setup. Prioritize helping players finish a round or recover from a failed connection before expanding the feature set.
