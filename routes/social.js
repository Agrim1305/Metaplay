// Routes for managing social features (friends, groups, etc.)

const express = require('express');
const router = express.Router();
const pool = require('../db');
const { ensureAuth, getLoggedInUserId } = require('../utils/auth');

// Apply ensureAuth to all /social routes
router.use(ensureAuth);

// Friend ids for a user, as a CTE body. Friends rows can point either way.
const FRIEND_IDS = `
  SELECT DISTINCT CASE WHEN User_ID_1 = $1 THEN User_ID_2 ELSE User_ID_1 END AS fid
  FROM Friends WHERE User_ID_1 = $1 OR User_ID_2 = $1`;

// Friends who have this game in their library or reviewed it
router.get('/games/:id/friends', async (req, res) => {
  const userId = getLoggedInUserId(req);
  const gameId = parseInt(req.params.id, 10);
  if (Number.isNaN(gameId) || gameId < 1) {
    return res.status(400).json({ error: 'Invalid game ID' });
  }
  try {
    const { rows } = await pool.query(
      `WITH f AS (${FRIEND_IDS})
       SELECT u.User_ID AS "userId", u.Username AS "username",
              ug.Status AS "status", gr.Rating AS "rating"
       FROM f
       JOIN MPUser u ON u.User_ID = f.fid
       LEFT JOIN User_Game ug ON ug.User_ID = f.fid AND ug.Game_ID = $2
       LEFT JOIN Game_Reviews gr ON gr.User_ID = f.fid AND gr.Game_ID = $2
       WHERE ug.Status IS NOT NULL OR gr.Rating IS NOT NULL
       ORDER BY gr.Rating DESC NULLS LAST, u.Username`,
      [userId, gameId]
    );
    return res.json(rows);
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch friends for this game' });
  }
});

// Everything the profile page needs from SQL. Level and badges are derived client side.
router.get('/me/stats', async (req, res) => {
  const userId = getLoggedInUserId(req);
  try {
    const [{ rows: [c] }, { rows: hist }] = await Promise.all([
      pool.query(
        `WITH f AS (${FRIEND_IDS})
         SELECT
           (SELECT COUNT(*) FROM User_Game WHERE User_ID = $1 AND Status = 'wishlist') AS wishlist,
           (SELECT COUNT(*) FROM User_Game WHERE User_ID = $1 AND Status = 'collection') AS playing,
           (SELECT COUNT(*) FROM User_Game WHERE User_ID = $1 AND Status = 'played') AS completed,
           (SELECT COUNT(*) FROM Game_Reviews WHERE User_ID = $1) AS reviews,
           (SELECT AVG(Rating) FROM Game_Reviews WHERE User_ID = $1) AS average,
           (SELECT COUNT(*) FROM f) AS friends,
           EXISTS (SELECT 1 FROM MPGroup WHERE Owner_ID = $1) AS owns_group`,
        [userId]
      ),
      pool.query(
        'SELECT Rating AS rating, COUNT(*) AS n FROM Game_Reviews WHERE User_ID = $1 GROUP BY Rating',
        [userId]
      )
    ]);
    const histogram = Array(10).fill(0);
    hist.forEach((h) => { histogram[h.rating - 1] = Number(h.n); });
    const counts = { wishlist: Number(c.wishlist), playing: Number(c.playing), completed: Number(c.completed) };
    return res.json({
      counts,
      tracked: counts.wishlist + counts.playing + counts.completed,
      reviews: Number(c.reviews),
      averageScore: c.average === null ? null : Number(Number(c.average).toFixed(1)),
      histogram,
      friends: Number(c.friends),
      ownsGroup: c.owns_group
    });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to load stats' });
  }
});

// Friends' activity: reviews plus "started playing" / "completed" status changes.
router.get('/feed', async (req, res) => {
  const userId = getLoggedInUserId(req);
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 50);
  try {
    const { rows } = await pool.query(
      `WITH f AS (${FRIEND_IDS})
       SELECT e.kind, e.user_id AS "userId", u.Username AS "username", e.game_id AS "gameId",
              g.Title AS "title", e.rating, e.review, e.at
       FROM (
         SELECT 'review' AS kind, gr.User_ID AS user_id, gr.Game_ID AS game_id,
                gr.Rating AS rating, gr.Review AS review, gr.Created_At AS at
         FROM Game_Reviews gr JOIN f ON f.fid = gr.User_ID
         UNION ALL
         SELECT CASE ug.Status WHEN 'collection' THEN 'playing' ELSE 'completed' END,
                ug.User_ID, ug.Game_ID, NULL, NULL, ug.Updated_At
         FROM User_Game ug JOIN f ON f.fid = ug.User_ID
         WHERE ug.Status IN ('collection', 'played')
       ) e
       JOIN MPUser u ON u.User_ID = e.user_id
       LEFT JOIN Games g ON g.Game_ID = e.game_id
       ORDER BY e.at DESC
       LIMIT $2`,
      [userId, limit]
    );
    return res.json(rows);
  } catch (err) {
    return res.status(500).json({ error: 'Failed to load activity' });
  }
});

