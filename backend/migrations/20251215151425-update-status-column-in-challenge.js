export async function up({ context: queryInterface }) {
  await queryInterface.sequelize.query(`
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1
        FROM pg_type t
        JOIN pg_enum e ON t.oid = e.enumtypid
        WHERE t.typname = 'enum_challenge_status'
          AND e.enumlabel = 'started'
      )
      AND NOT EXISTS (
        SELECT 1
        FROM pg_type t
        JOIN pg_enum e ON t.oid = e.enumtypid
        WHERE t.typname = 'enum_challenge_status'
          AND e.enumlabel = 'started_coding_phase'
      ) THEN
        ALTER TYPE "enum_challenge_status"
        RENAME VALUE 'started' TO 'started_coding_phase';
      END IF;
    END
    $$;

    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1
        FROM pg_type t
        JOIN pg_enum e ON t.oid = e.enumtypid
        WHERE t.typname = 'enum_challenge_status'
          AND e.enumlabel = 'ended'
      )
      AND NOT EXISTS (
        SELECT 1
        FROM pg_type t
        JOIN pg_enum e ON t.oid = e.enumtypid
        WHERE t.typname = 'enum_challenge_status'
          AND e.enumlabel = 'ended_coding_phase'
      ) THEN
        ALTER TYPE "enum_challenge_status"
        RENAME VALUE 'ended' TO 'ended_coding_phase';
      END IF;
    END
    $$;

    ALTER TYPE "enum_challenge_status" ADD VALUE IF NOT EXISTS 'started_peer_review';
    ALTER TYPE "enum_challenge_status" ADD VALUE IF NOT EXISTS 'ended_peer_review';
  `);
}

export async function down({ context: queryInterface }) {
  await queryInterface.sequelize.query(`
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1
        FROM pg_type t
        JOIN pg_enum e ON t.oid = e.enumtypid
        WHERE t.typname = 'enum_challenge_status'
          AND e.enumlabel = 'started_coding_phase'
      )
      AND NOT EXISTS (
        SELECT 1
        FROM pg_type t
        JOIN pg_enum e ON t.oid = e.enumtypid
        WHERE t.typname = 'enum_challenge_status'
          AND e.enumlabel = 'started'
      ) THEN
        ALTER TYPE "enum_challenge_status"
        RENAME VALUE 'started_coding_phase' TO 'started';
      END IF;
    END
    $$;

    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1
        FROM pg_type t
        JOIN pg_enum e ON t.oid = e.enumtypid
        WHERE t.typname = 'enum_challenge_status'
          AND e.enumlabel = 'ended_coding_phase'
      )
      AND NOT EXISTS (
        SELECT 1
        FROM pg_type t
        JOIN pg_enum e ON t.oid = e.enumtypid
        WHERE t.typname = 'enum_challenge_status'
          AND e.enumlabel = 'ended'
      ) THEN
        ALTER TYPE "enum_challenge_status"
        RENAME VALUE 'ended_coding_phase' TO 'ended';
      END IF;
    END
    $$;

  `);
}
