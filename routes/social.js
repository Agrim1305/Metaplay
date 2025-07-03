// Routes for managing social features (friends, groups, etc.)

const express = require('express');
const router = express.Router();
const pool = require('../db');
const { ensureAuth, getLoggedInUserId } = require('../utils/auth');

// Apply ensureAuth to all /social routes
router.use(ensureAuth);

// Check user status and friend request eligibility in a single query
async function checkUserAndFriendStatus(userId, receiverId) {
  const [rows] = await pool.execute(
    `SELECT
      EXISTS(SELECT 1 FROM MPUser WHERE User_ID = ?) as user_exists,
      EXISTS(
        SELECT 1 FROM Friends
        WHERE (User_ID_1 = ? AND User_ID_2 = ?)
        OR (User_ID_1 = ? AND User_ID_2 = ?)
      ) as are_friends,
      EXISTS(
        SELECT 1 FROM FriendRequests
        WHERE Sender_ID = ? AND Receiver_ID = ? AND Status = 'pending'
      ) as request_exists`,
    [receiverId, userId, receiverId, receiverId, userId, userId, receiverId]
  );
  return rows[0];
}

// Search users with optimized query
router.get('/users/search', async (req, res) => {
  const searchTerm = req.query.q;
  if (!searchTerm) {
    return res.status(400).json({ error: 'Search term is required' });
  }

  try {
    const [users] = await pool.execute(
      `SELECT User_ID, Username, Email, Bio
       FROM MPUser
       WHERE Username LIKE ? OR Email LIKE ?
       LIMIT 10`,
      [`%${searchTerm}%`, `%${searchTerm}%`]
    );
    return res.json(users);
  } catch (err) {
    return res.status(500).json({ error: 'Failed to search users' });
  }
});

// Get friend requests
router.get('/friends/requests', async (req, res) => {
  const userId = getLoggedInUserId(req);
  if (!userId) {
    return res.status(401).json({ error: 'Not logged in' });
  }

  try {
    const [requests] = await pool.execute(
      `SELECT fr.Request_ID, fr.Sender_ID, fr.Status, fr.Timestamp,
              u.Username, u.Email, u.Bio
       FROM FriendRequests fr
       JOIN MPUser u ON fr.Sender_ID = u.User_ID
       WHERE fr.Receiver_ID = ? AND fr.Status = 'pending'
       ORDER BY fr.Timestamp DESC`,
      [userId]
    );
    return res.json(requests);
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch friend requests' });
  }
});

// Get sent friend requests
router.get('/friends/requests/sent', async (req, res) => {
  const userId = getLoggedInUserId(req);
  if (!userId) {
    return res.status(401).json({ error: 'Not logged in' });
  }
  try {
    const [requests] = await pool.execute(
      'SELECT Request_ID, Receiver_ID FROM FriendRequests WHERE Sender_ID = ? AND Status = "pending"',
      [userId]
    );
    return res.json(requests);
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch sent friend requests' });
  }
});

// Send friend request
router.post('/friends/request', async (req, res) => {
  const userId = getLoggedInUserId(req);
  let { receiverId } = req.body;

  receiverId = parseInt(receiverId, 10);

  if (!userId) {
    return res.status(401).json({ error: 'Not logged in' });
  }

  if (!receiverId || isNaN(receiverId)) {
    return res.status(400).json({ error: 'Receiver ID is required' });
  }

  if (userId === receiverId) {
    return res.status(400).json({ error: 'You cannot send a friend request to yourself.' });
  }

  try {
    const status = await checkUserAndFriendStatus(userId, receiverId);

    if (!status.user_exists) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (status.are_friends) {
      return res.status(400).json({ error: 'Already friends' });
    }

    if (status.request_exists) {
      return res.status(400).json({ error: 'Friend request already sent' });
    }

    await pool.execute(
      'INSERT INTO FriendRequests (Sender_ID, Receiver_ID) VALUES (?, ?)',
      [userId, receiverId]
    );

    return res.status(201).json({ message: 'Friend request sent' });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to send friend request' });
  }
});

