package com.example.smartsolarmicrogrid.data.local

import android.content.ContentValues
import android.content.Context
import android.database.Cursor
import android.database.sqlite.SQLiteDatabase
import android.util.Log

/**
 * Data Access Object managing local SQLite persistence for the single auth_session row.
 * Handles safe insertion, queries, profile updates, and session deletion.
 *
 * All operations interact exclusively with the single session slot (id = 1).
 */
class AuthSessionDao(private val dbHelper: AppDatabaseHelper) {

    constructor(context: Context) : this(AppDatabaseHelper.getInstance(context))

    /**
     * Saves or replaces the active authenticated user session in the single row with id = 1.
     *
     * Note: SQLite's CONFLICT_REPLACE algorithm deletes any existing conflicting row before
     * inserting the new row (a pre-delete + insert sequence, not an in-place update).
     * This replaces any older session safely in the single-row table.
     *
     * @param session The API-confirmed session entity to persist.
     * @return True if the row was inserted/replaced successfully, false otherwise.
     */
    fun saveSession(session: AuthSessionEntity): Boolean {
        val values = ContentValues().apply {
            put(AppDatabaseContract.AuthSessionEntry.COLUMN_ID, 1L)
            put(AppDatabaseContract.AuthSessionEntry.COLUMN_NIC, session.nic)
            put(AppDatabaseContract.AuthSessionEntry.COLUMN_FULL_NAME, session.fullName)
            put(AppDatabaseContract.AuthSessionEntry.COLUMN_ROLE, session.role)
            put(AppDatabaseContract.AuthSessionEntry.COLUMN_ACCOUNT_STATUS, session.accountStatus)
            put(AppDatabaseContract.AuthSessionEntry.COLUMN_LOGGED_IN_AT, session.loggedInAt)
        }

        return try {
            val db = dbHelper.writableDatabase
            val rowId = db.insertWithOnConflict(
                AppDatabaseContract.AuthSessionEntry.TABLE_NAME,
                null,
                values,
                SQLiteDatabase.CONFLICT_REPLACE
            )
            val success = rowId != -1L
            if (success) {
                Log.d(TAG, "Saved active session for role: ${session.role}")
            } else {
                Log.e(TAG, "Failed to insert/replace session row.")
            }
            success
        } catch (e: Exception) {
            Log.e(TAG, "Error saving session", e)
            false
        }
    }

    /**
     * Reads the current local session row wrapped in a Kotlin [Result].
     * Allows callers (such as Step 14.3 startup validators) to clearly distinguish between:
     * - [Result.success] with non-null entity: valid local session present.
     * - [Result.success] with null entity: table is empty (no local session).
     * - [Result.failure]: SQLite storage/database access error occurred.
     *
     * @return [Result] enclosing the [AuthSessionEntity] or null.
     */
    fun readSessionResult(): Result<AuthSessionEntity?> {
        return try {
            val db = dbHelper.readableDatabase
            val projection = arrayOf(
                AppDatabaseContract.AuthSessionEntry.COLUMN_ID,
                AppDatabaseContract.AuthSessionEntry.COLUMN_NIC,
                AppDatabaseContract.AuthSessionEntry.COLUMN_FULL_NAME,
                AppDatabaseContract.AuthSessionEntry.COLUMN_ROLE,
                AppDatabaseContract.AuthSessionEntry.COLUMN_ACCOUNT_STATUS,
                AppDatabaseContract.AuthSessionEntry.COLUMN_LOGGED_IN_AT
            )

            val selection = "${AppDatabaseContract.AuthSessionEntry.COLUMN_ID} = ?"
            val selectionArgs = arrayOf("1")

            val session = db.query(
                AppDatabaseContract.AuthSessionEntry.TABLE_NAME,
                projection,
                selection,
                selectionArgs,
                null,
                null,
                null
            ).use { cursor ->
                if (cursor.moveToFirst()) {
                    mapCursorToEntity(cursor)
                } else {
                    null
                }
            }
            Result.success(session)
        } catch (e: Exception) {
            Log.e(TAG, "Error reading session", e)
            Result.failure(e)
        }
    }

    /**
     * Convenience read method returning [AuthSessionEntity] or null.
     *
     * @return The active [AuthSessionEntity], or null if no session exists or if a read failure occurs.
     */
    fun readSession(): AuthSessionEntity? {
        return readSessionResult().getOrNull()
    }

