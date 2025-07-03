// Global variables
let sentFriendRequests = [];
let currentUserId = null;

// Utility Functions
function showToast(message) {
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = message;
  document.body.appendChild(toast);

  setTimeout(() => {
    toast.remove();
  }, 3000);
}

// Display Functions
function displayFriendRequests(requests) {
  const container = document.getElementById('friendRequests');

  if (!requests.length) {
    container.innerHTML = '<p>No pending friend requests</p>';
    return;
  }

  const html = requests.map((request) => `
    <div class="section">
      <div>
        <h4>Request: ${request.Username}</h4>
        <p>Bio: ${request.Bio || 'No bio available'}</p>
      </div>
      <div class="modal-actions">
        <button type="button" class="btn-secondary" onclick="handleFriendRequest('${request.Request_ID}', 'accept')">
          Accept
        </button>
        <button type="button" class="btn-secondary" onclick="handleFriendRequest('${request.Request_ID}', 'reject')">
          Reject
        </button>
      </div>
    </div>
  `).join('');

  container.innerHTML = html;
}

function displayFriendsList(friends) {
  const container = document.getElementById('friendsList');

  if (!friends.length) {
    container.innerHTML = '<p>No friends yet</p>';
    return;
  }

  const html = friends.map((friend) => `
    <div class="section">
      <div>
        <h4>Friend: ${friend.Username}</h4>
        <p>Bio: ${friend.Bio || 'No bio available'}</p>
      </div>
      <button type="button" class="btn-secondary" onclick="removeFriend('${friend.User_ID}')">
        Remove Friend
      </button>
    </div>
  `).join('');

  container.innerHTML = html;
}

function displayGroupsList(groups) {
  const container = document.getElementById('groupsList');

  if (!groups.length) {
    container.innerHTML = '<p>Not a member of any groups</p>';
    return;
  }

  const html = groups.map((group) => {
    const groupName = group.name || 'Unnamed Group';
    const groupDesc = group.description || 'No description available';
    const memberText = typeof group.memberCount === 'number' ? group.memberCount : 'No members';
    return `
      <div class="section">
        <div>
          <h4>Group: ${groupName}</h4>
          <p>Bio: ${groupDesc}</p>
          <p>Members: ${memberText}</p>
        </div>
        <button type="button" class="btn-secondary" onclick="leaveGroup('${group.id}')">
          Leave Group
        </button>
      </div>
    `;
  }).join('');

  container.innerHTML = html;
}

function displayUserSearchResults(users) {
  const resultsContainer = document.getElementById('userSearchResults');

  if (!users.length) {
    resultsContainer.innerHTML = '<p>No users found</p>';
    return;
  }

  // Get a set of IDs for pending requests
  const pendingIds = new Set(sentFriendRequests.map((r) => r.Receiver_ID));

  const html = users
    .filter((user) => user.User_ID !== currentUserId) // filter out self
    .map((user) => {
      if (pendingIds.has(user.User_ID)) {
        return `
          <div class="section">
            <div>
              <h4>User: ${user.Username}</h4>
              <p>Bio: ${user.Bio || 'No bio available'}</p>
            </div>
            <button type="button" class="btn-secondary" disabled>Request Pending</button>
          </div>
        `;
      }
      return `
        <div class="section">
          <div>
            <h4>User: ${user.Username}</h4>
            <p>Bio: ${user.Bio || 'No bio available'}</p>
          </div>
          <button type="button" class="btn-primary" onclick="sendFriendRequest('${user.User_ID}')">Add Friend</button>
        </div>
      `;
    }).join('');

  resultsContainer.innerHTML = html;
}

function displayGroupSearchResults(groups) {
  const resultsContainer = document.getElementById('groupSearchResults');

  if (!groups.length) {
    resultsContainer.innerHTML = '<p>No groups found</p>';
    return;
  }

  const html = groups.map((group) => {
    const groupName = group.name || 'Unnamed Group';
    const groupDesc = group.description || 'No description available';
    const memberText = typeof group.memberCount === 'number' ? group.memberCount : 'No members';
    return `
      <div class="section">
        <div>
          <h4>Group: ${groupName}</h4>
          <p>Bio: ${groupDesc}</p>
          <p>Members: ${memberText}</p>
        </div>
        <button type="button" class="btn-primary" onclick="joinGroup('${group.id}')">
          Join Group
        </button>
      </div>
    `;
  }).join('');

  resultsContainer.innerHTML = html;
}

// API Functions
async function fetchCurrentUserId() {
  try {
    const response = await fetch('/get-user', { credentials: 'include' });
    if (!response.ok) return null;
    const user = await response.json();
    return user.userId;
  } catch (error) {
    return null;
  }
}

