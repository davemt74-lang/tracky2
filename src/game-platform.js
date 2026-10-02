// Shared gameplay registry: camera, identity and Voice Profiles belong to the host, not each game.
const ID = /^[a-z][a-z0-9-]{1,47}$/;
export function createGamePlatform() {
  const definitions = new Map();
  return Object.freeze({
    register(definition) {
      if (!definition || typeof definition.id !== 'string' || !ID.test(definition.id) ||
          typeof definition.title !== 'string' || !definition.title.trim() ||
          typeof definition.createSession !== 'function') throw new TypeError('Invalid game definition.');
      if (definitions.has(definition.id)) throw new Error('Game already registered: ' + definition.id);
      const game = Object.freeze({
        id: definition.id,
        title: definition.title.trim(),
        description: String(definition.description || '').trim(),
        createSession: definition.createSession
      });
      definitions.set(game.id, game);
      return Object.freeze({ id: game.id, title: game.title, description: game.description });
    },
    list() {
      return Object.freeze([...definitions.values()].map(({ id,title,description }) =>
        Object.freeze({ id,title,description })));
    },
    createSession(id, options) {
      const game = definitions.get(id);
      if (!game) throw new RangeError('Unknown game: ' + String(id));
      return game.createSession(options);
    }
  });
}
