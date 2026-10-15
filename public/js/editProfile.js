// Edit profile (was a Vue 2 page).
import './ui/nav.js';
import { api, me } from './ui/api.js';

const form = document.getElementById('form');
const msg = document.getElementById('msg');
const field = (id) => document.getElementById(id);
let user;

me().then((u) => {
  user = u;
  field('username').value = u.username || '';
  field('bio').value = u.bio || '';
});

const say = (text, ok) => { msg.textContent = text; msg.className = `form-msg ${ok ? 'ok' : 'err'}`; };

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const username = field('username').value.trim();
  const password = field('password').value;
  if (!username) { say('Username can’t be empty.'); field('username').focus(); return; }
  if (password && password.length < 8) { say('Password must be at least 8 characters.'); field('password').focus(); return; }
  const body = { bio: field('bio').value.trim() };
  if (username !== user.username) body.username = username;
  if (password) body.password = password;
  field('save').disabled = true;
  try {
    const res = await api('/profile', { method: 'PUT', body });
    field('password').value = '';
    user.username = username;
    say(res.message || 'Profile updated.', true);
  } catch (err) {
    say(err.message);
  } finally {
    field('save').disabled = false;
  }
});
