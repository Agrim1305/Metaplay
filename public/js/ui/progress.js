// Player progress derived from /api/me/stats (no tables of its own).
// XP = 100 per completed game + 50 per review + 10 per tracked game.
// Level L starts at 25 * L * (L + 1) XP.

export const xpFor = ({ completed, reviews, tracked }) => 100 * completed + 50 * reviews + 10 * tracked;
const levelStart = (L) => 25 * L * (L + 1);

export function levelFor(xp) {
  let level = 0;
  while (levelStart(level + 1) <= xp) level += 1;
  const start = levelStart(level);
  const next = levelStart(level + 1);
  return { level, xp, toNext: next - xp, pct: Math.round(((xp - start) / (next - start)) * 100) };
}

const G = {
  gold: 'linear-gradient(135deg,#FFD27A,#E0A83E)', red: 'linear-gradient(135deg,#FF8A9B,#E5484D)',
  blue: 'linear-gradient(135deg,#9BCBFF,#3E7FD6)', green: 'linear-gradient(135deg,#8BEBB9,#2F9E63)',
  purple: 'linear-gradient(135deg,#D3B3FF,#7A4FD6)', teal: 'linear-gradient(135deg,#8CEBE6,#2A9D9D)',
  pink: 'linear-gradient(135deg,#FFB3C7,#D6457A)', amber: 'linear-gradient(135deg,#FFE3A3,#C98A1E)',
};

// s: { completed, reviews, tracked, friends, ownsGroup, specialist: { genre, count } }
export function badgesFor(s) {
  const of = (n, goal, what) => `${Math.min(n, goal)} of ${goal} ${what}`;
  const sp = s.specialist || { genre: '', count: 0 };
  return [
    { name: 'First clear', icon: 'flag', bg: G.green, on: s.completed >= 1, done: 'Beat your first game', todo: 'Complete a game' },
    { name: 'Completionist', icon: 'emoji_events', bg: G.gold, on: s.completed >= 25, done: '25 games beaten', todo: of(s.completed, 25, 'beaten') },
    { name: 'Critic', icon: 'rate_review', bg: G.blue, on: s.reviews >= 10, done: '10 reviews written', todo: of(s.reviews, 10, 'reviews') },
    { name: 'Tastemaker', icon: 'auto_awesome', bg: G.pink, on: s.reviews >= 25, done: '25 reviews written', todo: of(s.reviews, 25, 'reviews') },
    { name: 'Specialist', icon: 'swords', bg: G.purple, on: sp.count >= 5, done: `5 ${sp.genre} games beaten`, todo: sp.genre ? of(sp.count, 5, `${sp.genre} beaten`) : 'Beat 5 in one genre' },
    { name: 'Party of six', icon: 'group', bg: G.teal, on: s.friends >= 5, done: '5 friends added', todo: of(s.friends, 5, 'friends') },
    { name: 'Founder', icon: 'castle', bg: G.red, on: !!s.ownsGroup, done: 'Started a group', todo: 'Start a group' },
    { name: 'Collector', icon: 'inventory_2', bg: G.amber, on: s.tracked >= 50, done: '50 games tracked', todo: of(s.tracked, 50, 'tracked') },
  ].map((b) => ({ ...b, desc: b.on ? b.done : b.todo }));
}

// Genre counts from RAWG game objects: [{ name, slug, count }] sorted by count.
export function genreCounts(games) {
  const m = new Map();
  for (const g of games) {
    for (const x of g.genres || []) {
      const cur = m.get(x.slug) || { name: x.name, slug: x.slug, count: 0 };
      cur.count += 1;
      m.set(x.slug, cur);
    }
  }
  return [...m.values()].sort((a, b) => b.count - a.count);
}
