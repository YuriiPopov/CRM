package com.beauty4you.client.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.beauty4you.client.R
import com.beauty4you.client.ui.ClientViewModel
import com.beauty4you.client.ui.common.B4URowCard
import com.beauty4you.client.ui.common.OutlineButton
import com.beauty4you.client.ui.common.Overline
import com.beauty4you.client.ui.common.PagePadding
import com.beauty4you.client.ui.common.PushedHeader
import com.beauty4you.client.ui.common.VSpace
import com.beauty4you.client.ui.theme.Accent
import com.beauty4you.client.ui.theme.B4UType
import com.beauty4you.client.ui.theme.ChipBg
import com.beauty4you.client.ui.theme.DisabledBg
import com.beauty4you.client.ui.theme.DisabledFg
import com.beauty4you.client.ui.theme.Ink
import com.beauty4you.client.ui.theme.InkStrong
import com.beauty4you.client.ui.theme.LargeShape
import com.beauty4you.client.ui.theme.MutedLight
import com.beauty4you.client.ui.theme.OnDarkMuted

@Composable
fun LoyaltyScreen(vm: ClientViewModel) {
    val points by vm.points.collectAsStateWithLifecycle()
    // Ближайшая недоступная награда задаёт цель прогресс-бара (в прототипе захардкожен порог
    // 200 pkt; здесь — из списка наград, чтобы механика оставалась data-driven).
    val nextReward = vm.loyalty.rewards.sortedBy { it.cost }.firstOrNull { it.cost > points }
    val progress = nextReward?.let { points.toFloat() / it.cost } ?: 1f

    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(start = PagePadding, end = PagePadding, top = 8.dp, bottom = 40.dp),
    ) {
        PushedHeader(stringResource(R.string.loyalty_title), onBack = vm::back, large = true)

        VSpace(16.dp)
        Column(
            Modifier
                .fillMaxWidth()
                .clip(LargeShape)
                .background(Ink)
                .padding(20.dp),
        ) {
            Text(
                stringResource(R.string.loyalty_balance).uppercase(),
                style = B4UType.SmallLabel.copy(fontWeight = FontWeight.Normal, letterSpacing = 0.66.sp),
                color = OnDarkMuted,
            )
            Text(
                stringResource(R.string.points_value, points),
                style = B4UType.Balance,
                color = Color.White,
                modifier = Modifier.padding(vertical = 4.dp),
            )
            Text(
                if (nextReward != null) stringResource(R.string.loyalty_to_next, nextReward.name, nextReward.cost - points)
                else stringResource(R.string.loyalty_all_unlocked),
                style = B4UType.Caption,
                color = OnDarkMuted,
            )
            VSpace(10.dp)
            Box(
                Modifier
                    .fillMaxWidth()
                    .height(8.dp)
                    .clip(RoundedCornerShape(4.dp))
                    .background(Color.White.copy(alpha = 0.18f)),
            ) {
                Box(
                    Modifier
                        .fillMaxWidth(progress.coerceIn(0f, 1f))
                        .fillMaxHeight()
                        .clip(RoundedCornerShape(4.dp))
                        .background(Accent),
                )
            }
        }

        Overline(stringResource(R.string.loyalty_earn), Modifier.padding(top = 22.dp, bottom = 10.dp))
        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
            vm.loyalty.earnRules.forEach { rule ->
                B4URowCard(contentPadding = PaddingValues(horizontal = 14.dp, vertical = 12.dp)) {
                    Text(rule.label, style = B4UType.Body, color = InkStrong, modifier = Modifier.weight(1f))
                    Text(
                        stringResource(R.string.loyalty_earn_points, rule.points),
                        style = B4UType.Body.copy(fontWeight = FontWeight.Bold),
                        color = Accent,
                    )
                }
            }
        }

        Overline(stringResource(R.string.loyalty_redeem), Modifier.padding(top = 22.dp, bottom = 10.dp))
        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
            vm.loyalty.rewards.forEach { reward ->
                val affordable = points >= reward.cost
                B4URowCard(contentPadding = PaddingValues(horizontal = 14.dp, vertical = 12.dp)) {
                    Text(reward.name, style = B4UType.CardTitle, color = InkStrong, modifier = Modifier.weight(1f))
                    OutlineButton(
                        stringResource(R.string.points_value, reward.cost),
                        onClick = { vm.redeemReward(reward.id) },
                        background = if (affordable) ChipBg else DisabledBg,
                        color = if (affordable) Ink else DisabledFg,
                        enabled = affordable,
                        bold = true,
                    )
                }
            }
        }

        VSpace(14.dp)
        Text(stringResource(R.string.loyalty_disclaimer), style = B4UType.SmallLabel.copy(fontWeight = FontWeight.Normal, lineHeight = 16.sp), color = MutedLight)
    }
}
