package com.example.smartsolarmicrogrid.data.local

import android.content.Context
import android.database.sqlite.SQLiteDatabase
import android.database.sqlite.SQLiteOpenHelper
import android.util.Log

/**
 * SQLiteOpenHelper managing local database lifecycle and migrations.
 * Database is opened and created lazily when getWritableDatabase() or getReadableDatabase() is called.
 */
class AppDatabaseHelper private constructor(context: Context) : SQLiteOpenHelper(
    context.applicationContext,
    AppDatabaseContract.DATABASE_NAME,
    null,
    AppDatabaseContract.DATABASE_VERSION
) {

    override fun onCreate(db: SQLiteDatabase) {
        Log.i(TAG, "Creating database tables at version ${AppDatabaseContract.DATABASE_VERSION}...")
        db.execSQL(AppDatabaseContract.SQL_CREATE_AUTH_SESSION)
        Log.i(TAG, "auth_session table created successfully.")
    }

    override fun onUpgrade(db: SQLiteDatabase, oldVersion: Int, newVersion: Int) {
        Log.i(TAG, "Upgrading database from version $oldVersion to $newVersion...")

        var currentVersion = oldVersion
        while (currentVersion < newVersion) {
            when (currentVersion) {
                1 -> {
                    // When upgrading to version 2 in the future:
                    // 1. Add non-destructive schema modifications (e.g. ALTER TABLE ... ADD COLUMN ...).
                    // 2. Increment currentVersion to 2 to continue the loop.
                    throw IllegalStateException(
                        "Migration from version 1 to 2 is not yet defined. " +
                        "Implement explicit schema migration before incrementing DATABASE_VERSION."
                    )
                }
                else -> {
                    throw IllegalStateException(
                        "Unhandled database migration step from version $currentVersion to $newVersion."
                    )
                }
            }
        }
    }

    override fun onDowngrade(db: SQLiteDatabase, oldVersion: Int, newVersion: Int) {
        Log.w(TAG, "Downgrading database from version $oldVersion to $newVersion.")
        super.onDowngrade(db, oldVersion, newVersion)
    }

    companion object {
        private const val TAG = "AppDatabaseHelper"

        @Volatile
        private var instance: AppDatabaseHelper? = null

        /**
         * Returns the application-scoped singleton instance of AppDatabaseHelper.
         */
        fun getInstance(context: Context): AppDatabaseHelper {
            return instance ?: synchronized(this) {
                instance ?: AppDatabaseHelper(context.applicationContext).also { instance = it }
            }
        }
    }
}
