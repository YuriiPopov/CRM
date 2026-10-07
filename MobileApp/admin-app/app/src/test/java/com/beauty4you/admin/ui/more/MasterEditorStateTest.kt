package com.beauty4you.admin.ui.more

import com.beauty4you.admin.domain.Master
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

// «Usuń» в форме мастера: только у сохранённого мастера без записей, не во время сохранения (item80)
class MasterEditorStateTest {

    private val deletable = Master("m1", "Anna", canDelete = true)
    private val withBookings = Master("m2", "Beata", canDelete = false)

    @Test
    fun `delete is offered only for a saved master without bookings`() {
        assertTrue(MasterEditorState(original = deletable).canDelete)
        assertFalse(MasterEditorState(original = withBookings).canDelete)
        assertFalse("новый мастер ещё не сохранён", MasterEditorState().canDelete)
    }

    @Test
    fun `editor is busy while a delete request is in flight`() {
        assertTrue(MasterEditorState(original = deletable, saving = true).busy)
    }
}