// Check user status and friend request eligibility in a single query
async function checkUserAndFriendStatus(userId, receiverId) {
  const { rows } = await pool.query(
    `SELECT
      EXISTS(SELECT 1 FROM MPUser WHERE User_ID = $1) as user_exists,
      EXISTS(
        SELECT 1 FROM Friends
        WHERE (User_ID_1 = $2 AND User_ID_2 = $3)
        OR (User_ID_1 = $4 AND User_ID_2 = $5)
      ) as are_friends,
      EXISTS(
        SELECT 1 FROM FriendRequests
        WHERE Sender_ID = $6 AND Receiver_ID = $7 AND Status = 'pending'
      ) as request_exists`,
    [receiverId, userId, receiverId, receiverId, userId, userId, receiverId]
  );
  return rows[0];
}

// Search users
router.get('/users/search', async (req, res) => {
  const searchTerm = req.query.q;
  if (!searchTerm) {
    return res.status(400).json({ error: 'Search term is required' });
  }

  try {
    const { rows: users } = await pool.query(
      `SELECT User_ID AS "User_ID", Username AS "Username",
              Email AS "Email", Bio AS "Bio"
       FROM MPUser
       WHERE Username ILIKE $1 OR Email ILIKE $2
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
    const { rows: requests } = await pool.query(
      `SELECT fr.Request_ID AS "Request_ID", fr.Sender_ID AS "Sender_ID",
              fr.Status AS "Status", fr.Timestamp AS "Timestamp",
              u.Username AS "Username", u.Email AS "Email", u.Bio AS "Bio"
       FROM FriendRequests fr
       JOIN MPUser u ON fr.Sender_ID = u.User_ID
       WHERE fr.Receiver_ID = $1 AND fr.Status = 'pending'
       ORDER BY fr.Timestamp DESC`,
      [userId]
    );
    return res.json(requests);
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch friend requests' });
  }
});

// Get sent friend requests — BUG FIX: single quotes instead of double
router.get('/friends/requests/sent', async (req, res) => {
  const userId = getLoggedInUserId(req);
  if (!userId) {
    return res.status(401).json({ error: 'Not logged in' });
  }
  try {
    const { rows: requests } = await pool.query(
      `SELECT Request_ID AS "Request_ID", Receiver_ID AS "Receiver_ID"
       FROM FriendRequests WHERE Sender_ID = $1 AND Status = 'pending'`,
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

    await pool.query(
      'INSERT INTO FriendRequests (Sender_ID, Receiver_ID) VALUES ($1, $2)',
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
    const { rows: requests } = await pool.query(
      `SELECT Request_ID AS "Request_ID", Sender_ID AS "Sender_ID",
              Receiver_ID AS "Receiver_ID", Status AS "Status"
       FROM FriendRequests WHERE Request_ID = $1 AND Receiver_ID = $2`,
      [requestId, userId]
    );

    if (requests.length === 0) {
      return res.status(404).json({ error: 'Friend request not found' });
    }

    const request = requests[0];

    if (action === 'accept') {
      // Postgres transaction: use pool.connect() + BEGIN/COMMIT/ROLLBACK
      const client = await pool.connect();
      try {
        await client.query('BEGIN');

        await client.query(
          'UPDATE FriendRequests SET Status = $1 WHERE Request_ID = $2',
          ['accepted', requestId]
        );

        await client.query(
          'INSERT INTO Friends (User_ID_1, User_ID_2) VALUES ($1, $2)',
          [request.Sender_ID, request.Receiver_ID]
        );

        await client.query('COMMIT');
        return res.json({ message: 'Friend request accepted' });
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }
    } else {
      await pool.query(
        'UPDATE FriendRequests SET Status = $1 WHERE Request_ID = $2',
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
    const { rows: friends } = await pool.query(
      `SELECT u.User_ID AS "User_ID", u.Username AS "Username",
              u.Email AS "Email", u.Bio AS "Bio",
              f.Timestamp_When_Friended AS "Timestamp_When_Friended",
              np.Game_ID AS "nowPlayingId", npg.Title AS "nowPlayingTitle"
       FROM Friends f
       JOIN MPUser u ON (
         (f.User_ID_1 = $1 AND f.User_ID_2 = u.User_ID) OR
         (f.User_ID_2 = $2 AND f.User_ID_1 = u.User_ID)
       )
       LEFT JOIN LATERAL (
         SELECT Game_ID FROM User_Game
         WHERE User_ID = u.User_ID AND Status = 'collection'
         ORDER BY Updated_At DESC LIMIT 1
       ) np ON TRUE
       LEFT JOIN Games npg ON npg.Game_ID = np.Game_ID
       WHERE f.User_ID_1 = $3 OR f.User_ID_2 = $4
       ORDER BY u.Username`,
      [userId, userId, userId, userId]
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
    await pool.query(
      `DELETE FROM Friends
       WHERE (User_ID_1 = $1 AND User_ID_2 = $2)
       OR (User_ID_1 = $3 AND User_ID_2 = $4)`,
      [userId, friendId, friendId, userId]
    );
    return res.json({ message: 'Friend removed' });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to remove friend' });
  }
});

// Search groups
// An empty search lists the biggest groups, so the Social page has groups to suggest.
router.get('/groups/search', async (req, res) => {
  const userId = getLoggedInUserId(req);
  const searchTerm = (req.query.q || '').trim();

  try {
    const { rows: groups } = await pool.query(
      `SELECT g.Group_ID AS "Group_ID", g.Group_Name AS "Group_Name",
              g.Bio AS "Bio", g.Group_Type AS "Group_Type",
              u.Username AS "Owner_Name", g.Owner_ID AS "Owner_ID",
              COUNT(gm.User_ID) AS "Member_Count",
              COALESCE(BOOL_OR(gm.User_ID = $3), FALSE) AS "Is_Member"
       FROM MPGroup g
       LEFT JOIN MPUser u ON g.Owner_ID = u.User_ID
       LEFT JOIN Group_Membership gm ON g.Group_ID = gm.Group_ID
       WHERE $1 = '' OR g.Group_Name ILIKE $2 OR g.Bio ILIKE $2
       GROUP BY g.Group_ID, u.Username
       ORDER BY COUNT(gm.User_ID) DESC, g.Group_Name
       LIMIT 12`,
      [searchTerm, `%${searchTerm}%`, userId]
    );
    const mappedGroups = groups.map((g) => ({
      id: g.Group_ID,
      name: g.Group_Name,
      description: g.Bio,
      memberCount: Number(g.Member_Count),
      owner: g.Owner_Name,
      groupType: g.Group_Type,
      isMember: g.Is_Member,
      isOwner: g.Owner_ID === userId
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
    const { rows: groups } = await pool.query(
      `SELECT g.Group_ID AS "Group_ID", g.Group_Name AS "Group_Name",
              g.Bio AS "Bio", g.Group_Type AS "Group_Type",
              u.Username AS "Owner_Name", g.Owner_ID AS "Owner_ID",
              COUNT(gm2.User_ID) AS "Member_Count"
       FROM Group_Membership gm
       JOIN MPGroup g ON gm.Group_ID = g.Group_ID
       LEFT JOIN MPUser u ON g.Owner_ID = u.User_ID
       LEFT JOIN Group_Membership gm2 ON g.Group_ID = gm2.Group_ID
       WHERE gm.User_ID = $1
       GROUP BY g.Group_ID, u.Username
       ORDER BY g.Group_Name`,
      [userId]
    );
    const mappedGroups = groups.map((g) => ({
      id: g.Group_ID,
      name: g.Group_Name,
      description: g.Bio,
      memberCount: Number(g.Member_Count),
      owner: g.Owner_Name,
      groupType: g.Group_Type,
      isMember: true,
      isOwner: g.Owner_ID === userId
    }));
    return res.json(mappedGroups);
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch user groups' });
  }
});

// Create group
router.post('/groups', async (req, res) => {
  const userId = getLoggedInUserId(req);
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
    // Postgres transaction
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const { rows: insertRows } = await client.query(
        `INSERT INTO MPGroup (Group_Name, Bio, Group_Type, Owner_ID)
         VALUES ($1, $2, $3, $4) RETURNING Group_ID`,
        [name, bio, groupType || null, userId]
      );

      const groupId = insertRows[0].group_id;

      await client.query(
        'INSERT INTO Group_Membership (User_ID, Group_ID) VALUES ($1, $2)',
        [userId, groupId]
      );

      await client.query('COMMIT');
      return res.status(201).json({
        message: 'Group created',
        groupId,
        name,
        bio,
        groupType
      });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
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
    const { rows: groups } = await pool.query(
      'SELECT Group_ID FROM MPGroup WHERE Group_ID = $1',
      [groupId]
    );

    if (groups.length === 0) {
      return res.status(404).json({ error: 'Group not found' });
    }

    const { rows: memberships } = await pool.query(
      'SELECT 1 FROM Group_Membership WHERE User_ID = $1 AND Group_ID = $2',
      [userId, groupId]
    );

    if (memberships.length > 0) {
      return res.status(400).json({ error: 'Already a member of this group' });
    }

    await pool.query(
      'INSERT INTO Group_Membership (User_ID, Group_ID) VALUES ($1, $2)',
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
    const { rows: groups } = await pool.query(
      'SELECT Owner_ID AS "Owner_ID" FROM MPGroup WHERE Group_ID = $1',
      [groupId]
    );

    if (groups.length === 0) {
      return res.status(404).json({ error: 'Group not found' });
    }

    if (groups[0].Owner_ID === userId) {
      // Owner is leaving: delete the group and all memberships
      await pool.query('DELETE FROM MPGroup WHERE Group_ID = $1', [groupId]);
      // Group_Membership rows will be deleted via ON DELETE CASCADE
      return res.json({ message: 'Group deleted because owner left' });
    }

    await pool.query(
      'DELETE FROM Group_Membership WHERE User_ID = $1 AND Group_ID = $2',
      [userId, groupId]
    );

    return res.json({ message: 'Left group' });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to leave group' });
  }
});

module.exports = router;
