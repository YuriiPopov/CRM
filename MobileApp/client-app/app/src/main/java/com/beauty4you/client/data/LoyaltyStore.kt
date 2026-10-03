package com.beauty4you.client.data

import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update

/**
 * Программа лояльности — ПОКА МОК: на backend нет ни баланса, ни наград, поэтому баллы живут в
 * памяти приложения (сбрасываются при перезапуске) и не синхронизируются с салоном. Интерфейс
 * оставлен таким, чтобы заменить реализацию на API без изменений в UI.
 */
class LoyaltyStore(initialPoints: Int = MockData.initialPoints) {
    val rewards: List<Reward> = MockData.rewards
    val earnRules: List<EarnRule> = MockData.earnRules

    private val _points = MutableStateFlow(initialPoints)
    val points: StateFlow<Int> = _points.asStateFlow()

    /** @return false, если баллов недостаточно. */
    fun redeem(rewardId: String): Boolean {
        val reward = rewards.first { it.id == rewardId }
        if (_points.value < reward.cost) return false
        _points.update { it - reward.cost }
        return true
    }
}
