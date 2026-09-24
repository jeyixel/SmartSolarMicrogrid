package com.example.smartsolarmicrogrid.data.local

import android.database.DatabaseUtils
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith

/**
 * Instrumented test verifying AuthSessionDao state transitions on a physical/virtual Android device.
 * Tests single-row guarantees, safe replacement, and cleanup without using real credentials.
 */
@RunWith(AndroidJUnit4::class)
class AuthSessionDaoTest {

    private lateinit var dbHelper: AppDatabaseHelper
    private lateinit var dao: AuthSessionDao

    @Before
    fun setUp() {
        val context = InstrumentationRegistry.getInstrumentation().targetContext
        dbHelper = AppDatabaseHelper.getInstance(context)
        dao = AuthSessionDao(dbHelper)
    }

    private fun queryDirectRowCount(): Long {
        val db = dbHelper.readableDatabase
        return DatabaseUtils.queryNumEntries(db, AppDatabaseContract.AuthSessionEntry.TABLE_NAME)
    }

    @Test
    fun testSessionLifecycleStateTransitions() {
        // --- 1. Action: Clear the local session ---
        dao.deleteSession()

        // Check immediately afterward: Read returns no session; row count is 0
        assertNull("Read should return null when session table is cleared", dao.readSession())
        assertFalse("hasSession should return false when table is empty", dao.hasSession())
        assertEquals("Direct SQLite row count should be 0", 0L, queryDirectRowCount())

        // --- 2. Action: Save fake user A ---
        val fakeUserA = AuthSessionEntity(
            id = 1L,
            nic = "000000000V",
            fullName = "Fake Test User A",
            role = "Prosumer",
            accountStatus = "Active",
            loggedInAt = 1700000000000L
        )
        val saveAResult = dao.saveSession(fakeUserA)
        assertTrue("Saving fake user A should succeed", saveAResult)

        // Check immediately afterward: Read returns A; row count is 1
        val readA = dao.readSession()
        assertNotNull("Read session should return an entity for user A", readA)
        assertEquals("000000000V", readA?.nic)
        assertEquals("Fake Test User A", readA?.fullName)
        assertEquals("Prosumer", readA?.role)
        assertEquals("Active", readA?.accountStatus)
        assertEquals(1700000000000L, readA?.loggedInAt)
        assertTrue("hasSession should return true for user A", dao.hasSession())
        assertEquals("Direct SQLite row count must be exactly 1 after saving user A", 1L, queryDirectRowCount())

        // --- 3. Action: Save fake user B ---
        val fakeUserB = AuthSessionEntity(
            id = 1L,
            nic = "111111111V",
            fullName = "Fake Test User B",
            role = "GridOperator",
            accountStatus = "Pending",
            loggedInAt = 1700000050000L
        )
        val saveBResult = dao.saveSession(fakeUserB)
        assertTrue("Saving fake user B should succeed", saveBResult)

        // Check immediately afterward: Read returns B, not A; row count remains 1
        val readB = dao.readSession()
        assertNotNull("Read session should return an entity for user B", readB)
        assertEquals("111111111V", readB?.nic)
        assertEquals("Fake Test User B", readB?.fullName)
        assertEquals("GridOperator", readB?.role)
        assertEquals("Pending", readB?.accountStatus)
        assertEquals(1700000050000L, readB?.loggedInAt)
        assertNotEquals("Read session should no longer match user A's NIC", "000000000V", readB?.nic)
        assertTrue("hasSession should return true for user B", dao.hasSession())
        assertEquals("Direct SQLite row count must remain exactly 1 after saving user B", 1L, queryDirectRowCount())

        // --- 4. Action: Update user B's profile (fullName and accountStatus) ---
        val updateResult = dao.updateCachedProfile(
            fullName = "Updated User B",
            accountStatus = "Active"
        )
        assertTrue("Updating cached profile should succeed", updateResult)

        // Check immediately afterward: new values appear, other fields and row count remain unchanged
        val readUpdated = dao.readSession()
        assertNotNull("Read session should return updated entity", readUpdated)
        assertEquals("111111111V", readUpdated?.nic)
        assertEquals("Updated User B", readUpdated?.fullName)
        assertEquals("GridOperator", readUpdated?.role)
        assertEquals("Active", readUpdated?.accountStatus)
        assertEquals(1700000050000L, readUpdated?.loggedInAt)
        assertEquals("Direct SQLite row count must remain 1 after profile update", 1L, queryDirectRowCount())

        // --- 5. Action: Clear fullName with updateFullName = true ---
        val clearResult = dao.updateCachedProfile(
            fullName = null,
            updateFullName = true
        )
        assertTrue("Clearing fullName should succeed", clearResult)

        // Check immediately afterward: fullName is null, other fields and row count remain unchanged
        val readCleared = dao.readSession()
        assertNotNull("Read session should return entity after clearing fullName", readCleared)
        assertEquals("111111111V", readCleared?.nic)
        assertNull("fullName should now be null", readCleared?.fullName)
        assertEquals("GridOperator", readCleared?.role)
        assertEquals("Active", readCleared?.accountStatus)
        assertEquals(1700000050000L, readCleared?.loggedInAt)
        assertEquals("Direct SQLite row count must remain 1 after clearing fullName", 1L, queryDirectRowCount())

        // --- 6. Action: Delete the session ---
        val deleteResult = dao.deleteSession()
        assertTrue("Deleting session should report success", deleteResult)

        // Check immediately afterward: Read returns no session; row count is 0
        assertNull("Read should return null after session deletion", dao.readSession())
        assertFalse("hasSession should return false after session deletion", dao.hasSession())
        assertEquals("Direct SQLite row count must be 0 after delete", 0L, queryDirectRowCount())
    }
}
