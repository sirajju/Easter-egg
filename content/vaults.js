// Collaborative vaults. Anyone who has closed a case on their own desk gets a
// personal shard. A vault opens for everyone once shards from `needDesks`
// different desks (and at least `needShards` people) are in. Contributors
// each earn `points`. Cases can unlock with `requires: { vault: "<id>" }`.

export default [
  {
    id: "server-room",
    title: "The Server Room Door",
    body:
      "The door to the old server room has a lock with many keyholes, one for each desk. " +
      "ARCHIE says m. designed it so nobody could open it alone.",
    needDesks: 3,
    needShards: 5,
    points: 150,
  },
];