// Handle friend request (accept/reject)
router.post('/friends/request/:requestId', async (req, res) => {
  const userId = getLoggedInUserId(req);
  const { requestId } = req.params;
  const { action } = req.body;

  if (!userId) {
    return res.status(401).json({ error: 'Not logged in' });
  }

  if (!['accept', 'reject'].includes(action)) {
    return res.status(400).json({ error: 'Invalid action' });
  }

  try {
    const [requests] = await pool.execute(
      'SELECT * FROM FriendRequests WHERE Request_ID = ? AND Receiver_ID = ?',
      [requestId, userId]
    );

    if (requests.length === 0) {
      return res.status(404).json({ error: 'Friend request not found' });
    }

    const request = requests[0];

    if (action === 'accept') {
      const conn = await pool.getConnection();
      await conn.beginTransaction();

      try {
        await conn.execute(
          'UPDATE FriendRequests SET Status = ? WHERE Request_ID = ?',
          ['accepted', requestId]
        );

        await conn.execute(
          'INSERT INTO Friends (User_ID_1, User_ID_2) VALUES (?, ?)',
          [request.Sender_ID, request.Receiver_ID]
        );

        await conn.commit();
        return res.json({ message: 'Friend request accepted' });
      } catch (err) {
        await conn.rollback();
        throw err;
      } finally {
        conn.release();
      }
    } else {
      await pool.execute(
        'UPDATE FriendRequests SET Status = ? WHERE Request_ID = ?',
        ['rejected', requestId]
      );
      return res.json({ message: 'Friend request rejected' });
    }
  } catch (err) {
    return res.status(500).json({ error: 'Failed to handle friend request' });
  }
});

// Get friends list
router.get('/friends', async (req, res) => {
  const userId = getLoggedInUserId(req);
  if (!userId) {
    return res.status(401).json({ error: 'Not logged in' });
  }

  try {
    const [friends] = await pool.execute(
      `SELECT u.User_ID, u.Username, u.Email, u.Bio, f.Timestamp_When_Friended
       FROM Friends f
       JOIN MPUser u ON (
         CASE
           WHEN f.User_ID_1 = ? THEN f.User_ID_2 = u.User_ID
           ELSE f.User_ID_1 = u.User_ID
         END
       )
       WHERE f.User_ID_1 = ? OR f.User_ID_2 = ?
       ORDER BY u.Username`,
      [userId, userId, userId]
    );
    return res.json(friends);
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch friends' });
  }
});

// Remove friend
router.delete('/friends/:friendId', async (req, res) => {
  const userId = getLoggedInUserId(req);
  const { friendId } = req.params;

  if (!userId) {
    return res.status(401).json({ error: 'Not logged in' });
  }

  try {
    await pool.execute(
      `DELETE FROM Friends
       WHERE (User_ID_1 = ? AND User_ID_2 = ?)
       OR (User_ID_1 = ? AND User_ID_2 = ?)`,
      [userId, friendId, friendId, userId]
    );
    return res.json({ message: 'Friend removed' });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to remove friend' });
  }
});

// Search groups
router.get('/groups/search', async (req, res) => {
  const searchTerm = req.query.q;
  if (!searchTerm) {
    return res.status(400).json({ error: 'Search term is required' });
  }

  try {
    const [groups] = await pool.execute(
      `SELECT g.Group_ID, g.Group_Name, g.Bio, g.Group_Type,
              u.Username as Owner_Name,
              COUNT(gm.User_ID) as Member_Count
       FROM MPGroup g
       LEFT JOIN MPUser u ON g.Owner_ID = u.User_ID
       LEFT JOIN Group_Membership gm ON g.Group_ID = gm.Group_ID
       WHERE g.Group_Name LIKE ? OR g.Bio LIKE ?
       GROUP BY g.Group_ID
       LIMIT 10`,
      [searchTerm, searchTerm]
    );
    const mappedGroups = groups.map((g) => ({
      id: g.Group_ID,
      name: g.Group_Name,
      description: g.Bio,
      memberCount: g.Member_Count,
      owner: g.Owner_Name,
      groupType: g.Group_Type
    }));
    return res.json(mappedGroups);
  } catch (err) {
    return res.status(500).json({ error: 'Failed to search groups' });
  }
});

