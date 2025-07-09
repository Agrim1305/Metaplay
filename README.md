# Group Repository for COMP SCI 2207/7207 Web & Database Computing Web Application Project (2025 Semester 1)

## Project Description
MetaPlay is a web application that allows users to find, interact with, and follow video games, accessing live data from the RAWG Video Games Database API, and socialise with other gamers. MetaPlay’s target audience consists of gamers, both the casual gamer who plays mobile games and the hardcore PC gamer or professional gamer. MetaPlay will have a clean, user-friendly interface that allows users to search through a massive collection of games across various platforms, genres, and popularity rankings. Users will be able to build and manage personalised game collections, keep track of played and wish listed games, and search for details like ratings, release dates, descriptions, screenshots, and player counts. MetaPlay will have search and filtering features to make it easy to find games based on genre, platform, release year, or user ratings. Users will also be able to contribute reviews and ratings, join groups, and make friends, helping to shape a dynamic and community-driven experience.

## Setup instructions

Navigate to the repository Final????, once there install the required dependencies by running npm install express morgan express-session passport dotenv bcrypt mysql2 passport-google-oauth20, the .env is included in the directory and contains the API key, and specific database information. This allows the server to connect to the mysql database and RAWG API correctly. To continue you must import the database schema by using mysql -u root -p metaplay < Schema.sql then ALTER USER 'root'@'localhost' IDENTIFIED WITH mysql_native_password BY 'root'; FLUSH PRIVILEGES; mysql -u root -p. once this is ready start the server using npm start, this will allow you to open the webpage using 'open in browser' or http://localhost:8080.

1. npm install express morgan express-session passport dotenv bcrypt mysql2 passport-google-oauth20
2. service mysql start
3. mysql
4. mysql> CREATE DATABASE metaplay;
5. ALTER USER 'root'@'localhost' IDENTIFIED WITH mysql_native_password BY 'root';
6. FLUSH PRIVILEGES;
7. exit
8. mysql -u root -p metaplay < Schema.sql
9. Password: root
10. npm start

## List of Features
- User Registration: Allows users to create an account with a username, email, password, and optional bio.
- User Login: Users can log in with their credentials to access the main features of the platform.
- Game Search Integration: Users can search for games using the RAWG Database API.
- Admin Dashboard: Admin users are permitted to a dashboard that displays a table of all registered users.
- Vue.js Frontend: Responsive and dynamic user interface built using Vue.js.
- API Integration: Utilises the RAWG API to fetch real-time game data.

## List of Functionality
- Register new users via a form submission that sends user input to the backend and inserts it into the MPUser table.
- Log in existing users: by sending login credentials to the server, verifying them, and redirecting based on role.
- Store and retrieve user data: securely from the MySQL database through SQL queries, this information can also be updated in a manage account section.
- Dynamic UI: with Vue.js, including real-time feedback messages for registration, login errors, or success.
- Fetch game data from RAWG API: when a search query is submitted, returning game titles, ratings, and release dates.
- Create personalised dashboard: Games from RAWG API can be stored in sections including Wishlist, Currently playing, Finished.
- Display user data in a formatted table for admin review, using async fetch requests to the /admin/users route.

No known bugs or limitations
