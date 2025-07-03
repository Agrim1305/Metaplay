-- MetaPlay Database Schema

-- Games and Game Details
CREATE TABLE IF NOT EXISTS Games (
    Game_ID INT NOT NULL,
    Title VARCHAR(255) DEFAULT NULL,
    Release_Date DATE DEFAULT NULL,
    Rating FLOAT DEFAULT NULL,
    PRIMARY KEY (Game_ID)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS Game_Profile (
    Game_ID INT NOT NULL,
    Genre VARCHAR(100) DEFAULT NULL,
    Player_Count VARCHAR(50) DEFAULT NULL,
    Developer VARCHAR(255) DEFAULT NULL,
    PRIMARY KEY (Game_ID),
    CONSTRAINT game_profile_to_game FOREIGN KEY (Game_ID)
        REFERENCES Games(Game_ID) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- User Management
CREATE TABLE IF NOT EXISTS MPUser (
    User_ID INT NOT NULL AUTO_INCREMENT,
    Username VARCHAR(50) NOT NULL UNIQUE,
    Password VARCHAR(255) NOT NULL,
    Email VARCHAR(100) NOT NULL UNIQUE,
    Bio TEXT DEFAULT NULL,
    Role ENUM('user', 'admin') NOT NULL DEFAULT 'user',
    PRIMARY KEY (User_ID)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Groups and Memberships
CREATE TABLE IF NOT EXISTS MPGroup (
    Group_ID INT NOT NULL AUTO_INCREMENT,
    Owner_ID INT DEFAULT NULL,
    Group_Name VARCHAR(100) DEFAULT NULL,
    Bio TEXT DEFAULT NULL,
    Group_Type VARCHAR(50) DEFAULT NULL,
    PRIMARY KEY (Group_ID),
    INDEX group_owner_index (Owner_ID),
    CONSTRAINT group_to_owner FOREIGN KEY (Owner_ID)
        REFERENCES MPUser(User_ID) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS Group_Membership (
    User_ID INT NOT NULL,
    Group_ID INT NOT NULL,
    Date_Added DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (User_ID, Group_ID),
    INDEX group_membership_group_index (Group_ID),
    CONSTRAINT membership_to_user FOREIGN KEY (User_ID)
        REFERENCES MPUser(User_ID) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT membership_to_group FOREIGN KEY (Group_ID)
        REFERENCES MPGroup(Group_ID) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Friends and Friend Requests
CREATE TABLE IF NOT EXISTS Friends (
    Friendship_ID INT NOT NULL AUTO_INCREMENT,
    User_ID_1 INT DEFAULT NULL,
    User_ID_2 INT DEFAULT NULL,
    Timestamp_When_Friended DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (Friendship_ID),
    INDEX friend_user1_index (User_ID_1),
    INDEX friend_user2_index (User_ID_2),
    CONSTRAINT friendship_to_user1 FOREIGN KEY (User_ID_1)
        REFERENCES MPUser(User_ID) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT friendship_to_user2 FOREIGN KEY (User_ID_2)
        REFERENCES MPUser(User_ID) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS FriendRequests (
    Request_ID INT AUTO_INCREMENT PRIMARY KEY,
    Sender_ID INT NOT NULL,
    Receiver_ID INT NOT NULL,
    Status ENUM('pending', 'accepted', 'rejected') DEFAULT 'pending',
    Timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (Sender_ID) REFERENCES MPUser(User_ID) ON DELETE CASCADE,
    FOREIGN KEY (Receiver_ID) REFERENCES MPUser(User_ID) ON DELETE CASCADE,
    UNIQUE KEY unique_friend_request (Sender_ID, Receiver_ID, Status),
    INDEX request_sender_index (Sender_ID),
    INDEX request_receiver_index (Receiver_ID),
    INDEX request_status_index (Status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- User Game Collections and Reviews
CREATE TABLE IF NOT EXISTS User_Game (
    User_ID INT NOT NULL,
    Game_ID INT NOT NULL,
    Rating INT DEFAULT NULL,
    Review TEXT DEFAULT NULL,
    Status ENUM('wishlist', 'played', 'collection') NOT NULL,
    PRIMARY KEY (User_ID, Game_ID),
    INDEX user_game_game_index (Game_ID),
    INDEX user_game_status_index (User_ID, Status),
    CONSTRAINT user_game_to_user FOREIGN KEY (User_ID)
        REFERENCES MPUser(User_ID) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT user_game_to_game FOREIGN KEY (Game_ID)
        REFERENCES Games(Game_ID) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT user_game_rating_check CHECK (Rating BETWEEN 1 AND 10)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS Game_Reviews (
    Game_ID INT NOT NULL,
    User_ID INT NOT NULL,
    Rating INT NOT NULL CHECK (Rating BETWEEN 1 AND 10),
    Review TEXT DEFAULT NULL,
    Created_At DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    Updated_At DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (Game_ID, User_ID),
    INDEX review_game_index (Game_ID),
    INDEX review_user_index (User_ID),
    CONSTRAINT review_to_game FOREIGN KEY (Game_ID)
        REFERENCES Games(Game_ID) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT review_to_user FOREIGN KEY (User_ID)
        REFERENCES MPUser(User_ID) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Create default admin user
INSERT IGNORE INTO MPUser (Username, Password, Email, `Role`)
VALUES (
    'Admin',
    '$2b$10$yu/z1er4vJUuxKx7HvFp/.rMjTF7.xezajBUcCeYa0qGRj94IWo4K', -- admin123
    'admin@example.com',
    'admin'
);