// Get user's groups
router.get('/groups', async (req, res) => {
  const userId = getLoggedInUserId(req);
  if (!userId) {
    return res.status(401).json({ error: 'Not logged in' });
  }

  try {
    const [groups] = await pool.execute(
      `SELECT g.Group_ID, g.Group_Name, g.Bio, g.Group_Type,
              u.Username as Owner_Name,
              COUNT(gm2.User_ID) as Member_Count
       FROM Group_Membership gm
       JOIN MPGroup g ON gm.Group_ID = g.Group_ID
       LEFT JOIN MPUser u ON g.Owner_ID = u.User_ID
       LEFT JOIN Group_Membership gm2 ON g.Group_ID = gm2.Group_ID
       WHERE gm.User_ID = ?
       GROUP BY g.Group_ID
       ORDER BY g.Group_Name`,
      [userId]
    );
    const mappedGroups = groups.map((g) => ({
      id: g.Group_ID,
      name: g.Group_Name,
      description: g.Bio,
      memberCount: g.Member_Count,
      owner: g.Owner_Name,
      groupType: g.Group_Type
    }));
    return res.json(mappedGroups);
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch user groups' });
  }
});

// Create group
router.post('/groups', async (req, res) => {
  const userId = getLoggedInUserId(req);
  // Accept both 'description' and 'bio' for compatibility
  const {
 name, description, bio: bioRaw, groupType
} = req.body;
  const bio = description || bioRaw || null;

  if (!userId) {
    return res.status(401).json({ error: 'Not logged in' });
  }

  if (!name) {
    return res.status(400).json({ error: 'Group name is required' });
  }

  try {
    const conn = await pool.getConnection();
    await conn.beginTransaction();

    try {
      const [result] = await conn.execute(
        'INSERT INTO MPGroup (Group_Name, Bio, Group_Type, Owner_ID) VALUES (?, ?, ?, ?)',
        [name, bio, groupType || null, userId]
      );

      const groupId = result.insertId;

      await conn.execute(
        'INSERT INTO Group_Membership (User_ID, Group_ID) VALUES (?, ?)',
        [userId, groupId]
      );

      await conn.commit();
      return res.status(201).json({
        message: 'Group created',
        groupId,
        name,
        bio,
        groupType
      });
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  } catch (err) {
    return res.status(500).json({ error: 'Failed to create group' });
  }
});

// Join group
router.post('/groups/:groupId/join', async (req, res) => {
  const userId = getLoggedInUserId(req);
  const { groupId } = req.params;

  if (!userId) {
    return res.status(401).json({ error: 'Not logged in' });
  }

  try {
    const [groups] = await pool.execute(
      'SELECT Group_ID FROM MPGroup WHERE Group_ID = ?',
      [groupId]
    );

    if (groups.length === 0) {
      return res.status(404).json({ error: 'Group not found' });
    }

    const [memberships] = await pool.execute(
      'SELECT 1 FROM Group_Membership WHERE User_ID = ? AND Group_ID = ?',
      [userId, groupId]
    );

    if (memberships.length > 0) {
      return res.status(400).json({ error: 'Already a member of this group' });
    }

    await pool.execute(
      'INSERT INTO Group_Membership (User_ID, Group_ID) VALUES (?, ?)',
      [userId, groupId]
    );

    return res.status(201).json({ message: 'Joined group' });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to join group' });
  }
});

// Leave group
router.delete('/groups/:groupId/leave', async (req, res) => {
  const userId = getLoggedInUserId(req);
  const { groupId } = req.params;

  if (!userId) {
    return res.status(401).json({ error: 'Not logged in' });
  }

  try {
    const [groups] = await pool.execute(
      'SELECT Owner_ID FROM MPGroup WHERE Group_ID = ?',
      [groupId]
    );

    if (groups.length === 0) {
      return res.status(404).json({ error: 'Group not found' });
    }

    if (groups[0].Owner_ID === userId) {
      // Owner is leaving: delete the group and all memberships
      await pool.execute('DELETE FROM MPGroup WHERE Group_ID = ?', [groupId]);
      // Group_Membership rows will be deleted via ON DELETE CASCADE
      return res.json({ message: 'Group deleted because owner left' });
    }

    await pool.execute(
      'DELETE FROM Group_Membership WHERE User_ID = ? AND Group_ID = ?',
      [userId, groupId]
    );

    return res.json({ message: 'Left group' });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to leave group' });
  }
});

module.exports = router;
