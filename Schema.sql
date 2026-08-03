-- MetaPlay Database Schema (Postgres)

-- Games and Game Details
CREATE TABLE IF NOT EXISTS Games (
    Game_ID INT NOT NULL,
    Title VARCHAR(255) DEFAULT NULL,
    Release_Date DATE DEFAULT NULL,
    Rating REAL DEFAULT NULL,
    PRIMARY KEY (Game_ID)
);

CREATE TABLE IF NOT EXISTS Game_Profile (
    Game_ID INT NOT NULL,
    Genre VARCHAR(100) DEFAULT NULL,
    Player_Count VARCHAR(50) DEFAULT NULL,
    Developer VARCHAR(255) DEFAULT NULL,
    PRIMARY KEY (Game_ID),
    CONSTRAINT game_profile_to_game FOREIGN KEY (Game_ID)
        REFERENCES Games(Game_ID) ON DELETE CASCADE ON UPDATE CASCADE
);

-- User Management
CREATE TABLE IF NOT EXISTS MPUser (
    User_ID SERIAL PRIMARY KEY,
    Username VARCHAR(50) NOT NULL UNIQUE,
    Password VARCHAR(255) NOT NULL,
    Email VARCHAR(100) NOT NULL UNIQUE,
    Bio TEXT DEFAULT NULL,
    Role VARCHAR(20) NOT NULL DEFAULT 'user',
    CONSTRAINT mpuser_role_check CHECK (Role IN ('user', 'admin'))
);

-- Groups and Memberships
CREATE TABLE IF NOT EXISTS MPGroup (
    Group_ID SERIAL PRIMARY KEY,
    Owner_ID INT DEFAULT NULL,
    Group_Name VARCHAR(100) DEFAULT NULL,
    Bio TEXT DEFAULT NULL,
    Group_Type VARCHAR(50) DEFAULT NULL,
    CONSTRAINT group_to_owner FOREIGN KEY (Owner_ID)
        REFERENCES MPUser(User_ID) ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS group_owner_index ON MPGroup(Owner_ID);

CREATE TABLE IF NOT EXISTS Group_Membership (
    User_ID INT NOT NULL,
    Group_ID INT NOT NULL,
    Date_Added TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (User_ID, Group_ID),
    CONSTRAINT membership_to_user FOREIGN KEY (User_ID)
        REFERENCES MPUser(User_ID) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT membership_to_group FOREIGN KEY (Group_ID)
        REFERENCES MPGroup(Group_ID) ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS group_membership_group_index ON Group_Membership(Group_ID);

-- Friends
CREATE TABLE IF NOT EXISTS Friends (
    Friendship_ID SERIAL PRIMARY KEY,
    User_ID_1 INT DEFAULT NULL,
    User_ID_2 INT DEFAULT NULL,
    Timestamp_When_Friended TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT friendship_to_user1 FOREIGN KEY (User_ID_1)
        REFERENCES MPUser(User_ID) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT friendship_to_user2 FOREIGN KEY (User_ID_2)
        REFERENCES MPUser(User_ID) ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS friend_user1_index ON Friends(User_ID_1);
CREATE INDEX IF NOT EXISTS friend_user2_index ON Friends(User_ID_2);

-- Friend Requests
CREATE TABLE IF NOT EXISTS FriendRequests (
    Request_ID SERIAL PRIMARY KEY,
    Sender_ID INT NOT NULL,
    Receiver_ID INT NOT NULL,
    Status VARCHAR(20) DEFAULT 'pending',
    Timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT friendrequest_status_check CHECK (Status IN ('pending', 'accepted', 'rejected')),
    CONSTRAINT friend_request_to_sender FOREIGN KEY (Sender_ID)
        REFERENCES MPUser(User_ID) ON DELETE CASCADE,
    CONSTRAINT friend_request_to_receiver FOREIGN KEY (Receiver_ID)
        REFERENCES MPUser(User_ID) ON DELETE CASCADE,
    CONSTRAINT unique_friend_request UNIQUE (Sender_ID, Receiver_ID, Status)
);

CREATE INDEX IF NOT EXISTS request_sender_index ON FriendRequests(Sender_ID);
CREATE INDEX IF NOT EXISTS request_receiver_index ON FriendRequests(Receiver_ID);
CREATE INDEX IF NOT EXISTS request_status_index ON FriendRequests(Status);

-- User Game Collections and Reviews
CREATE TABLE IF NOT EXISTS User_Game (
    User_ID INT NOT NULL,
    Game_ID INT NOT NULL,
    Rating INT DEFAULT NULL,
    Review TEXT DEFAULT NULL,
    Status VARCHAR(20) NOT NULL,
    PRIMARY KEY (User_ID, Game_ID),
    CONSTRAINT user_game_status_check CHECK (Status IN ('wishlist', 'played', 'collection')),
    CONSTRAINT user_game_rating_check CHECK (Rating IS NULL OR (Rating BETWEEN 1 AND 10)),
    CONSTRAINT user_game_to_user FOREIGN KEY (User_ID)
        REFERENCES MPUser(User_ID) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT user_game_to_game FOREIGN KEY (Game_ID)
        REFERENCES Games(Game_ID) ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS user_game_game_index ON User_Game(Game_ID);
CREATE INDEX IF NOT EXISTS user_game_status_index ON User_Game(User_ID, Status);

-- Game Reviews
CREATE TABLE IF NOT EXISTS Game_Reviews (
    Game_ID INT NOT NULL,
    User_ID INT NOT NULL,
    Rating INT NOT NULL CHECK (Rating BETWEEN 1 AND 10),
    Review TEXT DEFAULT NULL,
    Created_At TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    Updated_At TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (Game_ID, User_ID),
    CONSTRAINT review_to_game FOREIGN KEY (Game_ID)
        REFERENCES Games(Game_ID) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT review_to_user FOREIGN KEY (User_ID)
        REFERENCES MPUser(User_ID) ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS review_game_index ON Game_Reviews(Game_ID);
CREATE INDEX IF NOT EXISTS review_user_index ON Game_Reviews(User_ID);

-- Trigger to auto-update Updated_At on Game_Reviews (Postgres equivalent of MySQL's ON UPDATE CURRENT_TIMESTAMP)
CREATE OR REPLACE FUNCTION update_game_reviews_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.Updated_At = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS game_reviews_updated_at_trigger ON Game_Reviews;

CREATE TRIGGER game_reviews_updated_at_trigger
    BEFORE UPDATE ON Game_Reviews
    FOR EACH ROW
    EXECUTE FUNCTION update_game_reviews_updated_at();

-- NOTE: To create an admin after deploying:
--   1. Register normally through the app UI.
--   2. Run: UPDATE MPUser SET Role = 'admin' WHERE Username = 'your_username';
