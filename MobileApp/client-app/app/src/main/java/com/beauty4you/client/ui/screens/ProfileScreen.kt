package com.beauty4you.client.ui.screens

import android.content.ActivityNotFoundException
import android.content.Intent
import android.net.Uri
import androidx.annotation.DrawableRes
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.beauty4you.client.R
import com.beauty4you.client.data.Client
import com.beauty4you.client.ui.ClientViewModel
import com.beauty4you.client.ui.Tab
import com.beauty4you.client.ui.common.B4UCard
import com.beauty4you.client.ui.common.B4URowCard
import com.beauty4you.client.ui.common.EmojiTile
import com.beauty4you.client.ui.common.IconImageTile
import com.beauty4you.client.ui.common.Overline
import com.beauty4you.client.ui.common.PagePadding
import com.beauty4you.client.ui.common.ScreenTitle
import com.beauty4you.client.ui.common.VSpace
import com.beauty4you.client.ui.theme.Accent
import com.beauty4you.client.ui.theme.B4UType
import com.beauty4you.client.ui.theme.InkStrong
import com.beauty4you.client.ui.theme.Muted
import com.beauty4you.client.ui.theme.MutedLight

@Composable
fun ProfileScreen(vm: ClientViewModel, client: Client) {
    val points by vm.points.collectAsStateWithLifecycle()
    val context = LocalContext.current
    val contacts = vm.contacts

    fun open(uri: String?) {
        if (uri == null) {
            vm.showToast(R.string.soon)
            return
        }
        val action = if (uri.startsWith("tel:")) Intent.ACTION_DIAL else Intent.ACTION_VIEW
        try {
            context.startActivity(Intent(action, Uri.parse(uri)))
        } catch (_: ActivityNotFoundException) {
            vm.showToast(R.string.soon)
        }
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(start = PagePadding, end = PagePadding, top = 8.dp, bottom = 40.dp),
    ) {
        ScreenTitle(stringResource(R.string.tab_profile))

        VSpace(16.dp)
        B4URowCard(contentPadding = PaddingValues(14.dp)) {
            Box(
                Modifier.size(48.dp).clip(CircleShape).background(Accent),
                contentAlignment = Alignment.Center,
            ) {
                Text(client.initials, style = B4UType.RowTitle.copy(fontSize = 17.sp, fontWeight = FontWeight.Bold), color = Color.White)
            }
            Column(Modifier.weight(1f)) {
                Text(client.name, style = B4UType.RowTitle.copy(fontWeight = FontWeight.Bold), color = InkStrong)
                VSpace(1.dp)
                Text(client.phone, style = B4UType.Caption, color = Muted)
            }
        }

        VSpace(16.dp)
        Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
            NavRow(emoji = "⭐", title = stringResource(R.string.loyalty_title), subtitle = stringResource(R.string.points_value, points), onClick = vm::openLoyalty)
            NavRow(icon = R.drawable.ic_mail, title = stringResource(R.string.tab_news), subtitle = stringResource(R.string.profile_news_sub)) { vm.selectTab(Tab.NEWS) }
            NavRow(icon = R.drawable.ic_clock, title = stringResource(R.string.profile_history), subtitle = stringResource(R.string.profile_history_sub)) { vm.selectTab(Tab.BOOKINGS) }
            NavRow(emoji = "🎁", title = stringResource(R.string.profile_gift), subtitle = stringResource(R.string.profile_gift_sub)) { vm.showToast(R.string.soon) }
            NavRow(icon = R.drawable.ic_settings, title = stringResource(R.string.profile_settings), subtitle = stringResource(R.string.profile_settings_sub)) { vm.showToast(R.string.soon) }
            NavRow(emoji = "🚪", title = stringResource(R.string.profile_logout), subtitle = stringResource(R.string.profile_logout_sub), onClick = vm::logout)
        }

        Overline(stringResource(R.string.profile_contact), Modifier.padding(top = 22.dp, bottom = 10.dp))
        Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            ContactButton(R.drawable.ic_phone, stringResource(R.string.profile_call), Modifier.weight(1f)) { open("tel:${contacts.phone}") }
            ContactButton(R.drawable.ic_instagram, stringResource(R.string.profile_instagram), Modifier.weight(1f)) { open(contacts.instagramUrl) }
            ContactButton(R.drawable.ic_facebook, stringResource(R.string.profile_facebook), Modifier.weight(1f)) { open(contacts.facebookUrl) }
        }
    }
}

@Composable
private fun NavRow(
    title: String,
    subtitle: String,
    @DrawableRes icon: Int? = null,
    emoji: String? = null,
    onClick: () -> Unit,
) {
    B4URowCard(onClick = onClick, contentPadding = PaddingValues(horizontal = 16.dp, vertical = 14.dp)) {
        if (icon != null) IconImageTile(icon) else EmojiTile(emoji.orEmpty(), Modifier.size(36.dp), fontSize = 16)
        Column(Modifier.weight(1f).padding(start = 2.dp)) {
            Text(title, style = B4UType.RowTitle, color = InkStrong)
            VSpace(1.dp)
            Text(subtitle, style = B4UType.Caption, color = Muted)
        }
        Text("›", color = MutedLight, fontSize = 16.sp)
    }
}

@Composable
private fun ContactButton(@DrawableRes icon: Int, label: String, modifier: Modifier, onClick: () -> Unit) {
    B4UCard(modifier = modifier, onClick = onClick, contentPadding = PaddingValues(12.dp)) {
        Column(Modifier.align(Alignment.CenterHorizontally), horizontalAlignment = Alignment.CenterHorizontally) {
            IconImageTile(icon, size = 28.dp, shape = RoundedCornerShape(8.dp))
            VSpace(6.dp)
            Text(label, style = B4UType.Pill, color = InkStrong)
        }
    }
}
