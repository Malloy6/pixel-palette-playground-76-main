CREATE DATABASE IF NOT EXISTS `tusome_online`
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE `tusome_online`;

CREATE TABLE IF NOT EXISTS users (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  email VARCHAR(255) NOT NULL UNIQUE,
  phone VARCHAR(40) NULL,
  first_name VARCHAR(120) NOT NULL,
  last_name VARCHAR(120) NOT NULL,
  role ENUM('learner', 'tutor', 'admin') NOT NULL DEFAULT 'learner',
  password_hash VARCHAR(255) NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  suspended_at TIMESTAMP NULL,
  suspension_reason TEXT NULL,
  terms_version VARCHAR(32) NULL,
  terms_accepted_at TIMESTAMP NULL,
  role_agreement_version VARCHAR(32) NULL,
  role_agreement_accepted_at TIMESTAMP NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS auth_sessions (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,
  token_hash CHAR(64) NOT NULL UNIQUE,
  user_agent VARCHAR(512) NULL,
  ip_address VARCHAR(64) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_seen_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP NOT NULL,
  revoked_at TIMESTAMP NULL,
  CONSTRAINT fk_auth_sessions_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_auth_sessions_user (user_id),
  INDEX idx_auth_sessions_expires (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS live_classes (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  subject VARCHAR(160) NOT NULL,
  grade VARCHAR(80) NOT NULL,
  tutor_name VARCHAR(160) NOT NULL,
  schedule_label VARCHAR(160) NOT NULL,
  seats_taken INT UNSIGNED NOT NULL DEFAULT 0,
  seats_total INT UNSIGNED NOT NULL DEFAULT 1,
  price_kes INT UNSIGNED NOT NULL DEFAULT 0,
  room_slug VARCHAR(180) NOT NULL UNIQUE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS conference_rooms (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  class_id BIGINT UNSIGNED NOT NULL,
  jitsi_domain VARCHAR(120) NOT NULL DEFAULT 'meet.jit.si',
  room_name VARCHAR(255) NOT NULL UNIQUE,
  started_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ended_at TIMESTAMP NULL,
  whiteboard_visible BOOLEAN NOT NULL DEFAULT FALSE,
  CONSTRAINT fk_conference_rooms_class FOREIGN KEY (class_id) REFERENCES live_classes(id) ON DELETE CASCADE,
  INDEX idx_conference_rooms_class (class_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS conference_participants (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  room_id BIGINT UNSIGNED NOT NULL,
  user_id BIGINT UNSIGNED NOT NULL,
  auth_session_id BIGINT UNSIGNED NULL,
  joined_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_seen_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  left_at TIMESTAMP NULL,
  duration_seconds INT UNSIGNED NOT NULL DEFAULT 0,
  CONSTRAINT fk_conference_participants_room FOREIGN KEY (room_id) REFERENCES conference_rooms(id) ON DELETE CASCADE,
  CONSTRAINT fk_conference_participants_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_conference_participants_session FOREIGN KEY (auth_session_id) REFERENCES auth_sessions(id) ON DELETE SET NULL,
  INDEX idx_conference_participants_user (user_id),
  INDEX idx_conference_participants_room (room_id),
  INDEX idx_conference_participants_active (left_at, last_seen_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS class_bookings (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  class_id BIGINT UNSIGNED NOT NULL,
  user_id BIGINT UNSIGNED NOT NULL,
  status ENUM('booked', 'cancelled', 'attended') NOT NULL DEFAULT 'booked',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_class_bookings_class FOREIGN KEY (class_id) REFERENCES live_classes(id) ON DELETE CASCADE,
  CONSTRAINT fk_class_bookings_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE KEY uniq_class_booking (class_id, user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO live_classes
  (subject, grade, tutor_name, schedule_label, seats_taken, seats_total, price_kes, room_slug)
VALUES
  ('Mathematics', 'Grade 7', 'Mr. Kamau', 'Mon & Wed · 6:00pm', 4, 8, 400, 'math-grade-7'),
  ('Integrated Science', 'Grade 8', 'Ms. Wanjiru', 'Tue & Thu · 5:00pm', 6, 10, 350, 'science-grade-8'),
  ('English', 'Grade 9', 'Mr. Otieno', 'Sat · 10:00am', 3, 8, 450, 'english-grade-9'),
  ('Kiswahili', 'Grade 7', 'Ms. Mwende', 'Fri · 4:30pm', 5, 10, 350, 'kiswahili-grade-7'),
  ('Social Studies', 'Grade 8', 'Mr. Njoroge', 'Wed · 6:30pm', 7, 12, 300, 'social-studies-grade-8'),
  ('Pre-Technical', 'Grade 9', 'Ms. Achieng', 'Sat · 2:00pm', 2, 8, 450, 'pre-technical-grade-9')
ON DUPLICATE KEY UPDATE
  subject = VALUES(subject),
  grade = VALUES(grade),
  tutor_name = VALUES(tutor_name),
  schedule_label = VALUES(schedule_label),
  seats_taken = VALUES(seats_taken),
  seats_total = VALUES(seats_total),
  price_kes = VALUES(price_kes),
  is_active = TRUE;
