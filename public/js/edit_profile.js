document.addEventListener('DOMContentLoaded', () => {
  const app = new Vue({
    el: '#app',
    data() {
      return {
        user: null,
        form: {
          username: '',
          password: '',
          bio: ''
        },
        message: '',
        error: ''
      };
    },
    mounted() {
      fetch('/get-user', { credentials: 'include' })
        .then((res) => {
          if (!res.ok) throw new Error('Not logged in');
          return res.json();
        })
        .then((data) => {
          this.user = data;
          this.form.username = data.username || '';
          this.form.bio = data.bio || '';
        })
        .catch(() => {
          window.location.href = '/pages/login.html';
        });

      document.addEventListener('click', (e) => {
        if (e.target && e.target.id === 'btn-logout') {
          e.preventDefault();
          fetch('/auth/logout', { credentials: 'include' })
            .then(() => {
              window.location.href = '/pages/index.html';
            });
        }
      });
    },
    methods: {
      async saveProfile() {
        this.message = '';
        this.error = '';

        const payload = {};
        if (this.form.username && this.form.username !== this.user.username) {
          payload.username = this.form.username;
        }
        if (this.form.password) {
          payload.password = this.form.password;
        }
        payload.bio = this.form.bio;

        if (Object.keys(payload).length === 0) {
          this.error = 'No changes to save.';
          return;
        }

        try {
          const res = await fetch('/profile', {
            method: 'PUT',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || 'Update failed');

          this.message = data.message || 'Profile updated.';
          if (payload.username) this.user.username = payload.username;
          this.user.bio = payload.bio;
          this.form.password = '';
        } catch (err) {
          this.error = err.message;
        }
      },
      goBack() {
        window.location.href = '/pages/profile.html';
      }
    }
  });
});
