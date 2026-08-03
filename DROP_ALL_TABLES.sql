-- Run this FIRST in Neon SQL Editor to drop the incorrect schema.
-- Then run the new Schema.sql to create the corrected tables.

DROP TABLE IF EXISTS Game_Reviews CASCADE;
DROP TABLE IF EXISTS User_Game CASCADE;
DROP TABLE IF EXISTS FriendRequests CASCADE;
DROP TABLE IF EXISTS Friends CASCADE;
DROP TABLE IF EXISTS Group_Membership CASCADE;
DROP TABLE IF EXISTS MPGroup CASCADE;
DROP TABLE IF EXISTS MPUser CASCADE;
DROP TABLE IF EXISTS Game_Profile CASCADE;
DROP TABLE IF EXISTS Games CASCADE;

DROP FUNCTION IF EXISTS update_game_reviews_updated_at() CASCADE;