async function loadSentFriendRequests() {
  try {
    const response = await fetch('/api/friends/requests/sent', {
      credentials: 'include'
    });
    if (!response.ok) throw new Error('Failed to load sent friend requests');
    sentFriendRequests = await response.json();
  } catch (error) {
    sentFriendRequests = [];
  }
}

async function loadFriendRequests() {
  try {
    const response = await fetch('/api/friends/requests', {
      credentials: 'include'
    });

    if (!response.ok) throw new Error('Failed to load friend requests');

    const requests = await response.json();
    displayFriendRequests(requests);
  } catch (error) {
    showToast('Failed to load friend requests');
  }
}

async function loadFriendsList() {
  try {
    const response = await fetch('/api/friends', {
      credentials: 'include'
    });

    if (!response.ok) throw new Error('Failed to load friends list');

    const friends = await response.json();
    displayFriendsList(friends);
  } catch (error) {
    showToast('Failed to load friends list');
  }
}

async function loadGroupsList() {
  try {
    const response = await fetch('/api/groups', {
      credentials: 'include'
    });

    if (!response.ok) throw new Error('Failed to load groups list');

    const groups = await response.json();
    displayGroupsList(groups);
  } catch (error) {
    showToast('Failed to load groups list');
  }
}

async function handleUserSearch() {
  const searchInput = document.getElementById('userSearch');
  const searchTerm = searchInput.value.trim();

  if (!searchTerm) {
    showToast('Please enter a search term');
    return;
  }

  try {
    await loadSentFriendRequests();
    const response = await fetch(`/api/users/search?q=${encodeURIComponent(searchTerm)}`, {
      credentials: 'include'
    });

    if (!response.ok) throw new Error('Search failed');

    const users = await response.json();
    displayUserSearchResults(users);
  } catch (error) {
    showToast('Failed to search users');
  }
}

async function handleGroupSearch() {
  const searchInput = document.getElementById('groupSearch');
  const searchTerm = searchInput.value.trim();

  if (!searchTerm) {
    showToast('Please enter a search term');
    return;
  }

  try {
    const response = await fetch(`/api/groups/search?q=${encodeURIComponent(searchTerm)}`, {
      credentials: 'include'
    });

    if (!response.ok) throw new Error('Search failed');

    const groups = await response.json();
    displayGroupSearchResults(groups);
  } catch (error) {
    showToast('Failed to search groups');
  }
}

async function handleFriendRequest(requestId, action) {
  try {
    const response = await fetch(`/api/friends/request/${requestId}`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action })
    });

    if (!response.ok) throw new Error(`Failed to ${action} friend request`);

    showToast(`Friend request ${action}ed`);
    loadFriendRequests();
    loadFriendsList();
  } catch (error) {
    showToast(`Failed to ${action} friend request`);
  }
}

async function sendFriendRequest(userId) {
  try {
    const response = await fetch('/api/friends/request', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      credentials: 'include',
      body: JSON.stringify({ receiverId: userId })
    });

    if (!response.ok) throw new Error('Failed to send friend request');

    showToast('Friend request sent');
    await loadSentFriendRequests();
    handleUserSearch();
  } catch (error) {
    showToast('Failed to send friend request');
  }
}

async function removeFriend(friendId) {
  try {
    const response = await fetch(`/api/friends/${friendId}`, {
      method: 'DELETE',
      credentials: 'include'
    });

    if (!response.ok) throw new Error('Failed to remove friend');

    showToast('Friend removed');
    loadFriendsList();
  } catch (error) {
    showToast('Failed to remove friend');
  }
}

async function joinGroup(groupId) {
  try {
    const response = await fetch(`/api/groups/${groupId}/join`, {
      method: 'POST',
      credentials: 'include'
    });

    if (!response.ok) throw new Error('Failed to join group');

    showToast('Joined group');
    loadGroupsList();
  } catch (error) {
    showToast('Failed to join group');
  }
}

async function leaveGroup(groupId) {
  try {
    const response = await fetch(`/api/groups/${groupId}/leave`, {
      method: 'DELETE',
      credentials: 'include'
    });

    if (!response.ok) throw new Error('Failed to leave group');

    showToast('Left group');
    loadGroupsList();
  } catch (error) {
    showToast('Failed to leave group');
  }
}

// Initialize everything after all functions are defined
function initializeApp() {
  // Initialize all sections
  loadFriendRequests();
  loadFriendsList();
  loadGroupsList();

  document.getElementById('searchUsers').addEventListener('click', handleUserSearch);
  document.getElementById('searchGroups').addEventListener('click', handleGroupSearch);

  document.getElementById('userSearch').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') handleUserSearch();
  });
  document.getElementById('groupSearch').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') handleGroupSearch();
  });
}

// On page load, fetch current user ID and initialize app
document.addEventListener('DOMContentLoaded', async () => {
  currentUserId = await fetchCurrentUserId();
  initializeApp();
});

