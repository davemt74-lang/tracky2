// Pure view model keeps gameplay copy separate from camera and voice runtimes.
export function gamePresentation(game) {
  if (game.over) return {
    title: 'Game over — ' + game.score + ' points.',
    detail: 'You reached your selected point goal. Press Play again for a new game.'
  };
  if (!game.active) return {
    title: 'Choose your point goal and start the game.',
    detail: 'Each highlighted section cleared is worth one point.'
  };
  const zoneNumber = game.activeZone + 1;
  if (game.lastEvent === 'signal-lost') return {
    title: 'Tracking lost. Find the green controller.',
    detail: 'After tracking resumes, start a complete up → down repetition.'
  };
  if (game.lastEvent === 'outside-zone') return {
    title: 'Move into Zone ' + zoneNumber + '.',
    detail: 'Only complete up → down reps inside the highlighted section count.'
  };
  if (game.lastEvent === 'rep') return {
    title: game.repsRemaining + ' reps left in Zone ' + zoneNumber + '.',
    detail: 'Keep the up → down rhythm inside the highlighted section.'
  };
  if (game.lastEvent === 'round-start') return {
    title: 'Zone ' + zoneNumber + ': ' + game.repsRemaining + ' reps.',
    detail: 'Complete up → down cycles inside the highlighted section.'
  };
  return {
    title: 'Zone ' + zoneNumber + ': ' + game.repsRemaining + ' reps left.',
    detail: 'Complete up → down cycles inside the highlighted section.'
  };
}
