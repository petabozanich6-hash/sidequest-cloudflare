-- Side Quest Learning: initial D1 schema (replaces MongoDB)

CREATE TABLE families (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  owner_id TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE users (
  id TEXT PRIMARY KEY,
  family_id TEXT NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT,
  name TEXT NOT NULL,
  picture TEXT,
  oauth_provider TEXT,
  is_owner INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT
);
CREATE INDEX idx_users_family ON users(family_id);

CREATE TABLE students (
  id TEXT PRIMARY KEY,
  family_id TEXT NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  username TEXT NOT NULL UNIQUE,
  pin_hash TEXT NOT NULL,
  birth_year INTEGER,
  stage TEXT NOT NULL,
  stage_name TEXT,
  year_level TEXT,
  band TEXT,
  theme TEXT,
  subject_levels TEXT NOT NULL DEFAULT '{}',
  interests TEXT NOT NULL DEFAULT '[]',
  electives TEXT NOT NULL DEFAULT '[]',
  notes TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX idx_students_family ON students(family_id);

CREATE TABLE pets (
  id TEXT PRIMARY KEY,
  student_id TEXT NOT NULL UNIQUE REFERENCES students(id) ON DELETE CASCADE,
  family_id TEXT NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  species TEXT NOT NULL,
  xp INTEGER NOT NULL DEFAULT 0,
  happiness INTEGER NOT NULL DEFAULT 80,
  background TEXT,
  accessories TEXT NOT NULL DEFAULT '[]',
  last_fed TEXT,
  last_played TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE pet_activity (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  pet_id TEXT NOT NULL REFERENCES pets(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL,
  reason TEXT NOT NULL,
  at TEXT NOT NULL
);
CREATE INDEX idx_pet_activity_pet ON pet_activity(pet_id);
