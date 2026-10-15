// Run: node test/progress.check.mjs
import assert from 'node:assert/strict';
import { xpFor, levelFor, badgesFor, genreCounts } from '../public/js/ui/progress.js';

// The design's example: 4,470 XP is level 12, 80 XP short of 13, 88% of the way.
assert.deepEqual(levelFor(4470), { level: 12, xp: 4470, toNext: 80, pct: 88 });
assert.equal(levelFor(0).level, 0);
assert.equal(levelFor(49).level, 0);
assert.equal(levelFor(50).level, 1);   // 25 * 1 * 2
assert.equal(levelFor(150).level, 2);  // 25 * 2 * 3
assert.equal(xpFor({ completed: 31, reviews: 18, tracked: 47 }), 3100 + 900 + 470);

const b = badgesFor({ completed: 1, reviews: 18, tracked: 47, friends: 5, ownsGroup: false, specialist: { genre: 'RPG', count: 3 } });
const on = Object.fromEntries(b.map((x) => [x.name, x.on]));
assert.deepEqual(on, { 'First clear': true, Completionist: false, Critic: true, Tastemaker: false, Specialist: false, 'Party of six': true, Founder: false, Collector: false });
assert.equal(b.find((x) => x.name === 'Tastemaker').desc, '18 of 25 reviews');
assert.equal(b.find((x) => x.name === 'Specialist').desc, '3 of 5 RPG beaten');

const g = genreCounts([{ genres: [{ name: 'Action', slug: 'action' }, { name: 'RPG', slug: 'rpg' }] }, { genres: [{ name: 'Action', slug: 'action' }] }]);
assert.deepEqual(g.map((x) => [x.slug, x.count]), [['action', 2], ['rpg', 1]]);

console.log('progress checks passed');
