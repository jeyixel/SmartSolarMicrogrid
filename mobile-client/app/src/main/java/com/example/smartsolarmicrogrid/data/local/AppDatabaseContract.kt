package com.example.smartsolarmicrogrid.data.local

import android.provider.BaseColumns

/**
 * Defines database constants, table schemas, and SQL statements for the local SQLite database.
 */
object AppDatabaseContract {

    const val DATABASE_NAME = "smart_solar_microgrid.db"
    const val DATABASE_VERSION = 1

    /**
     * Contract definition for the auth_session table.
     * Caches the active user's session snapshot locally.
     */
    object AuthSessionEntry : BaseColumns {
        const val TABLE_NAME = "auth_session"
        const val COLUMN_ID = "id"
        const val COLUMN_NIC = "nic"
        const val COLUMN_FULL_NAME = "full_name"
        const val COLUMN_ROLE = "role"
        const val COLUMN_ACCOUNT_STATUS = "account_status"
        const val COLUMN_LOGGED_IN_AT = "logged_in_at"
    }

    /**
     * DDL to create the auth_session table.
     * Enforces the single-session constraint using `CHECK (id = 1)`.
     */
    const val SQL_CREATE_AUTH_SESSION = """
        CREATE TABLE ${AuthSessionEntry.TABLE_NAME} (
            ${AuthSessionEntry.COLUMN_ID} INTEGER PRIMARY KEY CHECK (${AuthSessionEntry.COLUMN_ID} = 1),
            ${AuthSessionEntry.COLUMN_NIC} TEXT NOT NULL,
            ${AuthSessionEntry.COLUMN_FULL_NAME} TEXT,
            ${AuthSessionEntry.COLUMN_ROLE} TEXT NOT NULL,
            ${AuthSessionEntry.COLUMN_ACCOUNT_STATUS} TEXT,
            ${AuthSessionEntry.COLUMN_LOGGED_IN_AT} INTEGER NOT NULL
        );
    """

    /**
     * SQL statement to clear the active session row (used during logout in Step 14.2).
     * Deletes the session record without dropping the table structure.
     */
    const val SQL_CLEAR_AUTH_SESSION = """
        DELETE FROM ${AuthSessionEntry.TABLE_NAME} WHERE ${AuthSessionEntry.COLUMN_ID} = 1;
    """
}