    /**
     * Checks if a local session row exists.
     * NOTE: Local existence does NOT guarantee the user is currently authenticated with the backend.
     * It merely indicates a cached session snapshot is present.
     *
     * @return True if a local session record with id = 1 exists, false if absent or if an error occurs.
     */
    fun hasSession(): Boolean {
        return try {
            val db = dbHelper.readableDatabase
            val query = "SELECT 1 FROM ${AppDatabaseContract.AuthSessionEntry.TABLE_NAME} WHERE ${AppDatabaseContract.AuthSessionEntry.COLUMN_ID} = 1 LIMIT 1"

            db.rawQuery(query, null).use { cursor ->
                cursor.moveToFirst()
            }
        } catch (e: Exception) {
            Log.e(TAG, "Error checking session existence", e)
            false
        }
    }

    /**
     * Updates cached profile fields for the active session.
     * Supports updating non-null values, as well as explicitly clearing cached values to NULL
     * by setting [updateFullName] or [updateAccountStatus] to true while supplying null.
     *
     * @param fullName Updated display name from the API (or null).
     * @param accountStatus Updated account status from the API (or null).
     * @param updateFullName Whether to write the [fullName] value (including null) to the database.
     * @param updateAccountStatus Whether to write the [accountStatus] value (including null) to the database.
     * @return True if the update modified the row, false otherwise.
     */
    fun updateCachedProfile(
        fullName: String? = null,
        accountStatus: String? = null,
        updateFullName: Boolean = (fullName != null),
        updateAccountStatus: Boolean = (accountStatus != null)
    ): Boolean {
        if (!updateFullName && !updateAccountStatus) {
            return false
        }

        val values = ContentValues().apply {
            if (updateFullName) {
                if (fullName != null) {
                    put(AppDatabaseContract.AuthSessionEntry.COLUMN_FULL_NAME, fullName)
                } else {
                    putNull(AppDatabaseContract.AuthSessionEntry.COLUMN_FULL_NAME)
                }
            }
            if (updateAccountStatus) {
                if (accountStatus != null) {
                    put(AppDatabaseContract.AuthSessionEntry.COLUMN_ACCOUNT_STATUS, accountStatus)
                } else {
                    putNull(AppDatabaseContract.AuthSessionEntry.COLUMN_ACCOUNT_STATUS)
                }
            }
        }

        val whereClause = "${AppDatabaseContract.AuthSessionEntry.COLUMN_ID} = ?"
        val whereArgs = arrayOf("1")

        return try {
            val db = dbHelper.writableDatabase
            val rowsAffected = db.update(
                AppDatabaseContract.AuthSessionEntry.TABLE_NAME,
                values,
                whereClause,
                whereArgs
            )
            rowsAffected > 0
        } catch (e: Exception) {
            Log.e(TAG, "Error updating cached profile", e)
            false
        }
    }

    /**
     * Removes the active session record on logout.
     * Deletes the row with id = 1 without dropping or modifying the table structure.
     *
     * @return True if a session row was removed, false otherwise.
     */
    fun deleteSession(): Boolean {
        val whereClause = "${AppDatabaseContract.AuthSessionEntry.COLUMN_ID} = ?"
        val whereArgs = arrayOf("1")

        return try {
            val db = dbHelper.writableDatabase
            val rowsDeleted = db.delete(
                AppDatabaseContract.AuthSessionEntry.TABLE_NAME,
                whereClause,
                whereArgs
            )
            Log.d(TAG, "Deleted session rows: $rowsDeleted")
            rowsDeleted > 0
        } catch (e: Exception) {
            Log.e(TAG, "Error deleting session", e)
            false
        }
    }

    private fun mapCursorToEntity(cursor: Cursor): AuthSessionEntity {
        val idIndex = cursor.getColumnIndexOrThrow(AppDatabaseContract.AuthSessionEntry.COLUMN_ID)
        val nicIndex = cursor.getColumnIndexOrThrow(AppDatabaseContract.AuthSessionEntry.COLUMN_NIC)
        val fullNameIndex = cursor.getColumnIndexOrThrow(AppDatabaseContract.AuthSessionEntry.COLUMN_FULL_NAME)
        val roleIndex = cursor.getColumnIndexOrThrow(AppDatabaseContract.AuthSessionEntry.COLUMN_ROLE)
        val statusIndex = cursor.getColumnIndexOrThrow(AppDatabaseContract.AuthSessionEntry.COLUMN_ACCOUNT_STATUS)
        val loggedInAtIndex = cursor.getColumnIndexOrThrow(AppDatabaseContract.AuthSessionEntry.COLUMN_LOGGED_IN_AT)

        return AuthSessionEntity(
            id = cursor.getLong(idIndex),
            nic = cursor.getString(nicIndex),
            fullName = if (cursor.isNull(fullNameIndex)) null else cursor.getString(fullNameIndex),
            role = cursor.getString(roleIndex),
            accountStatus = if (cursor.isNull(statusIndex)) null else cursor.getString(statusIndex),
            loggedInAt = cursor.getLong(loggedInAtIndex)
        )
    }

    companion object {
        private const val TAG = "AuthSessionDao"
    }
}
